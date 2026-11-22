import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage } from "../../core/i18n";
import { imageUrl } from "../../core/validation/image-url";

/**
 * ============================================================
 * ورقة «طلب الموافقة على الإشراف» — نصوصها وشعاراها
 * ============================================================
 *
 * تعدّلها الإدارة من «واجهة الموقع»: سطور الترويسة، وسطر القسم، والعنوان،
 * وكلّ عبارةٍ في الورقة، وأسماء الشهادات، وعبارة الإمضاء، وشعارا الجامعة
 * والكلّية، وسطر التخصّص تحت خانات الشهادة. وما لم يُحفظ قطّ فنصّ الورقة
 * الأصليّ (DEFAULT_SUPERVISION_SHEET).
 *
 * **وكلّ حقلٍ اختياريّ**: ما يُترك فارغاً لا يُطبع — العنوان، أو تمهيدٌ،
 * أو سطرٌ من الترويسة، أو اسمُ شهادة. وتبقى البيانات نفسها تُطبع (اسم
 * المشرف وعنوان المذكّرة والطلبة والسنة) وإن لم يسبقها تمهيد.
 *
 * **وكلّ وثيقةٍ تحمل نصّها**: القالب الجاري في لقطتها ما لم تُطبع، ثمّ يُثبَّت
 * عند أوّل طباعة (supervision.service)، فتُطبع وتُتحقّق منها كما وقّع عليها
 * الأستاذ — وتعديلٌ لاحق يسري على ما لم يُطبع بعد وحده. والوثائق الصادرة
 * قبل هذه الميزة لا قالب في لقطتها، فتُقرأ بالنصّ الأصليّ، وهو ما صدرت به.
 */

/** A sentence of the sheet: empty is allowed, and is not printed. */
const line = (max: number) => z.string().trim().max(max);
const logo = z
  .union([imageUrl, z.literal("")])
  .nullable()
  .transform((v) => v || null);

export const supervisionSheetSchema = z.object({
  /** Above the title, under the logos: the state, the ministry, the university… Blank lines are dropped. */
  header: z
    .array(line(140))
    .max(6)
    .transform((lines) => lines.filter(Boolean)),
  /** The line under them naming the specialization's department: «قسم …», or none. */
  department: z.object({ show: z.boolean(), prefix: line(40) }),
  title: line(120),
  supervisorLead: line(200),
  topicLead: line(200),
  degreeLead: line(120),
  /** The degrees' names; an empty one is not printed (the doctorate, by default). */
  degrees: z.object({ licence: line(60), master: line(60), doctorate: line(60) }),
  /**
   * Under the degrees' boxes, the topic's specialization: «{label} {name}», or
   * none. A sheet saved before this line was added has it, as the original does.
   */
  specialization: z.object({ show: z.boolean(), label: line(60) }).default({ show: true, label: "التخصّص:" }),
  studentsLead: line(200),
  studentLabel: line(60),
  yearLabel: line(60),
  signLabel: line(80),
  /** An uploaded logo, or `null` (or empty) for the platform's own. */
  universityLogo: logo,
  facultyLogo: logo,
});
export type SupervisionSheet = z.infer<typeof supervisionSheetSchema>;

/** The sheet as it has always been printed. */
export const DEFAULT_SUPERVISION_SHEET: SupervisionSheet = {
  header: ["الجمهورية الجزائرية الديمقراطية الشعبية", "وزارة التعليم العالي والبحث العلمي", "جامعة الشهيد حمه لخضر الوادي"],
  department: { show: true, prefix: "قسم" },
  title: "طلب الموافقة على الإشراف",
  supervisorLead: "أنا الأستاذ الممضي أسفله:",
  topicLead: "أعلمكم بأني صادقت على عنوان المذكرة:",
  degreeLead: "لنيل شهادة:",
  degrees: { licence: "الليسانس", master: "الماستر", doctorate: "" },
  specialization: { show: true, label: "التخصّص:" },
  studentsLead: "من إعداد الطلبة الآتية أسماؤهم:",
  studentLabel: "الطالب (ة):",
  yearLabel: "السنة الجامعية:",
  signLabel: "إمضاء الأستاذ:",
  universityLogo: null,
  facultyLogo: null,
};

const SLUG = "supervision-sheet";

/**
 * The sheet as the administration saved it — `null` when it never did. A
 * saved value that no longer fits the schema is taken as none, rather than
 * break the sheet with a missing field.
 */
export const getSupervisionSheetService = async (): Promise<SupervisionSheet | null> => {
  const row = await prisma.siteContent.findUnique({ where: { slug: SLUG } });
  if (!row) return null;
  const parsed = supervisionSheetSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
};

/** The sheet a document issued now is printed with: the saved one, else the original. */
export const currentSupervisionSheet = async (): Promise<SupervisionSheet> =>
  (await getSupervisionSheetService()) ?? DEFAULT_SUPERVISION_SHEET;

export const saveSupervisionSheetService = async (data: SupervisionSheet) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({ where: { slug: SLUG }, create: { slug: SLUG, value }, update: { value } });
  return getSupervisionSheetService();
};

/** Back to the original: the saved row goes; documents issued with it keep their text. */
export const resetSupervisionSheetService = async () => {
  await prisma.siteContent.deleteMany({ where: { slug: SLUG } });
  return null;
};

// ─── controllers ───────────────────────────────────────────────

export const getSupervisionSheetController = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // The saved one (or none), and the original — for the editor's «restore» and its blanks.
    return res.status(HTTPSTATUS.OK).json({ content: await getSupervisionSheetService(), defaults: DEFAULT_SUPERVISION_SHEET });
  } catch (e) {
    next(e);
  }
};

export const saveSupervisionSheetController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = supervisionSheetSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
    return res.status(HTTPSTATUS.OK).json({ content: await saveSupervisionSheetService(parsed.data), defaults: DEFAULT_SUPERVISION_SHEET });
  } catch (e) {
    next(e);
  }
};

export const resetSupervisionSheetController = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(HTTPSTATUS.OK).json({ content: await resetSupervisionSheetService(), defaults: DEFAULT_SUPERVISION_SHEET });
  } catch (e) {
    next(e);
  }
};
