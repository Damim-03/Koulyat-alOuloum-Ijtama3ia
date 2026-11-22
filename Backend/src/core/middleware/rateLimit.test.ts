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
import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { accountOrIp, makeAuthLimiter, refreshLimiter } from "./rateLimit.middleware";
import { tr } from "../i18n";

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
    expect(blocked.body.message).toBe(tr("auth.tooManyAttempts"));
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

/**
 * حدود الكتابة تُحسب لكلّ حساب لا لكلّ عنوان: مخبرٌ كامل خلف عنوانٍ واحد
 * (NAT الجامعة) كان سيتقاسم ميزانيةً واحدة، فيستنفدها واحدٌ عن الجميع.
 */
describe("حدّ الكتابة لكلّ حساب", () => {
  function appFor(max: number) {
    const app = express();
    // مكان `authMiddleware`: الحساب من رأسٍ يضعه الاختبار.
    app.use((req, _res, next) => {
      const who = req.header("x-test-user");
      if (who) req.user = { userId: who, role: "student", refId: who };
      next();
    });
    app.post("/write", rateLimit({ windowMs: 60_000, max, keyGenerator: accountOrIp }), (_req, res) =>
      res.status(201).json({ ok: true }),
    );
    return app;
  }

  it("حسابٌ استنفد ميزانيته لا يُوقف زميله على العنوان نفسه", async () => {
    const app = appFor(2);
    await request(app).post("/write").set("x-test-user", "a").expect(201);
    await request(app).post("/write").set("x-test-user", "a").expect(201);
    await request(app).post("/write").set("x-test-user", "a").expect(429);
    await request(app).post("/write").set("x-test-user", "b").expect(201);
  });

  it("وبلا حساب يُحسب بالعنوان", async () => {
    const app = appFor(1);
    await request(app).post("/write").expect(201);
    await request(app).post("/write").expect(429);
  });
});

describe("الحدود المشتركة", () => {
  it("حدٌّ مشتركٌ يُشعَل ⇒ 429 برسالةٍ مفهومة", async () => {
    const app = express();
    app.post("/refresh", refreshLimiter, (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 60; i++) await request(app).post("/refresh").expect(200);
    const res = await request(app).post("/refresh").expect(429);
    expect(res.body).toEqual({ message: tr("auth.tooManyRequests") });
  });

  /** طلبٌ لا عنوان له (انقطع اتّصاله) يُحسب بمفتاحٍ ثابت، لا يُسقط الحدّ. */
  it("وطلبٌ بلا حسابٍ ولا عنوان ⇒ مفتاحٌ ثابت لا رمية", () => {
    expect(accountOrIp({} as Request)).toBe("ip:");
  });

  /** أسقف الإنتاج هي المكتوبة في الوسيط — تُعلن في ترويسة المعيار، فتُقرأ منها. */
  it("وفي الإنتاج أسقفٌ أضيق", async () => {
    let prod!: typeof import("./rateLimit.middleware");
    jest.isolateModules(() => {
      jest.doMock("../config/app.config", () => {
        const { config } = jest.requireActual("../config/app.config");
        return { config: { ...config, IS_PRODUCTION: true } };
      });
      prod = require("./rateLimit.middleware");
    });
    const policy = async (limiter: RequestHandler) => {
      const app = express();
      app.get("/", limiter, (_req, res) => res.end());
      return (await request(app).get("/")).headers["ratelimit-policy"];
    };
    expect(await policy(prod.globalLimiter)).toBe("1000;w=900");
    expect(await policy(prod.verifyLimiter)).toBe("60;w=900");
    expect(await policy(prod.writeLimiter)).toBe("60;w=60");
    expect(await policy(prod.messageLimiter)).toBe("20;w=60");
    expect(await policy(prod.lookupLimiter)).toBe("40;w=900");
  });
});
