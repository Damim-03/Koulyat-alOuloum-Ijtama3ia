/**
 * مهلة اختيار المواضيع — `/api/admin/academic-years/:id/selection-window`،
 * و`/api/student/selection-window`.
 *
 * ما يستحقّ حارساً:
 *   ١. الإدارة تحدّدها وتغيّرها وتلغيها، وطلبة السنة يُبلَّغون بالتواريخ —
 *      «حُدّدت» أوّل مرّة و«تغيّرت» بعدها، ولا جرس لحفظٍ لم يغيّر شيئاً؛
 *   ٢. قبلها وبعدها لا يرسل الطالب طلب فريق، ويُقال له متى؛ وسحبُ طلبه
 *      ممكنٌ حتى نهايتها، ثمّ يبقى بيد الإدارة — والإدارة تقرّر بعدها كما تشاء؛
 *   ٣. والطالب يقرأ مهلة سنته؛ والتواريخ المقلوبة تُرفض، والأستاذ والطالب
 *      لا يحدّدانها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, makeTopic, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
const tokens = new Map<string, string>();

const as = (r: request.Test, token = admin) => r.set("Authorization", `Bearer ${token}`);
const url = () => `/api/admin/academic-years/${f.academicYear.id}/selection-window`;

/** يومٌ بتوقيت الجامعة، بعد اليوم بـ`offset` يوماً: «2026-11-11». */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
const setWindow = (opensOn: string, closesOn: string) => as(request(app).put(url())).send({ opensOn, closesOn });

async function studentToken(reg: string) {
  if (!tokens.has(reg)) {
    const res = await request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password: TEST_PASSWORD }).expect(200);
    tokens.set(reg, res.body.accessToken);
  }
  return tokens.get(reg)!;
}

/** A student asks for a fresh open topic, alone — and is answered `status`. */
async function ask(reg: string, title: string, status: number) {
  const topic = await makeTopic(f, title, "open", 2);
  return as(request(app).post("/api/student/group-requests"), await studentToken(reg)).send({ topicId: topic.id, priority: 1 }).expect(status);
}

/** إشعارات طالبٍ بالمهلة، الأحدث أوّلاً. */
const bells = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, link: "/topics" },
    orderBy: { createdAt: "desc" },
    select: { title: true, message: true },
  });

