/**
 * تحصين الدخول: القفل لكلّ حساب، وقواعد كلمة المرور حين يغيّرها صاحبها،
 * ورمز التحديث في كعكةٍ لا تقرؤها الصفحة ويتبدّل مع كلّ استعمال.
 *
 * كلمة المرور الأولى للطالب قد تكون تاريخ ميلاده — بضعة آلاف احتمال، ورقم
 * تسجيله مطبوعٌ على بطاقته. فما هنا هو ما يجعل ذلك مقبولاً: لا يُخمَّن من
 * أجهزةٍ كثيرة، وتغييرها متاحٌ له متى شاء.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { throttleKey } from "../../src/core/auth/login-throttle";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;

beforeAll(async () => {
  await teardown();
  f = await seed(4);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const studentLogin = (reg: string, password: string) =>
  request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password });

/** `refresh_token=…` من ترويسة Set-Cookie، أو undefined. */
const refreshCookieOf = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers["set-cookie"] ?? [])
    .find((c) => c.startsWith("refresh_token="));

//
// ═══ القفل لكلّ حساب ═══
//

describe("القفل بعد خمس محاولاتٍ خاطئة", () => {
  afterEach(async () => {
    await prisma.loginThrottle.deleteMany({
      where: { key: throttleKey("student", f.students[0].reg) },
    });
  });

  it("الخامسة تُقفل، وبعدها تُردّ حتى كلمة المرور الصحيحة بـ429", async () => {
    for (let i = 0; i < 4; i++) await studentLogin(f.students[0].reg, "2003/07/31").expect(401);
    const fifth = await studentLogin(f.students[0].reg, "2003/07/31").expect(429);
    expect(fifth.body.errorCode).toBe("AUTH_TOO_MANY_ATTEMPTS");

    const right = await studentLogin(f.students[0].reg, TEST_PASSWORD).expect(429);
    expect(right.body.errorCode).toBe("AUTH_TOO_MANY_ATTEMPTS");
  });

  it("ورقمٌ لا حساب له يُقفل بالطريقة نفسها — فالقفل لا يكشف من هو مسجَّل", async () => {
    const ghost = `${f.students[0].reg}-GHOST`;
    for (let i = 0; i < 4; i++) await studentLogin(ghost, "x").expect(401);
    await studentLogin(ghost, "x").expect(429);
    await prisma.loginThrottle.deleteMany({ where: { key: throttleKey("student", ghost) } });
  });

  it("والدخول الصحيح قبل القفل يمحو العدّ", async () => {
    for (let i = 0; i < 3; i++) await studentLogin(f.students[0].reg, "nope").expect(401);
    await studentLogin(f.students[0].reg, TEST_PASSWORD).expect(200);
    expect(
      await prisma.loginThrottle.findUnique({ where: { key: throttleKey("student", f.students[0].reg) } }),
    ).toBeNull();
  });

  it("وإعادة تعيين الإدارة لكلمة المرور تفكّ القفل", async () => {
    for (let i = 0; i < 5; i++) await studentLogin(f.students[0].reg, "nope");
    const admin = (
      await request(app)
        .post("/api/auth/admin/login")
        .send({ email: f.admin.email, password: TEST_PASSWORD })
        .expect(200)
    ).body.accessToken;
    await request(app)
      .post(`/api/admin/users/${f.students[0].userId}/reset-password`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ password: TEST_PASSWORD })
      .expect(200);
    await studentLogin(f.students[0].reg, TEST_PASSWORD).expect(200);
  });
});

describe("الحساب الموقوف", () => {
  it("بكلمة مرورٍ خاطئة ⇒ نفس رسالة كلمة المرور الخاطئة، لا «موقوف»", async () => {
    await prisma.user.update({ where: { id: f.students[1].userId }, data: { status: "suspended" } });
    const [suspendedWrong, plainWrong] = [
      await studentLogin(f.students[1].reg, "nope"),
      await studentLogin(f.students[2].reg, "nope"),
    ];
    expect(suspendedWrong.status).toBe(401);
    expect(suspendedWrong.body.message).toBe(plainWrong.body.message);
    await prisma.user.update({ where: { id: f.students[1].userId }, data: { status: "active" } });
  });
});

