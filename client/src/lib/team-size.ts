import type { SpecLevel } from "./spec-level";

/**
 * عدد الطلبة في كلّ موضوع — تقرّره الإدارة لكلّ سنةٍ جامعية ولكلّ مستوى
 * (Backend: core/academic/team-size): «بالضبط» عددٌ واحد، أو «حتى» حدٌّ لا
 * يُتجاوز (قاعدةٌ قديمة)، أو لا شيء بعد. والمستوى مستوى تخصّص الموضوع.
 *
 * والنماذج لا تقبل كتابته أبداً (components/topic/team-size-ruled): «بالضبط»
 * تعرضه ثابتاً وترسله هو؛ و«حتى» القيم المسموحة وحدها؛ وما لم يُحدَّد بعدُ
 * يبقى على عدده — طالبٌ واحد لموضوعٍ جديد، وعددُه لموضوعٍ قائم — حتى يُحدَّد.
 */

export type TeamSizeMode = "exact" | "max";
export interface TeamSizeRule {
  n: number;
  mode: TeamSizeMode;
}
/** A year's rules, by level; a level left out is free. */
export type TeamSizes = Partial<Record<SpecLevel, TeamSizeRule>>;

/** A year as the forms read it: its rules, when the administration set some. */
export interface RuledYear {
  id: string;
  title: string;
  teamSizes?: TeamSizes | null;
}

/** The rule of the chosen year for the chosen specialization's level — `null` when free, or not known yet. */
export const ruleOf = (years: RuledYear[] | undefined, yearId: string | undefined, level: string | undefined): TeamSizeRule | null =>
  (yearId && level && years?.find((y) => y.id === yearId)?.teamSizes?.[level as SpecLevel]) || null;

/**
 * The number a topic is saved with: the rule's when «exactly», what was
 * chosen within it when «up to» — or, for a topic from before the rule that
 * has more students than it, its own number as it is (the server takes it
 * unchanged, and removes nobody).
 *
 * `kept` is the topic as it is now — its students and its number — in an edit.
 */
export function seatsFor(rule: TeamSizeRule | null, chosen: number, kept?: { members: number; current: number }) {
  if (!rule) return chosen;
  if (kept && kept.members > rule.n) return kept.current;
  return rule.mode === "exact" ? rule.n : Math.min(Math.max(chosen, 1), rule.n);
}
