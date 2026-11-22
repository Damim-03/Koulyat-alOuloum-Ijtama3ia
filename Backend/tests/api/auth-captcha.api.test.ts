/**
 * التحقّق القصير قبل الدخول (ALTCHA).
 *
 * لا يُطلب إلا بسبب، وعلى درجتين: المسألة الحسابية وحدها لمعرِّفٍ أخطأ
 * مرّتين؛ ومعها رمزُ صورةٍ حين يكون أمرٌ مريب قائماً — إنذار الفشل الجماعي،
 * أو معرِّفٌ أُقفل اليوم. وبدون ما تطلبه الدرجة يُردّ الدخول بـ428، ومعه
 * الدرجة، قبل أن يُبحث عن الحساب أو تُقارن كلمة المرور — فلا يُعرف منه شيء،
 * ولا يُحسب على المعرِّف. وكلُّ حلٍّ وكلُّ تصريحٍ يفتح دخولاً واحداً.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { throttleKey } from "../../src/core/auth/login-throttle";
import { CHALLENGE, imageCode } from "../../src/modules/auth/captcha";
import { FAILURE_SPIKE_ACTION } from "../../src/modules/auth/failure-spike";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";
import type * as AltchaLib from "altcha-lib" with { "resolution-mode": "import" };
import type * as Pbkdf2 from "altcha-lib/algorithms/pbkdf2" with { "resolution-mode": "import" };

/* eslint-disable @typescript-eslint/no-require-imports */
const { solveChallenge }: typeof AltchaLib = require("altcha-lib");
const { deriveKey }: typeof Pbkdf2 = require("altcha-lib/algorithms/pbkdf2");
/* eslint-enable @typescript-eslint/no-require-imports */

let f: Fixture;

