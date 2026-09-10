/**
 * حدّ المحاولات على مسارات الاعتماد.
 *
 * رُفع سقف الحدّ في بيئة الاختبار (`AUTH_RATE_LIMIT_MAX=200`) لأن اختبارات
 * المصادقة تُفشل الدخول عمداً عشرات المرّات فتُشعله، فتفشل لسببٍ لا علاقة له
 * بما تختبره. ورفعُ سقفٍ بلا اختبارٍ يحرسه يترك الحماية بلا شاهد — فهذا
 * الملفّ يبنيه بسقفٍ صغير ويهاجمه.
 *
 * ولا يمسّ قاعدة البيانات ولا يمرّ بـ bcrypt: تطبيق Express صغير عليه الحدّ
 * وحده، فيُنفَّذ في أجزاء من الثانية.
 */
import express from "express";
import request from "supertest";
import { makeAuthLimiter } from "./rateLimit.middleware";

/** تطبيق صغير: الحدّ، ثم معالج يعلن النجاح أو الفشل حسب ما يُطلب. */
function appWithLimit(max: number) {
  const app = express();
  app.use(express.json());
  app.post("/try", makeAuthLimiter(max), (req, res) => {
    // `?fail=1` يُحاكي محاولة دخول فاشلة.
    if (req.query.fail) return res.status(401).json({ message: "no" });
    return res.status(200).json({ message: "ok" });
  });
  return app;
}

describe("حدّ محاولات الاعتماد", () => {
  it("يسمح حتى السقف ثم يردّ 429", async () => {
    const app = appWithLimit(3);

    for (let i = 0; i < 3; i++) {
      await request(app).post("/try?fail=1").expect(401);
    }

    const blocked = await request(app).post("/try?fail=1").expect(429);
    expect(blocked.body.message).toMatch(/Too many failed attempts/);
  });

  /**
   * `skipSuccessfulRequests` هو ما يمنع معاقبة موظّف لأن زميلاً على نفس
   * الشبكة أخطأ كلمة سرّه. بدونه يصير الحدّ سلاحاً على المستخدمين لا على
   * المهاجم.
   */
  it("والمحاولات الناجحة لا تُحتسب إطلاقاً", async () => {
    const app = appWithLimit(2);

    for (let i = 0; i < 10; i++) {
      await request(app).post("/try").expect(200);
    }

    // بعد عشر نجاحات، ما يزال الرصيد كاملاً للفاشلات.
    await request(app).post("/try?fail=1").expect(401);
    await request(app).post("/try?fail=1").expect(401);
    await request(app).post("/try?fail=1").expect(429);
  });

  it("وبعد إشعاله يُحجب حتى الطلب الصحيح", async () => {
    const app = appWithLimit(1);

    await request(app).post("/try?fail=1").expect(401);
    await request(app).post("/try?fail=1").expect(429);

    // كلمة السرّ الصحيحة لا تُنقذ: العنوان محجوب حتى تنقضي النافذة.
    await request(app).post("/try").expect(429);
  });

  it("ويُعلن الحدّ في ترويسات المعيار، فيعرف العميل متى يُعاود", async () => {
    const app = appWithLimit(2);
    const res = await request(app).post("/try?fail=1");

    // draft-7: ترويسة واحدة تجمع الحدّ والمتبقّي ووقت إعادة الضبط.
    expect(res.headers["ratelimit"] ?? res.headers["ratelimit-policy"]).toBeDefined();
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined(); // القديمة مُطفأة
  });
});
