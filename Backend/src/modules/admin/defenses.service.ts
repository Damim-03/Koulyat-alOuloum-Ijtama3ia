import ExcelJS from "exceljs";
import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import type { Prisma } from "../../generated/prisma";
import type { DefenseConflictsDTO, ListDefensesDTO } from "./admin.validation";

/**
 * The defence schedule, as the administration runs it.
 *
 * Three things the old list could not do and this one does:
 *
 *   • **Find a session** — by topic, room, student, juror — and narrow by what
 *     matters: today, this week, overdue for an update, missing a jury.
 *   • **Count honestly.** Its figures were counted from the page on screen, so
 *     "upcoming: 3" meant "3 of the 10 shown". They now come from the table.
 *   • **Catch a clash** — the same room, or the same professor on two juries,
 *     at overlapping times — before it becomes a morning of apologies.
 */

const userLite = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  avatarUrl: true,
  gender: true,
} as const;

const defenseInclude = {
  group: {
    select: {
      id: true,
      topic: {
        select: {
          id: true,
          title: true,
          professorId: true,
          specialization: { select: { id: true, name: true, level: true } },
          academicYear: { select: { id: true, title: true } },
          professor: { select: { id: true, user: { select: userLite } } },
        },
      },
      members: {
        orderBy: { isLeader: "desc" as const },
        select: {
          id: true,
          isLeader: true,
          student: { select: { id: true, registrationNumber: true, user: { select: userLite } } },
        },
      },
    },
  },
  committee: {
    select: {
      id: true,
      role: true,
      professorId: true,
      professor: { select: { id: true, user: { select: userLite } } },
    },
  },
} satisfies Prisma.DefenseInclude;

const MIN = 60_000;
const endOf = (d: { date: Date; durationMinutes: number }) => new Date(d.date.getTime() + d.durationMinutes * MIN);
const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && b.start < a.end;
const sameRoom = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/** بالعربية، وباللاتينية لمن لا اسم عربيّ له. */
const nameOf = (
  u?: {
    firstName: string | null;
    lastName: string | null;
    firstNameLatin?: string | null;
    lastNameLatin?: string | null;
  } | null,
) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
  [u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ");

function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * MIN);
  return { start, end };
}