beforeAll(async () => {
  await teardown();
  f = await seed(4);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { action: FAILURE_SPIKE_ACTION } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

beforeEach(() => {
  jest.replaceProperty(config, "LOGIN_CAPTCHA", true);
  // صعوبةٌ صغيرة: يُحلّ في أجزاء من الثانية، والتحقّق هو نفسه.
  jest.replaceProperty(CHALLENGE, "cost", 10);
  jest.replaceProperty(CHALLENGE, "counterMin", 10);
  jest.replaceProperty(CHALLENGE, "counterMax", 40);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await prisma.loginThrottle.deleteMany({ where: { key: { contains: TAG.toLowerCase() } } });
  await prisma.auditLog.deleteMany({ where: { action: FAILURE_SPIKE_ACTION } });
});

const studentLogin = (reg: string, password: string, altcha?: string) =>
  request(app)
    .post("/api/auth/student/login")
    .send({ registrationNumber: reg, password, ...(altcha ? { altcha } : {}) });

/** ما يفعله المتصفّح: يطلب تحدّياً، ويحلّه، ويرسل الحلّ مع الدخول. */
async function solved() {
  const res = await request(app).get("/api/auth/challenge").expect(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  const challenge = res.body;
  const solution = await solveChallenge({ challenge, deriveKey });
  expect(solution).not.toBeNull();
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

const failuresOf = async (reg: string) =>
  (await prisma.loginThrottle.findUnique({ where: { key: throttleKey("student", reg) } }))?.failures ?? 0;

const expectAsked = (
  res: request.Response,
  message: "auth.captchaRequired" | "auth.captchaInvalid" = "auth.captchaRequired",
  captcha: "work" | "image" = "work",
) => {
  expect(res.status).toBe(428);
  expect(res.body).toMatchObject({ errorCode: "AUTH_CAPTCHA_REQUIRED", message: tr(message), captcha });
};

const CODE = "23456";

/** المسألة بدرجة الصورة، محلولةً — والصورة معها. */
async function solvedImage() {
  jest.spyOn(imageCode, "next").mockReturnValue(CODE);
  const res = await request(app).get("/api/auth/challenge").query({ level: "image" }).expect(200);
  const { codeChallenge, ...challenge } = res.body;
  const solution = await solveChallenge({ challenge, deriveKey });
  return { codeChallenge, payload: Buffer.from(JSON.stringify({ challenge, solution })).toString("base64") };
}

/** ما ترسله الأداة بعد أن يكتب المستخدم الرمز — كما ترسله: JSON بالحلّ والرمز. */
const verifyCode = (payload: string, code: string) =>
  request(app).post("/api/auth/challenge/verify").send({ code, payload }).expect(200);

/** تصريحُ دخولٍ واحد: مسألةٌ محلولة، ورمزٌ صحيح. */
async function imagePass() {
  const { payload } = await solvedImage();
  const res = await verifyCode(payload, CODE);
  expect(res.body).toMatchObject({ verified: true });
  return res.body.payload as string;
}

/** معرِّفٌ أُقفل اليوم وانقضى قفله: ما زال تحت النظر. */
const lockedBefore = (reg: string) =>
  prisma.loginThrottle.create({
    data: {
      key: throttleKey("student", reg),
      failures: 0,
      lockCount: 1,
      lockedUntil: new Date(Date.now() - 60_000),
      lastFailureAt: new Date(),
    },
  });

describe("متى يُطلب", () => {
  it("دخولٌ صحيح من أوّل مرّة ⇒ لا يُطلب شيء", async () => {
    await studentLogin(f.students[0]!.reg, TEST_PASSWORD).expect(200);
  });

  it("بعد خطأين ⇒ الثالثة تُردّ بـ428 ولو صحّت كلمة المرور، ولا تُحسب خطأً", async () => {
    const reg = f.students[0]!.reg;
    await studentLogin(reg, "wrong-1").expect(401);
    await studentLogin(reg, "wrong-2").expect(401);

    expectAsked(await studentLogin(reg, TEST_PASSWORD));
    expectAsked(await studentLogin(reg, "wrong-3"));
    expect(await failuresOf(reg)).toBe(2);
  });

  it("ورقمٌ لا حساب له يُعامَل بالطريقة نفسها — فالطلب لا يكشف من هو مسجَّل", async () => {
    const ghost = `${TAG}-CAPTCHA-GHOST`;
    await studentLogin(ghost, "x").expect(401);
    await studentLogin(ghost, "x").expect(401);
    expectAsked(await studentLogin(ghost, "x"));
  });

  it("والإنذار قائم ⇒ الصورة من أوّل محاولة، لكلّ حساب؛ والمسألة وحدها لا تكفي", async () => {
    await prisma.auditLog.create({ data: { action: FAILURE_SPIKE_ACTION, success: false } });
    const reg = f.students[1]!.reg;
    expectAsked(await studentLogin(reg, TEST_PASSWORD), "auth.captchaRequired", "image");
    expectAsked(await studentLogin(reg, TEST_PASSWORD, await solved()), "auth.captchaRequired", "image");
    await studentLogin(reg, TEST_PASSWORD, await imagePass()).expect(200);
  });

  it("ومعرِّفٌ أُقفل اليوم ⇒ الصورة، ولو انقضى القفل", async () => {
    const reg = f.students[1]!.reg;
    await lockedBefore(reg);
    expectAsked(await studentLogin(reg, TEST_PASSWORD), "auth.captchaRequired", "image");
    await studentLogin(reg, TEST_PASSWORD, await imagePass()).expect(200);
  });

  it("ومطفأٌ في الإعداد ⇒ لا يُطلب أبداً: الخطأ الثالث 401 كما كان", async () => {
    jest.replaceProperty(config, "LOGIN_CAPTCHA", false);
    const reg = f.students[2]!.reg;
    for (let i = 0; i < 3; i++) await studentLogin(reg, "wrong").expect(401);
    expect(await failuresOf(reg)).toBe(3);
  });
});

describe("الحلّ", () => {
  /** معرِّفٌ أخطأ مرّتين، فصار يطلب التحقّق. */
  const twice = async (reg: string) => {
    await studentLogin(reg, "wrong-1").expect(401);
    await studentLogin(reg, "wrong-2").expect(401);
  };

  it("حلٌّ صحيح وكلمة مرورٍ صحيحة ⇒ يدخل؛ وحلٌّ وكلمةٌ خاطئة ⇒ 401 يُحسب", async () => {
    const reg = f.students[0]!.reg;
    await twice(reg);
    await studentLogin(reg, "wrong-3", await solved()).expect(401);
    expect(await failuresOf(reg)).toBe(3);
    await studentLogin(reg, TEST_PASSWORD, await solved()).expect(200);
  });

  it("الحلّ نفسه مرّةً ثانية ⇒ يُردّ: كلّ حلٍّ لدخولٍ واحد", async () => {
    const reg = f.students[0]!.reg;
    await twice(reg);
    const payload = await solved();
    await studentLogin(reg, "wrong-3", payload).expect(401);
    expectAsked(await studentLogin(reg, TEST_PASSWORD, payload), "auth.captchaInvalid");
  });

  /*
   * البرهان هو المفتاح المشتقّ نفسه: لا يُعرف إلا بإيجاد العدد الصحيح، والخادم
   * يتحقّق منه بتوقيعه في التحدّي دون أن يعيد الحساب. فالعدد المرسَل معه
   * لا يُفحص إلا في شكله — وتغييره لا يغني شيئاً عمّن لم يجد المفتاح.
   */
  it("مفتاحٌ مزيَّف، أو تحدٍّ مزوَّر، أو «وضع الاختبار» الفارغ ⇒ يُردّ", async () => {
    const reg = f.students[0]!.reg;
    await twice(reg);

    const real = JSON.parse(Buffer.from(await solved(), "base64").toString());
    const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

    const key: string = real.solution.derivedKey;
    const wrongKey = encode({
      ...real,
      solution: { ...real.solution, derivedKey: `${key.slice(0, -1)}${key.endsWith("0") ? "1" : "0"}` },
    });
    const forged = encode({
      ...real,
      challenge: { ...real.challenge, parameters: { ...real.challenge.parameters, cost: 1 } },
    });
    const testMode = encode({ challenge: null, solution: null, test: true });

    for (const payload of [wrongKey, forged, testMode, "not-base64-at-all"])
      expectAsked(await studentLogin(reg, TEST_PASSWORD, payload), "auth.captchaInvalid");
    expect(await failuresOf(reg)).toBe(2);
  });

  it("والأستاذ والمسؤول كالطالب", async () => {
    const prof = (password: string, altcha?: string) =>
      request(app)
        .post("/api/auth/professor/login")
        .send({ universityEmail: f.professor.universityEmail, password, ...(altcha ? { altcha } : {}) });
    await prof("wrong").expect(401);
    await prof("wrong").expect(401);
    expectAsked(await prof(TEST_PASSWORD));
    await prof(TEST_PASSWORD, await solved()).expect(200);

    const admin = (password: string, altcha?: string) =>
      request(app)
        .post("/api/auth/admin/login")
        .send({ email: f.admin.email, password, ...(altcha ? { altcha } : {}) });
    await admin("wrong").expect(401);
    await admin("wrong").expect(401);
    expectAsked(await admin(TEST_PASSWORD));
    await admin(TEST_PASSWORD, await solved()).expect(200);
  });
});

describe("رمز الصورة", () => {
  it("التحدّي بدرجة الصورة يحمل صورةً لا يُقرأ الرمز من نصّها", async () => {
    const { codeChallenge } = await solvedImage();
    expect(codeChallenge).toMatchObject({ length: CODE.length });
    expect(codeChallenge.image).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(codeChallenge.image.split(",")[1], "base64").toString();
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain(CODE);
  });

  it("رمزٌ خاطئ ⇒ يُرفض بسببه، والمسألة احترقت: لا يُجرَّب عليها رمزٌ ثانٍ", async () => {
    const { payload } = await solvedImage();
    expect((await verifyCode(payload, "99999")).body).toEqual({ verified: false, reason: tr("auth.captchaCodeWrong") });
    expect((await verifyCode(payload, CODE)).body).toEqual({ verified: false, reason: tr("auth.captchaInvalid") });
  });

  it("والمسافات في الرمز لا تهمّ؛ ومسألةٌ بلا صورة لا تُعطي تصريحاً", async () => {
    const { payload } = await solvedImage();
    expect((await verifyCode(payload, ` ${CODE.slice(0, 2)} ${CODE.slice(2)} `)).body).toMatchObject({ verified: true });
    expect((await verifyCode(await solved(), CODE)).body).toEqual({ verified: false, reason: tr("auth.captchaInvalid") });
  });

  it("التصريح لدخولٍ واحد، والمزوَّر يُردّ", async () => {
    const reg = f.students[2]!.reg;
    await lockedBefore(reg);
    const pass = await imagePass();
    await studentLogin(reg, "wrong", pass).expect(401);
    expectAsked(await studentLogin(reg, TEST_PASSWORD, pass), "auth.captchaInvalid", "image");

    const forged = Buffer.from(JSON.stringify({ pass: `x.${Date.now() + 60_000}`, sig: "00".repeat(32) })).toString("base64");
    expectAsked(await studentLogin(reg, TEST_PASSWORD, forged), "auth.captchaRequired", "image");
  });

  it("وفي درجة المسألة يكفي التصريح أيضاً", async () => {
    const reg = f.students[3]!.reg;
    await studentLogin(reg, "wrong-1").expect(401);
    await studentLogin(reg, "wrong-2").expect(401);
    await studentLogin(reg, TEST_PASSWORD, await imagePass()).expect(200);
  });
});
