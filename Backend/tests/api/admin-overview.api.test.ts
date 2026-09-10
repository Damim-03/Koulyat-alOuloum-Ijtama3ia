/**
 * آخر تسعة مسارات: لوحة الإدارة وإحصاءاتها، جرس الإشعارات، الموضوع المُسنَد،
 * و«من أنا».
 *
 * أكثرها قراءةٌ فقط، وهذا لا يجعلها بلا خطر — بل ينقل الخطر من الكتابة إلى
 * **ما يُرى ومَن يراه**:
 *
 *   **الجرس شخصيّ.** كل عمليات الإشعارات تمرّ بـ`updateMany({ id, userId })`،
 *     والمعرّف وحده لا يكفي. ولو سقط `userId` من أحدها لصار أيّ مدير يُطفئ
 *     إشعارات غيره — بلا خطأ، بلا أثر، وبلا أن يلاحظ أحد.
 *
 *   **العدّاد يجب أن يتحرّك.** لوحةٌ تعرض رقماً ثابتاً أسوأ من لوحةٍ لا تعرض
 *     شيئاً: الأولى تُطمئن كذباً. ولذلك كل تأكيدٍ هنا **فرقٌ** بين قراءتين لا
 *     قيمةٌ مطلقة — فالقاعدة فيها صفوفٌ من اختباراتٍ أخرى، والرقم المطلق
 *     يجعل الاختبار هشّاً بلا أن يجعله أدقّ.
 *
 *   **الإسناد كتابةٌ تتنكّر في صورة تحرير.** «عدّل الموضوع المُسنَد» قد
 *     يُنشئ مجموعةً، أو يُخرج طالباً من مشروعه، أو يضع سقفاً تحت فريقٍ قائم.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let ownerToken = "";
let studentToken = "";
let professorToken = "";

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const NO_SUCH_ID = "00000000-0000-0000-0000-000000000000";
let n = 0;

/** إشعارٌ لصاحبٍ بعينه. */
const notify = (userId: string, read = false) =>
  prisma.notification.create({
    data: {
      userId,
      type: "general",
      title: `${TAG} إشعار ${++n}`,
      message: `${TAG} نصّ`,
      isRead: read,
    },
  });

const bell = {
  list: (query: Record<string, string> = {}) =>
    as(request(app).get("/api/admin/notifications").query(query)),
  count: () => as(request(app).get("/api/admin/notifications/unread-count")),
  readOne: (id: string) =>
    as(request(app).patch(`/api/admin/notifications/${id}/read`)),
  readAll: () => as(request(app).patch("/api/admin/notifications/read-all")),
};

const unread = async () => (await bell.count().expect(200)).body.unread as number;

