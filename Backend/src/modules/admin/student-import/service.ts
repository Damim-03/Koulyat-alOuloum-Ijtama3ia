import { prisma } from "../../../core/prisma/client";
import { config } from "../../../core/config/app.config";
import { IMPORT_COLUMNS, STUDENT_SPEC, type ColumnKey } from "./columns";
import { parseImportFile, type ParsedFile } from "../import-kit/parser";
import { buildAccountsFile } from "../import-kit/files";
import { hashMany } from "../import-kit/hash-many";
import type { ImportReport, ReportRow } from "../import-kit/report";
import {
  annotatedBase64,
  buildReport,
  columnTexts,
  fullName,
  generatePassword,
  loadTakenMails,
  unreadableReport,
} from "../import-kit/pipeline";
import { buildImportTemplate } from "./template";
import {
  buildContext,
  checkRow,
  fullNameKey,
  regDigits,
  type ReadyStudent,
  type Reference,
  type RefSpec,
  type Taken,
} from "./checks";

export type { ImportReport } from "../import-kit/report";

/**
 * استيراد الطلبة من ملفّ Excel — بخطوات الاستيراد المشتركة (import-kit).
 *
 * ولكلّ طالبٍ حسابُه وملفّه معاً (إنشاءٌ متداخل)، فلا يبقى حسابٌ بلا طالب ولا
 * طالبٌ بلا حساب.
 */

async function loadReference(): Promise<Reference> {
  const [specs, years, faculties, departments, filieres] = await Promise.all([
    prisma.specialization.findMany({
      select: {
        id: true,
        name: true,
        level: true,
        filiere: {
          select: {
            id: true,
            name: true,
            department: {
              select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      select: { id: true, title: true, isActive: true, archivedAt: true },
      orderBy: { title: "desc" },
    }),
    prisma.faculty.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, facultyId: true } }),
    prisma.filiere.findMany({ select: { id: true, name: true, departmentId: true } }),
  ]);
  return { specs: specs as RefSpec[], years, faculties, departments, filieres };
}

export async function buildStudentImportTemplate(): Promise<Buffer> {
  const { specs, years } = await loadReference();
  return buildImportTemplate({ specs, years: years.filter((y) => !y.archivedAt) });
}

/** ما سبق إلى المنصّة ممّا في الملف — بثلاثة نداءاتٍ لا بنداءٍ لكلّ صف. */
async function loadTaken(parsed: ParsedFile<ColumnKey>): Promise<Taken> {
  const regs = [...new Set(columnTexts(parsed, "registrationNumber").map(regDigits))];
  const lastNames = [...new Set(columnTexts(parsed, "lastName").map((s) => s.replace(/\s+/g, " ")))];

  const [students, mails, namesakes] = await Promise.all([
    regs.length
      ? prisma.student.findMany({
          where: { registrationNumber: { in: regs } },
          select: {
            registrationNumber: true,
            user: { select: { firstName: true, lastName: true } },
            specialization: { select: { name: true } },
          },
        })
      : [],
    loadTakenMails(columnTexts(parsed, "email")),
    lastNames.length
      ? prisma.user.findMany({
          where: { role: "student", lastName: { in: lastNames } },
          select: {
            firstName: true,
            lastName: true,
            student: { select: { registrationNumber: true } },
          },
        })
      : [],
  ]);

  const names = new Map<string, { registrationNumber: string }[]>();
  for (const u of namesakes) {
    if (!u.firstName || !u.lastName || !u.student) continue;
    const k = fullNameKey(u.firstName, u.lastName);
    names.set(k, [...(names.get(k) ?? []), { registrationNumber: u.student.registrationNumber }]);
  }
  return {
    regs: new Map(
      students.map((s) => [
        s.registrationNumber,
        { name: fullName(s.user), specialization: s.specialization.name },
      ]),
    ),
    mails,
    names,
  };
}

/** يحكم على كلّ خانة، ولا يكتب شيئاً. */
export async function validateStudentImport(
  buffer: Buffer,
): Promise<{ report: ImportReport; ready: ReadyStudent[]; annotatedFile?: string }> {
  const parsed = await parseImportFile(buffer, STUDENT_SPEC);
  if (parsed.fileErrors.length) return { report: unreadableReport(parsed, IMPORT_COLUMNS), ready: [] };

  const [ref, taken] = await Promise.all([loadReference(), loadTaken(parsed)]);
  const ctx = buildContext(ref, parsed.rows, taken);

  const rows: ReportRow<ColumnKey>[] = [];
  const ready: ReadyStudent[] = [];
  for (const raw of parsed.rows) {
    const out = checkRow(raw, ctx);
    rows.push(out.report);
    if (out.ready) ready.push(out.ready);
  }

  const report = buildReport(parsed, IMPORT_COLUMNS, rows);
  return {
    report,
    ready,
    annotatedFile: await annotatedBase64(buffer, parsed, report, IMPORT_COLUMNS, "student-import"),
  };
}

export interface ImportedAccount {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  /** المولَّدة وحدها — ما كُتب في الملف عند المسؤول أصلاً. */
  password: string | null;
}

export type ImportOutcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | { ok: true; created: number; accounts: ImportedAccount[]; accountsFile: string };

/** يُعيد الحكم، ثم ينشئ الدفعة كلّها أو لا أحد. التنبيهات لا تمنع؛ الأخطاء تمنع. */
export async function importStudents(buffer: Buffer): Promise<ImportOutcome> {
  const { report, ready, annotatedFile } = await validateStudentImport(buffer);
  if (report.fileErrors.length || report.summary.invalid > 0 || ready.length === 0)
    return { ok: false, report, annotatedFile };

  const passwords = ready.map((s) => s.password ?? generatePassword());
  const hashes = await hashMany(passwords, config.BCRYPT_ROUNDS);

  // معاملةٌ واحدة: إن سقط صفٌّ — سبقه أحدٌ إلى رقمٍ بين المعاينة والاستيراد
  // مثلاً — سقطت الدفعة كلّها، وردّ معالج الأخطاء بالحقل المتعارض.
  await prisma.$transaction(
    ready.map((s, i) =>
      prisma.student.create({
        data: {
          registrationNumber: s.registrationNumber,
          specialization: { connect: { id: s.specializationId } },
          academicYear: { connect: { id: s.academicYearId } },
          user: {
            create: {
              firstName: s.firstName,
              lastName: s.lastName,
              firstNameLatin: s.firstNameLatin,
              lastNameLatin: s.lastNameLatin,
              email: s.email,
              phone: s.phone,
              gender: s.gender,
              isVerified: s.isVerified,
              password: hashes[i]!,
              role: "student",
            },
          },
        },
        select: { id: true },
      }),
    ),
  );

  const accounts = ready.map((s, i) => ({
    registrationNumber: s.registrationNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    password: s.password ? null : passwords[i]!,
  }));
  const file = await buildAccountsFile(
    [
      { header: "رقم التسجيل", width: 18 },
      { header: "الاسم", width: 18 },
      { header: "اللقب", width: 18 },
      { header: "كلمة المرور الأوّلية", width: 22 },
    ],
    accounts.map((a) => [a.registrationNumber, a.firstName, a.lastName, a.password]),
  );
  return { ok: true, created: ready.length, accounts, accountsFile: file.toString("base64") };
}