/* ── filters ────────────────────────────────────────────────── */
function whereOf(q: ListDefensesDTO): Prisma.DefenseWhereInput {
  const now = new Date();
  const and: Prisma.DefenseWhereInput[] = [];

  if (q.status) and.push({ status: q.status });

  if (q.when === "upcoming") and.push({ status: "scheduled", date: { gte: now } });
  else if (q.when === "today") {
    const { start, end } = dayBounds(now);
    and.push({ date: { gte: start, lt: end } });
  } else if (q.when === "week")
    and.push({ date: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * MIN) } });
  else if (q.when === "past") and.push({ date: { lt: now } });
  else if (q.when === "stale") and.push({ status: "scheduled", date: { lt: now } });

  if (q.from) and.push({ date: { gte: new Date(q.from) } });
  if (q.to) and.push({ date: { lte: new Date(q.to) } });
  if (q.room) and.push({ room: { contains: q.room } });

  if (q.professorId)
    and.push({
      OR: [
        { committee: { some: { professorId: q.professorId } } },
        { group: { topic: { professorId: q.professorId } } },
      ],
    });
  if (q.specializationId) and.push({ group: { topic: { specializationId: q.specializationId } } });
  if (q.academicYearId) and.push({ group: { topic: { academicYearId: q.academicYearId } } });

  if (q.issue === "noCommittee") and.push({ status: { not: "cancelled" }, committee: { none: {} } });
  else if (q.issue === "noPresident")
    and.push({ status: { not: "cancelled" }, committee: { some: {}, none: { role: "president" } } });
  else if (q.issue === "noGrade") and.push({ status: "completed", grade: null });

  if (q.search) {
    const term = q.search;
    const person = { OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }] };
    and.push({
      OR: [
        { room: { contains: term } },
        { group: { topic: { title: { contains: term } } } },
        { group: { topic: { professor: { user: person } } } },
        { group: { members: { some: { student: { registrationNumber: { contains: term } } } } } },
        { group: { members: { some: { student: { user: person } } } } },
        { committee: { some: { professor: { user: person } } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

/* ── clashes ────────────────────────────────────────────────── */
type Slot = { id?: string; start: Date; end: Date; room?: string | null; professorIds: string[] };

/** Scheduled defences that overlap a slot by room or by juror. */
async function clashesFor(slots: Slot[]) {
  if (!slots.length) return new Map<string, ReturnType<typeof emptyClash>>();
  const from = new Date(Math.min(...slots.map((s) => s.start.getTime())) - 12 * 60 * MIN);
  const to = new Date(Math.max(...slots.map((s) => s.end.getTime())) + 12 * 60 * MIN);

  const others = await prisma.defense.findMany({
    where: { status: "scheduled", date: { gte: from, lte: to } },
    select: {
      id: true,
      date: true,
      durationMinutes: true,
      room: true,
      group: { select: { topic: { select: { title: true } } } },
      committee: { select: { professorId: true, professor: { select: { user: { select: userLite } } } } },
    },
  });

  const out = new Map<string, ReturnType<typeof emptyClash>>();
  slots.forEach((slot, i) => {
    const key = slot.id ?? `slot-${i}`;
    const clash = emptyClash();
    for (const o of others) {
      if (o.id === slot.id) continue;
      const window = { start: o.date, end: endOf(o) };
      if (!overlaps(slot, window)) continue;
      const brief = { id: o.id, title: o.group.topic.title, date: o.date, room: o.room };
      if (sameRoom(slot.room, o.room)) clash.room.push(brief);
      for (const c of o.committee)
        if (slot.professorIds.includes(c.professorId))
          clash.professors.push({ ...brief, professorId: c.professorId, name: nameOf(c.professor.user) });
    }
    out.set(key, clash);
  });
  return out;
}

const emptyClash = () => ({
  room: [] as { id: string; title: string; date: Date; room: string }[],
  professors: [] as { id: string; title: string; date: Date; room: string; professorId: string; name: string }[],
});

export const defenseConflictsService = async (q: DefenseConflictsDTO) => {
  const start = new Date(q.date);
  const slot: Slot = {
    id: q.excludeId,
    start,
    end: new Date(start.getTime() + q.durationMinutes * MIN),
    room: q.room,
    professorIds: q.professorIds,
  };
  const map = await clashesFor([slot]);
  return map.get(q.excludeId ?? "slot-0") ?? emptyClash();
};

/** The clashes of stored defences, for the list and after a save. */
export const clashesOfDefenses = async (
  list: { id: string; date: Date; durationMinutes: number; room: string; status: string; committee: { professorId: string }[] }[],
) =>
  clashesFor(
    list
      .filter((d) => d.status === "scheduled")
      .map((d) => ({
        id: d.id,
        start: d.date,
        end: endOf(d),
        room: d.room,
        professorIds: d.committee.map((c) => c.professorId),
      })),
  );

/* ── list + figures ─────────────────────────────────────────── */
export const listDefensesService = async (q: ListDefensesDTO) => {
  const where = whereOf(q);
  const orderBy = { date: q.sort === "dateDesc" ? ("desc" as const) : ("asc" as const) };
  const now = new Date();
  const { start: today, end: tomorrow } = dayBounds(now);

  const [items, total, stats] = await Promise.all([
    prisma.defense.findMany({
      where,
      include: defenseInclude,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.defense.count({ where }),
    // The figures describe the whole schedule, not the page or the filter,
    // so each tile can be clicked to become the filter.
    Promise.all([
      prisma.defense.count(),
      prisma.defense.count({ where: { status: "scheduled", date: { gte: now } } }),
      prisma.defense.count({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.defense.count({ where: { date: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * MIN) } } }),
      prisma.defense.count({ where: { status: "completed" } }),
      prisma.defense.count({ where: { status: "cancelled" } }),
      prisma.defense.count({ where: { status: "scheduled", date: { lt: now } } }),
      prisma.defense.count({ where: { status: { not: "cancelled" }, committee: { none: {} } } }),
      prisma.defense.aggregate({ where: { status: "completed", grade: { not: null } }, _avg: { grade: true } }),
      prisma.defense.findMany({
        where: { status: "scheduled", date: { gte: now } },
        select: { room: true },
        distinct: ["room"],
      }),
      prisma.projectGroup.count({ where: { defense: { is: null } } }),
    ]),
  ]);

  const clashes = await clashesOfDefenses(items);
  const [all, upcoming, todayN, week, completed, cancelled, stale, noCommittee, avg, rooms, ready] = stats;

  return {
    items: items.map((d) => ({
      ...d,
      endsAt: endOf(d),
      clashes: clashes.get(d.id) ?? emptyClash(),
    })),
    total,
    page: q.page,
    limit: q.limit,
    stats: {
      total: all,
      upcoming,
      today: todayN,
      week,
      completed,
      cancelled,
      stale,
      noCommittee,
      averageGrade: avg._avg.grade,
      rooms: rooms.length,
      readyToSchedule: ready,
    },
  };
};

/* ── export ─────────────────────────────────────────────────── */
const STATUS_AR: Record<string, string> = { scheduled: "مبرمجة", completed: "نوقشت", cancelled: "ملغاة" };
const ROLE_AR: Record<string, string> = { president: "رئيس", supervisor: "مشرف", examiner: "مناقش" };

/** The schedule as a spreadsheet — to print, post, or send to the jury. */
export const exportDefensesService = async (q: ListDefensesDTO) => {
  const list = await prisma.defense.findMany({
    where: whereOf(q),
    include: defenseInclude,
    orderBy: { date: "asc" },
    take: 3000,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mudhakkirati";
  const ws = wb.addWorksheet("المناقشات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "التاريخ", key: "date", width: 13 },
    { header: "اليوم", key: "day", width: 11 },
    { header: "من", key: "from", width: 8 },
    { header: "إلى", key: "to", width: 8 },
    { header: "القاعة", key: "room", width: 14 },
    { header: "الموضوع", key: "title", width: 42 },
    { header: "التخصّص", key: "spec", width: 22 },
    { header: "المشرف", key: "supervisor", width: 22 },
    { header: "الطلبة", key: "students", width: 36 },
    { header: "لجنة المناقشة", key: "committee", width: 44 },
    { header: "الحالة", key: "status", width: 10 },
    { header: "الدرجة", key: "grade", width: 8 },
  ];
  const tz = "Africa/Algiers";
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("ar-DZ", { timeZone: tz, ...o });

  for (const d of list) {
    const end = endOf(d);
    ws.addRow({
      date: fmt(d.date, { year: "numeric", month: "2-digit", day: "2-digit" }),
      day: fmt(d.date, { weekday: "long" }),
      from: fmt(d.date, { hour: "2-digit", minute: "2-digit", hour12: false }),
      to: fmt(end, { hour: "2-digit", minute: "2-digit", hour12: false }),
      room: d.room,
      title: d.group.topic.title,
      spec: d.group.topic.specialization?.name ?? "",
      supervisor: nameOf(d.group.topic.professor?.user),
      students: d.group.members
        .map((m) => `${nameOf(m.student.user)} (${m.student.registrationNumber})`)
        .join("، "),
      committee: [...d.committee]
        .sort((a, b) => ["president", "supervisor", "examiner"].indexOf(a.role) - ["president", "supervisor", "examiner"].indexOf(b.role))
        .map((c) => `${ROLE_AR[c.role] ?? c.role}: ${nameOf(c.professor.user)}`)
        .join(" — "),
      status: STATUS_AR[d.status] ?? d.status,
      grade: d.grade ?? "",
    });
  }

  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26423D" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: "middle", wrapText: true };
    row.font = { name: "Arial", size: 10 };
    if (n % 2 === 0)
      row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F1E3" } }));
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
};

/* ── one defence, in full ───────────────────────────────────── */

const personDetail = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  email: true,
  avatarUrl: true,
  gender: true,
} as const;

const professorDetail = {
  id: true,
  universityEmail: true,
  grade: true,
  user: { select: personDetail },
  department: { select: { id: true, name: true } },
} as const;

/**
 * Everything about one session: when and where, who stands before whom, how
 * far the project got, what else holds the room that day, and whether any of
 * it clashes. The page it feeds is the one to send to a colleague — or print
 * and pin to the door.
 */
export const defenseDetailService = async (id: string) => {
  const d = await prisma.defense.findUnique({
    where: { id },
    include: {
      group: {
        select: {
          id: true,
          createdAt: true,
          topic: {
            select: {
              id: true,
              title: true,
              description: true,
              maxStudents: true,
              professorId: true,
              academicYear: { select: { id: true, title: true, isActive: true } },
              specialization: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  filiere: {
                    select: {
                      name: true,
                      department: { select: { name: true, faculty: { select: { name: true } } } },
                    },
                  },
                },
              },
              professor: { select: professorDetail },
            },
          },
          members: {
            orderBy: { isLeader: "desc" },
            select: {
              id: true,
              isLeader: true,
              student: {
                select: {
                  id: true,
                  registrationNumber: true,
                  user: { select: personDetail },
                  specialization: { select: { id: true, name: true } },
                },
              },
            },
          },
          milestones: {
            select: { status: true, deadline: true, _count: { select: { submissions: true } } },
          },
        },
      },
      committee: {
        select: { id: true, role: true, professorId: true, professor: { select: professorDetail } },
      },
    },
  });
  if (!d) throw new NotFoundException("Defense not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);

  const now = new Date();
  const ms = d.group.milestones;
  const progress = {
    total: ms.length,
    completed: ms.filter((m) => m.status === "completed").length,
    late: ms.filter((m) => m.status !== "completed" && (m.status === "overdue" || m.deadline < now)).length,
    submissions: ms.reduce((n, m) => n + m._count.submissions, 0),
  };

  // The room's day: what comes before and after in the same place.
  const dayStart = new Date(d.date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MIN);
  const [roomDay, clashes] = await Promise.all([
    prisma.defense.findMany({
      where: { room: d.room, date: { gte: dayStart, lt: dayEnd }, status: { not: "cancelled" } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        durationMinutes: true,
        status: true,
        group: { select: { topic: { select: { title: true } } } },
      },
    }),
    clashesOfDefenses([d]),
  ]);

  const { milestones: _drop, ...group } = d.group;
  return {
    defense: {
      ...d,
      group,
      endsAt: endOf(d),
      progress,
      clashes: clashes.get(d.id) ?? emptyClash(),
      roomDay: roomDay.map((r) => ({
        id: r.id,
        date: r.date,
        endsAt: endOf(r),
        status: r.status,
        title: r.group.topic.title,
        current: r.id === d.id,
      })),
    },
  };
};
