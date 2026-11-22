/**
 * الإدارة — طلبات المجموعات: ما يُرسله المسار للشاشة.
 *
 * جدول القواعد مُختبَرٌ صرفاً في `request-actions.test.ts`. وهذا الملفّ يسأل
 * سؤالاً آخر: **هل يصل؟** فدالّةٌ صحيحة لا يُرفقها المسار بالردّ لا تنفع
 * شاشةً، والشاشة عندئذٍ تعود إلى التخمين.
 *
 * وشيئان يُختبَران هنا ولا يُختبَران هناك:
 *
 *   **أن `hasGroup` حقيقيّ.** لو سقط `projectGroup` من الـ`include` لبقي
 *     كاذباً أبداً، فصار الجدول أسوأ من غيابه: يقول «يجوز» عن إجراءٍ يردّه
 *     الخادم بعد ضغطة.
 *
 *   **أن العدّادات تتبع الفلاتر.** كانت الشاشة تحسبها بثلاثة نداءاتٍ لا
 *     تُمرّر فلاترها، فيقول الشريط «١ معلّقة» فوق قائمةٍ فارغة.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { computeTopicStatus } from "../../src/core/topic/topic-status";
import { tr } from "../../src/core/i18n";
import { acceptGroupRequestService } from "../../src/modules/admin/admin.service";
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
let n = 0;

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const list = (query: Record<string, string> = {}) =>
  as(request(app).get("/api/admin/group-requests").query(query));

/** موضوعٌ لأحد الأستاذين بالحالة المطلوبة. */
const topicFor = (
  professorId: string,
  status = "open",
  maxStudents = 3,
) =>
  prisma.graduationTopic.create({
    data: {
      title: `${TAG} طلبات ${++n}`,
      description: `${TAG} وصف`,
      maxStudents,
      status: status as never,
      publishedAt: status === "open" || status === "full" ? new Date() : null,
      professorId,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });

/** طلبٌ على موضوع، بالحالة والأعضاء المطلوبين. */
const requestOn = async (
  topicId: string,
  status: "pending" | "accepted" | "rejected",
  count = 2,
) => {
  const team = f.nextStudents(count);
  const created = await prisma.groupRequest.create({
    data: {
      topicId,
      leaderStudentId: team[0]!.id,
      priority: 1,
      status,
      members: { create: team.map((s) => ({ studentId: s.id })) },
    },
  });
  // As the services do after every change to a topic's requests.
  await computeTopicStatus(prisma, topicId);
  return created;
};

const find = (body: unknown, id: string) =>
  (body as { items: { id: string; actions?: Record<string, unknown> }[] }).items.find(
    (r) => r.id === id,
  );

beforeAll(async () => {
  await teardown();
  f = await seed(80);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email!, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ جدول القواعد يصل مع كل طلب ═══
//

describe("جدول القواعد في ردّ القائمة", () => {
  it("طلبٌ معلَّق على موضوعٍ حرّ ⇒ يجوز القبول والرفض، بلا أسباب", async () => {
    const topic = await topicFor(f.professor.id);
    const req = await requestOn(topic.id, "pending");

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions).toMatchObject({ canAccept: true, canReject: true });
    expect(row.actions!.blockedReasons).toEqual({});
  });

  /**
   * هذا هو الشرط الذي لا تراه الشاشة بغير الجدول: وجود المجموعة ليس في حالة
   * الطلب ولا في حالة الموضوع كما تقرأهما.
   */
  it("وطلبٌ مقبولٌ تشكّل له مشروع ⇒ يُمنع الاثنان، والرفض يدلّ على البديل", async () => {
    const topic = await topicFor(f.professor.id, "full");
    const group = await prisma.projectGroup.create({
      data: { topicId: topic.id },
    });
    const req = await requestOn(topic.id, "accepted");
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: req.leaderStudentId, isLeader: true },
    });

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions).toMatchObject({ canAccept: false, canReject: false });
    expect(row.actions!.blockedReasons).toMatchObject({
      accept: expect.stringContaining("مقبولٌ بالفعل"),
      reject: expect.stringContaining("افسخ المذكرة"),
    });
  });

  it("وطلبٌ معلَّق على موضوعٍ سبقه فريقٌ آخر ⇒ يُمنع القبول ويبقى الرفض", async () => {
    const topic = await topicFor(f.professor.id, "full");
    await prisma.projectGroup.create({ data: { topicId: topic.id } });
    const req = await requestOn(topic.id, "pending");

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions).toMatchObject({ canAccept: false, canReject: true });
    expect(row.actions!.blockedReasons).toMatchObject({
      accept: expect.stringContaining("سبقهم"),
    });
  });

  /**
   * الكسر الصامت الذي يحرسه هذا التأكيد: لو سقط `projectGroup` من الـ`include`
   * لقال الجدول «يجوز القبول» — ولوافقه الاختبار السابق لو اكتفى بقراءة
   * الجدول. فنُقارن هنا بما **يفعله الخادم فعلاً** عند المحاولة.
   */
  it("وما يقوله الجدول هو ما يفعله الخادم عند المحاولة", async () => {
    const topic = await topicFor(f.professor.id, "full");
    await prisma.projectGroup.create({ data: { topicId: topic.id } });
    const req = await requestOn(topic.id, "pending");

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions!.canAccept).toBe(false);

    const res = await as(
      request(app).patch(`/api/admin/group-requests/${req.id}/accept`),
    ).expect(400);
    // الرسالة نفسها حرفاً بحرف: مصدرها واحد.
    expect(res.body.message).toBe(
      (row.actions!.blockedReasons as Record<string, string>).accept,
    );
  });

  it("وصفحة التفصيل تُرسل الجدول نفسه", async () => {
    const topic = await topicFor(f.professor.id, "full");
    await prisma.projectGroup.create({ data: { topicId: topic.id } });
    const req = await requestOn(topic.id, "accepted");

    const detail = await as(
      request(app).get(`/api/admin/group-requests/${req.id}`),
    ).expect(200);
    const fromDetail = (detail.body.groupRequest ?? detail.body).actions;
    const fromList = find((await list().expect(200)).body, req.id)!.actions;

    expect(fromDetail).toEqual(fromList);
  });

  it("وعددٌ يتجاوز سعة الموضوع ⇒ يُمنع القبول بسببٍ يذكر الرقمين", async () => {
    const topic = await topicFor(f.professor.id, "open", 2);
    const req = await requestOn(topic.id, "pending", 4);

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions!.canAccept).toBe(false);
    expect(row.actions!.blockedReasons).toMatchObject({
      accept: expect.stringContaining("4"),
    });
  });
});

