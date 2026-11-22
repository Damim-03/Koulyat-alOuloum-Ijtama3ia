/**
 * أرشيف السنوات — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يبني سنةً بمشروعين ويغلقها ويعيد فتحها. وهنا ما يحتاج سنةً
 * أغنى: درجاتٌ في كلّ تقدير، ومناقشةٌ مكتملة بلا درجة، ومراحل متأخّرة بحالها
 * أو بموعدها، وطلبةٌ بلا مشروع أو بمشروعٍ لم يُناقش، وأساتذةٌ يتساوون في
 * المشاريع فيُرتَّبون بالمواضيع. ثمّ ما يُردّ به الإغلاق وإعادة الفتح.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: {
    academicYear: { findUnique: jest.fn(), findMany: jest.fn() },
    student: { findMany: jest.fn(), count: jest.fn() },
    graduationTopic: { findMany: jest.fn(), count: jest.fn() },
    groupRequest: { groupBy: jest.fn(), count: jest.fn() },
    projectGroup: { findMany: jest.fn(), count: jest.fn() },
    defense: { count: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("../notification/notification.service", () => ({ notifyAdminsQuietly: jest.fn() }));
jest.mock("../../core/realtime/realtime", () => ({ broadcastChange: jest.fn() }));

import { prisma } from "../../core/prisma/client";
import { tr } from "../../core/i18n";
import {
  closeYearService,
  listArchiveYearsService,
  reopenYearService,
  yearReadinessService,
  yearRecordService,
} from "./archive.service";

type Mock = jest.Mock;
const db = prisma as unknown as {
  academicYear: { findUnique: Mock; findMany: Mock };
  student: { findMany: Mock; count: Mock };
  graduationTopic: { findMany: Mock; count: Mock };
  groupRequest: { groupBy: Mock; count: Mock };
  projectGroup: { findMany: Mock; count: Mock };
  defense: { count: Mock };
  user: { findUnique: Mock };
  $transaction: Mock;
};
const tx = {
  academicYearArchive: { create: jest.fn(), delete: jest.fn() },
  academicYear: { update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
};

beforeEach(() => {
  jest.resetAllMocks();
  db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
});

//
// ═══ سنةٌ حيّة ═══
//

const person = (first: string) => ({ firstName: first, lastName: "ب", firstNameLatin: null, lastNameLatin: null, gender: "male", avatarUrl: null });
const spec = (id: string) => ({ id, name: `تخصص ${id}`, level: "master" });
const prof = (id: string) => ({ id, user: person(`أستاذ ${id}`), department: { name: "قسم علم النفس" } });
const defense = (grade: number | null, day: string) => ({
  id: `d-${day}`,
  date: new Date(`2026-06-${day}`),
  durationMinutes: 30,
  room: "A1",
  status: "completed",
  grade,
  notes: null,
  committee: [],
});
const group = (id: string, def: ReturnType<typeof defense> | null, extra: { members?: unknown[]; milestones?: unknown[] } = {}) => ({
  id,
  createdAt: new Date("2026-02-01"),
  members: extra.members ?? [],
  milestones: extra.milestones ?? [],
  defense: def,
});
const topic = (id: string, professor: ReturnType<typeof prof>, projectGroup: ReturnType<typeof group> | null, specId = "X", status = "full") => ({
  id,
  title: `موضوع ${id}`,
  status,
  maxStudents: 2,
  createdAt: new Date("2026-01-01"),
  specialization: spec(specId),
  professor,
  _count: { groupRequests: 0 },
  projectGroup,
});
const student = (id: string, specId: string, member?: { group: string; defense: { status: string; grade: number | null } | null }) => ({
  id,
  registrationNumber: `2026${id}`,
  user: { ...person(`طالب ${id}`), status: "active" },
  specialization: spec(specId),
  projectMembers: member
    ? [{ isLeader: true, group: { id: member.group, topic: { id: `t-${member.group}`, title: "موضوع" }, defense: member.defense } }]
    : [],
});

const PAST = new Date("2020-01-01");
const FUTURE = new Date("2999-01-01");
const [A, B, C, D] = ["A", "B", "C", "D"].map(prof) as [ReturnType<typeof prof>, ReturnType<typeof prof>, ReturnType<typeof prof>, ReturnType<typeof prof>];

async function liveRecord() {
  db.academicYear.findUnique.mockResolvedValueOnce({ id: "y1", title: "2026/2027", isActive: true, archivedAt: null, archive: null });
  db.student.findMany.mockResolvedValueOnce([
    student("s1", "X", { group: "g1", defense: { status: "completed", grade: 17 } }),
    student("s2", "X", { group: "g2", defense: { status: "completed", grade: null } }),
    student("s3", "X"),
    student("s4", "Y", { group: "g3", defense: null }),
  ]);
  db.graduationTopic.findMany.mockResolvedValueOnce([
    topic("t1", A, group("g1", defense(17, "10"), {
      members: [{ isLeader: true, student: { id: "s1", registrationNumber: "2026s1", user: person("طالب s1") } }],
      milestones: [
        { status: "completed", deadline: PAST, _count: { submissions: 2 } },
        { status: "overdue", deadline: FUTURE, _count: { submissions: 1 } },
        { status: "pending", deadline: PAST, _count: { submissions: 0 } },
        { status: "pending", deadline: FUTURE, _count: { submissions: 0 } },
      ],
    })),
    topic("t2", A, group("g2", defense(null, "01"))),
    topic("t3", B, group("g3", null)),
    topic("t4", B, null, "X", "pending"),
    topic("t5", C, group("g5", defense(15, "12"))),
    topic("t6", C, group("g6", defense(13, "13"))),
    topic("t7", C, group("g7", defense(11, "14"))),
    topic("t8", D, group("g8", defense(8, "15")), "Y"),
  ]);
  db.groupRequest.groupBy.mockResolvedValueOnce([
    { status: "pending", _count: { _all: 2 } },
    { status: "accepted", _count: { _all: 1 } },
  ]);
  const res = await yearRecordService("y1");
  expect(res.source).toBe("live");
  return (res as Extract<typeof res, { source: "live" }>).record;
}

describe("سجلّ سنةٍ حيّة", () => {
  /** الدرجات المكتملة وحدها تُحسب: التقديرات كلّها، والمعدّل والأعلى ونسبة النجاح؛ والمكتملة بلا درجة لا تُعدّ. */
  it("الخلاصة: التقديرات الخمسة، والمعدّل، ونسبة النجاح، والطلبات بحالاتها", async () => {
    const { summary } = await liveRecord();
    expect(summary).toMatchObject({
      students: 4,
      studentsWithProject: 3,
      topics: 8,
      topicsByStatus: { full: 7, pending: 1 },
      projects: 7,
      defenses: { total: 6, completed: 6, scheduled: 0, cancelled: 0 },
      graded: 5,
      averageGrade: 12.8,
      bestGrade: 17,
      passRate: 80,
      mentions: { excellent: 1, veryGood: 1, good: 1, fair: 1, fail: 1 },
      requests: { pending: 2, accepted: 1 },
      supervisors: 4,
    });
  });

  it("المشاريع: مراحلها — المتأخّرة بحالها أو بموعدها — والمناقشات بتاريخها", async () => {
    const record = await liveRecord();
    const g1 = record.projects.find((p) => p.id === "g1")!;
    expect(g1.milestones).toEqual({ total: 4, completed: 1, late: 2, submissions: 3 });
    expect(record.projects.find((p) => p.id === "g2")!.defense).toMatchObject({ grade: null, mention: null });
    expect(record.defenses.map((d) => d.projectId)).toEqual(["g2", "g1", "g5", "g6", "g7", "g8"]);
  });

  it("الطلبة: بلا مشروع، وبمشروعٍ لم يُناقش، ونوقش بلا درجة", async () => {
    const byId = new Map((await liveRecord()).students.map((s) => [s.id, s]));
    expect(byId.get("s3")).toMatchObject({ project: null, defense: null });
    expect(byId.get("s4")).toMatchObject({ project: { id: "g3" }, defense: null });
    expect(byId.get("s2")!.defense).toEqual({ status: "completed", grade: null, mention: null });
    expect(byId.get("s1")!.defense).toMatchObject({ mention: "excellent" });
  });

  /** الأساتذة بالمشاريع ثمّ بالمواضيع؛ ومن لا درجة لطلبته لا معدّل له. والتخصّصات بعدد طلبتها. */
  it("الأساتذة بالمشاريع ثمّ بالمواضيع، والتخصّصات بطلبتها", async () => {
    const record = await liveRecord();
    expect(record.supervisors.map((s) => [s.id, s.projects, s.topics])).toEqual([
      ["C", 3, 3],
      ["A", 2, 2],
      ["B", 1, 2],
      ["D", 1, 1],
    ]);
    expect(record.supervisors.find((s) => s.id === "B")!.averageGrade).toBeNull();
    expect(record.bySpecialization.map((s) => [s.id, s.students])).toEqual([
      ["X", 3],
      ["Y", 1],
    ]);
    expect(record.topics[0]!.department).toBe("قسم علم النفس");
  });
});

