import { prisma } from "../../../core/prisma/client";
import { config } from "../../../core/config/app.config";
import { randomEmployeeNumber } from "../admin.service";
import { PROFESSOR_COLUMNS, PROFESSOR_SPEC, type ProfessorKey } from "./columns";
import { parseImportFile, type ParsedFile } from "../import-kit/parser";
import { buildAccountsFile } from "../import-kit/files";
import { hashMany } from "../import-kit/hash-many";
import { compactDigits, fullNameKey } from "../import-kit/fields";
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
import { buildProfessorImportTemplate } from "./template";
import { buildContext, checkRow, type ReadyProfessor, type Reference, type Taken } from "./checks";

/**
 * استيراد الأساتذة من ملفّ Excel — بخطوات الاستيراد المشتركة (import-kit)،
 * وبقاعدة خدمة «إضافة أستاذ» نفسها: نطاق البريد الجامعي من المنصّة، والرقم
 * الوظيفي يُولَّد بصيغة EAN-13 إن تُرك. ولكلّ أستاذٍ حسابُه وملفّه معاً.
 */

async function loadReference(): Promise<Reference> {
  const [faculties, departments, domains] = await Promise.all([
    prisma.faculty.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      select: { id: true, name: true, facultyId: true, faculty: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.universityDomain.findMany({ select: { domain: true }, orderBy: { domain: "asc" } }),
  ]);
  return { faculties, departments, domains: domains.map((d) => d.domain.toLowerCase()) };
}

export async function buildProfessorTemplate(): Promise<Buffer> {
  const { departments, domains } = await loadReference();
  return buildProfessorImportTemplate({ departments, domains });
}

/** ما سبق إلى المنصّة ممّا في الملف — بأربعة نداءاتٍ لا بنداءٍ لكلّ صف. */
async function loadTaken(parsed: ParsedFile<ProfessorKey>): Promise<Taken> {
  const uni = [...new Set(columnTexts(parsed, "universityEmail").map((m) => m.toLowerCase()))];
  const emp = [...new Set(columnTexts(parsed, "employeeNumber").map(compactDigits))];
  const lastNames = [...new Set(columnTexts(parsed, "lastName").map((s) => s.replace(/\s+/g, " ")))];

  const who = { user: { select: { firstName: true, lastName: true } } } as const;
  const [byUni, byEmp, mails, namesakes] = await Promise.all([
    uni.length
      ? prisma.professor.findMany({ where: { universityEmail: { in: uni } }, select: { universityEmail: true, ...who } })
      : [],
    emp.length
      ? prisma.professor.findMany({ where: { employeeNumber: { in: emp } }, select: { employeeNumber: true, ...who } })
      : [],
    loadTakenMails(columnTexts(parsed, "email")),
    lastNames.length
      ? prisma.user.findMany({
          where: { role: "professor", lastName: { in: lastNames } },
          select: { firstName: true, lastName: true, professor: { select: { universityEmail: true } } },
        })
      : [],
  ]);

  const names = new Map<string, string[]>();
  for (const u of namesakes) {
    if (!u.firstName || !u.lastName || !u.professor) continue;
    const k = fullNameKey(u.firstName, u.lastName);
    names.set(k, [...(names.get(k) ?? []), u.professor.universityEmail]);
  }
  return {
    universityEmails: new Map(byUni.map((p) => [p.universityEmail.toLowerCase(), { name: fullName(p.user) }])),
    employeeNumbers: new Map(byEmp.map((p) => [p.employeeNumber, { name: fullName(p.user) }])),
    mails,
    names,
  };
}

/** يحكم على كلّ خانة، ولا يكتب شيئاً. */
export async function validateProfessorImport(
  buffer: Buffer,
): Promise<{ report: ImportReport; ready: ReadyProfessor[]; annotatedFile?: string }> {
  const parsed = await parseImportFile(buffer, PROFESSOR_SPEC);
  if (parsed.fileErrors.length) return { report: unreadableReport(parsed, PROFESSOR_COLUMNS), ready: [] };

  const [ref, taken] = await Promise.all([loadReference(), loadTaken(parsed)]);
  const ctx = buildContext(ref, parsed.rows, taken);

  const rows: ReportRow<ProfessorKey>[] = [];
  const ready: ReadyProfessor[] = [];
  for (const raw of parsed.rows) {
    const out = checkRow(raw, ctx);
    rows.push(out.report);
    if (out.ready) ready.push(out.ready);
  }

  const report = buildReport(parsed, PROFESSOR_COLUMNS, rows);
  return {
    report,
    ready,
    annotatedFile: await annotatedBase64(buffer, parsed, report, PROFESSOR_COLUMNS, "professor-import"),
  };
}

/**
 * أرقامٌ وظيفية لمن لم يُكتب رقمه: فريدةٌ فيما بينها، وفيما كُتب في الملف،
 * وفي المنصّة — بنداءٍ واحد لكلّ جولة، لا بنداءٍ لكلّ رقم.
 */
async function freshEmployeeNumbers(count: number, reserved: Set<string>): Promise<string[]> {
  const out = new Set<string>();
  for (let round = 0; out.size < count && round < 10; round++) {
    const batch = new Set<string>();
    while (batch.size < count - out.size) {
      const n = randomEmployeeNumber();
      if (!reserved.has(n) && !out.has(n)) batch.add(n);
    }
    const taken = await prisma.professor.findMany({
      where: { employeeNumber: { in: [...batch] } },
      select: { employeeNumber: true },
    });
    const used = new Set(taken.map((t) => t.employeeNumber));
    for (const n of batch) if (!used.has(n)) out.add(n);
  }
  if (out.size < count) throw new Error("تعذّر توليد أرقامٍ وظيفية فريدة — أعد المحاولة.");
  return [...out];
}

export interface ImportedProfessor {
  employeeNumber: string;
  universityEmail: string;
  firstName: string;
  lastName: string;
  /** المولَّدة وحدها — ما كُتب في الملف عند المسؤول أصلاً. */
  password: string | null;
}

export type ProfessorImportOutcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | { ok: true; created: number; accounts: ImportedProfessor[]; accountsFile: string };

/** يُعيد الحكم، ثم ينشئ الدفعة كلّها أو لا أحد. التنبيهات لا تمنع؛ الأخطاء تمنع. */
export async function importProfessors(buffer: Buffer): Promise<ProfessorImportOutcome> {
  const { report, ready, annotatedFile } = await validateProfessorImport(buffer);
  if (report.fileErrors.length || report.summary.invalid > 0 || ready.length === 0)
    return { ok: false, report, annotatedFile };

  const given = new Set(ready.map((p) => p.employeeNumber).filter((n): n is string => !!n));
  const fresh = await freshEmployeeNumbers(ready.filter((p) => !p.employeeNumber).length, given);
  const numbers = ready.map((p) => p.employeeNumber ?? fresh.shift()!);
  const passwords = ready.map((p) => p.password ?? generatePassword());
  const hashes = await hashMany(passwords, config.BCRYPT_ROUNDS);

  // معاملةٌ واحدة: إن سقط صفٌّ — سبقه أحدٌ إلى بريدٍ بين المعاينة والاستيراد
  // مثلاً — سقطت الدفعة كلّها، وردّ معالج الأخطاء بالحقل المتعارض.
  await prisma.$transaction(
    ready.map((p, i) =>
      prisma.professor.create({
        data: {
          employeeNumber: numbers[i]!,
          universityEmail: p.universityEmail,
          grade: p.grade,
          tags: p.tags,
          department: { connect: { id: p.departmentId } },
          user: {
            create: {
              firstName: p.firstName,
              lastName: p.lastName,
              firstNameLatin: p.firstNameLatin,
              lastNameLatin: p.lastNameLatin,
              email: p.email,
              phone: p.phone,
              gender: p.gender,
              isVerified: p.isVerified,
              password: hashes[i]!,
              role: "professor",
            },
          },
        },
        select: { id: true },
      }),
    ),
  );

  const accounts = ready.map((p, i) => ({
    employeeNumber: numbers[i]!,
    universityEmail: p.universityEmail,
    firstName: p.firstName,
    lastName: p.lastName,
    password: p.password ? null : passwords[i]!,
  }));
  const file = await buildAccountsFile(
    [
      { header: "الرقم الوظيفي", width: 18 },
      { header: "البريد الجامعي (للدخول)", width: 32 },
      { header: "الاسم", width: 18 },
      { header: "اللقب", width: 18 },
      { header: "كلمة المرور الأوّلية", width: 22 },
    ],
    accounts.map((a) => [a.employeeNumber, a.universityEmail, a.firstName, a.lastName, a.password]),
  );
  return { ok: true, created: ready.length, accounts, accountsFile: file.toString("base64") };
}
