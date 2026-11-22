import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { tr } from "../../core/i18n";
import { assertYearOpen } from "../../core/academic/year-open";

/**
 * حدّ المواضيع لكلّ أستاذ في سنةٍ جامعية — قراءته مع حال الأساتذة منه،
 * وتحديده وإلغاؤه. والحارس الذي يرفض ما يتجاوزه في core/academic/topic-quota.
 *
 * وتحديده لا يمسّ موضوعاً: أستاذٌ تجاوزه تبقى مواضيعه كما هي، ولا يرسل
 * جديداً حتى ينزل تحته (برفضٍ أو حذف).
 */

/** A list of professors is shown in full up to this many. */
const SHOWN = 200;

const yearOf = async (id: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id },
    select: { id: true, title: true, isActive: true, archivedAt: true, maxTopicsPerProfessor: true },
  });
  if (!year) throw new NotFoundException(tr("notFound.academicYear"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return year;
};

const nameOf = (u?: { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null } | null) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
  [u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ").trim();

/**
 * The year's limit, and the professors against it: how many there are, how
 * many proposed, and — for the limit set, or any the dialog weighs — each
 * proposing professor's count, the most first.
 */
export const topicQuotaService = async (id: string) => {
  const year = await yearOf(id);
  const [groups, total] = await Promise.all([
    prisma.graduationTopic.groupBy({
      by: ["professorId"],
      where: { academicYearId: id, status: { not: "rejected" } },
      _count: { _all: true },
    }),
    prisma.professor.count(),
  ]);
  const counts = groups.map((g) => ({ id: g.professorId, count: g._count._all })).sort((a, b) => b.count - a.count);
  const people = await prisma.professor.findMany({
    where: { id: { in: counts.slice(0, SHOWN).map((c) => c.id) } },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true } },
    },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const max = year.maxTopicsPerProfessor;
  return {
    year,
    stats: {
      professors: total,
      proposing: counts.length,
      atLimit: max === null ? 0 : counts.filter((c) => c.count === max).length,
      over: max === null ? 0 : counts.filter((c) => c.count > max).length,
    },
    /** How many professors have each count: `{ "3": 4 }` — four professors have three topics. */
    histogram: counts.reduce<Record<string, number>>((h, c) => ({ ...h, [c.count]: (h[c.count] ?? 0) + 1 }), {}),
    professors: counts.slice(0, SHOWN).map((c) => {
      const u = byId.get(c.id)?.user;
      return { id: c.id, name: nameOf(u), avatar: u ? { avatarUrl: u.avatarUrl, gender: u.gender } : null, count: c.count };
    }),
  };
};

/** Sets the limit. No topic is touched. */
export const setTopicQuotaService = async (id: string, data: { max: number }) => {
  await yearOf(id);
  await assertYearOpen(id);
  await prisma.academicYear.update({ where: { id }, data: { maxTopicsPerProfessor: data.max } });
  return topicQuotaService(id);
};

/** No limit any more. */
export const clearTopicQuotaService = async (id: string) => {
  await yearOf(id);
  await assertYearOpen(id);
  await prisma.academicYear.update({ where: { id }, data: { maxTopicsPerProfessor: null } });
  return topicQuotaService(id);
};