//
// ═══ العدّادات ═══
//

describe("عدّادات الشريط", () => {
  it("تصل مع القائمة، وتُعلن الحالات الثلاث ولو بأصفار", async () => {
    const body = (await list().expect(200)).body;

    expect(Object.keys(body.counts).sort()).toEqual([
      "accepted",
      "all",
      "pending",
      "rejected",
    ]);
    for (const v of Object.values(body.counts)) expect(typeof v).toBe("number");
    expect(body.counts.all).toBe(
      body.counts.pending + body.counts.accepted + body.counts.rejected,
    );
  });

  /**
   * الترشيح بحالةٍ يُضيّق القائمة **ولا يُضيّق الشريط**: وإلّا صار الشريط
   * عديم الفائدة — يقول «١ معلّقة» وأنت تنظر إلى المعلّقات وحدها.
   */
  it("والترشيح بالحالة يُضيّق القائمة ويُبقي الشريط كاملاً", async () => {
    const topic = await topicFor(f.professor.id);
    await requestOn(topic.id, "pending");

    const all = (await list().expect(200)).body;
    const onlyPending = (await list({ status: "pending" }).expect(200)).body;

    expect(onlyPending.counts).toEqual(all.counts);
    expect(onlyPending.total).toBe(all.counts.pending);
    expect(onlyPending.total).toBeLessThanOrEqual(all.total);
  });

  /**
   * وهذا هو العطل الذي أُصلح: الشريط كان يُحسب بنداءاتٍ لا تحمل الفلاتر،
   * فيبقى على الإجمالي العامّ فوق قائمةٍ رشّحها المستخدم.
   */
  it("وفلترُ الأستاذ يُضيّق الشريط كما يُضيّق القائمة", async () => {
    const mine = await topicFor(f.professor.id);
    await requestOn(mine.id, "pending");
    const theirs = await topicFor(f.professor2.id);
    await requestOn(theirs.id, "pending");

    const all = (await list().expect(200)).body;
    const filtered = (
      await list({ professorId: f.professor2.id }).expect(200)
    ).body;

    expect(filtered.counts.all).toBeLessThan(all.counts.all);
    expect(filtered.counts.all).toBe(filtered.total);
    // وكل ما بقي يخصّ ذلك الأستاذ.
    for (const row of filtered.items as { topic: { professorId: string } }[])
      expect(row.topic.professorId).toBe(f.professor2.id);
  });

  it("وفلترٌ لا يُطابق شيئاً ⇒ أصفارٌ لا غياب", async () => {
    const body = (
      await list({ professorId: "00000000-0000-0000-0000-000000000000" }).expect(
        200,
      )
    ).body;

    expect(body.items).toEqual([]);
    expect(body.counts).toEqual({
      pending: 0,
      accepted: 0,
      rejected: 0,
      all: 0,
    });
  });
});

