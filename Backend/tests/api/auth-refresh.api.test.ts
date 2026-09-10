/**
 * تحديث الرمز، ومسارا دخول الطالب والأستاذ.
 *
 * تكملة لـ`auth.api.test.ts` الذي غطّى مسار الإدارة وحده. وما هنا هو الجزء
 * الأخطر من الوحدة: مسار `refresh` هو ما يُبقي الجلسة حيّة، فإن قَبِل ما لا
 * ينبغي بقيت جلسةٌ يجب أن تنتهي — وهذا أسوأ من رفض جلسة صحيحة.
 *
 * تعليق `refreshTokenService` يسمّي ثلاث حمايات: النوع والخوارزمية والمُصدِر،
 * ومطابقة الجيل، وقراءة الدور من القاعدة لا من الرمز. كلٌّ منها له تأكيد هنا.
 */
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { signRefreshToken } from "../../src/core/auth/tokens";
import { Roles } from "../../src/core/enums/role.enum";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
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

type Pair = { accessToken: string; refreshToken: string };

const loginAdmin = async (): Promise<Pair> =>
  (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body;

const refresh = (token: string) =>
  request(app).post("/api/auth/refresh").send({ refreshToken: token });

//
// ═══ دخول الطالب ═══
//

describe("POST /api/auth/student/login", () => {
  it("رقم تسجيل وكلمة سرّ صحيحان ⇒ 200 مع رمزَين", async () => {
    const res = await request(app)
      .post("/api/auth/student/login")
      .send({
        registrationNumber: f.students[0].reg,
        password: TEST_PASSWORD,
      })
      .expect(200);

    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.role).toBe(Roles.STUDENT);
    expect(res.body.user.registrationNumber).toBe(f.students[0].reg);
  });

  it("كلمة سرّ خاطئة ⇒ 401", async () => {
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0].reg, password: "nope" })
      .expect(401);
  });

  it("رقم تسجيل مجهول ⇒ 401 بنفس الرسالة — فلا يُعرَف أي رقم مسجَّل", async () => {
    const [wrongPass, unknown] = await Promise.all([
      request(app)
        .post("/api/auth/student/login")
        .send({ registrationNumber: f.students[0].reg, password: "nope" }),
      request(app)
        .post("/api/auth/student/login")
        .send({ registrationNumber: `${TAG}-NOPE`, password: TEST_PASSWORD }),
    ]);

    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPass.body.message);
  });

  it("ولا يُعيد كلمة السرّ ولا تجزئتها", async () => {
    const res = await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0].reg, password: TEST_PASSWORD });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("$2b$");
    expect(res.body.user?.password).toBeUndefined();
  });

  it("طالب موقوف ⇒ يُرفض دخوله", async () => {
    await prisma.user.update({
      where: { id: f.students[1].userId },
      data: { status: "suspended" },
    });

    const res = await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[1].reg, password: TEST_PASSWORD });
    expect([401, 403]).toContain(res.status);

    await prisma.user.update({
      where: { id: f.students[1].userId },
      data: { status: "active" },
    });
  });
});

//
// ═══ دخول الأستاذ ═══
//

describe("POST /api/auth/professor/login", () => {
  it("بريد جامعي وكلمة سرّ صحيحان ⇒ 200", async () => {
    const res = await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor.universityEmail,
        password: TEST_PASSWORD,
      })
      .expect(200);

    expect(res.body.user.role).toBe(Roles.PROFESSOR);
    expect(typeof res.body.refreshToken).toBe("string");
  });

  it("بريد جامعي مجهول ⇒ 401 بنفس رسالة كلمة السرّ الخاطئة", async () => {
    const [wrongPass, unknown] = await Promise.all([
      request(app).post("/api/auth/professor/login").send({
        universityEmail: f.professor.universityEmail,
        password: "nope",
      }),
      request(app).post("/api/auth/professor/login").send({
        universityEmail: `${TAG}.nobody@test.local`,
        password: TEST_PASSWORD,
      }),
    ]);

    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPass.body.message);
  });

  /**
   * الأستاذ يدخل ببريده الجامعي لا ببريد حسابه. الخلط بينهما يفتح باباً
   * لم يُقصد فتحه.
   */
  it("ببريد الحساب بدل البريد الجامعي ⇒ يُرفض", async () => {
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.profUser.email, password: TEST_PASSWORD })
      .expect(401);
  });
});

//
// ═══ تحديث الرمز ═══
//

