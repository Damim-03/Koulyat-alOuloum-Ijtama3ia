import { z } from "zod";

import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";

/**
 * ============================================================
 * عدد الطلبة في كلّ موضوع — تقرّره الإدارة لكلّ سنةٍ ولكلّ مستوى
 * ============================================================
 *
 * لكلّ مستوى (ليسانس، ماستر، دكتوراه) قاعدةٌ أو لا شيء:
 *   - «بالضبط» n: كلّ موضوعٍ من هذا المستوى له n مقاعد، لا أقلّ ولا أكثر؛
 *   - «حتى» n: من ١ إلى n، يختار الأستاذ؛
 *   - ولا قاعدة: العدد حرّ كما كان، من ١ إلى ١٠.
 * والمستوى مستوى تخصّص الموضوع. وتُفرض في كلّ مسار: الأستاذ والإدارة،
 * والإسناد، والاستيراد من Excel.
 *
 * والفريق لا يتجاوز مقاعد موضوعه في كلّ مسارٍ قائم، فضبطُ المقاعد يضبطه.
 *
 * وموضوعٌ سبق القاعدة فبقي على عدده — فيه طلبةٌ أكثر منها، أو طُبّقت على
 * الجديدة وحدها (modules/admin/team-size.service) — يُعدَّل بلا أن يُجبر على
 * تغيير عدده: ما لم يتغيّر لا يُردّ.
 */

export const LEVELS = ["licence", "master", "doctorate"] as const;
export type Level = (typeof LEVELS)[number];

export const teamSizeRuleSchema = z.object({
  n: z.number().int().min(1).max(10),
  mode: z.enum(["exact", "max"]),
});
export type TeamSizeRule = z.infer<typeof teamSizeRuleSchema>;
/** A year's rules, by level; a level left out is free. */
export type TeamSizes = Partial<Record<Level, TeamSizeRule>>;

const storedSchema = z.object({
  licence: teamSizeRuleSchema.optional(),
  master: teamSizeRuleSchema.optional(),
  doctorate: teamSizeRuleSchema.optional(),
});

/** The rules as the year keeps them — none when it has none, or when what is kept no longer reads. */
export function readTeamSizes(value: unknown): TeamSizes {
  const parsed = storedSchema.safeParse(value ?? {});
  if (!parsed.success) return {};
  return Object.fromEntries(Object.entries(parsed.data).filter(([, r]) => r)) as TeamSizes;
}

/** A topic's number that keeps to a rule. */
export const fits = (rule: TeamSizeRule, maxStudents: number) =>
  rule.mode === "exact" ? maxStudents === rule.n : maxStudents >= 1 && maxStudents <= rule.n;

/**
 * The number a topic is brought to by a rule: as it is if it keeps to it;
 * the rule's own otherwise — unless it has more students than the rule, for
 * nobody is removed: then its students' count, its free seats closed.
 */
export function targetOf(rule: TeamSizeRule, maxStudents: number, members: number) {
  if (members > rule.n) return members;
  if (fits(rule, maxStudents)) return maxStudents;
  return rule.n;
}

const LEVEL_NAME = { licence: "imp.level.licence", master: "imp.level.master", doctorate: "imp.level.doctorate" } as const;
export const levelName = (level: Level) => tr(LEVEL_NAME[level]);

/**
 * Refuses a topic's number of students that does not keep to its year's rule
 * for its specialization's level: with the year, the level and the number,
 * for the form to say what it must be.
 *
 * `unchanged`: the topic's number as it already is. Kept as it is, it is not
 * refused — a topic from before the rule is edited without being forced.
 */
export const assertTeamSize = async (yearId: string, specializationId: string, maxStudents: number, unchanged?: number) => {
  const [y, s] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: yearId }, select: { title: true, teamSizes: true } }),
    prisma.specialization.findUnique({ where: { id: specializationId }, select: { level: true } }),
  ]);
  if (!y || !s) return; // what is missing is refused by the caller, with its own message
  const rule = readTeamSizes(y.teamSizes)[s.level];
  if (!rule || fits(rule, maxStudents) || maxStudents === unchanged) return;
  throw new BadRequestException(
    tr(rule.mode === "exact" ? "topic.teamSize.fixed" : "topic.teamSize.max", { year: y.title, level: levelName(s.level), count: rule.n, max: rule.n }),
    ErrorCodeEnum.TOPIC_TEAM_SIZE,
  );
};