//
// ═══ الطلبات تحت مواضيعها ═══
//

/**
 * عدّة فرقٍ تتقدّم إلى الموضوع معاً والإدارة تختار — فالقرار يُتّخذ لكلّ
 * موضوعٍ وفرقُه المتنافسة جنباً إلى جنب. والصفحة تَعدّ المواضيع لا الطلبات،
 * فلا تنقسم طلباتُ موضوعٍ بين صفحتين.
 */
describe("GET /api/admin/group-requests/by-topic", () => {
  const byTopic = (query: Record<string, string> = {}) =>
    as(request(app).get("/api/admin/group-requests/by-topic").query(query));

  it("يجمع طلبات كلّ موضوعٍ تحته، بترتيب وصولها، ويَعدّ حالاتها كلّها", async () => {
    const busy = await topicFor(f.professor2.id);
    const first = await requestOn(busy.id, "pending", 1);
    const second = await requestOn(busy.id, "pending", 1);
    await requestOn(busy.id, "rejected", 1);

    const body = (await byTopic({ professorId: f.professor2.id }).expect(200)).body;
    const t = body.items.find((x: { id: string }) => x.id === busy.id);
    expect(t).toBeTruthy();
    expect(t.counts).toEqual({ pending: 2, accepted: 0, rejected: 1, all: 3 });
    expect(t.pendingRequestCount).toBe(2);

    const pending = t.requests.filter((r: { status: string }) => r.status === "pending");
    expect(pending.map((r: { id: string }) => r.id)).toEqual([first.id, second.id]); // الأسبقُ أوّلاً
    expect(pending[0].actions.canAccept).toBe(true);
  });

  it("والمواضيعُ التي تنتظرها فرقٌ أكثر تأتي أوّلاً", async () => {
    const quiet = await topicFor(f.professor2.id);
    await requestOn(quiet.id, "rejected", 1);
    const crowded = await topicFor(f.professor2.id);
    await requestOn(crowded.id, "pending", 1);
    await requestOn(crowded.id, "pending", 1);
    await requestOn(crowded.id, "pending", 1);

    const ids = (await byTopic({ professorId: f.professor2.id }).expect(200)).body.items.map((x: { id: string }) => x.id);
    expect(ids.indexOf(crowded.id)).toBeLessThan(ids.indexOf(quiet.id));
  });

  it("وترشيحُ الحالة يُضيّق الطلبات المعروضة ويُبقي عدّاد الموضوع كاملاً", async () => {
    const mixed = await topicFor(f.professor2.id);
    await requestOn(mixed.id, "pending", 1);
    await requestOn(mixed.id, "rejected", 1);

    const t = (await byTopic({ professorId: f.professor2.id, status: "rejected" }).expect(200)).body.items.find(
      (x: { id: string }) => x.id === mixed.id,
    );
    expect(t.requests.every((r: { status: string }) => r.status === "rejected")).toBe(true);
    expect(t.counts.all).toBe(2);
  });

  it("والصفحةُ تَعدّ المواضيع", async () => {
    const body = (await byTopic({ professorId: f.professor2.id, limit: "1" }).expect(200)).body;
    expect(body.items).toHaveLength(1);
    expect(body.total).toBeGreaterThan(1);
  });

  /**
   * «البتّ في الطلب» من صفحة الموضوع يفتح هذه الصفحة عليه. وبين مواضيع
   * كثيرة ينتظر كلٌّ منها فريقاً قد يقع في أيّ صفحة — فيتصدّر الأولى، ولا
   * يتكرّر فيما بعدها.
   */
  it("و`focus` يُصدّر موضوعه الصفحةَ الأولى ولا يُكرّره بعدها", async () => {
    const quiet = await topicFor(f.professor2.id);
    await requestOn(quiet.id, "rejected", 1); // بلا انتظار ⇒ آخرُ الترتيب

    const p1 = (await byTopic({ professorId: f.professor2.id, limit: "1", focus: quiet.id }).expect(200)).body;
    expect(p1.items[0].id).toBe(quiet.id);
    expect(p1.items[0].focused).toBe(true);
    expect(p1.items).toHaveLength(2); // هو، وصفحةٌ كاملة من غيره

    const pages = Math.ceil(p1.pageTotal / 1);
    const later = [];
    for (let page = 2; page <= pages; page++)
      later.push(...(await byTopic({ professorId: f.professor2.id, limit: "1", page: String(page), focus: quiet.id }).expect(200)).body.items);
    expect(later.map((x: { id: string }) => x.id)).not.toContain(quiet.id);
    expect(p1.total).toBe(p1.pageTotal + 1);
  });
});

