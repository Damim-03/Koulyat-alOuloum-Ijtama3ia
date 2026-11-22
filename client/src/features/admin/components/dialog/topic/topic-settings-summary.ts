import type { TFunction } from "i18next";
import type { ProposalWindowState } from "../../../../../types/admin";
import { periodState, type Period } from "../../../../../lib/proposal-window";

/**
 * ما يقوله سطرُ إعدادات المواضيع وواجهةُ صفحتها عن الفترتين: حالُ كلٍّ،
 * ولونُها، وكم بقي على ما يُعدّ إليه — باليوم، ثمّ الساعة، ثمّ الدقيقة.
 */

export const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A state's colour, as a dot beside its word. */
export const STATE_DOT: Record<ProposalWindowState, string> = {
  unset: "bg-gray-400",
  upcoming: "bg-amber-400",
  open: "bg-emerald-400",
  closed: "bg-red-400",
};

/** How long is left, coarsely: «6 أيام», «3 ساعات», «دقيقة». */
export function timeLeft(t: TFunction, ms: number) {
  const left = Math.max(0, ms);
  if (left >= DAY) return t("admin.topicSettings.days", { count: Math.floor(left / DAY) });
  if (left >= HOUR) return t("admin.topicSettings.hours", { count: Math.floor(left / HOUR) });
  return t("admin.topicSettings.minutes", { count: Math.max(1, Math.ceil(left / MINUTE)) });
}

/** A period's state at `now`, and — while it is counted to — «تنتهي بعد…» or «تبدأ بعد…». */
export function periodLine(t: TFunction, period: Period, now: number) {
  const state = periodState(period, now);
  const target = state === "open" ? period.closeAt : state === "upcoming" ? period.openAt : null;
  const when = target
    ? t(state === "open" ? "admin.topicSettings.endsIn" : "admin.topicSettings.startsIn", { when: timeLeft(t, Date.parse(target) - now) })
    : null;
  return { state, when };
}
