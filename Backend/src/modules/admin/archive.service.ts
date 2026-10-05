import { prisma } from "../../core/prisma/client";
import type { Prisma } from "../../generated/prisma";
import { BadRequestException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { notifyAdminsQuietly } from "../notification/notification.service";
import { broadcastChange } from "../../core/realtime/realtime";

/**
 * The academic archive.
 *
 * A year is lived, then closed. Closing freezes its record — every student,
 * topic, project, defence and grade, with the figures they add up to — into
 * one stored document, so the year can be read back exactly as it stood, even
 * after students move on, accounts are removed or topics are rewritten. A
 * closed year takes no new students or topics; reopening it lifts that, and
 * the live rows become its record again.
 *
 * The same builder serves an open year live, so both read the same way.
 */

const person = {
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  gender: true,
  avatarUrl: true,
} as const;

const nameOf = (u?: { firstName: string | null; lastName: string | null } | null) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ");

/** The same name in Latin script — what French and English show — or null. */
const latinOf = (u?: { firstNameLatin: string | null; lastNameLatin: string | null } | null) =>
  [u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ") || null;

const round = (n: number) => Math.round(n * 100) / 100;

/** The mention a grade earns, on the 0–20 scale. */
const mentionOf = (g: number) =>
  g >= 16 ? "excellent" : g >= 14 ? "veryGood" : g >= 12 ? "good" : g >= 10 ? "fair" : "fail";

const notFound = () => new NotFoundException("Academic year not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);
const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);

/* ════════════════════════════════════════════════════════════
   THE RECORD OF A YEAR
   ════════════════════════════════════════════════════════════ */
export async function buildYearRecord(yearId: string) {
  const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
  if (!year) throw notFound();

  const [students, topics, requests] = await Promise.all([
    prisma.student.findMany({
      where: { academicYearId: yearId },
      orderBy: { registrationNumber: "asc" },
      select: {
        id: true,
        registrationNumber: true,
        user: { select: { ...person, status: true } },
        specialization: { select: { id: true, name: true, level: true } },
        projectMembers: {
          select: {
            isLeader: true,
            group: {
              select: {
                id: true,
                topic: { select: { id: true, title: true } },
                defense: { select: { status: true, grade: true } },
              },
            },
          },
        },
      },
    }),
    prisma.graduationTopic.findMany({
      where: { academicYearId: yearId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        maxStudents: true,
        createdAt: true,
        specialization: { select: { id: true, name: true, level: true } },
        professor: {
          select: { id: true, user: { select: person }, department: { select: { name: true } } },
        },
        _count: { select: { groupRequests: true } },
        projectGroup: {
          select: {
            id: true,
            createdAt: true,
            members: {
              orderBy: { isLeader: "desc" },
              select: {
                isLeader: true,
                student: { select: { id: true, registrationNumber: true, user: { select: person } } },
              },
            },
            milestones: {
              select: { status: true, deadline: true, _count: { select: { submissions: true } } },
            },
            defense: {
              select: {
                id: true,
                date: true,
                durationMinutes: true,
                room: true,
                status: true,
                grade: true,
                notes: true,
                committee: {
                  select: {
                    role: true,
                    professor: { select: { id: true, user: { select: person } } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.groupRequest.groupBy({
      by: ["status"],
      where: { topic: { academicYearId: yearId } },
      _count: { _all: true },
    }),
  ]);

  const projects = topics
    .filter((t) => t.projectGroup)
    .map((t) => {
      const g = t.projectGroup!;
      const ms = g.milestones;
      return {
        id: g.id,
        topicId: t.id,
        title: t.title,
        createdAt: g.createdAt,
        specialization: t.specialization,
        supervisor: { id: t.professor.id, name: nameOf(t.professor.user), latinName: latinOf(t.professor.user), gender: t.professor.user.gender, avatarUrl: t.professor.user.avatarUrl },
        members: g.members.map((m) => ({
          id: m.student.id,
          name: nameOf(m.student.user),
          latinName: latinOf(m.student.user),
          registrationNumber: m.student.registrationNumber,
          leader: m.isLeader,
          gender: m.student.user.gender,
          avatarUrl: m.student.user.avatarUrl,
        })),
        milestones: {
          total: ms.length,
          completed: ms.filter((m) => m.status === "completed").length,
          late: ms.filter((m) => m.status !== "completed" && (m.status === "overdue" || m.deadline < new Date())).length,
          submissions: ms.reduce((n, m) => n + m._count.submissions, 0),
        },
        defense: g.defense
          ? {
              id: g.defense.id,
              date: g.defense.date,
              durationMinutes: g.defense.durationMinutes,
              room: g.defense.room,
              status: g.defense.status,
              grade: g.defense.grade,
              mention: g.defense.grade !== null ? mentionOf(g.defense.grade) : null,
              notes: g.defense.notes,
              committee: g.defense.committee.map((c) => ({ role: c.role, id: c.professor.id, name: nameOf(c.professor.user), latinName: latinOf(c.professor.user) })),
            }
          : null,
      };
    });

  const defenses = projects
    .filter((p) => p.defense)
    .map((p) => ({
      ...p.defense!,
      projectId: p.id,
      title: p.title,
      students: p.members.map((m) => m.name),
      studentsLatin: p.members.map((m) => m.latinName),
      supervisor: p.supervisor.name,
      supervisorLatin: p.supervisor.latinName,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const graded = defenses.filter((d) => d.status === "completed" && d.grade !== null).map((d) => d.grade as number);
  const mentions = { excellent: 0, veryGood: 0, good: 0, fair: 0, fail: 0 } as Record<string, number>;
  for (const g of graded) mentions[mentionOf(g)] += 1;

  const studentRows = students.map((s) => {
    const pm = s.projectMembers[0];
    const def = pm?.group.defense;
    return {
      id: s.id,
      registrationNumber: s.registrationNumber,
      name: nameOf(s.user),
      latinName: latinOf(s.user),
      gender: s.user.gender,
      avatarUrl: s.user.avatarUrl,
      accountStatus: s.user.status,
      specialization: s.specialization,
      project: pm ? { id: pm.group.id, title: pm.group.topic.title, leader: pm.isLeader } : null,
      defense: def ? { status: def.status, grade: def.grade, mention: def.grade !== null ? mentionOf(def.grade) : null } : null,
    };
  });

  const topicRows = topics.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    maxStudents: t.maxStudents,
    createdAt: t.createdAt,
    specialization: t.specialization,
    supervisor: { id: t.professor.id, name: nameOf(t.professor.user), latinName: latinOf(t.professor.user) },
    department: t.professor.department?.name ?? null,
    requests: t._count.groupRequests,
    projectId: t.projectGroup?.id ?? null,
    members: t.projectGroup?.members.length ?? 0,
  }));

  // Per supervisor: how many topics, teams and defences, and how they went.
  const bySupervisor = new Map<string, { id: string; name: string; latinName: string | null; topics: number; projects: number; defended: number; grades: number[] }>();
  for (const t of topics) {
    const k = t.professor.id;
    const row = bySupervisor.get(k) ?? { id: k, name: nameOf(t.professor.user), latinName: latinOf(t.professor.user), topics: 0, projects: 0, defended: 0, grades: [] };
    row.topics += 1;
    if (t.projectGroup) row.projects += 1;
    const d = t.projectGroup?.defense;
    if (d?.status === "completed") {
      row.defended += 1;
      if (d.grade !== null) row.grades.push(d.grade);
    }
    bySupervisor.set(k, row);
  }

  // Per specialization: the year seen by programme.
  const bySpec = new Map<string, { id: string; name: string; level: string; students: number; topics: number; projects: number; defended: number; grades: number[] }>();
  const specRow = (s: { id: string; name: string; level: string }) =>
    bySpec.get(s.id) ?? { id: s.id, name: s.name, level: s.level, students: 0, topics: 0, projects: 0, defended: 0, grades: [] };
  for (const s of students) {
    const r = specRow(s.specialization);
    r.students += 1;
    bySpec.set(r.id, r);
  }
  for (const t of topics) {
    const r = specRow(t.specialization);
    r.topics += 1;
    if (t.projectGroup) r.projects += 1;
    const d = t.projectGroup?.defense;
    if (d?.status === "completed") {
      r.defended += 1;
      if (d.grade !== null) r.grades.push(d.grade);
    }
    bySpec.set(r.id, r);
  }

  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const topicsByStatus: Record<string, number> = {};
  for (const t of topics) topicsByStatus[t.status] = (topicsByStatus[t.status] ?? 0) + 1;
  const requestsByStatus: Record<string, number> = {};
  for (const r of requests) requestsByStatus[r.status] = r._count._all;

  const summary = {
    students: students.length,
    studentsWithProject: studentRows.filter((s) => s.project).length,
    topics: topics.length,
    topicsByStatus,
    projects: projects.length,
    defenses: {
      total: defenses.length,
      completed: defenses.filter((d) => d.status === "completed").length,
      scheduled: defenses.filter((d) => d.status === "scheduled").length,
      cancelled: defenses.filter((d) => d.status === "cancelled").length,
    },
    graded: graded.length,
    averageGrade: avg(graded),
    bestGrade: graded.length ? Math.max(...graded) : null,
    passRate: graded.length ? round((graded.filter((g) => g >= 10).length / graded.length) * 100) : null,
    mentions,
    requests: requestsByStatus,
    supervisors: bySupervisor.size,
  };

  return {
    year: { id: year.id, title: year.title },
    generatedAt: new Date(),
    summary,
    bySpecialization: [...bySpec.values()]
      .map(({ grades, ...r }) => ({ ...r, averageGrade: avg(grades) }))
      .sort((a, b) => b.students - a.students),
    supervisors: [...bySupervisor.values()]
      .map(({ grades, ...r }) => ({ ...r, averageGrade: avg(grades) }))
      .sort((a, b) => b.projects - a.projects || b.topics - a.topics),
    students: studentRows,
    topics: topicRows,
    projects,
    defenses,
  };
}

type YearRecord = Awaited<ReturnType<typeof buildYearRecord>>;

/* ════════════════════════════════════════════════════════════
   THE YEARS
   ════════════════════════════════════════════════════════════ */
export const listArchiveYearsService = async () => {
  const years = await prisma.academicYear.findMany({
    orderBy: { title: "desc" },
    include: {
      archive: { select: { summary: true, createdAt: true, archivedByName: true } },
      _count: { select: { students: true, topics: true } },
    },
  });

  // Open years are counted live; closed ones read the figures they closed with.
  const open = years.filter((y) => !y.archive).map((y) => y.id);
  const groups = open.length
    ? await prisma.projectGroup.findMany({
        where: { topic: { academicYearId: { in: open } } },
        select: { topic: { select: { academicYearId: true } }, defense: { select: { status: true } } },
      })
    : [];
  const projectsBy = new Map<string, number>();
  const defendedBy = new Map<string, number>();
  for (const g of groups) {
    const y = g.topic.academicYearId;
    projectsBy.set(y, (projectsBy.get(y) ?? 0) + 1);
    if (g.defense?.status === "completed") defendedBy.set(y, (defendedBy.get(y) ?? 0) + 1);
  }

  return {
    items: years.map((y) => {
      const s = y.archive?.summary as YearRecord["summary"] | undefined;
      return {
        id: y.id,
        title: y.title,
        isActive: y.isActive,
        archivedAt: y.archivedAt,
        archivedByName: y.archive?.archivedByName ?? null,
        counts: s
          ? {
              students: s.students,
              topics: s.topics,
              projects: s.projects,
              defended: s.defenses.completed,
              averageGrade: s.averageGrade,
            }
          : {
              students: y._count.students,
              topics: y._count.topics,
              projects: projectsBy.get(y.id) ?? 0,
              defended: defendedBy.get(y.id) ?? 0,
              averageGrade: null,
            },
      };
    }),
  };
};

/** A closed year reads its frozen record; an open one is built live. */
export const yearRecordService = async (yearId: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id: yearId },
    include: { archive: true },
  });
  if (!year) throw notFound();
  if (year.archive)
    return {
      source: "archive" as const,
      archivedAt: year.archivedAt,
      archivedByName: year.archive.archivedByName,
      note: year.archive.note,
      isActive: year.isActive,
      record: year.archive.snapshot,
    };
  return {
    source: "live" as const,
    archivedAt: null,
    archivedByName: null,
    note: null,
    isActive: year.isActive,
    record: await buildYearRecord(yearId),
  };
};

/**
 * What is still open in a year — to settle, or knowingly leave as it is,
 * before the year is closed.
 */
export const yearReadinessService = async (yearId: string) => {
  const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
  if (!year) throw notFound();
  const inYear = { topic: { academicYearId: yearId } };
  const now = new Date();

  const [pendingTopics, pendingRequests, noDefense, scheduledDefenses, ungraded, studentsWithout] = await Promise.all([
    prisma.graduationTopic.count({ where: { academicYearId: yearId, status: "pending" } }),
    prisma.groupRequest.count({ where: { ...inYear, status: "pending" } }),
    prisma.projectGroup.count({ where: { ...inYear, defense: { is: null } } }),
    prisma.defense.count({ where: { status: "scheduled", group: inYear } }),
    prisma.defense.count({ where: { status: "completed", grade: null, group: inYear } }),
    prisma.student.count({ where: { academicYearId: yearId, projectMembers: { none: {} } } }),
  ]);
  const upcoming = await prisma.defense.count({ where: { status: "scheduled", date: { gte: now }, group: inYear } });

  const items = [
    { key: "scheduledDefenses", count: scheduledDefenses, level: scheduledDefenses ? "warn" : "ok", extra: { upcoming } },
    { key: "ungraded", count: ungraded, level: ungraded ? "warn" : "ok" },
    { key: "noDefense", count: noDefense, level: noDefense ? "warn" : "ok" },
    { key: "pendingRequests", count: pendingRequests, level: pendingRequests ? "info" : "ok" },
    { key: "pendingTopics", count: pendingTopics, level: pendingTopics ? "info" : "ok" },
    { key: "studentsWithout", count: studentsWithout, level: studentsWithout ? "info" : "ok" },
  ];
  return { year: { id: year.id, title: year.title, archivedAt: year.archivedAt }, items, ready: items.every((i) => i.level === "ok") };
};

/* ════════════════════════════════════════════════════════════
   CLOSE / REOPEN
   ════════════════════════════════════════════════════════════ */
export const closeYearService = async (
  adminId: string,
  yearId: string,
  dto: { note?: string; nextYearId?: string; nextYearTitle?: string; confirmTitle: string },
) => {
  const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
  if (!year) throw notFound();
  if (year.archivedAt) throw bad("هذه السنة مؤرشفة بالفعل");
  if (dto.confirmTitle.trim() !== year.title) throw bad(`اكتب «${year.title}» كما هو لتأكيد إغلاق السنة`);

  // The next year, if one is named: an existing open year, or a new one
  // (created with the rest, so a failed close leaves no stray year behind).
  let nextId: string | null = null;
  const newTitle = dto.nextYearId ? null : dto.nextYearTitle?.trim() || null;
  if (dto.nextYearId) {
    const next = await prisma.academicYear.findUnique({ where: { id: dto.nextYearId } });
    if (!next || next.id === yearId) throw bad("السنة التالية غير صالحة");
    if (next.archivedAt) throw bad("لا يمكن جعل سنةٍ مؤرشفة سنةً جارية");
    nextId = next.id;
  } else if (newTitle && (await prisma.academicYear.findUnique({ where: { title: newTitle } })))
    throw bad(`السنة «${newTitle}» موجودة بالفعل — اخترها من القائمة`);

  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { firstName: true, lastName: true } });
  const record = await buildYearRecord(yearId);

  await prisma.$transaction(async (tx) => {
    await tx.academicYearArchive.create({
      data: {
        academicYearId: yearId,
        snapshot: record as unknown as Prisma.InputJsonValue,
        summary: record.summary as unknown as Prisma.InputJsonValue,
        note: dto.note?.trim() || null,
        archivedById: adminId,
        archivedByName: nameOf(admin) || null,
      },
    });
    await tx.academicYear.update({ where: { id: yearId }, data: { archivedAt: new Date(), isActive: false } });
    if (newTitle) nextId = (await tx.academicYear.create({ data: { title: newTitle, isActive: false } })).id;
    if (nextId) {
      await tx.academicYear.updateMany({ data: { isActive: false } });
      await tx.academicYear.update({ where: { id: nextId }, data: { isActive: true } });
    }
  });

  // Which year is current just changed for every screen that picks one.
  broadcastChange("academic-years", "updated", yearId);
  await notifyAdminsQuietly({
    type: "general",
    title: "أُغلقت سنة جامعية وحُفظت في الأرشيف",
    message: `السنة ${year.title}: ${record.summary.students} طالباً، ${record.summary.projects} مذكرة، ${record.summary.defenses.completed} مناقشة منتهية.`,
    link: "/admin/academic-years",
  });

  return { archived: true, summary: record.summary, activeYearId: nextId };
};

export const reopenYearService = async (yearId: string, dto: { activate?: boolean }) => {
  const year = await prisma.academicYear.findUnique({ where: { id: yearId }, include: { archive: true } });
  if (!year) throw notFound();
  if (!year.archivedAt) throw bad("هذه السنة غير مؤرشفة");

  await prisma.$transaction(async (tx) => {
    // The live rows are its record again; the frozen copy goes.
    if (year.archive) await tx.academicYearArchive.delete({ where: { id: year.archive.id } });
    await tx.academicYear.update({ where: { id: yearId }, data: { archivedAt: null } });
    if (dto.activate) {
      await tx.academicYear.updateMany({ data: { isActive: false } });
      await tx.academicYear.update({ where: { id: yearId }, data: { isActive: true } });
    }
  });
  broadcastChange("academic-years", "updated", yearId);
  return { reopened: true, active: !!dto.activate };
};
