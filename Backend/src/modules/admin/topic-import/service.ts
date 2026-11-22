import { prisma } from "../../../core/prisma/client";
import { createNotifications } from "../../notification/notification.service";
import { STATUS_LABEL, TOPIC_COLUMNS, TOPIC_SPEC, professorName, type TopicKey } from "./columns";
import { parseImportFile } from "../import-kit/parser";
import { loadAcademicReference } from "../import-kit/academic";
import type { ImportReport, ReportRow } from "../import-kit/report";
import { annotatedBase64, buildReport, columnTexts, unreadableReport } from "../import-kit/pipeline";
import { buildTopicImportTemplate } from "./template";
import {
  buildContext,
  checkRow,
  professorsOf,
  withExisting,
  type ExistingTopic,
  type ReadyTopic,
  type Reference,
} from "./checks";

/**
 * استيراد مواضيع الأساتذة من ملفّ Excel — بخطوات الاستيراد المشتركة
 * (import-kit): المعاينة لا تكتب شيئاً، والاستيراد ينشئ الدفعة كلّها في
 * معاملةٍ واحدة أو لا ينشئ شيئاً.
 *
 * وكلّ موضوعٍ كما تنشئه نافذة «إنشاء موضوع»: بأستاذه وتخصّصه وسنته، وبقرار
 * الإدارة فيه — قيد الانتظار، أو تمت الموافقة، أو منشوراً للطلبة. ويُعلَم كلّ
 * أستاذٍ مرّةً واحدة بما أُضيف باسمه.
 */

/** الهيكل الجامعي والسنوات والأساتذة — يشترك فيه استيرادا المواضيع. */
export async function loadTopicReference(): Promise<Reference> {
  const [academic, professors] = await Promise.all([
    loadAcademicReference(),
    prisma.professor.findMany({
      select: {
        id: true,
        universityEmail: true,
        employeeNumber: true,
        departmentId: true,
        department: { select: { name: true } },
        user: {
          select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, status: true },
        },
      },
    }),
  ]);
  return { ...academic, professors };
}

export async function buildTopicTemplate(): Promise<Buffer> {
  const { specs, years, professors } = await loadTopicReference();
  return buildTopicImportTemplate({
    specs,
    years: years.filter((y) => !y.archivedAt),
    professors: professors.filter((p) => p.user.status !== "suspended"),
  });
}

/** مواضيع المنصّة لأساتذة الملف أو بعناوينه — بنداءٍ واحد لا بنداءٍ لكلّ صف. */
export async function loadExisting(professorIds: string[], titles: string[]): Promise<ExistingTopic[]> {
  if (!professorIds.length && !titles.length) return [];
  const topics = await prisma.graduationTopic.findMany({
    where: {
      OR: [
        ...(professorIds.length ? [{ professorId: { in: professorIds } }] : []),
        ...(titles.length ? [{ title: { in: titles } }] : []),
      ],
    },
    select: {
      title: true,
      status: true,
      professorId: true,
      academicYearId: true,
      academicYear: { select: { title: true } },
      professor: {
        select: {
          id: true,
          universityEmail: true,
          user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
        },
      },
    },
  });
  return topics.map((t) => ({
    title: t.title,
    status: t.status,
    professorId: t.professorId,
    academicYearId: t.academicYearId,
    professorName: professorName(t.professor) || t.professor.universityEmail,
    yearTitle: t.academicYear.title,
  }));
}

