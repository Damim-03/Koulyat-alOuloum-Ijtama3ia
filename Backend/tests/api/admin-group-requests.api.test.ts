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
  return prisma.groupRequest.create({
    data: {
      topicId,
      activeTopicId: status === "rejected" ? null : topicId,
      leaderStudentId: team[0]!.id,
      priority: 1,
      status,
      members: { create: team.map((s) => ({ studentId: s.id })) },
    },
  });
};

const find = (body: unknown, id: string) =>
  (body as { items: { id: string; actions?: Record<string, unknown> }[] }).items.find(
    (r) => r.id === id,
  );

beforeAll(async () => {
  await teardown();
  f = await seed(40);

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
      reject: expect.stringContaining("افسخ المشروع"),
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
