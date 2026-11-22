/**
 * فترة اقتراح المواضيع — `/api/admin/academic-years/:id/proposal-window`.
 *
 * ما يستحقّ حارساً:
 *   ١. الإدارة تحدّدها وتغيّرها وتلغيها، والأساتذة يُبلَّغون بالتواريخ —
 *      «حُدّدت» أوّل مرّة و«تغيّرت» بعدها، ولا جرس لحفظٍ لم يغيّر شيئاً؛
 *   ٢. خارجها لا يقترح الأستاذ موضوعاً جديداً (وحده ولا بفريق)، ويُقال له
 *      متى — لكنّه يعدّل مقترحاته، والإدارة تُنشئ كما تشاء؛
 *   ٣. والأستاذ يقرؤها مع السنوات؛ والتواريخ المقلوبة أو غير الموجودة تُرفض.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
let n = 0;

const as = (r: request.Test, token = admin) => r.set("Authorization", `Bearer ${token}`);
const url = () => `/api/admin/academic-years/${f.academicYear.id}/proposal-window`;

/** يومٌ بتوقيت الجامعة، بعد اليوم بـ`offset` يوماً: «2026-11-11». */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
const setWindow = (opensOn: string, closesOn: string) => as(request(app).put(url())).send({ opensOn, closesOn });

const propose = () =>
  as(request(app).post("/api/professor/topics"), prof).send({
    title: `${TAG} مقترح ${++n}`,
    description: `${TAG} وصف`,
    maxStudents: 2,
    specializationId: f.specialization.id,
    academicYearId: f.academicYear.id,
  });

/** إشعارات أستاذ الاختبار بفترة الاقتراح، الأحدث أوّلاً. */
const bells = () =>
  prisma.notification.findMany({
    where: { userId: f.professor.userId, link: "/professor/topics" },
    orderBy: { createdAt: "desc" },
    select: { title: true, message: true },
  });

beforeAll(async () => {
  await teardown();
  f = await seed(4);
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

describe("فترة اقتراح المواضيع", () => {
  it("بلا فترة: حالها «unset»، والأستاذ يقترح كما كان", async () => {
    const res = await as(request(app).get(url())).expect(200);
    expect(res.body).toMatchObject({ state: "unset", year: { id: f.academicYear.id, proposalsOpenAt: null } });
    expect(res.body.stats).toMatchObject({ topics: 0, professorsProposed: 0 });
    expect(res.body.stats.professorsTotal).toBeGreaterThan(0);
    await propose().expect(201);
  });

  it("تحديدها: مفتوحةٌ اليوم، والأستاذ يُبلَّغ بتواريخها؛ والحفظ نفسه مرّةً أخرى لا يُرسل شيئاً", async () => {
    const res = await setWindow(day(-2), day(10)).expect(200);
    expect(res.body.state).toBe("open");
    expect(res.body.stats).toMatchObject({ topics: 1, professorsProposed: 1 });

    const [bell] = await bells();
    expect(bell!.title).toBe(`فترة اقتراح المواضيع — ${f.academicYear.title}`);
    expect(bell!.message).toMatch(/^اقترحوا مواضيعكم من .+ إلى .+\.$/);

    await setWindow(day(-2), day(10)).expect(200);
    expect(await bells()).toHaveLength(1);
    await propose().expect(201);
  });

  it("وتغييرها يُبلَّغ «تغيّرت»؛ والأستاذ يقرؤها مع السنوات", async () => {
    await setWindow(day(-2), day(20)).expect(200);
    const [moved] = await bells();
    expect(moved!.title).toBe(`تغيّرت فترة اقتراح المواضيع — ${f.academicYear.title}`);

    const years = (await as(request(app).get("/api/common/academic-years"), prof).expect(200)).body.academicYears;
    const mine = years.find((y: { id: string }) => y.id === f.academicYear.id);
    expect(new Date(mine.proposalsCloseAt).getTime()).toBeGreaterThan(Date.now());
    expect(mine.proposalsOpenAt).toBeTruthy();
  });

  it("انتهت: لا اقتراح جديد (وحده ولا بفريق) ويُقال متى — والتعديل باقٍ، والإدارة تُنشئ", async () => {
    const mine = await prisma.graduationTopic.findFirstOrThrow({ where: { professorId: f.professor.id, title: { startsWith: TAG } } });
    await setWindow(day(-30), day(-1)).expect(200);

    const refused = await propose().expect(400);
    expect(refused.body.errorCode).toBe("TOPIC_PROPOSALS_CLOSED");
    expect(refused.body.message).toContain("انتهت فترة اقتراح المواضيع");

    const [a, b] = f.nextStudents(2);
    await as(request(app).post("/api/professor/topics/with-group"), prof)
      .send({
        title: `${TAG} بفريق ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 2,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
        memberRegistrationNumbers: [a!.reg, b!.reg],
        leaderRegistrationNumber: a!.reg,
      })
      .expect(400);

    await as(request(app).put(`/api/professor/topics/${mine.id}`), prof).send({ title: `${TAG} معدّل بعد الإغلاق` }).expect(200);
    await as(request(app).post("/api/admin/topics"))
      .send({
        title: `${TAG} من الإدارة ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 2,
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      })
      .expect(201);
  });

  it("لم تبدأ بعد ⇒ يُقال يوم بدايتها؛ وإلغاؤها يعيد الاقتراح بلا قيد", async () => {
    await setWindow(day(5), day(30)).expect(200);
    const res = await propose().expect(400);
    expect(res.body.message).toContain("تبدأ في");

    const cleared = await as(request(app).delete(url())).expect(200);
    expect(cleared.body).toMatchObject({ state: "unset", year: { proposalsOpenAt: null, proposalsCloseAt: null } });
    await propose().expect(201);
  });

  it("تواريخ مقلوبة أو غير موجودة ⇒ 400؛ سنةٌ غائبة ⇒ 404؛ سنةٌ مؤرشفة ⇒ 400؛ والأستاذ ⇒ 403", async () => {
    await setWindow(day(10), day(1)).expect(400);
    await setWindow("2026-02-30", "2026-03-10").expect(400);
    await as(request(app).put(url())).send({ opensOn: "11/10/2026", closesOn: day(1) }).expect(400);
    await as(request(app).put("/api/admin/academic-years/00000000-0000-4000-8000-000000000000/proposal-window"))
      .send({ opensOn: day(1), closesOn: day(2) })
      .expect(404);
    await as(request(app).get("/api/admin/academic-years/00000000-0000-4000-8000-000000000000/proposal-window")).expect(404);

    const closed = await prisma.academicYear.create({ data: { title: `${TAG} 2098/2099`, archivedAt: new Date() } });
    await as(request(app).put(`/api/admin/academic-years/${closed.id}/proposal-window`))
      .send({ opensOn: day(1), closesOn: day(2) })
      .expect(400);

    await as(request(app).get(url()), prof).expect(403);
  });
});
