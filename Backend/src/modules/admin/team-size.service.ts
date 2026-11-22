import { Prisma } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { tr } from "../../core/i18n";
import { assertYearOpen } from "../../core/academic/year-open";
import {
  LEVELS,
  fits,
  readTeamSizes,
  targetOf,
  type Level,
  type TeamSizeRule,
  type TeamSizes,
} from "../../core/academic/team-size";

/**
 * عدد الطلبة في كلّ موضوعٍ لسنةٍ جامعية، لكلّ مستوى — تحديده وإلغاؤه،
 * وأثره على مواضيعها قبل أن يُحفظ. والحارس الذي يرفض ما يخالفه في
 * core/academic/team-size.
 *
 * وحين يُحدَّد يُطبَّق على مواضيع السنة القائمة أيضاً — إلّا أن تختار
 * الإدارة الجديدة وحدها: كلّ موضوعٍ إلى ما تقوله قاعدة مستواه (targetOf)،
 * ولا يُخرج طالب: ما فيه طلبةٌ أكثر تُغلق مقاعده الشاغرة فقط، ويُعلَّم لتراجعه
 * الإدارة. والمؤرشفة لا تُمسّ: سجلٌّ مضى. ومستوى بلا قاعدة لا يُمسّ.
 */

const yearOf = async (id: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id },
    select: { id: true, title: true, isActive: true, archivedAt: true, teamSizes: true },
  });
  if (!year) throw new NotFoundException(tr("notFound.academicYear"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return { ...year, teamSizes: rulesOrNull(readTeamSizes(year.teamSizes)) };
};

const rulesOrNull = (r: TeamSizes) => (Object.keys(r).length ? r : null);

/** The topics a rule is applied to: the year's, but the archived. */
const LIVE = (yearId: string) => ({ academicYearId: yearId, status: { not: "archived" as const } });

/** A list is shown in full up to this many; beyond, its count says the rest. */
const SHOWN = 300;

const nameOf = (u?: { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null } | null) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
  [u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ").trim();

/** The year's topics with what a rule needs of them: their level, number and students. */
const topicsOf = (yearId: string) =>
  prisma.graduationTopic.findMany({
    where: LIVE(yearId),
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      maxStudents: true,
      status: true,
      specialization: { select: { level: true, name: true } },
      professor: {
        select: {
          user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true } },
        },
      },
      projectGroup: { select: { _count: { select: { members: true } } } },
    },
  });

/**
 * What rules would do to the year's topics, before they are saved: how many
 * under a rule already keep to it, which change and to what, which keep more
 * students than it (their free seats closed), and how many pending requests
 * have a larger team than their topic's level allows — the gate refuses them
 * on acceptance (core/topic/topic-status).
 */