/** يحكم على كلّ خانة، ولا يكتب شيئاً. */
export async function validateTopicImport(
  buffer: Buffer,
): Promise<{ report: ImportReport; ready: ReadyTopic[]; annotatedFile?: string }> {
  const parsed = await parseImportFile(buffer, TOPIC_SPEC);
  if (parsed.fileErrors.length) return { report: unreadableReport(parsed, TOPIC_COLUMNS), ready: [] };

  const ref = await loadTopicReference();
  const base = buildContext(ref, parsed.rows);
  // الأساتذة أوّلاً — بهم تُجلب مواضيعهم الموجودة.
  const profOf = professorsOf(base, parsed.rows);
  const titles = [...new Set(columnTexts(parsed, "title").map((t) => t.replace(/\s+/g, " ").trim()))];
  const existing = await loadExisting([...new Set(profOf.values())], titles);
  const ctx = withExisting(base, parsed.rows, profOf, existing);

  const rows: ReportRow<TopicKey>[] = [];
  const ready: ReadyTopic[] = [];
  for (const raw of parsed.rows) {
    const out = checkRow(raw, ctx);
    rows.push(out.report);
    if (out.ready) ready.push(out.ready);
  }

  const report = buildReport(parsed, TOPIC_COLUMNS, rows);
  return {
    report,
    ready,
    annotatedFile: await annotatedBase64(buffer, parsed, report, TOPIC_COLUMNS, "topic-import"),
  };
}

export interface ImportedTopic {
  title: string;
  professor: string;
  specialization: string;
  status: string;
}

export type TopicImportOutcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | { ok: true; created: number; topics: ImportedTopic[] };

/** يُعيد الحكم، ثم ينشئ الدفعة كلّها أو لا شيء. التنبيهات لا تمنع؛ الأخطاء تمنع. */
export async function importTopics(buffer: Buffer): Promise<TopicImportOutcome> {
  const { report, ready, annotatedFile } = await validateTopicImport(buffer);
  if (report.fileErrors.length || report.summary.invalid > 0 || ready.length === 0)
    return { ok: false, report, annotatedFile };

  // معاملةٌ واحدة: إن سقط موضوعٌ سقطت الدفعة كلّها.
  const now = new Date();
  const created = await prisma.$transaction(
    ready.map((t) =>
      prisma.graduationTopic.create({
        data: {
          title: t.title,
          description: t.description,
          objectives: t.objectives,
          requirements: t.requirements,
          references: t.references,
          maxStudents: t.maxStudents,
          maxRequests: t.maxRequests,
          status: t.status,
          // النشر بتاريخه: الحالة إسقاطٌ يُعاد حسابه منه (core/topic/topic-status).
          publishedAt: t.status === "open" ? now : null,
          professorId: t.professorId,
          specializationId: t.specializationId,
          academicYearId: t.academicYearId,
        },
        select: {
          title: true,
          status: true,
          specialization: { select: { name: true } },
          professor: {
            select: {
              userId: true,
              universityEmail: true,
              user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
            },
          },
        },
      }),
    ),
  );

  // لكلّ أستاذٍ إشعارٌ واحد بما أُضيف باسمه — لا جرسٌ لكلّ موضوع. وبعد
  // المعاملة: إشعارٌ تعذّر لا يُسقط مواضيع أُنشئت.
  const byProfessor = new Map<string, string[]>();
  for (const t of created)
    byProfessor.set(t.professor.userId, [...(byProfessor.get(t.professor.userId) ?? []), t.title]);
  try {
    await createNotifications(
      [...byProfessor].map(([userId, titles]) => ({
        userId,
        type: "general" as const,
        title: { key: "notif.topicsImported.title" as const, params: { count: titles.length } },
        message: { key: "notif.topicsImported.message" as const, params: { count: titles.length, title: titles[0]! } },
        link: "/professor/topics",
      })),
    );
  } catch (e) {
    console.error("[topic-import] notifications failed:", e);
  }

  return {
    ok: true,
    created: created.length,
    topics: created.map((t) => ({
      title: t.title,
      professor: professorName(t.professor) || t.professor.universityEmail,
      specialization: t.specialization.name,
      // أُنشئ للتوّ بحالةٍ من حالات الاستيراد الثلاث، ولكلٍّ منها اسمها.
      status: STATUS_LABEL[t.status as keyof typeof STATUS_LABEL],
    })),
  };
}