beforeAll(async () => {
  await teardown();
  f = await seed(60);

  const login = async (path: string, body: Record<string, string>) =>
    (await request(app).post(path).send(body).expect(200)).body
      .accessToken as string;

  adminToken = await login("/api/auth/admin/login", {
    email: f.admin.email!,
    password: TEST_PASSWORD,
  });
  ownerToken = await login("/api/auth/admin/login", {
    email: f.owner.email!,
    password: TEST_PASSWORD,
  });
  studentToken = await login("/api/auth/student/login", {
    registrationNumber: f.students[0]!.reg,
    password: TEST_PASSWORD,
  });
  professorToken = await login("/api/auth/professor/login", {
    universityEmail: f.professor.universityEmail,
    password: TEST_PASSWORD,
  });
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ جرس الإشعارات ═══
//

describe("جرس الإشعارات", () => {
  it("العدّاد يرتفع بإشعارٍ جديد، ولا يعدّ المقروء", async () => {
    const before = await unread();

    await notify(f.admin.id);
    await notify(f.admin.id);
    await notify(f.admin.id, true); // مقروءٌ سلفاً

    expect(await unread()).toBe(before + 2);
  });

  it("والقائمة تُصفّح، وتذكر الإجمالي وغير المقروء", async () => {
    await notify(f.admin.id);
    await notify(f.admin.id);
    await notify(f.admin.id);

    const page1 = await bell.list({ page: "1", limit: "2" }).expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.page).toBe(1);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.total).toBeGreaterThanOrEqual(3);

    const page2 = await bell.list({ page: "2", limit: "2" }).expect(200);
    const ids1 = page1.body.items.map((i: { id: string }) => i.id);
    const ids2 = page2.body.items.map((i: { id: string }) => i.id);
    // صفحتان لا تتقاطعان — وإلا لَرأى المستخدم الشيء مرّتين وفاته غيره.
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
  });

  it("و«غير المقروء فقط» يُرشِّح فعلاً", async () => {
    const fresh = await notify(f.admin.id);
    const old = await notify(f.admin.id, true);

    const res = await bell.list({ unread: "true" }).expect(200);
    const ids = res.body.items.map((i: { id: string }) => i.id);

    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(old.id);
  });

  it("وتعليم واحدٍ مقروءاً يُنقص العدّاد واحداً", async () => {
    const note = await notify(f.admin.id);
    const before = await unread();

    const res = await bell.readOne(note.id).expect(200);
    expect(res.body.updated).toBe(1);

    expect(await unread()).toBe(before - 1);
    expect(
      (await prisma.notification.findUnique({ where: { id: note.id } }))!.isRead,
    ).toBe(true);
  });

  /**
   * `updated` عددُ الصفوف **المطابِقة** لا المتغيّرة — هكذا تعدّها MariaDB،
   * فتعليم إشعارٍ مقروءٍ سلفاً يُعيد ١ لا ٠. وهذا مقبول ما دام العدّاد نفسه
   * لا يتحرّك؛ والمهمّ ألّا تُقرأ القيمة على أنها «كم تغيّر» في واجهةٍ تبني
   * عليها شيئاً.
   */
  it("وتعليمه مرّتين لا يُنقص العدّاد مرّتين", async () => {
    const note = await notify(f.admin.id);
    await bell.readOne(note.id).expect(200);

    const before = await unread();
    await bell.readOne(note.id).expect(200);

    expect(await unread()).toBe(before);
  });

  /**
   * هذا هو الحارس الحقيقي في هذه المجموعة: الشرط `{ id, userId }` معاً.
   * فمعرّف الإشعار وحده يُرسَل من العميل، ولو حُذف `userId` من الشرط لصار
   * أيّ مديرٍ يُطفئ جرس غيره — والرمز صحيح، والدور صحيح، والفعل مسروق.
   *
   * والردّ ٢٠٠ بـ`updated: 0` لا ٤٠٤ عن قصد: ٤٠٤ تقول «هذا المعرّف غير
   * موجود» و٤٠٣ تقول «موجودٌ وليس لك» — وكلتاهما تكشف ما لا يخصّ السائل.
   */
  it("ولا يُعلّم أحدٌ إشعار غيره مقروءاً", async () => {
    const foreign = await notify(f.owner.id);
    const ownerBefore = await prisma.notification.count({
      where: { userId: f.owner.id, isRead: false },
    });

    const res = await bell.readOne(foreign.id).expect(200);
    expect(res.body.updated).toBe(0);

    expect(
      (await prisma.notification.findUnique({ where: { id: foreign.id } }))!
        .isRead,
    ).toBe(false);
    expect(
      await prisma.notification.count({
        where: { userId: f.owner.id, isRead: false },
      }),
    ).toBe(ownerBefore);
  });

  it("ومعرّفٌ لا وجود له ⇒ 200 بلا تغيير، لا 404 تكشف", async () => {
    const res = await bell.readOne(NO_SUCH_ID).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it("و«اقرأ الكلّ» يُصفّر عدّاد صاحبه وحده", async () => {
    await notify(f.admin.id);
    await notify(f.admin.id);
    const foreign = await notify(f.owner.id);

    const res = await bell.readAll().expect(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(2);
    expect(await unread()).toBe(0);

    // وجرس المالك لم يُمَسّ.
    expect(
      (await prisma.notification.findUnique({ where: { id: foreign.id } }))!
        .isRead,
    ).toBe(false);
  });

  it("و«اقرأ الكلّ» على جرسٍ فارغ ⇒ صفرٌ بلا عطل", async () => {
    await bell.readAll().expect(200);
    const res = await bell.readAll().expect(200);
    expect(res.body.updated).toBe(0);
  });

  it("وحدٌّ خارج المدى في التصفّح ⇒ 400", async () => {
    await bell.list({ limit: "500" }).expect(400);
    await bell.list({ page: "0" }).expect(400);
  });
});

//
// ═══ إحصاءات النظرة العامّة ═══
//

describe("إحصاءات النظرة العامّة", () => {
  it("تصل بالحقول الستّة كلّها أعداداً", async () => {
    const res = await as(request(app).get("/api/admin/stats/overview")).expect(
      200,
    );

    expect(Object.keys(res.body.stats).sort()).toEqual([
      "approvedTopics",
      "defenses",
      "professors",
      "projects",
      "students",
      "topics",
    ]);
    for (const v of Object.values(res.body.stats))
      expect(typeof v).toBe("number");
  });

  it("وأعدادها تتحرّك مع البيانات", async () => {
    const before = (await as(request(app).get("/api/admin/stats/overview")))
      .body.stats;

    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} إحصاء ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 2,
        status: "approved",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const after = (await as(request(app).get("/api/admin/stats/overview")))
      .body.stats;
    expect(after.topics).toBe(before.topics + 1);
    expect(after.approvedTopics).toBe(before.approvedTopics + 1);
  });
});

//
// ═══ لوحة الإدارة ═══
//

describe("لوحة الإدارة", () => {
  type Dash = {
    stats: Record<string, number>;
    trends: Record<string, { current: number; previous: number; delta: number }>;
    academicYear: { id: string; title: string } | null;
    topicBreakdown: { status: string; count: number }[];
    systemHealth: Record<string, number>;
    attention: Record<string, unknown[]>;
    pendingProposals: { id: string }[];
    studentsPerSpecialization: { id: string; count: number }[];
    monthlyGrowth: unknown[];
    recentRequests: unknown[];
    upcomingDefenses: unknown[];
  };

  const dash = async () =>
    (await as(request(app).get("/api/admin/dashboard")).expect(200))
      .body as Dash;

  it("تصل بكل أقسامها", async () => {
    const d = await dash();

    for (const key of [
      "stats",
      "trends",
      "topicBreakdown",
      "systemHealth",
      "attention",
      "pendingProposals",
      "recentRequests",
      "upcomingDefenses",
      "studentsPerSpecialization",
      "monthlyGrowth",
    ] as const) {
      expect(d[key]).toBeDefined();
    }
  });

  /**
   * التوزيع يذكر كل حالةٍ ولو كان عددها صفراً. شاشةٌ تبني أعمدةً من هذه
   * القائمة تحتاج العمود الفارغ ليبقى مكانه، لا أن يختفي فتتزحزح البقيّة.
   */
  it("وتوزيع الحالات يذكر الستّ كلّها ولو بأصفار", async () => {
    const d = await dash();
    const statuses = d.topicBreakdown.map((r) => r.status);

    expect(statuses).toEqual([
      ...new Set(statuses), // بلا تكرار
    ]);
    for (const s of ["pending", "approved", "open", "full", "rejected", "archived"])
      expect(statuses).toContain(s);
  });

  it("وصحّة النظام: المجموع هو النشط زائد الموقوف", async () => {
    const h = (await dash()).systemHealth;
    expect(h.totalAccounts).toBe(h.activeUsers! + h.suspendedUsers!);
  });

  it("والاتّجاه يحمل الحالي والسابق والفرق بينهما", async () => {
    const t = (await dash()).trends;
    for (const key of ["students", "topics", "requests"] as const) {
      expect(t[key]!.delta).toBe(t[key]!.current - t[key]!.previous);
    }
  });

  it("والسنة النشطة هي المفعّلة لا أوّل ما يُصادَف", async () => {
    const year = await prisma.academicYear.create({
      data: { title: `${TAG} سنة اللوحة ${++n}` },
    });
    await as(
      request(app).patch(`/api/admin/academic-years/${year.id}/activate`),
    ).expect(200);

    expect((await dash()).academicYear?.id).toBe(year.id);
  });

  it("والمقترحات المعلَّقة تظهر، والمعتمَدة لا", async () => {
    const pending = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} مقترح معلّق ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 2,
        status: "pending",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const d = await dash();
    expect(d.pendingProposals.map((p) => p.id)).toContain(pending.id);
    expect(d.stats.pendingTopics).toBeGreaterThanOrEqual(1);
  });

  it("والطلبة لكل تخصّص يعدّون فعلاً", async () => {
    const d = await dash();
    const row = d.studentsPerSpecialization.find(
      (r) => r.id === f.specialization.id,
    );

    expect(row).toBeDefined();
    expect(row!.count).toBe(
      await prisma.student.count({
        where: { specializationId: f.specialization.id },
      }),
    );
  });
});

//
// ═══ الموضوع المُسنَد ═══
//

describe("إسناد موضوعٍ بفريقه", () => {
  const assigned = (over: Record<string, unknown> = {}) => {
    const team = (over.memberStudentIds as string[]) ?? [];
    return {
      title: `${TAG} مُسنَد ${++n}`,
      description: `${TAG} وصف المُسنَد`,
      maxStudents: 3,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
      memberStudentIds: team,
      leaderStudentId: team[0],
      ...over,
    };
  };

  const create = (body: Record<string, unknown>) =>
    as(request(app).post("/api/admin/topics/assigned")).send(body);

  /**
   * المُسنَد يولد **معتمَداً ومحجوزاً وغير منشور**: `status` يقرأ `full` من
   * الإسقاط لأن له مجموعة، و`publishedAt` يبقى فارغاً لأنه لم يُعرَض على
   * الطلبة قطّ. ولو كُتب `full` حرفياً لعاد الخلط الذي عالجناه.
   */
  it("يُنشئ موضوعاً محجوزاً بمجموعته، ولا يُعدّ منشوراً", async () => {
    const team = f.nextStudents(2);
    const res = await create(
      assigned({
        memberStudentIds: team.map((s) => s.id),
        leaderStudentId: team[1]!.id,
      }),
    );
    expect([200, 201]).toContain(res.status);

    const topicId = (res.body.topic ?? res.body).id as string;
    const topic = (await prisma.graduationTopic.findUnique({
      where: { id: topicId },
      include: { projectGroup: { include: { members: true } } },
    }))!;

    expect(topic.status).toBe("full");
    expect(topic.publishedAt).toBeNull();
    expect(topic.projectGroup).not.toBeNull();
    expect(topic.projectGroup!.members).toHaveLength(2);

    // والمرسِل هو من سُمّي، لا أوّل القائمة.
    const leader = topic.projectGroup!.members.find((m) => m.isLeader)!;
    expect(leader.studentId).toBe(team[1]!.id);
  });

  it("ويُشعِر الطلبة المُسنَدين", async () => {
    const team = f.nextStudents(2);
    await create(
      assigned({
        memberStudentIds: team.map((s) => s.id),
        leaderStudentId: team[0]!.id,
      }),
    );

    for (const s of team)
      expect(
        await prisma.notification.count({ where: { userId: s.userId } }),
      ).toBeGreaterThan(0);
  });

  it("وطالبٌ له مشروع لا يُسنَد مرّتين", async () => {
    const team = f.nextStudents(2);
    await create(
      assigned({
        memberStudentIds: team.map((s) => s.id),
        leaderStudentId: team[0]!.id,
      }),
    );

    const free = f.nextStudents(1)[0]!;
    const res = await create(
      assigned({
        memberStudentIds: [free.id, team[0]!.id],
        leaderStudentId: free.id,
      }),
    ).expect(400);
    expect(res.body.message).toContain("مشروع");
  });

  it("وطالبٌ غير موجود ⇒ 400", async () => {
    const [s] = f.nextStudents(1);
    const res = await create(
      assigned({
        memberStudentIds: [s!.id, NO_SUCH_ID],
        leaderStudentId: s!.id,
      }),
    ).expect(400);
    expect(res.body.message).toContain("غير موجودين");
  });

  it("والمرسِل من خارج الفريق ⇒ 400", async () => {
    const team = f.nextStudents(2);
    const outsider = f.nextStudents(1)[0]!;

    await create(
      assigned({
        memberStudentIds: team.map((s) => s.id),
        leaderStudentId: outsider.id,
      }),
    ).expect(400);
  });

  it.each([
    ["أستاذ", "professorId"],
    ["تخصّص", "specializationId"],
    ["سنة", "academicYearId"],
  ])("و%s غير موجود ⇒ 404", async (_l, field) => {
    const [s] = f.nextStudents(1);
    await create(
      assigned({
        memberStudentIds: [s!.id],
        leaderStudentId: s!.id,
        [field]: NO_SUCH_ID,
      }),
    ).expect(404);
  });

  it("والفشل لا يترك موضوعاً بلا مجموعة", async () => {
    const before = await prisma.graduationTopic.count();
    const [s] = f.nextStudents(1);

    await create(
      assigned({
        memberStudentIds: [s!.id, NO_SUCH_ID],
        leaderStudentId: s!.id,
      }),
    ).expect(400);

    expect(await prisma.graduationTopic.count()).toBe(before);
  });
});

//
// ═══ تعديل الإسناد ═══
//

describe("تعديل الموضوع المُسنَد", () => {
  /** موضوعٌ مُسنَدٌ جاهز، ومعه فريقه. */
  async function assignedTopic(memberCount = 2, maxStudents = 3) {
    const team = f.nextStudents(memberCount);
    const res = await as(request(app).post("/api/admin/topics/assigned")).send({
      title: `${TAG} للتعديل ${++n}`,
      description: `${TAG} وصف`,
      maxStudents,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
      memberStudentIds: team.map((s) => s.id),
      leaderStudentId: team[0]!.id,
    });
    const id = (res.body.topic ?? res.body).id as string;
    return { id, team };
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    as(request(app).patch(`/api/admin/topics/${id}/assignment`)).send(body);

  it("تعديل العنوان والمشرف وحدهما لا يمسّ الفريق", async () => {
    const { id, team } = await assignedTopic(2);

    await patch(id, {
      title: `${TAG} عنوان معدّل`,
      professorId: f.professor2.id,
    }).expect(200);

    const topic = (await prisma.graduationTopic.findUnique({
      where: { id },
      include: { projectGroup: { include: { members: true } } },
    }))!;
    expect(topic.title).toBe(`${TAG} عنوان معدّل`);
    expect(topic.professorId).toBe(f.professor2.id);
    expect(topic.projectGroup!.members.map((m) => m.studentId).sort()).toEqual(
      team.map((s) => s.id).sort(),
    );
  });

  /**
   * سقفٌ يُرسَل وحده كان يتسلّل من فحصٍ لا يجري إلا مع قائمة الطلبة — فيصير
   * الحدّ الأقصى واحداً تحت فريقٍ من ثلاثة. عددٌ يناقض ما تحته، ولا شيء
   * يقوله.
   */
  it("وسقفٌ أقلّ من عدد الفريق القائم ⇒ 400 ولو أُرسل وحده", async () => {
    const { id } = await assignedTopic(3, 3);

    const res = await patch(id, { maxStudents: 1 }).expect(400);
    expect(res.body.message).toContain("الحدّ الأقصى");

    expect(
      (await prisma.graduationTopic.findUnique({ where: { id } }))!.maxStudents,
    ).toBe(3);
  });

  it("ورفع السقف مسموح", async () => {
    const { id } = await assignedTopic(2, 2);
    await patch(id, { maxStudents: 5 }).expect(200);

    expect(
      (await prisma.graduationTopic.findUnique({ where: { id } }))!.maxStudents,
    ).toBe(5);
  });

  it("واستبدال الفريق يستبدله كاملاً", async () => {
    const { id, team } = await assignedTopic(2);
    const replacement = f.nextStudents(2);

    await patch(id, {
      memberStudentIds: replacement.map((s) => s.id),
      leaderStudentId: replacement[0]!.id,
    }).expect(200);

    const members = await prisma.projectMember.findMany({
      where: { group: { topicId: id } },
    });
    expect(members.map((m) => m.studentId).sort()).toEqual(
      replacement.map((s) => s.id).sort(),
    );
    // والقدامى خرجوا فعلاً، فصاروا متاحين لمشروعٍ آخر.
    for (const old of team)
      expect(members.some((m) => m.studentId === old.id)).toBe(false);
  });

  it("وفريقٌ فارغ ⇒ 400: المشروع لا يبقى بلا أحد", async () => {
    const { id } = await assignedTopic(2);
    await patch(id, { memberStudentIds: [], leaderStudentId: null }).expect(400);
  });

  it("ومرسِلٌ من خارج القائمة ⇒ 400", async () => {
    const { id } = await assignedTopic(2);
    const team = f.nextStudents(2);
    const outsider = f.nextStudents(1)[0]!;

    const res = await patch(id, {
      memberStudentIds: team.map((s) => s.id),
      leaderStudentId: outsider.id,
    }).expect(400);
    expect(res.body.message).toContain("المرسِل");
  });

  it("وطالبٌ مكرّر في القائمة ⇒ 400", async () => {
    const { id } = await assignedTopic(2);
    const [s] = f.nextStudents(1);

    const res = await patch(id, {
      memberStudentIds: [s!.id, s!.id],
      leaderStudentId: s!.id,
    }).expect(400);
    expect(res.body.message).toContain("مكرّر");
  });

  it("وطالبٌ جديدٌ له مشروع آخر ⇒ 400", async () => {
    const busy = await assignedTopic(1);
    const target = await assignedTopic(1);
    const keep = target.team[0]!;

    const res = await patch(target.id, {
      memberStudentIds: [keep.id, busy.team[0]!.id],
      leaderStudentId: keep.id,
    }).expect(400);
    expect(res.body.message).toContain("مشروع");
  });

  /**
   * إسناد مجموعةٍ إلى موضوعٍ ينتظر فريقٌ قرارَه يتخطّاهم بلا ردّ: تُنشأ
   * المجموعة، ويصير الموضوع محجوزاً، ويبقى طلبهم معلّقاً على موضوعٍ مأخوذ.
   * ولذلك يمرّ هذا الطريق بجدول القواعد نفسه الذي يحرس بقيّة الإجراءات.
   */
  it("وإسناد فريقٍ إلى موضوعٍ ينتظره فريقٌ آخر ⇒ يُمنع بسببٍ مذكور", async () => {
    const topic = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} ينتظره فريق ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 3,
        status: "open",
        publishedAt: new Date(),
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const waiting = f.nextStudents(1)[0]!;
    await prisma.groupRequest.create({
      data: {
        topicId: topic.id,
        activeTopicId: topic.id,
        leaderStudentId: waiting.id,
        priority: 1,
        status: "pending",
        members: { create: [{ studentId: waiting.id }] },
      },
    });

    const team = f.nextStudents(2);
    const res = await patch(topic.id, {
      memberStudentIds: team.map((s) => s.id),
      leaderStudentId: team[0]!.id,
    }).expect(400);

    expect(res.body.message).toBeTruthy();
    expect(
      await prisma.projectGroup.findFirst({ where: { topicId: topic.id } }),
    ).toBeNull();
  });

  it("وموضوعٌ غير موجود ⇒ 404", async () => {
    await patch(NO_SUCH_ID, { title: `${TAG} لا شيء` }).expect(404);
  });

  it.each([
    ["أستاذ", "professorId"],
    ["تخصّص", "specializationId"],
    ["سنة", "academicYearId"],
  ])("و%s غير موجود في التعديل ⇒ 404", async (_l, field) => {
    const { id } = await assignedTopic(1);
    await patch(id, { [field]: NO_SUCH_ID }).expect(404);
  });
});

//
// ═══ «من أنا» ═══
//

describe("GET /api/auth/me", () => {
  const me = (token: string) =>
    request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

  it("بلا رمز ⇒ 401", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("والمدير يعرف نفسه بمعرّف حسابه", async () => {
    const res = await me(adminToken).expect(200);

    expect(res.body.user.id).toBe(f.admin.id);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.email).toBe(f.admin.email);
  });

  it("والمالك دورُه owner لا admin", async () => {
    const res = await me(ownerToken).expect(200);
    expect(res.body.user.role).toBe("owner");
  });

  /**
   * للطالب والأستاذ يُعاد **معرّف الملفّ** لا معرّف الحساب. وهذا فرقٌ تعتمد
   * عليه الواجهة في كل نداءٍ بعده، فخلطه يجعلها تسأل عن شخصٍ لا وجود له.
   */
  it("والطالب يعرف نفسه بمعرّف ملفّه ورقم تسجيله", async () => {
    const res = await me(studentToken).expect(200);
    const s = f.students[0]!;

    expect(res.body.user.id).toBe(s.id); // Student.id
    expect(res.body.user.id).not.toBe(s.userId); // لا User.id
    expect(res.body.user.role).toBe("student");
    expect(res.body.user.registrationNumber).toBe(s.reg);
  });

  it("والأستاذ بمعرّف ملفّه وبريده الجامعي", async () => {
    const res = await me(professorToken).expect(200);

    expect(res.body.user.id).toBe(f.professor.id);
    expect(res.body.user.role).toBe("professor");
    expect(res.body.user.universityEmail).toBe(f.professor.universityEmail);
  });

  it("ولا تُعاد كلمة السرّ ولا نسختها المُعمّاة", async () => {
    for (const token of [adminToken, studentToken, professorToken]) {
      const res = await me(token).expect(200);
      const body = JSON.stringify(res.body);

      expect(res.body.user.password).toBeUndefined();
      expect(body).not.toContain("password");
      expect(body).not.toContain("$2"); // بادئة bcrypt
    }
  });

  it("وحسابٌ حُذف بعد إصدار رمزه ⇒ لا يُجاب بـ200", async () => {
    const ghost = await prisma.user.create({
      data: {
        firstName: TAG,
        lastName: "Vanish",
        email: `${TAG}.vanish@test.local`,
        password: f.admin.password,
        role: "admin",
      },
    });
    const token = (
      await request(app)
        .post("/api/auth/admin/login")
        .send({ email: ghost.email, password: TEST_PASSWORD })
    ).body.accessToken as string;

    await prisma.user.delete({ where: { id: ghost.id } });

    const res = await me(token);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