//
// ═══ صفحة التفصيل: ما يُبنى عليه القرار ═══
//

describe("صفحة الطلب — ما يُبنى عليه القرار", () => {
  /**
   * القرارُ يُتّخذ على طلبة، والشاشة تقول عن كلّ واحدٍ ما يخصّ القرار: أهو
   * في مشروعٍ قائم؟ أله طلبٌ آخر ينتظر؟ ومن أيّ تخصّص؟ — قبل الضغط، لا من
   * رسالة رفضٍ بعده.
   */
  it("يحمل لكلّ عضوٍ تخصّصه ومشروعه وطلباته الأخرى المعلّقة", async () => {
    const topic = await topicFor(f.professor.id);
    const req = await requestOn(topic.id, "pending", 3);
    const reqMembers = await prisma.groupRequestMember.findMany({
      where: { requestId: req.id },
      select: { studentId: true },
    });
    const [placed, doubleBooked, free] = reqMembers.map((m) => m.studentId);

    // الأوّل في مشروعٍ قائم على موضوعٍ آخر.
    const otherTopic = await topicFor(f.professor2.id, "full");
    const group = await prisma.projectGroup.create({
      data: { topicId: otherTopic.id },
    });
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: placed! },
    });

    // والثاني في طلبٍ آخر ما يزال ينتظر.
    const thirdTopic = await topicFor(f.professor.id);
    await prisma.groupRequest.create({
      data: {
        topicId: thirdTopic.id,
        leaderStudentId: doubleBooked!,
        priority: 2,
        status: "pending",
        members: { create: [{ studentId: doubleBooked! }] },
      },
    });

    const body = (
      await as(request(app).get(`/api/admin/group-requests/${req.id}`)).expect(200)
    ).body;
    const detail = (body.groupRequest ?? body) as {
      topic: { _count: { groupRequests: number } };
      members: {
        studentId: string;
        student: { specialization: { id: string } };
        project: { topic: { id: string } } | null;
        otherPending: { topic: { id: string } }[];
      }[];
    };
    const of = (id: string) => detail.members.find((m) => m.studentId === id)!;

    expect(of(placed!).project?.topic.id).toBe(otherTopic.id);
    expect(of(doubleBooked!).otherPending.map((r) => r.topic.id)).toEqual([
      thirdTopic.id,
    ]);
    // والطلبُ نفسه لا يُعدّ «طلباً آخر» لأعضائه.
    expect(of(free!).project).toBeNull();
    expect(of(free!).otherPending).toEqual([]);
    expect(of(free!).student.specialization.id).toBe(f.specialization.id);
    expect(detail.topic._count.groupRequests).toBe(1);
  });
});

