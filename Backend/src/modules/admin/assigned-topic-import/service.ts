import { prisma } from "../../../core/prisma/client";
import { computeTopicStatus } from "../../../core/topic/topic-status";
import { BadRequestException } from "../../../core/utils/appErros";
import { ErrorCodeEnum } from "../../../core/enums/error-code.enum";
import { createNotifications } from "../../notification/notification.service";
import { ASSIGNED_COLUMNS, ASSIGNED_SPEC, STUDENT_KEYS, type AssignedKey } from "./columns";
import { personName } from "../topic-import/columns";
import { parseImportFile } from "../import-kit/parser";
import { sep } from "../import-kit/match";
import type { ImportReport, ReportRow } from "../import-kit/report";
import { annotatedBase64, buildReport, columnTexts, unreadableReport } from "../import-kit/pipeline";
import { buildContext, professorsOf, withExisting } from "../topic-import/checks";
import { loadExisting, loadTopicReference } from "../topic-import/service";
import { buildAssignedTopicImportTemplate } from "./template";
import { checkRow, regOf, withStudents, type ReadyAssigned, type RefStudent } from "./checks";
import { tr } from "../../../core/i18n";

/**
 * استيراد المواضيع المُسنَدة من ملفّ Excel — «إنشاء موضوع وإسناده» دفعةً:
 * لكلّ صفٍّ موضوعٌ ومجموعةٌ بطلبتها، والأوّل منهم المرسِل.
 *
 * بخطوات الاستيراد المشتركة: المعاينة لا تكتب شيئاً، والاستيراد ينشئ الدفعة
 * كلّها في معاملةٍ واحدة أو لا شيء. وكما في `createAssignedTopicService`:
 * الموضوع «تمت الموافقة» وغير منشور — لم يُعرَض على الطلبة قطّ — وإسقاط
 * الحالة يقرأ المجموعة فيجعله «مسنداً».
 */

export async function buildAssignedTopicTemplate(): Promise<Buffer> {
  const { specs, years, professors } = await loadTopicReference();
  return buildAssignedTopicImportTemplate({
    specs,
    years: years.filter((y) => !y.archivedAt),
    professors: professors.filter((p) => p.user.status !== "suspended"),
  });
}

/** «قائم»: قيد الانتظار أو مقبول — كمرشّح الطلبة «unassigned». */
const LIVE = { in: ["pending", "accepted"] as ("pending" | "accepted")[] };

/** طلبة الملف — بمذكراتهم وطلباتهم القائمة — بنداءٍ واحد. */
async function loadStudents(regs: string[]): Promise<RefStudent[]> {
  if (!regs.length) return [];
  const rows = await prisma.student.findMany({
    where: { registrationNumber: { in: regs } },
    select: {
      id: true,
      userId: true,
      registrationNumber: true,
      specializationId: true,
      academicYearId: true,
      specialization: { select: { name: true } },
      academicYear: { select: { title: true } },
      user: {
        select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, status: true },
      },
      projectMembers: { select: { group: { select: { topic: { select: { title: true } } } } }, take: 1 },
      ledGroupRequests: { where: { status: LIVE }, select: { topic: { select: { title: true } } }, take: 1 },
      groupRequestMembers: {
        where: { request: { status: LIVE } },
        select: { request: { select: { topic: { select: { title: true } } } } },
        take: 1,
      },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    userId: s.userId,
    registrationNumber: s.registrationNumber,
    name: personName(s) || s.registrationNumber,
    suspended: s.user.status === "suspended",
    specializationId: s.specializationId,
    specialization: s.specialization.name,
    academicYearId: s.academicYearId,
    year: s.academicYear.title,
    project: s.projectMembers[0]?.group.topic.title,
    request: s.ledGroupRequests[0]?.topic.title ?? s.groupRequestMembers[0]?.request.topic.title,
  }));
}

/** يحكم على كلّ خانة، ولا يكتب شيئاً. */
export async function validateAssignedTopicImport(
  buffer: Buffer,
): Promise<{ report: ImportReport; ready: ReadyAssigned[]; annotatedFile?: string }> {
  const parsed = await parseImportFile(buffer, ASSIGNED_SPEC);
  if (parsed.fileErrors.length) return { report: unreadableReport(parsed, ASSIGNED_COLUMNS), ready: [] };

  const ref = await loadTopicReference();
  const base = buildContext(ref, parsed.rows);
  const profOf = professorsOf(base, parsed.rows);
  const titles = [...new Set(columnTexts(parsed, "title").map((t) => t.replace(/\s+/g, " ").trim()))];
  // كما كُتب، وبلا مسافاتٍ ولا شرطات — فالمقعد يطابق بأيّهما.
  const regs = [
    ...new Set(STUDENT_KEYS.flatMap((k) => columnTexts(parsed, k).flatMap((t) => [t.trim(), regOf(t)])).filter(Boolean)),
  ];
  const [existing, students] = await Promise.all([
    loadExisting([...new Set(profOf.values())], titles),
    loadStudents(regs),
  ]);
  const ctx = withStudents(withExisting(base, parsed.rows, profOf, existing), parsed.rows, students);

  const rows: ReportRow<AssignedKey>[] = [];
  const ready: ReadyAssigned[] = [];
  for (const raw of parsed.rows) {
    const out = checkRow(raw, ctx);
    rows.push(out.report);
    if (out.ready) ready.push(out.ready);
  }

  const report = buildReport(parsed, ASSIGNED_COLUMNS, rows);
  return {
    report,
    ready,
    annotatedFile: await annotatedBase64(buffer, parsed, report, ASSIGNED_COLUMNS, "assigned-topic-import"),
  };
}