export async function teamSizeImpact(yearId: string, rules: TeamSizes) {
  await yearOf(yearId);
  const [topics, pending] = await Promise.all([
    topicsOf(yearId),
    prisma.groupRequest.findMany({
      where: { status: "pending", topic: { academicYearId: yearId } },
      select: { topic: { select: { specialization: { select: { level: true } } } }, _count: { select: { members: true } } },
    }),
  ]);

  type Row = {
    id: string;
    title: string;
    professor: string;
    /** The supervisor's face, for the list: a photo, or a silhouette by gender. */
    avatar: { avatarUrl: string | null; gender: string | null } | null;
    specialization: string;
    status: string;
    members: number;
    level: Level;
    from: number;
    to: number;
  };
  const changes: Row[] = [];
  const over: Row[] = [];
  // Every level, ruled or not: its topics, the numbers they have now, and what the rule does to them.
  const levels = Object.fromEntries(
    LEVELS.map((l) => [l, { total: 0, sizes: {} as Record<string, number>, ruled: !!rules[l], matching: 0, changes: 0, over: 0, pendingOver: 0 }]),
  ) as Record<Level, { total: number; sizes: Record<string, number>; ruled: boolean; matching: number; changes: number; over: number; pendingOver: number }>;
  let matching = 0;
  let ruled = 0;
  for (const t of topics) {
    const level = t.specialization.level;
    const at = levels[level];
    at.total++;
    at.sizes[t.maxStudents] = (at.sizes[t.maxStudents] ?? 0) + 1;
    const rule = rules[level];
    if (!rule) continue;
    ruled++;
    const members = t.projectGroup?._count.members ?? 0;
    const u = t.professor?.user;
    const row = {
      id: t.id,
      title: t.title,
      professor: nameOf(u),
      avatar: u ? { avatarUrl: u.avatarUrl, gender: u.gender } : null,
      specialization: t.specialization.name,
      status: t.status,
      members,
      level,
      from: t.maxStudents,
    };
    if (members > rule.n) {
      over.push({ ...row, to: targetOf(rule, t.maxStudents, members) });
      at.over++;
    } else if (fits(rule, t.maxStudents)) {
      matching++;
      at.matching++;
    } else {
      changes.push({ ...row, to: targetOf(rule, t.maxStudents, members) });
      at.changes++;
    }
  }
  for (const r of pending) {
    const level = r.topic.specialization.level;
    const rule = rules[level];
    if (rule && r._count.members > rule.n) levels[level].pendingOver++;
  }

  // The lists by level, then by title: a level's topics read together.
  const byLevel = <T extends { level: Level }>(rows: T[]) => [...rows].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  return {
    total: topics.length,
    ruled,
    matching,
    changesCount: changes.length,
    changes: byLevel(changes).slice(0, SHOWN),
    overCount: over.length,
    over: byLevel(over).slice(0, SHOWN),
    pendingOver: LEVELS.reduce((n, l) => n + levels[l].pendingOver, 0),
    levels,
  };
}

/** The year's rules, and how its topics stand to them. */
export const teamSizeService = async (id: string) => {
  const year = await yearOf(id);
  const rules = year.teamSizes ?? {};
  const topics = await topicsOf(id);
  const under = topics.filter((t) => rules[t.specialization.level]);
  const matching = under.filter((t) => fits(rules[t.specialization.level]!, t.maxStudents)).length;
  return {
    year,
    stats: { total: topics.length, topics: under.length, matching, differing: under.length - matching },
  };
};

/**
 * Sets the rules — and, unless the new topics alone are meant, brings the
 * year's topics to them. In one transaction: the rules and their topics,
 * together or not at all.
 */
export const setTeamSizeService = async (
  id: string,
  data: { rules: Record<Level, TeamSizeRule | null>; applyToExisting?: boolean },
) => {
  await yearOf(id);
  await assertYearOpen(id);
  const rules: TeamSizes = Object.fromEntries(LEVELS.filter((l) => data.rules[l]).map((l) => [l, data.rules[l]!]));
  const stored = rulesOrNull(rules);

  const updates =
    data.applyToExisting === false
      ? []
      : (await topicsOf(id))
          .filter((t) => rules[t.specialization.level])
          .map((t) => ({
            id: t.id,
            from: t.maxStudents,
            to: targetOf(rules[t.specialization.level]!, t.maxStudents, t.projectGroup?._count.members ?? 0),
          }))
          .filter((u) => u.to !== u.from);

  await prisma.$transaction([
    prisma.academicYear.update({ where: { id }, data: { teamSizes: stored ?? Prisma.DbNull } }),
    ...updates.map((u) => prisma.graduationTopic.update({ where: { id: u.id }, data: { maxStudents: u.to } })),
  ]);
  return { ...(await teamSizeService(id)), applied: { changed: updates.length } };
};

/** No rules any more: each topic's number is free again, as it was. The topics keep theirs. */
export const clearTeamSizeService = async (id: string) => {
  await yearOf(id);
  await assertYearOpen(id);
  await prisma.academicYear.update({ where: { id }, data: { teamSizes: Prisma.DbNull } });
  return teamSizeService(id);
};
