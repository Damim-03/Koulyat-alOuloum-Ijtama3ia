/**
 * مسارات **الرفض** في المصادقة، عبر HTTP حقيقي.
 *
 * كانت التغطية تقول إن `modules/auth` عند ٥٦٪ جمل و**١٥.٧٪ فروع**، والفجوة
 * بينهما تصف الحال وصفاً دقيقاً: مسار النجاح مُجرَّب — تسجيل دخول صحيح يعمل —
 * وكل ما عداه لا. والأمان لا يسكن مسار النجاح، بل يسكن ما يليه:
 *
 *   كلمة سرّ خاطئة · حساب غير موجود · حساب موقوف · رمز منتهٍ · رمز مزوَّر ·
 *   جلسة أُبطلت بالخروج · كل الجلسات أُبطلت · رمز يدّعي دوراً لا يملكه
 *
 * كلٌّ من هذه سطرٌ في الشيفرة يقول «ارفض». وسطرٌ يقول «ارفض» ولم يُنفَّذ قطّ
 * هو سطرٌ لا نعرف أنه يرفض.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../../src/core/config/app.config";
import { signAccessToken, signRefreshToken } from "../../src/core/auth/tokens";
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

/** يسجّل الدخول ويُعيد الزوج كاملاً. */
async function login() {
  const res = await request(app)
    .post("/api/auth/admin/login")
    .send({ email: f.admin.email, password: TEST_PASSWORD })
    .expect(200);
  return res.body as { accessToken: string; refreshToken: string };
}

const guarded = "/api/admin/topics";
const withToken = (token: string) =>
  request(app).get(guarded).set("Authorization", `Bearer ${token}`);

//
// ═══ تسجيل الدخول ═══
//

describe("POST /api/auth/admin/login", () => {
  it("بيانات صحيحة ⇒ 200 مع رمزَين", async () => {
    const body = await login();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("كلمة سرّ خاطئة ⇒ 401", async () => {
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: "wrong-password" })
      .expect(401);
  });

  it("بريد غير موجود ⇒ 401", async () => {
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: `${TAG}.nobody@test.local`, password: TEST_PASSWORD })
      .expect(401);
  });

  /**
   * الرسالة نفسها في الحالتين: التمييز بينهما يُخبر المهاجم أي بريد مسجَّل،
   * فيتحوّل النموذج إلى أداة لعدّ الحسابات.
   */
  it("ولا تُميّز رسالةُ الرفض بين «بريد مجهول» و«كلمة سرّ خاطئة»", async () => {
    const [wrongPass, noSuchUser] = await Promise.all([
      request(app)
        .post("/api/auth/admin/login")
        .send({ email: f.admin.email, password: "wrong-password" }),
      request(app)
        .post("/api/auth/admin/login")
        .send({ email: `${TAG}.nobody@test.local`, password: TEST_PASSWORD }),
    ]);

    expect(wrongPass.status).toBe(noSuchUser.status);
    expect(wrongPass.body.message).toBe(noSuchUser.body.message);
  });

  it("لا يردّ الرمز المخزَّن ولا التجزئة مهما كان الطلب", async () => {
    const res = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("$2a$"); // بادئة تجزئة bcrypt
    expect(body).not.toContain("$2b$");
    expect(res.body.user?.password).toBeUndefined();
  });

  it("جسم بلا بريد أو بلا كلمة سرّ ⇒ 400 لا 500", async () => {
    for (const body of [
      {},
      { email: f.admin.email },
      { password: TEST_PASSWORD },
      { email: "not-an-email", password: TEST_PASSWORD },
    ]) {
      const res = await request(app).post("/api/auth/admin/login").send(body);
      expect(res.status).toBe(400);
    }
  });

  it("حساب موظّف على مسار دخول الإدارة ⇒ يُرفض", async () => {
    // البريد موجود، لكنه ليس بدور admin.
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.profUser.email, password: TEST_PASSWORD })
      .expect(401);
  });
});

//
// ═══ الميدل-وير: ما يُقبل وما يُرفض ═══
//

