/**
 * الأجهزة المتّصلة بالحساب — قائمتها، وإخراج واحدٍ منها.
 *
 * كلّ دخولٍ جلسةٌ تحفظ جهازها (المتصفّح والنظام والعنوان)، فيعرف صاحب الحساب
 * هاتفه من حاسوبه. وإخراج جهازٍ يسري فوراً: رموزه تُرفض من الطلب التالي، ولا
 * يمسّ الأجهزة الأخرى. ولا يصل أحدٌ إلى جلسات غيره.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let f: Fixture;

const adminLogin = async (ua: string) =>
  (
    await request(app)
      .post("/api/auth/admin/login")
      .set("User-Agent", ua)
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;
const as = (r: request.Test, token: string) => r.set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  await teardown();
  f = await seed(2);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("GET /api/account/sessions", () => {
  it("يعرض كلّ جهازٍ دخل الحساب، وهذا الجهاز أوّلاً", async () => {
    const desk = await adminLogin(DESKTOP);
    await adminLogin(PHONE);

    const res = await as(request(app).get("/api/account/sessions"), desk).expect(200);
    const sessions = res.body.sessions as Array<{
      id: string;
      current: boolean;
      device: { type: string; os: string; browser: string };
    }>;

    expect(sessions[0]).toMatchObject({ current: true, device: { type: "desktop", os: "Windows", browser: "Chrome" } });
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(sessions.some((s) => s.device.os === "iOS" && s.device.type === "mobile")).toBe(true);
  });

  it("يتطلّب الدخول", async () => {
    await request(app).get("/api/account/sessions").expect(401);
  });
});

describe("DELETE /api/account/sessions/:id", () => {
  it("يُخرج الجهاز فوراً ويُبقي هذا الجهاز", async () => {
    const desk = await adminLogin(DESKTOP);
    const phone = await adminLogin(PHONE);
    const phoneSid = (await as(request(app).get("/api/account/sessions"), phone).expect(200)).body.sessions.find(
      (s: { current: boolean }) => s.current,
    ).id;

    await as(request(app).delete(`/api/account/sessions/${phoneSid}`), desk).expect(200);

    await as(request(app).get("/api/auth/me"), phone).expect(401);
    await as(request(app).get("/api/auth/me"), desk).expect(200);
    const left = (await as(request(app).get("/api/account/sessions"), desk).expect(200)).body.sessions;
    expect(left.map((s: { id: string }) => s.id)).not.toContain(phoneSid);
  });

  it("لا يصل إلى جلسات حسابٍ آخر", async () => {
    const desk = await adminLogin(DESKTOP);
    const prof = (
      await request(app)
        .post("/api/auth/professor/login")
        .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
        .expect(200)
    ).body.accessToken;
    const adminSid = (await as(request(app).get("/api/account/sessions"), desk).expect(200)).body.sessions[0].id;

    await as(request(app).delete(`/api/account/sessions/${adminSid}`), prof).expect(404);
    await as(request(app).get("/api/auth/me"), desk).expect(200);
  });

  it("يرفض معرّفاً لا جلسة له", async () => {
    const desk = await adminLogin(DESKTOP);
    await as(request(app).delete("/api/account/sessions/no-such-session"), desk).expect(404);
  });
});
