/**
 * صفحة التفعيل، جانب الطلبة (modules/admin/activation-desk)، وما يصل إليه
 * الطالب قبل أن يُفعَّل.
 *
 * كلمة المرور الأولى تاريخ ميلاد مطبوعٌ على بطاقة الطالب نفسها. فيُفعِّل
 * الطالب حسابه بمرحلتين: كلمة مرورٍ يختارها — تسري فوراً — ثمّ صورتا بطاقته
 * ووجهه يوثّق بهما المسؤولُ الحساب، وله أن يتخطّاهما (modules/activation —
 * اختباراتها في activation-request.api.test).
 *
 * يُحرس: أنّ الطالب يُعثر عليه برقمه أو اسمه أو بفلترٍ على حاله؛ وأنّ ملفّه
 * كاملٌ في جوابٍ واحد؛ وأنّ ذلك للمسؤول وحده؛ وأنّ كلمة المرور المسلَّمة لا تفتح
 * إلا شاشة تغييرها، فإذا تغيّرت فُتح الحساب كلّه؛ وأنّ رمز التفعيل الحضوريّ ذهب
 * بطرقه كلّها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, makeTopic, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
const NEW_PASSWORD = "Wadi-Souf#2026";

beforeAll(async () => {
  await teardown();
  f = await seed(16);
  adminToken = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorLabel: { contains: TAG } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await prisma.loginThrottle.deleteMany({ where: { key: { contains: TAG.toLowerCase() } } });
});

const admin = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);
const lookup = (reg: string) => admin(request(app).get("/api/admin/activation/student").query({ registrationNumber: reg }));
const login = (registrationNumber: string, password: string) =>
  request(app).post("/api/auth/student/login").send({ registrationNumber, password });
/** A student whose password the administration handed out, not replaced yet. */
const handedOut = async (s: { userId: string }) =>
  prisma.user.update({ where: { id: s.userId }, data: { mustChangePassword: true } });

describe("البحث عن الطالب برقمه — من البطاقة أو مكتوباً", () => {
  it("برقم التسجيل ⇒ اسمه وتخصّصه، ولم يُفعَّل ما دامت كلمة مروره مسلَّمة", async () => {
    const [s] = f.nextStudents(1);
    await handedOut(s!);
    const res = await lookup(s!.reg).expect(200);
    expect(res.body).toMatchObject({
      id: s!.id,
      registrationNumber: s!.reg,
      lastName: "Student1",
      specialization: { name: `${TAG} spec`, level: "master" },
      status: "active",
      activated: false,
    });
    expect(res.body).not.toHaveProperty("pendingCode");
  });

  it("رقمٌ لا طالب له ⇒ 404؛ والإعدادات تقول إنّ التفعيل غير مشترط افتراضياً", async () => {
    await lookup(`${TAG}-NOBODY`).expect(404);
    const settings = await admin(request(app).get("/api/admin/activation/settings")).expect(200);
    expect(settings.body).toMatchObject({ required: false });
    expect(settings.body).not.toHaveProperty("codeHours");
  });

  it("ليس لغير المسؤول", async () => {
    const [s] = f.nextStudents(1);
    const token = (await login(s!.reg, TEST_PASSWORD).expect(200)).body.accessToken;
    await request(app)
      .get("/api/admin/activation/student")
      .query({ registrationNumber: s!.reg })
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });
});