describe("حارس المصادقة على مسار محميّ", () => {
  it("بلا ترويسة ⇒ 401", async () => {
    await request(app).get(guarded).expect(401);
  });

  it.each([
    ["ترويسة فارغة", ""],
    ["بلا كلمة Bearer", "just-a-token"],
    ["Bearer بلا رمز", "Bearer "],
    ["مخطّط آخر", "Basic dXNlcjpwYXNz"],
  ])("%s ⇒ 401", async (_label, header) => {
    await request(app)
      .get(guarded)
      .set("Authorization", header)
      .expect(401);
  });

  it("رمز مشوَّه ⇒ 401 «Invalid token»", async () => {
    const res = await withToken("aaa.bbb.ccc").expect(401);
    expect(res.body.message).toBe("Invalid token");
  });

  it("رمز منتهٍ ⇒ 401 «Token expired» — رسالة مختلفة ليعرف العميل أن يُجدّد", async () => {
    const expired = jwt.sign(
      {
        userId: f.admin.id,
        role: Roles.ADMIN,
        refId: f.admin.id,
        tokenVersion: 0,
        typ: "access",
      },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "-1s",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    const res = await withToken(expired).expect(401);
    expect(res.body.message).toBe("Token expired");
  });

  it("رمز تحديث مُقدَّم كرمز وصول ⇒ 401", async () => {
    const { refreshToken } = await login();
    await withToken(refreshToken).expect(401);
  });

  it("رمز لمستخدم محذوف ⇒ 401 «User not found»", async () => {
    const orphan = signAccessToken({
      userId: "00000000-0000-0000-0000-000000000000",
      role: Roles.ADMIN,
      refId: "00000000-0000-0000-0000-000000000000",
      tokenVersion: 0,
    });

    const res = await withToken(orphan).expect(401);
    expect(res.body.message).toBe("User not found");
  });

  it("رمز صحيح ⇒ 200", async () => {
    const { accessToken } = await login();
    await withToken(accessToken).expect(200);
  });
});

//
// ═══ الحساب الموقوف ═══
//

describe("الحساب الموقوف", () => {
  it("رمزٌ أُصدر قبل الإيقاف يتوقّف عن العمل فوراً ⇒ 403", async () => {
    const { accessToken } = await login();
    await withToken(accessToken).expect(200); // يعمل قبل الإيقاف

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "suspended" },
    });

    const res = await withToken(accessToken).expect(403);
    expect(res.body.message).toBe("Your account has been suspended");

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "active" },
    });
  });

  it("والحساب الموقوف لا يستطيع تسجيل الدخول أصلاً", async () => {
    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "suspended" },
    });

    const res = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD });
    expect([401, 403]).toContain(res.status);

    await prisma.user.update({
      where: { id: f.admin.id },
      data: { status: "active" },
    });
  });
});

//
// ═══ إبطال الجلسات ═══
//

describe("الخروج يُبطل الرمز فعلاً", () => {
  /**
   * قبل وجود الإبطال كان الخروج يمسح المتصفّح ويترك الرمز صالحاً لكامل عمره.
   * هذان التأكيدان يحرسان الرافعتين: جلسة واحدة، وكل الجلسات.
   */
  it("خروجٌ من جلسة واحدة يُبطل رمزها ⇒ 401 «Session has been revoked»", async () => {
    const { accessToken } = await login();
    await withToken(accessToken).expect(200);

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const res = await withToken(accessToken).expect(401);
    expect(res.body.message).toBe("Session has been revoked");
  });

  it("و«الخروج من كل الأجهزة» يُبطل جلسةً أخرى لم تُلمَس", async () => {
    const first = await login();
    const second = await login(); // جهاز ثانٍ
    await withToken(first.accessToken).expect(200);
    await withToken(second.accessToken).expect(200);

    await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);

    // الجلسة الثانية لم تُستعمل في الخروج، ومع ذلك بطلت.
    await withToken(second.accessToken).expect(401);
  });
});

//
// ═══ الامتياز يأتي من القاعدة لا من الرمز ═══
//

describe("رمزٌ يدّعي دوراً لا يملكه صاحبه", () => {
  /**
   * أخطر تأكيد في هذا الملفّ.
   *
   * الرمز موقَّع، فلا يستطيع أحد تزويره من الخارج — لكن لو سرّب سرُّ التوقيع
   * يوماً، أو أُصدر رمز بدور قديم ثم خُفّض صاحبه، فالسؤال: هل يُصدَّق ما في
   * الرمز؟ تعليق الميدل-وير يقول لا — الدور يُقرأ من القاعدة دائماً. وهنا
   * إثباته: رمز صحيح التوقيع يقول `admin` لطالب، ومع ذلك يُرفض.
   */
  it("رمز صحيح التوقيع يقول admin لطالب ⇒ يُرفض كطالب", async () => {
    const student = f.students[0];

    const forged = signAccessToken({
      userId: student.userId,
      role: Roles.ADMIN, // كذبة موقَّعة توقيعاً صحيحاً
      refId: student.id,
      tokenVersion: 0,
    });

    // التوقيع سليم، فالميدل-وير يقبله ويُكمل — ثم يقرأ الدور من القاعدة.
    const res = await withToken(forged);
    expect(res.status).toBe(403);
  });

  it("ورمز تحديث مزوَّر بنفس الادّعاء لا ينفع كذلك", async () => {
    const student = f.students[1];
    const forged = signRefreshToken({
      userId: student.userId,
      role: Roles.ADMIN,
      refId: student.id,
      tokenVersion: 0,
    });

    await withToken(forged).expect(401);
  });
});