//
// ═══ تغيير كلمة المرور — اختياريّ، بقواعد ═══
//

describe("تغيير كلمة المرور متى شاء صاحبها", () => {
  const s = () => f.students[3];

  it("الدخول بكلمة المرور المسلَّمة يفتح الحساب كاملاً — لا إجبار", async () => {
    const { accessToken } = (await studentLogin(s().reg, TEST_PASSWORD).expect(200)).body;
    await request(app).get("/api/student/dashboard").set("Authorization", `Bearer ${accessToken}`).expect(200);
  });

  it("والكلمة الجديدة لا تكون تاريخاً أو أرقاماً، ولا رقم التسجيل", async () => {
    const { accessToken } = (await studentLogin(s().reg, TEST_PASSWORD).expect(200)).body;
    const change = (newPassword: string) =>
      request(app)
        .post("/api/account/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: TEST_PASSWORD, newPassword });
    await change("2003/07/31").expect(400);
    await change("20030731").expect(400);
    await change(`x${s().reg}x`).expect(400);
  });

  it("وكلمةٌ صالحة تُحفظ، بجلسةٍ جديدة وكعكة تحديثٍ جديدة", async () => {
    const { accessToken } = (await studentLogin(s().reg, TEST_PASSWORD).expect(200)).body;
    const res = await request(app)
      .post("/api/account/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "Talib-Jadid-2026" })
      .expect(200);
    expect(refreshCookieOf(res)).toBeDefined();
    await request(app).get("/api/student/dashboard").set("Authorization", `Bearer ${res.body.accessToken}`).expect(200);
  });
});

//
// ═══ رمز التحديث: كعكةٌ تتبدّل ═══
//

describe("رمز التحديث في كعكة httpOnly", () => {
  it("الدخول يضعها: httpOnly، على مسارات الدخول وحدها", async () => {
    const res = await studentLogin(f.students[2].reg, TEST_PASSWORD).expect(200);
    const cookie = refreshCookieOf(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("والتجديد بالكعكة يُعيد رمز وصولٍ وكعكةً جديدة — ولا رمز تحديثٍ في الجسم", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/student/login").send({ registrationNumber: f.students[2].reg, password: TEST_PASSWORD }).expect(200);
    const res = await agent.post("/api/auth/refresh").send({}).expect(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.refreshToken).toBeUndefined();
    expect(refreshCookieOf(res)).toBeDefined();
  });

  it("رمزٌ استُبدل يعود بعد مهلة السماح ⇒ تُلغى الجلسة كلّها، ورمزها الجديد معها", async () => {
    const first = (await studentLogin(f.students[2].reg, TEST_PASSWORD).expect(200)).body.refreshToken as string;
    const second = (await request(app).post("/api/auth/refresh").send({ refreshToken: first }).expect(200)).body
      .refreshToken as string;
    expect(second).toBeDefined();

    // تبويبان يجدّدان معاً: القديم يُقبل لحظاتٍ بعد تبديله.
    await request(app).post("/api/auth/refresh").send({ refreshToken: first }).expect(200);

    // ثمّ تمضي المهلة: عودته بعدها سرقة.
    await prisma.authSession.updateMany({
      where: { userId: f.students[2].userId },
      data: { rotatedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    await request(app).post("/api/auth/refresh").send({ refreshToken: first }).expect(401);
    await request(app).post("/api/auth/refresh").send({ refreshToken: second }).expect(401);
  });

  it("والخروج بالكعكة وحدها — بلا رمز وصول — يُنهي الجلسة ويمحو الكعكة", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[2].reg, password: TEST_PASSWORD })
      .expect(200);
    const out = await agent.post("/api/auth/logout").send({}).expect(200);
    expect(refreshCookieOf(out)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    await agent.post("/api/auth/refresh").send({}).expect(400);
    // ونسخة الرمز نفسه، من أيّ طريقٍ جاءت، لم تعد تعمل.
    await request(app).post("/api/auth/refresh").send({ refreshToken: login.body.refreshToken }).expect(401);
  });
});