describe("الطلبة بلا بطاقة، والملفّ الكامل", () => {
  const students = (query: Record<string, string | number>) =>
    admin(request(app).get("/api/admin/activation/students").query(query)).expect(200);
  const ids = (res: request.Response) => (res.body.items as { id: string }[]).map((i) => i.id);

  it("الإعدادات ومعها أين يقف الطلبة", async () => {
    const res = await admin(request(app).get("/api/admin/activation/settings")).expect(200);
    expect(res.body).toMatchObject({
      required: false,
      counts: {
        students: expect.any(Number),
        notActivated: expect.any(Number),
        verified: expect.any(Number),
        suspended: expect.any(Number),
        pendingRequests: expect.any(Number),
      },
    });
    expect(res.body.counts).not.toHaveProperty("codesOut");
    expect(res.body.counts.students).toBeGreaterThanOrEqual(f.students.length);
  });

  it("الفلتر: بالرقم، وبالاسم، وبالحالة، وبالتخصص، وصفحةً صفحة", async () => {
    const [a, b, c, d] = f.nextStudents(4);
    await handedOut(a!);
    await prisma.user.update({ where: { id: b!.userId }, data: { isVerified: true } });
    await prisma.user.update({ where: { id: c!.userId }, data: { status: "suspended" } });
    await prisma.activationRequest.create({ data: { userId: d!.userId, status: "pending" } });

    const byNumber = await students({ q: a!.reg });
    expect(byNumber.body.items[0]).toMatchObject({ id: a!.id, activated: false, verified: false, specialization: { name: `${TAG} spec` } });

    const lastName = (await prisma.user.findUniqueOrThrow({ where: { id: a!.userId }, select: { lastName: true } })).lastName!;
    // Any order of the words: «Student3 __TEST__» finds «__TEST__ Student3».
    expect(ids(await students({ q: `${lastName} ${TAG}` }))).toEqual([a!.id]);

    expect(ids(await students({ q: TAG, state: "notActivated" }))).toContain(a!.id);
    expect(ids(await students({ q: TAG, state: "notActivated" }))).not.toContain(b!.id);
    expect(ids(await students({ q: TAG, state: "verified" }))).toEqual(expect.arrayContaining([b!.id]));
    expect(ids(await students({ q: TAG, state: "verified" }))).not.toContain(a!.id);
    expect(ids(await students({ q: TAG, state: "suspended" }))).toEqual([c!.id]);
    expect(ids(await students({ q: TAG, state: "requested" }))).toEqual([d!.id]);
    expect((await students({ q: d!.reg })).body.items[0].pendingRequest).toMatchObject({ sentAt: expect.any(String) });
    // The code is gone, and its state with it.
    await admin(request(app).get("/api/admin/activation/students").query({ state: "codeIssued" })).expect(400);

    expect((await students({ q: TAG, specializationId: f.specialization.id })).body.total).toBeGreaterThanOrEqual(3);
    expect((await students({ q: TAG, specializationId: "00000000-0000-4000-8000-000000000000" })).body.total).toBe(0);

    const page = await students({ q: TAG, limit: 2, page: 1 });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBeGreaterThan(2);
  });

  it("الملفّ الكامل: الشخصيّ والأكاديميّ، وطلبات المواضيع قائداً وعضواً، والنشاط", async () => {
    const [leader, member] = f.nextStudents(2);
    const topic = await makeTopic(f, "desk profile topic", "open");
    await prisma.groupRequest.create({
      data: {
        topicId: topic.id,
        leaderStudentId: leader!.id,
        members: { create: [{ studentId: leader!.id }, { studentId: member!.id }] },
      },
    });
    // Something in the audit log done by the account: a refused sign-in.
    await login(leader!.reg, "wrong-password").expect(401);
    await new Promise((r) => setTimeout(r, 200));

    const res = await admin(request(app).get(`/api/admin/activation/students/${leader!.id}`)).expect(200);
    expect(res.body).toMatchObject({
      id: leader!.id,
      registrationNumber: leader!.reg,
      personal: { userId: leader!.userId, email: leader!.email, lastName: expect.stringContaining("Student") },
      academic: {
        faculty: `${TAG} faculty`,
        department: `${TAG} dept`,
        filiere: `${TAG} filiere`,
        specialization: { name: `${TAG} spec`, level: "master" },
        academicYear: `${TAG} 2099/2100`,
      },
      account: { status: "active", activated: true, verified: false, request: null },
      project: null,
    });
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0]).toMatchObject({ role: "leader", status: "pending", topic: { title: `${TAG} desk profile topic` } });
    expect(res.body.requests[0].team).toEqual([expect.objectContaining({ registrationNumber: member!.reg })]);
    expect(res.body.activity[0]).toMatchObject({ action: "auth.loginFailed", success: false });

    const theirs = await admin(request(app).get(`/api/admin/activation/students/${member!.id}`)).expect(200);
    expect(theirs.body.requests).toHaveLength(1);
    expect(theirs.body.requests[0]).toMatchObject({ role: "member", team: [expect.objectContaining({ registrationNumber: leader!.reg })] });
  });

  it("معرّفٌ لا طالب له ⇒ 404، ومعرّفٌ ليس معرّفاً ⇒ 400", async () => {
    await admin(request(app).get("/api/admin/activation/students/00000000-0000-4000-8000-000000000000")).expect(404);
    await admin(request(app).get("/api/admin/activation/students/bad.id")).expect(400);
  });
});

