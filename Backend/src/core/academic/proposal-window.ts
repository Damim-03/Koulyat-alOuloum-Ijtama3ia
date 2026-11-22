import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";

/**
 * فترة اقتراح المواضيع لسنةٍ جامعية: الأستاذ لا يقترح موضوعاً جديداً لتلك
 * السنة قبل بدايتها ولا بعد نهايتها. وتعديل مقترحاته باقٍ له — ومنها ما
 * رفضته الإدارة وطلبت تصحيحه، فلا يعلق بموضوعٍ لا يستطيع إصلاحه. والإدارة
 * لا تتقيّد بها: تُنشئ وتستورد متى شاءت.
 *
 * والفترة أيّامٌ كاملة ما لم تُذكر ساعة: من بداية يومها الأوّل إلى نهاية
 * يومها الأخير، بتوقيت الجامعة (الجزائر، UTC+1 طوال السنة بلا توقيتٍ صيفيّ).
 * فـ«إلى 11 نوفمبر» تشمل يوم 11 كلّه. وتُضبط بالثانية إن ذُكرت الساعة: من
 * «10 نوفمبر 08:00:00» إلى «11 نوفمبر 18:30:00» — وتشمل تلك الثانية الأخيرة.
 */

export type ProposalWindowState = "unset" | "upcoming" | "open" | "closed";

interface Windowed {
  proposalsOpenAt: Date | null;
  proposalsCloseAt: Date | null;
}

const UNIVERSITY_OFFSET = "+01:00";

/** «08:00» ⇒ «08:00:00». */
const seconds = (time: string) => (time.length === 5 ? `${time}:00` : time);

/**
 * «2026-10-11» و«2026-11-11» ⇒ أوّل لحظةٍ من الأوّل وآخر لحظةٍ من الثاني —
 * أو، بساعتين، من تلك الثانية إلى آخر تلك الثانية.
 */
export function windowBounds(opensOn: string, closesOn: string, opensTime = "00:00:00", closesTime = "23:59:59") {
  return {
    proposalsOpenAt: new Date(`${opensOn}T${seconds(opensTime)}.000${UNIVERSITY_OFFSET}`),
    proposalsCloseAt: new Date(`${closesOn}T${seconds(closesTime)}.999${UNIVERSITY_OFFSET}`),
  };
}

export function proposalWindowState(y: Windowed, now = new Date()): ProposalWindowState {
  if (!y.proposalsOpenAt || !y.proposalsCloseAt) return "unset";
  if (now < y.proposalsOpenAt) return "upcoming";
  if (now > y.proposalsCloseAt) return "closed";
  return "open";
}

/**
 * يرفض اقتراحاً جديداً لسنةٍ فترتُها لم تبدأ أو انتهت — بالتاريخ، ليعرف
 * الأستاذ متى يعود أو أنّ الأمر صار بيد الإدارة.
 */
export const assertProposalsOpen = async (yearId: string) => {
  const y = await prisma.academicYear.findUnique({
    where: { id: yearId },
    select: { title: true, proposalsOpenAt: true, proposalsCloseAt: true },
  });
  if (!y) return; // السنة الغائبة يرفضها ما بعد هذا برسالتها.
  const state = proposalWindowState(y);
  if (state === "upcoming")
    throw new BadRequestException(
      tr("topic.proposals.notYet", { year: y.title, date: y.proposalsOpenAt!.toISOString() }),
      ErrorCodeEnum.TOPIC_PROPOSALS_CLOSED,
    );
  if (state === "closed")
    throw new BadRequestException(
      tr("topic.proposals.closed", { year: y.title, date: y.proposalsCloseAt!.toISOString() }),
      ErrorCodeEnum.TOPIC_PROPOSALS_CLOSED,
    );
};