//
// ═══ قائمة السنوات ═══
//

describe("listArchiveYearsService", () => {
  /** المغلقة تقرأ أرقامها المجمَّدة؛ ولا سنة مفتوحة ⇒ لا تُعدّ مشاريع حيّة أصلاً. */
  it("كلّها مغلقة ⇒ أرقامها المجمَّدة، ولا عدّ حيّ", async () => {
    db.academicYear.findMany.mockResolvedValueOnce([
      {
        id: "y0",
        title: "2025/2026",
        isActive: false,
        archivedAt: new Date("2026-07-01"),
        archive: {
          summary: { students: 3, topics: 2, projects: 1, defenses: { completed: 1 }, averageGrade: 14 },
          createdAt: new Date("2026-07-01"),
          archivedByName: "المسؤول",
        },
        _count: { students: 0, topics: 0 },
      },
    ]);
    const { items } = await listArchiveYearsService();
    expect(db.projectGroup.findMany).not.toHaveBeenCalled();
    expect(items[0]).toMatchObject({
      archivedByName: "المسؤول",
      counts: { students: 3, topics: 2, projects: 1, defended: 1, averageGrade: 14 },
    });
  });
});

//
// ═══ الجاهزية للإغلاق ═══
//

describe("yearReadinessService", () => {
  it("سنةٌ غير موجودة ⇒ 404", async () => {
    db.academicYear.findUnique.mockResolvedValueOnce(null);
    await expect(yearReadinessService("nope")).rejects.toMatchObject({ statusCode: 404 });
  });

  /** كلّ بندٍ «سليم» حين يكون صفراً، وإلّا فتنبيهٌ أو معلومة — بحسب ثقله. */
  it("كلّ بندٍ بثقله حين لا يكون صفراً، وسليمٌ حين يكون", async () => {
    const readiness = async (c: { topics: number; requests: number; noDefense: number; scheduled: number; ungraded: number; students: number }) => {
      db.academicYear.findUnique.mockResolvedValueOnce({ id: "y1", title: "2026/2027", archivedAt: null });
      db.graduationTopic.count.mockResolvedValueOnce(c.topics);
      db.groupRequest.count.mockResolvedValueOnce(c.requests);
      db.projectGroup.count.mockResolvedValueOnce(c.noDefense);
      db.defense.count.mockResolvedValueOnce(c.scheduled).mockResolvedValueOnce(c.ungraded).mockResolvedValueOnce(1);
      db.student.count.mockResolvedValueOnce(c.students);
      const r = await yearReadinessService("y1");
      return Object.fromEntries(r.items.map((i) => [i.key, i.level]));
    };

    expect(await readiness({ topics: 0, requests: 2, noDefense: 0, scheduled: 3, ungraded: 1, students: 4 })).toEqual({
      scheduledDefenses: "warn",
      ungraded: "warn",
      noDefense: "ok",
      pendingRequests: "info",
      pendingTopics: "ok",
      studentsWithout: "info",
    });
    expect(await readiness({ topics: 1, requests: 0, noDefense: 2, scheduled: 0, ungraded: 0, students: 0 })).toEqual({
      scheduledDefenses: "ok",
      ungraded: "ok",
      noDefense: "warn",
      pendingRequests: "ok",
      pendingTopics: "info",
      studentsWithout: "ok",
    });
  });
});

