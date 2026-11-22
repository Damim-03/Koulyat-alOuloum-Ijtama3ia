import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";
import { proposalWindowState, windowBounds, type ProposalWindowState } from "./proposal-window";

/**
 * مهلة اختيار المواضيع لسنةٍ جامعية: الطالب لا يرسل طلب فريقٍ على موضوعٍ من
 * تلك السنة قبل بدايتها ولا بعد نهايتها، ولا يسحب طلبه بعد نهايتها — فما
 * أُرسل في الموعد صار بيد الإدارة كما هو. والإدارة لا تتقيّد بها: تقبل
 * وترفض وتعدّل الفرق متى شاءت، وتمدّد المهلة إن احتاجت.
 *
 * بقاعدة فترة الاقتراح نفسها (./proposal-window): أيّامٌ كاملة بتوقيت
 * الجامعة، تُحدَّد معاً أو تُترك معاً — وتركها يعني الاختيار بلا قيد.
 */

export type SelectionWindowState = ProposalWindowState;

interface Selection {
  selectionOpenAt: Date | null;
  selectionCloseAt: Date | null;
}

export const selectionWindowState = (y: Selection, now = new Date()): SelectionWindowState =>
  proposalWindowState({ proposalsOpenAt: y.selectionOpenAt, proposalsCloseAt: y.selectionCloseAt }, now);

/** «2026-11-15» و«2026-11-30» ⇒ أوّل لحظةٍ من الأوّل وآخر لحظةٍ من الثاني — أو بالساعتين إن ذُكرتا. */
export function selectionBounds(opensOn: string, closesOn: string, opensTime?: string, closesTime?: string) {
  const b = windowBounds(opensOn, closesOn, opensTime, closesTime);
  return { selectionOpenAt: b.proposalsOpenAt, selectionCloseAt: b.proposalsCloseAt };
}

const yearWindow = (yearId: string) =>
  prisma.academicYear.findUnique({
    where: { id: yearId },
    select: { title: true, selectionOpenAt: true, selectionCloseAt: true },
  });

const refused = (key: "topic.selection.notYet" | "topic.selection.closed" | "topic.selection.locked", year: string, date: Date) =>
  new BadRequestException(tr(key, { year, date: date.toISOString() }), ErrorCodeEnum.TOPIC_SELECTION_CLOSED);

/**
 * يرفض طلباً جديداً على موضوعٍ سنتُه مهلتُها لم تبدأ أو انتهت — بالتاريخ،
 * ليعرف الطالب متى يعود، أو أنّ الأمر صار بيد الإدارة.
 */
export const assertSelectionOpen = async (yearId: string) => {
  const y = await yearWindow(yearId);
  if (!y) return; // السنة الغائبة يرفضها ما بعد هذا برسالتها.
  const state = selectionWindowState(y);
  if (state === "upcoming") throw refused("topic.selection.notYet", y.title, y.selectionOpenAt!);
  if (state === "closed") throw refused("topic.selection.closed", y.title, y.selectionCloseAt!);
};

/** يرفض سحب طلبٍ بعد نهاية المهلة: ما أُرسل في الموعد بيد الإدارة الآن. */
export const assertSelectionNotClosed = async (yearId: string) => {
  const y = await yearWindow(yearId);
  if (y && selectionWindowState(y) === "closed") throw refused("topic.selection.locked", y.title, y.selectionCloseAt!);
};