describe("التفعيل بمرحلتين (REQUIRE_STUDENT_ACTIVATION)", () => {
  beforeEach(() => {
    jest.replaceProperty(config, "REQUIRE_STUDENT_ACTIVATION", true);
  });

  const asToken = (token: string) => ({
    get: (path: string) => request(app).get(path).set("Authorization", `Bearer ${token}`),
    post: (path: string, body: object) => request(app).post(path).set("Authorization", `Bearer ${token}`).send(body),
  });

  it("المرحلة الأولى: كلمة المرور المسلَّمة لا تصل إلا إلى تغييرها؛ فتسري الجديدة فوراً، ويُفتح الحساب", async () => {
    const [s] = f.nextStudents(1);
    await handedOut(s!);
    const res = await login(s!.reg, TEST_PASSWORD).expect(200);
    expect(res.body.user).toMatchObject({ activationRequired: true, mustChangePassword: true });
    const as = asToken(res.body.accessToken);

    // As any account with a handed-out password: the password screen, and nothing else.
    expect((await as.get("/api/auth/me").expect(200)).body.user).toMatchObject({ activationRequired: true });
    await as.get("/api/account").expect(200);
    const blocked = await as.get("/api/account/sessions").expect(403);
    expect(blocked.body).toMatchObject({ errorCode: "PASSWORD_CHANGE_REQUIRED" });
    // The photos come second: not before the password is the student's own.
    await as.get("/api/account/activation-request").expect(403);

    const done = await as.post("/api/account/password", { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }).expect(200);
    const fresh = asToken(done.body.accessToken);
    expect((await fresh.get("/api/auth/me").expect(200)).body.user).toMatchObject({
      activationRequired: false,
      mustChangePassword: false,
    });
    // The second stage is open to it now — and so is the rest, without it.
    expect((await fresh.get("/api/account/activation-request").expect(200)).body).toEqual({ status: "none" });
    await fresh.get("/api/account/sessions").expect(200);
    await login(s!.reg, TEST_PASSWORD).expect(401);
    await login(s!.reg, NEW_PASSWORD).expect(200);
  });

  it("طالبٌ اختار كلمة مروره من قبل ⇒ لا مراحل، وحسابه كلّه كما كان", async () => {
    const [s] = f.nextStudents(1);
    const res = await login(s!.reg, TEST_PASSWORD).expect(200);
    expect(res.body.user.activationRequired).toBe(false);
    await asToken(res.body.accessToken).get("/api/account/sessions").expect(200);
  });

  it("الأستاذ بكلمة مرورٍ مسلَّمة ⇒ تغييرها وحده، بلا مرحلة صور", async () => {
    await prisma.user.update({ where: { id: f.professor.userId }, data: { mustChangePassword: true } });
    try {
      const res = await request(app)
        .post("/api/auth/professor/login")
        .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
        .expect(200);
      expect(res.body.user).toMatchObject({ activationRequired: false, mustChangePassword: true });
    } finally {
      await prisma.user.update({ where: { id: f.professor.userId }, data: { mustChangePassword: false } });
    }
  });

  it("والتفعيل غير مفعّل ⇒ كلمة المرور المسلَّمة تفتح شاشة تغييرها وحدها", async () => {
    jest.replaceProperty(config, "REQUIRE_STUDENT_ACTIVATION", false);
    const [s] = f.nextStudents(1);
    await handedOut(s!);
    const res = await login(s!.reg, TEST_PASSWORD).expect(200);
    expect(res.body.user).toMatchObject({ activationRequired: false, mustChangePassword: true });
    await asToken(res.body.accessToken).get("/api/account").expect(200);
  });
});

describe("رمز التفعيل الحضوريّ ذهب بطرقه كلّها", () => {
  it("لا إعطاء رمزٍ في الإدارة، ولا «نسيت كلمة المرور» به، ولا تفعيل به من الحساب", async () => {
    const [s] = f.nextStudents(1);
    await admin(request(app).post(`/api/admin/activation/students/${s!.id}/code`).send({ cardChecked: true })).expect(404);
    await request(app)
      .post("/api/auth/student/activate")
      .send({ registrationNumber: s!.reg, code: "ABCD-EFGH", newPassword: NEW_PASSWORD })
      .expect(404);
    const token = (await login(s!.reg, TEST_PASSWORD).expect(200)).body.accessToken;
    await request(app)
      .post("/api/account/activate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "ABCD-EFGH", newPassword: NEW_PASSWORD })
      .expect(404);
  });
});