export interface ImportedAssignedTopic {
  title: string;
  professor: string;
  /** أسماء الطلبة بترتيب مقاعدهم — والأوّل المرسِل. */
  students: string;
  specialization: string;
}

export type AssignedTopicImportOutcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | { ok: true; created: number; assigned: number; topics: ImportedAssignedTopic[] };

/** يُعيد الحكم، ثم ينشئ الدفعة كلّها أو لا شيء. التنبيهات لا تمنع؛ الأخطاء تمنع. */
export async function importAssignedTopics(buffer: Buffer): Promise<AssignedTopicImportOutcome> {
  const { report, ready, annotatedFile } = await validateAssignedTopicImport(buffer);
  if (report.fileErrors.length || report.summary.invalid > 0 || ready.length === 0)
    return { ok: false, report, annotatedFile };

  const studentIds = ready.flatMap((t) => t.members.map((m) => m.id));
  const created = await prisma.$transaction(
    async (tx) => {
      // بين المعاينة وهذه اللحظة ربّما أُسند طالبٌ أو قدّم طلباً — ولا قيدَ في
      // القاعدة يمنع طالباً من مجموعتين. فيُسأل ثانيةً داخل المعاملة.
      const taken = await tx.student.findFirst({
        where: {
          id: { in: studentIds },
          OR: [
            { projectMembers: { some: {} } },
            { ledGroupRequests: { some: { status: LIVE } } },
            { groupRequestMembers: { some: { request: { status: LIVE } } } },
          ],
        },
        select: { registrationNumber: true },
      });
      if (taken)
        throw new BadRequestException(
          tr("assigned.importRaced", { reg: taken.registrationNumber }),
          ErrorCodeEnum.VALIDATION_ERROR,
        );

      const out = [];
      for (const t of ready) {
        const topic = await tx.graduationTopic.create({
          data: {
            title: t.title,
            description: t.description,
            objectives: t.objectives,
            requirements: t.requirements,
            references: t.references,
            maxStudents: t.maxStudents,
            maxRequests: t.maxRequests,
            // قرار الإدارة: تمت الموافقة. و«مسند» نتيجة المجموعة أدناه لا قرار،
            // يقرؤها الإسقاط. و`publishedAt` يبقى فارغاً: لم يُعرَض على الطلبة.
            status: "approved",
            professorId: t.professorId,
            specializationId: t.specializationId,
            academicYearId: t.academicYearId,
          },
          select: { id: true },
        });
        const group = await tx.projectGroup.create({ data: { topicId: topic.id }, select: { id: true } });
        await tx.projectMember.createMany({
          data: t.members.map((m, i) => ({ groupId: group.id, studentId: m.id, isLeader: i === 0 })),
        });
        await computeTopicStatus(tx, topic.id);
        const saved = await tx.graduationTopic.findUniqueOrThrow({
          where: { id: topic.id },
          select: {
            title: true,
            specialization: { select: { name: true } },
            professor: {
              select: {
                userId: true,
                universityEmail: true,
                user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
              },
            },
          },
        });
        out.push({ ...saved, members: t.members });
      }
      return out;
    },
    // ألف موضوعٍ بمجموعاتها أطول من مهلة المعاملة الافتراضية (5 ثوانٍ).
    { timeout: 120_000, maxWait: 10_000 },
  );

  // بعد المعاملة: إشعارٌ تعذّر لا يُسقط ما أُنشئ. للطلبة كما في النافذة، ولكلّ
  // أستاذٍ إشعارٌ واحد بما أُسند تحت إشرافه.
  const byProfessor = new Map<string, string[]>();
  for (const t of created)
    byProfessor.set(t.professor.userId, [...(byProfessor.get(t.professor.userId) ?? []), t.title]);
  try {
    await createNotifications([
      ...created.flatMap((t) =>
        t.members.map((m) => ({
          userId: m.userId,
          type: "general" as const,
          title: { key: "notif.assignedToTopic.title" as const },
          message: { key: "notif.assignedToTopic.message" as const, params: { title: t.title } },
          link: "/student/project",
        })),
      ),
      ...[...byProfessor].map(([userId, titles]) => ({
        userId,
        type: "general" as const,
        title: { key: "notif.assignedImported.title" as const, params: { count: titles.length } },
        message: { key: "notif.assignedImported.message" as const, params: { count: titles.length, title: titles[0]! } },
        link: "/professor/topics",
      })),
    ]);
  } catch (e) {
    console.error("[assigned-topic-import] notifications failed:", e);
  }

  const assigned = created.reduce((n, t) => n + t.members.length, 0);
  return {
    ok: true,
    created: created.length,
    assigned,
    topics: created.map((t) => ({
      title: t.title,
      professor: personName(t.professor) || t.professor.universityEmail,
      students: t.members.map((m) => m.name).join(sep()),
      specialization: t.specialization.name,
    })),
  };
}