beforeAll(async () => {
  await teardown();
  f = await seed(5);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  prof = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("مهلة اختيار المواضيع", () => {
  it("بلا مهلة: حالها «unset»، والطالب يقرؤها كذلك ويطلب كما كان", async () => {
    const res = await as(request(app).get(url())).expect(200);
    expect(res.body).toMatchObject({ state: "unset", year: { id: f.academicYear.id, selectionOpenAt: null } });
    expect(res.body.stats).toMatchObject({ studentsRequested: 0, pendingRequests: 0, studentsTotal: 5 });

    const s = f.students[0];
    const mine = await as(request(app).get("/api/student/selection-window"), await studentToken(s.reg)).expect(200);
    expect(mine.body.window).toMatchObject({ id: f.academicYear.id, state: "unset", selectionOpenAt: null });
    await ask(s.reg, "sel unset", 201);
  });

  it("تحديدها: مفتوحةٌ اليوم، وطلبة السنة يُبلَّغون بتواريخها؛ والحفظ نفسه مرّةً أخرى لا يُرسل شيئاً", async () => {
    const res = await setWindow(day(-2), day(10)).expect(200);
    expect(res.body.state).toBe("open");
    // Who has asked, and who is waiting for a decision.
    expect(res.body.stats).toMatchObject({ studentsRequested: 1, pendingRequests: 1, studentsTotal: 5 });
    expect(res.body.year).toHaveProperty("proposalsCloseAt");

    const s = f.students[1];
    const [bell] = await bells(s.userId);
    expect(bell!.title).toBe(`مهلة اختيار المواضيع — ${f.academicYear.title}`);
    expect(bell!.message).toMatch(/^اختاروا مواضيعكم وأرسلوا طلباتكم من .+ إلى .+\.$/);

    await setWindow(day(-2), day(10)).expect(200);
    expect(await bells(s.userId)).toHaveLength(1);

    const mine = await as(request(app).get("/api/student/selection-window"), await studentToken(s.reg)).expect(200);
    expect(mine.body.window.state).toBe("open");
    await ask(s.reg, "sel open", 201);
  });

  it("وتغييرها يُبلَّغ «تغيّرت»", async () => {
    await setWindow(day(-2), day(20)).expect(200);
    const [moved] = await bells(f.students[1].userId);
    expect(moved!.title).toBe(`تغيّرت مهلة اختيار المواضيع — ${f.academicYear.title}`);
  });

  it("انتهت: لا طلب جديد ويُقال متى؛ ولا سحب لطلبٍ أُرسل في الموعد — والإدارة تقرّر كما تشاء", async () => {
    const s = f.students[1];
    const pending = await prisma.groupRequest.findFirstOrThrow({ where: { leaderStudentId: s.id, status: "pending" } });
    await setWindow(day(-30), day(-1)).expect(200);

    const refused = await ask(f.students[2].reg, "sel closed", 400);
    expect(refused.body.errorCode).toBe("TOPIC_SELECTION_CLOSED");
    expect(refused.body.message).toContain("انتهت مهلة اختيار المواضيع");

    const kept = await as(request(app).delete(`/api/student/group-requests/${pending.id}`), await studentToken(s.reg)).expect(400);
    expect(kept.body.errorCode).toBe("TOPIC_SELECTION_CLOSED");
    expect(kept.body.message).toContain("لا يُسحب");
    expect(await prisma.groupRequest.findUnique({ where: { id: pending.id } })).not.toBeNull();

    await as(request(app).patch(`/api/admin/group-requests/${pending.id}/reject`)).send({ reason: "مهلة" }).expect(200);
  });

  it("لم تبدأ بعد ⇒ يُقال يوم بدايتها، والسحب قبل النهاية ممكن؛ وإلغاؤها يعيد الاختيار بلا قيد", async () => {
    const s = f.students[0];
    const pending = await prisma.groupRequest.findFirstOrThrow({ where: { leaderStudentId: s.id, status: "pending" } });
    await setWindow(day(5), day(30)).expect(200);

    const res = await ask(f.students[3].reg, "sel upcoming", 400);
    expect(res.body.message).toContain("تبدأ في");
    // Withdrawing is open until the deadline — a request sent before it was set too.
    await as(request(app).delete(`/api/student/group-requests/${pending.id}`), await studentToken(s.reg)).expect(200);

    const cleared = await as(request(app).delete(url())).expect(200);
    expect(cleared.body).toMatchObject({ state: "unset", year: { selectionOpenAt: null, selectionCloseAt: null } });
    await ask(f.students[3].reg, "sel cleared", 201);
  });

  it("بالثانية: من ساعةٍ إلى ساعة، والرسالة تقول الساعة؛ والمقلوبة في اليوم نفسه تُرفض", async () => {
    const res = await as(request(app).put(url()))
      .send({ opensOn: day(3), closesOn: day(9), opensTime: "08:00", closesTime: "18:30:15" })
      .expect(200);
    expect(res.body.year.selectionOpenAt).toBe(new Date(`${day(3)}T08:00:00.000+01:00`).toISOString());
    expect(res.body.year.selectionCloseAt).toBe(new Date(`${day(9)}T18:30:15.999+01:00`).toISOString());

    const refused = await ask(f.students[4].reg, "sel timed", 400);
    expect(refused.body.message).toContain("على الساعة 08:00");

    await as(request(app).put(url())).send({ opensOn: day(3), closesOn: day(3), opensTime: "10:00", closesTime: "09:59:59" }).expect(400);
    await as(request(app).put(url())).send({ opensOn: day(3), closesOn: day(3), opensTime: "25:00" }).expect(400);
    await as(request(app).delete(url())).expect(200);
  });

  it("تواريخ مقلوبة ⇒ 400؛ سنةٌ غائبة ⇒ 404؛ سنةٌ مؤرشفة ⇒ 400؛ الأستاذ والطالب ⇒ 403", async () => {
    await setWindow(day(10), day(1)).expect(400);
    await setWindow("2026-02-30", "2026-03-10").expect(400);
    const nowhere = "/api/admin/academic-years/00000000-0000-4000-8000-000000000000/selection-window";
    await as(request(app).put(nowhere)).send({ opensOn: day(1), closesOn: day(2) }).expect(404);
    await as(request(app).get(nowhere)).expect(404);
    await as(request(app).delete(nowhere)).expect(404);

    const closed = await prisma.academicYear.create({ data: { title: `__TEST__ 2097/2098`, archivedAt: new Date() } });
    await as(request(app).put(`/api/admin/academic-years/${closed.id}/selection-window`))
      .send({ opensOn: day(1), closesOn: day(2) })
      .expect(400);

    await as(request(app).get(url()), prof).expect(403);
    await as(request(app).put(url()), await studentToken(f.students[4].reg)).send({ opensOn: day(1), closesOn: day(2) }).expect(403);
  });
});
