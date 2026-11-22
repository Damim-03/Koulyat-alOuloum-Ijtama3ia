import type { Prisma } from "../../generated/prisma";
import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";

/**
 * ============================================================
 * حدّ المواضيع لكلّ أستاذ — تقرّره الإدارة لكلّ سنةٍ جامعية
 * ============================================================
 *
 * رقمٌ واحد لكلّ أستاذ في السنة (`AcademicYear.maxTopicsPerProfessor`)، أو
 * لا شيء فلا حدّ. أقلّ منه لا بأس؛ والمهمّ ألّا يُتجاوز.
 *
 * ويُحسب كلّ موضوعٍ له في تلك السنة، مشرفاً عليه — المنتظر والمقبول والمنشور
 * والممتلئ والمؤرشف — إلّا المرفوض: الرفض يحرّر مكانه فيقترح بدله. وما
 * أنشأته الإدارة باسمه يُحسب كذلك: لا يُعرف من أنشأ موضوعاً (قرار المستخدم).
 *
 * ويُفرض على ما يرسله الأستاذ: موضوعٌ جديد، أو بفريق، أو مرفوضٌ يُعاد إرساله
 * بتعديله، أو موضوعٌ يُنقل إلى سنةٍ أخرى. والإدارة لا تتقيّد به، كفترة
 * الاقتراح. وأستاذٌ تجاوزه قبل أن يُحدَّد تبقى مواضيعه، ولا يرسل جديداً.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** What counts toward a professor's limit: his topics of the year, but the rejected. */
export const countedTopics = (yearId: string, professorId: string): Prisma.GraduationTopicWhereInput => ({
  academicYearId: yearId,
  professorId,
  status: { not: "rejected" },
});

/** The year's limit (`null`: none) and how much of it the professor has used. */
export async function topicQuotaOf(yearId: string, professorId: string, db: Db = prisma) {
  const y = await db.academicYear.findUnique({
    where: { id: yearId },
    select: { id: true, title: true, maxTopicsPerProfessor: true },
  });
  if (!y) return null;
  const used = await db.graduationTopic.count({ where: countedTopics(yearId, professorId) });
  return { year: { id: y.id, title: y.title }, max: y.maxTopicsPerProfessor, used };
}

/**
 * One professor's sends, one after another: two at once would each count the
 * same topics and both pass. Taken first in the transaction that adds a topic
 * to his count, held until it commits.
 */
export const lockProfessor = (tx: Prisma.TransactionClient, professorId: string) =>
  tx.$queryRaw`SELECT id FROM Professor WHERE id = ${professorId} FOR UPDATE`;

/**
 * Refuses one topic more for a professor who has reached his year's limit —
 * with the year, the limit and his count, for the screen to say it.
 */
export async function assertTopicQuota(yearId: string, professorId: string, db: Db = prisma) {
  const q = await topicQuotaOf(yearId, professorId, db);
  if (!q || q.max === null || q.used < q.max) return;
  throw new BadRequestException(
    tr("topic.quota.reached", { year: q.year.title, max: q.max, count: q.used }),
    ErrorCodeEnum.TOPIC_QUOTA_REACHED,
  );
}