describe("POST /api/auth/refresh", () => {
  it("رمز تحديث صحيح ⇒ 200 مع رمز وصول جديد يعمل", async () => {
    const { refreshToken } = await loginAdmin();

    const res = await refresh(refreshToken).expect(200);
    expect(typeof res.body.accessToken).toBe("string");

    // والرمز الجديد يفتح مساراً محميّاً فعلاً — لا مجرّد نصّ.
    await request(app)
      .get("/api/admin/topics")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it("بلا رمز في الجسم ⇒ 400 أو 401، لا 500", async () => {
    const res = await refresh("");
    expect([400, 401]).toContain(res.status);
  });

  it("رمز مشوَّه ⇒ 401", async () => {
    await refresh("aaa.bbb.ccc").expect(401);
  });

  /**
   * الحماية الأولى: النوع. رمز الوصول لا يصلح للتحديث ولو كان صحيحاً تماماً —
   * وإلا صار عمر الجلسة عمرَ أي رمز وصول مسروق.
   */
  it("رمز وصول مُقدَّم للتحديث ⇒ 401", async () => {
    const { accessToken } = await loginAdmin();
    await refresh(accessToken).expect(401);
  });

  it("رمز تحديث منتهٍ ⇒ 401", async () => {
    const expired = jwt.sign(
      {
        userId: f.admin.id,
        role: Roles.ADMIN,
        refId: f.admin.id,
        tokenVersion: 0,
        typ: "refresh",
      },
      config.JWT_REFRESH_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "-1s",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    await refresh(expired).expect(401);
  });

  it("رمز تحديث موقَّع بسرّ آخر ⇒ 401", async () => {
    const forged = jwt.sign(
      {
        userId: f.admin.id,
        role: Roles.ADMIN,
        refId: f.admin.id,
        tokenVersion: 0,
        typ: "refresh",
      },
      "some-other-secret",
      {
        algorithm: "HS256",
        expiresIn: "7d",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    await refresh(forged).expect(401);
  });

  it("رمز تحديث لمستخدم محذوف ⇒ 401", async () => {
    const orphan = signRefreshToken({
      userId: "00000000-0000-0000-0000-000000000000",
      role: Roles.ADMIN,
      refId: "00000000-0000-0000-0000-000000000000",
      tokenVersion: 0,
    });

    const res = await refresh(orphan).expect(401);
    expect(res.body.message).toBe("User no longer exists");
  });

  /**
   * الحماية الثانية: مطابقة الجيل. هذا هو جوهر «الخروج من كل الأجهزة» —
   * وبدونه يبقى رمز التحديث المسروق صالحاً أسبوعاً كاملاً بعد أن يُبلِّغ
   * المستخدم عن اختراق حسابه ويُخرج جلساته.
   */
  it("رمز تحديث بجيل قديم ⇒ 401 «Session has been revoked»", async () => {
    const { refreshToken } = await loginAdmin();

    // «الخروج من كل الأجهزة» يرفع الجيل.
    await prisma.user.update({
      where: { id: f.admin.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const res = await refresh(refreshToken).expect(401);
    expect(res.body.message).toBe("Session has been revoked");
  });

  it("والخروج من جلسة واحدة يُبطل رمز تحديثها هي", async () => {
    const pair = await loginAdmin();

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${pair.accessToken}`)
      .expect(200);

    const res = await refresh(pair.refreshToken).expect(401);
    expect(res.body.message).toBe("Session has been revoked");
  });

  it("وحساب أُوقف بعد إصدار الرمز ⇒ يُرفض تحديثه", async () => {
    const { refreshToken } = await loginAdmin();

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "suspended" },
    });

    const res = await refresh(refreshToken);
    expect([401, 403]).toContain(res.status);

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "active" },
    });
  });

  /**
   * الحماية الثالثة، وأدقّها.
   *
   * الدور يُقرأ من القاعدة عند كل تحديث، لا من الرمز. فلو خُفِّض حساب من
   * `admin` إلى `professor`، لا ينتظر التخفيض انتهاء رمز التحديث — بل يسري
   * عند أوّل تحديث. وبدون هذا يبقى الامتياز المُلغى حيّاً أسبوعاً.
   */
  it("خفض الدور يسري عند أوّل تحديث — الدور من القاعدة لا من الرمز", async () => {
    const { refreshToken } = await loginAdmin();

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { role: "professor" },
    });

    const res = await refresh(refreshToken).expect(200);

    // الرمز القديم كان يقول admin؛ الجديد يجب أن يقول professor.
    const decoded = jwt.decode(res.body.accessToken) as { role: string };
    expect(decoded.role).toBe(Roles.PROFESSOR);

    // وبه لا يُفتح مسار الإدارة.
    await request(app)
      .get("/api/admin/topics")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(403);

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { role: "admin" },
    });
  });
});