//
// ═══ طالبٌ واحد لمشروعٍ واحد ═══
//

/**
 * قبولُ طلبٍ لم يكن يسأل عن أعضائه. فريقٌ طلب موضوعين بأولويتين، فقُبل
 * الأوّل وبقي الثاني معلّقاً — ثمّ قُبل هو أيضاً، فصار أعضاؤه في مشروعين.
 */
describe("طالبٌ واحد لمشروعٍ واحد", () => {
  type S = { id: string; userId: string };

  const accept = (id: string) =>
    as(request(app).patch(`/api/admin/group-requests/${id}/accept`));

  /** طلبٌ معلّق بأعضاءٍ معيّنين؛ أوّلهم مرسِله. */
  const requestWith = async (topicId: string, team: S[], priority = 1) => {
    const created = await prisma.groupRequest.create({
      data: {
        topicId,
        leaderStudentId: team[0]!.id,
        priority,
        status: "pending",
        members: { create: team.map((s) => ({ studentId: s.id })) },
      },
    });
    await computeTopicStatus(prisma, topicId);
    return created;
  };

  const nameOf = async (s: S) => {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: s.userId },
      select: { firstName: true, lastName: true },
    });
    return [u.firstName, u.lastName].filter(Boolean).join(" ");
  };

  const pendingOn = async (topicId: string) =>
    (await prisma.graduationTopic.findUniqueOrThrow({ where: { id: topicId } }))
      .pendingRequestCount;

  it("عضوٌ له مشروعٌ على موضوعٍ آخر ⇒ «قبول» مطفأٌ بسببٍ يسمّيه ومشروعه، والخادم يردّ بالنصّ نفسه", async () => {
    const done = await topicFor(f.professor.id, "full");
    const group = await prisma.projectGroup.create({ data: { topicId: done.id } });
    const [alaa, ayman] = f.nextStudents(2);
    await prisma.projectMember.create({ data: { groupId: group.id, studentId: ayman!.id } });

    const t = await topicFor(f.professor.id);
    const req = await requestWith(t.id, [alaa!, ayman!]);

    const row = find((await list().expect(200)).body, req.id)!;
    expect(row.actions).toMatchObject({ canAccept: false, canReject: true });
    const reason = (row.actions!.blockedReasons as Record<string, string>).accept!;
    expect(reason).toBe(tr("gate.memberPlaced", { name: await nameOf(ayman!), topic: done.title }));

    // صفحة التفصيل تقول الشيء نفسه.
    const detail = (await as(request(app).get(`/api/admin/group-requests/${req.id}`)).expect(200)).body;
    expect((detail.groupRequest ?? detail).actions).toEqual(row.actions);

    const res = await accept(req.id).expect(400);
    expect(res.body.message).toBe(reason);
    expect(await prisma.projectGroup.count({ where: { topicId: t.id } })).toBe(0);
    expect(await prisma.projectMember.count({ where: { studentId: ayman!.id } })).toBe(1);
  });

  it("وقبولُ طلبٍ يُلغي طلبات الفريق نفسه على مواضيع أخرى، ويُبلغهم، ويُحرّر خاناتها", async () => {
    const [ahmed, sara] = f.nextStudents(2);
    const first = await topicFor(f.professor.id);
    const second = await topicFor(f.professor2.id);
    const a = await requestWith(first.id, [ahmed!, sara!], 1);
    const b = await requestWith(second.id, [ahmed!, sara!], 2);
    expect(await pendingOn(second.id)).toBe(1);

    await accept(a.id).expect(200);

    const after = await prisma.groupRequest.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("rejected");
    expect(after.rejectionReason).toBe(tr("request.teamPlacedReason", { title: first.title }));
    expect(await pendingOn(second.id)).toBe(0);

    const told = await prisma.notification.findMany({
      where: { userId: { in: [ahmed!.userId, sara!.userId] }, title: tr("notif.groupReleased.title") },
      select: { message: true },
    });
    expect(told.map((n) => n.message)).toEqual(
      Array(2).fill(tr("notif.groupReleased.message", { accepted: first.title, title: second.title })),
    );

    // ولا سبيل إلى قبوله بعد ذلك: أعضاؤه في مشروع.
    const res = await accept(b.id).expect(400);
    expect(res.body.message).toContain(first.title);
    expect(await prisma.projectMember.count({ where: { studentId: ahmed!.id } })).toBe(1);
  });

  /**
   * حالة أيمن: في فريق أحمد، وله طلبٌ آخر مع علاء وحسام — كما كان يمرّ قبل
   * أن يُفحص المرسِل. قبولُ فريق أحمد يُلغي الطلب الآخر، ويُقال لعلاء وحسام
   * من خرج منه.
   */
  it("وطلبُ فريقٍ آخر فيه أحدُ الأعضاء يُلغى كذلك، ويُقال لبقيّته من خرج", async () => {
    const [ahmed, ayman, alaa, hossam] = f.nextStudents(4);
    const migration = await topicFor(f.professor.id);
    const other = await topicFor(f.professor2.id);
    const a = await requestWith(migration.id, [ahmed!, ayman!]);
    const b = await requestWith(other.id, [ayman!, alaa!, hossam!]);

    await accept(a.id).expect(200);

    const names = await nameOf(ayman!);
    const after = await prisma.groupRequest.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("rejected");
    expect(after.rejectionReason).toBe(
      tr("request.memberPlacedReason", { names, title: migration.title }),
    );

    const message = async (s: S) =>
      (
        await prisma.notification.findFirstOrThrow({
          where: { userId: s.userId, title: tr("notif.groupReleased.title") },
          select: { message: true },
        })
      ).message;
    for (const s of [alaa!, hossam!])
      expect(await message(s)).toBe(
        tr("notif.groupMemberPlaced.message", { names, accepted: migration.title, title: other.title }),
      );
    // وأيمن نفسه يُقال له إنّ فريقه قُبل.
    expect(await message(ayman!)).toBe(
      tr("notif.groupReleased.message", { accepted: migration.title, title: other.title }),
    );
  });

  /**
   * قبولان في اللحظة نفسها لطلبين يشتركان في طالب، على موضوعين مختلفين: كان
   * كلٌّ منهما يقرأ «لا مشروع له» قبل أن يكتب الآخر. قفلُ الأعضاء يُصفّهما.
   */
  it("وقبولان متزامنان لطلبين يشتركان في طالب: يمرّ واحد", async () => {
    const [shared, x, y] = f.nextStudents(3);
    const t1 = await topicFor(f.professor.id);
    const t2 = await topicFor(f.professor2.id);
    const a = await requestWith(t1.id, [x!, shared!]);
    const b = await requestWith(t2.id, [y!, shared!]);

    const results = await Promise.allSettled([
      acceptGroupRequestService(a.id),
      acceptGroupRequestService(b.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.projectMember.count({ where: { studentId: shared!.id } })).toBe(1);

    // والثاني رُدّ بالقاعدة نفسها — لا بخطأٍ عارض كتعارض الأقفال.
    const won = results[0]!.status === "fulfilled" ? t1 : t2;
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((lost.reason as Error).message).toBe(
      tr("gate.memberPlaced", { name: await nameOf(shared!), topic: won.title }),
    );
  });
});