//
// ═══ الإغلاق وإعادة الفتح ═══
//

describe("closeYearService", () => {
  const OPEN = { id: "y1", title: "2026/2027", archivedAt: null };
  const close = (dto: Record<string, string>) => closeYearService("admin-1", "y1", { confirmTitle: "2026/2027", ...dto });

  it("سنةٌ غير موجودة ⇒ 404", async () => {
    db.academicYear.findUnique.mockResolvedValueOnce(null);
    await expect(close({})).rejects.toMatchObject({ statusCode: 404 });
  });

  /** السنة التالية سنةٌ أخرى مفتوحة — أو عنوانٌ جديد لا يوجد بعد. */
  it.each<[string, unknown, Record<string, string>, string]>([
    ["سنةٌ تالية غير موجودة", null, { nextYearId: "y9" }, tr("archive.badNextYear")],
    ["والسنة نفسها", OPEN, { nextYearId: "y1" }, tr("archive.badNextYear")],
    ["وسنةٌ تالية مؤرشفة", { id: "y0", archivedAt: new Date() }, { nextYearId: "y0" }, tr("archive.nextArchived")],
    ["وعنوانٌ جديد موجودٌ مسبقاً", { id: "y2" }, { nextYearTitle: " 2027/2028 " }, tr("archive.nextExists", { title: "2027/2028" })],
  ])("%s ⇒ 400، ولا يُغلق شيء", async (_l, found, dto, message) => {
    db.academicYear.findUnique.mockResolvedValueOnce(OPEN).mockResolvedValueOnce(found);
    await expect(close(dto)).rejects.toMatchObject({ statusCode: 400, message });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  /** وعنوانٌ جديد ⇒ تُنشأ السنة مع الإغلاق وتصير الجارية. ومسؤولٌ بلا اسم ⇒ لا اسم في السجلّ، لا فراغ. */
  it("عنوانٌ جديد ⇒ تُنشأ وتصير الجارية؛ ومسؤولٌ بلا اسم ⇒ لا اسم", async () => {
    db.academicYear.findUnique.mockResolvedValueOnce(OPEN).mockResolvedValueOnce(null);
    db.user.findUnique.mockResolvedValueOnce({ firstName: null, lastName: null });
    db.student.findMany.mockResolvedValueOnce([]);
    db.graduationTopic.findMany.mockResolvedValueOnce([]);
    db.groupRequest.groupBy.mockResolvedValueOnce([]);
    tx.academicYear.create.mockResolvedValueOnce({ id: "y-new" });

    const res = await close({ nextYearTitle: "2027/2028" });

    expect(res).toMatchObject({ archived: true, activeYearId: "y-new" });
    expect(tx.academicYearArchive.create.mock.calls[0]![0].data).toMatchObject({ archivedByName: null, note: null });
    expect(tx.academicYear.create).toHaveBeenCalledWith({ data: { title: "2027/2028", isActive: false } });
    expect(tx.academicYear.update).toHaveBeenLastCalledWith({ where: { id: "y-new" }, data: { isActive: true } });
  });
});

describe("reopenYearService", () => {
  it("سنةٌ غير موجودة ⇒ 404", async () => {
    db.academicYear.findUnique.mockResolvedValueOnce(null);
    await expect(reopenYearService("nope", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  /** أُغلقت بلا سجلٍّ مجمَّد (قبل أن يُحفظ السجلّ): تعود مفتوحة، ولا شيء يُحذف. وبلا «فعِّلها» تبقى غير جارية. */
  it("مؤرشفةٌ بلا سجلٍّ مجمَّد، وبلا تفعيل ⇒ تُفتح فقط", async () => {
    db.academicYear.findUnique.mockResolvedValueOnce({ id: "y0", archivedAt: new Date("2026-07-01"), archive: null });

    expect(await reopenYearService("y0", {})).toEqual({ reopened: true, active: false });
    expect(tx.academicYearArchive.delete).not.toHaveBeenCalled();
    expect(tx.academicYear.updateMany).not.toHaveBeenCalled();
    expect(tx.academicYear.update).toHaveBeenCalledWith({ where: { id: "y0" }, data: { archivedAt: null } });
  });
});
