/**
 * الفرع الأخير في معالج الأخطاء — شبكة الأمان.
 *
 * لم يكن مُنفَّذاً في أي اختبار، والسبب طيّب: أُصلحت اليوم كل المواضع التي
 * كانت تُسقط الخادم بـ٥٠٠، فلم يبقَ في المجموعة كلّها طلبٌ يبلغه. لكنّ ذلك
 * يترك مفارقةً: كلّ ما فكّرنا فيه محروس، والحارس الذي يمسك **ما لم نفكّر
 * فيه** بلا شاهد.
 *
 * وما يحرسه ليس شكلياً. تعليق الملفّ يقول إن هذا الفرع كان يُعيد
 * `error.message` إلى العميل — وتلك السلسلة تحمل في خطأ Prisma أسماء الجداول
 * والأعمدة، وفي خطأ نظام الملفّات مساراتٍ مطلقة على الخادم، وفي خطأ المشغّل
 * وجهةَ الاتّصال بالقاعدة. كلّها كانت تُسلَّم لعميلٍ غير موثَّق.
 *
 * ولذلك يُسأل هنا سؤالان لا واحد:
 *
 *   **ماذا يصل العميل؟** رسالةٌ ثابتة ورقمُ حادثة، ولا حرفَ من داخل الآلة.
 *   **وماذا يصل السجلّ؟** الخطأ الحقيقي بالرقم نفسه — وإلّا صار الردّ
 *     الغامض عمًى للمساندة أيضاً — ومعه `meta` منزوعةَ الأسرار.
 *
 * والاختبار يبني تطبيق Express صغيراً حول المعالج **الحقيقي**: لا محاكاة
 * لـ`res`، ولا استدعاء مباشر للدالّة. فما يُقاس هو ما يقع على السلك.
 */
import express from "express";
import request from "supertest";

import { errorHandler } from "./errorHandler.middleware";
import { BadRequestException, NotFoundException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";

/** أسرارٌ لو ظهرت في ردٍّ أو سجلٍّ كانت تسريباً. */
const SECRET = "p@ssw0rd-must-never-appear";
const TABLE = "GraduationTopic.professorId";
const ABS_PATH = "C:\\\\srv\\\\app\\\\secrets\\\\keys.pem";

/** تطبيقٌ صغير: مسارٌ واحد يرمي ما يُطلب منه، والمعالج الحقيقي خلفه. */
function appThrowing(makeError: () => unknown) {
  const app = express();
  app.get("/boom", () => {
    throw makeError();
  });
  app.use(errorHandler);
  return app;
}

/** يلتقط ما كُتب في `console.error` أثناء الطلب. */
function captureLogs() {
  const lines: string[] = [];
  const spy = jest
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  return { lines, restore: () => spy.mockRestore() };
}

/** السطر البنيوي وحده (JSON)، دون سطر أثر النداء. */
const structured = (lines: string[]) =>
  JSON.parse(lines.find((l) => l.trim().startsWith("{"))!) as Record<
    string,
    unknown
  >;

describe("الفرع الأخير: خطأٌ غير متوقَّع", () => {
  it("يردّ ٥٠٠ برسالةٍ ثابتة ورقم حادثة", async () => {
    const log = captureLogs();
    try {
      const res = await request(appThrowing(() => new Error("boom"))).get(
        "/boom",
      );

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        message: "Internal Server Error",
        errorCode: ErrorCodeEnum.INTERNAL_SERVER_ERROR,
        incidentId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
      });
    } finally {
      log.restore();
    }
  });

  /**
   * جوهر الإصلاح: لا شيء من داخل الآلة يعبر إلى العميل. والخطأ هنا محشوٌّ
   * عمداً بالثلاثة التي كانت تتسرّب — اسمُ عمودٍ في القاعدة، ومسارٌ مطلق على
   * الخادم، وسرّ.
   */
  it("ولا يُسرِّب اسم جدولٍ ولا مساراً ولا سرّاً", async () => {
    const log = captureLogs();
    try {
      const nasty = new Error(
        `Invalid \`prisma.topic.create()\`: FK ${TABLE} at ${ABS_PATH} with ${SECRET}`,
      );

      const res = await request(appThrowing(() => nasty)).get("/boom");
      const body = JSON.stringify(res.body);

      expect(res.status).toBe(500);
      expect(body).not.toContain(TABLE);
      expect(body).not.toContain(ABS_PATH);
      expect(body).not.toContain(SECRET);
      expect(body).not.toContain("prisma");
      // ولا أثر النداء: هو أدقّ ما يصف الداخل.
      expect(body).not.toContain("at ");
      expect(res.body.stack).toBeUndefined();
    } finally {
      log.restore();
    }
  });

  /**
   * والوجه الآخر: الردّ الغامض بلا سجلٍّ مقابل يجعل العطل غير قابلٍ للتتبّع.
   * فالرقم نفسه يجب أن يربط ما رآه المستخدم بما رآه الخادم.
   */
  it("ويُسجَّل الخطأ الحقيقي بالرقم نفسه", async () => {
    const log = captureLogs();
    try {
      const res = await request(
        appThrowing(() => new Error(`FK ${TABLE} exploded`)),
      ).get("/boom");

      const line = structured(log.lines);
      expect(line.incidentId).toBe(res.body.incidentId);
      expect(line.level).toBe("error");
      expect(line.method).toBe("GET");
      expect(line.path).toBe("/boom");
      // السجلّ خاصٌّ بالخادم، فيحمل ما مُنع عن العميل.
      expect(String(line.message)).toContain(TABLE);
    } finally {
      log.restore();
    }
  });

  it("والمسار يُسجَّل بلا سلسلة الاستعلام", async () => {
    const log = captureLogs();
    try {
      await request(appThrowing(() => new Error("x"))).get(
        `/boom?token=${SECRET}&page=2`,
      );

      const line = structured(log.lines);
      expect(line.path).toBe("/boom");
      expect(String(line.path)).not.toContain(SECRET);
    } finally {
      log.restore();
    }
  });

  it("وكل حادثةٍ رقمها الخاصّ", async () => {
    const log = captureLogs();
    try {
      const app = appThrowing(() => new Error("same error"));
      const a = await request(app).get("/boom");
      const b = await request(app).get("/boom");

      expect(a.body.incidentId).not.toBe(b.body.incidentId);
    } finally {
      log.restore();
    }
  });

  /**
   * ليس كل ما يُرمى `Error`. نصٌّ أو رقمٌ أو كائنٌ عاديّ يصل المعالج بلا
   * `message` ولا `stack`، فيجب أن يبقى الجواب هو نفسه لا أن يسقط المعالج
   * وهو يقرأ حقولاً غير موجودة — وسقوطُ معالج الأخطاء يترك الطلب معلّقاً
   * بلا ردٍّ إطلاقاً.
   */
  it.each([
    ["نصّ", "مجرّد نصّ"],
    ["رقم", 42],
    ["كائن عاديّ", { a: 1 }],
  ])("وما لا يُشبه الخطأ — %s — يُجاب بالجواب نفسه", async (_l, thrown) => {
    const log = captureLogs();
    try {
      const res = await request(appThrowing(() => thrown)).get("/boom");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal Server Error");
      expect(res.body.incidentId).toBeTruthy();
    } finally {
      log.restore();
    }
  });

  /**
   * وقيمةٌ كاذبة لا تبلغ المعالج أصلاً.
   *
   * Express يُترجم الرمية إلى `next(value)`، و`next` بقيمةٍ كاذبة تعني
   * «تابِع» لا «خطأ». فـ`throw null` في أي مسارٍ يصير **٤٠٤ صامتة**: لا
   * سطر سجلّ، ولا رقم حادثة، ولا أثرَ لعطلٍ وقع فعلاً.
   *
   * وهذا سلوك Express لا سلوكنا، ولا يُصلَح من هنا. يُوثَّق ليُعرف: من رمى
   * قيمةً في شيفرة هذا المشروع فليرمِ `Error`.
   */
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["صفر", 0],
    ["نصّ فارغ", ""],
  ])("وقيمةٌ كاذبة — %s — لا تبلغ المعالج بل تصير ٤٠٤ صامتة", async (_l, thrown) => {
    const log = captureLogs();
    try {
      const res = await request(appThrowing(() => thrown)).get("/boom");

      expect(res.status).toBe(404);
      expect(res.body.incidentId).toBeUndefined();
      expect(log.lines.filter((l) => l.includes('"level":"error"'))).toEqual([]);
    } finally {
      log.restore();
    }
  });
});

//
// ═══ نزع الأسرار من `meta` ═══
//

describe("نزع الأسرار قبل السجلّ", () => {
  /** خطأٌ يحمل `meta` كما تفعل أخطاء Prisma. */
  const withMeta = (meta: unknown) =>
    Object.assign(new Error("failed"), { meta });

  it("المفاتيح الحسّاسة تُستبدَل بعلامةٍ لا بقيمتها", async () => {
    const log = captureLogs();
    try {
      await request(
        appThrowing(() =>
          withMeta({
            password: SECRET,
            accessToken: SECRET,
            refreshToken: SECRET,
            authorization: `Bearer ${SECRET}`,
            cookie: `sid=${SECRET}`,
            secret: SECRET,
            keep: "قيمةٌ عادية",
          }),
        ),
      ).get("/boom");

      const line = structured(log.lines);
      const meta = line.meta as Record<string, unknown>;

      for (const key of [
        "password",
        "accessToken",
        "refreshToken",
        "authorization",
        "cookie",
        "secret",
      ]) {
        expect(meta[key]).toBe("[redacted]");
      }
      // وما ليس سرّاً يبقى: النزع أداةٌ لا مقصّ.
      expect(meta.keep).toBe("قيمةٌ عادية");
      expect(JSON.stringify(line.meta)).not.toContain(SECRET);
    } finally {
      log.restore();
    }
  });

  it("والتعشيش لا يُفلت منه سرّ", async () => {
    const log = captureLogs();
    try {
      await request(
        appThrowing(() =>
          withMeta({ level1: { level2: { password: SECRET, ok: "نصّ" } } }),
        ),
      ).get("/boom");

      const line = structured(log.lines);
      expect(JSON.stringify(line.meta)).not.toContain(SECRET);
      expect(JSON.stringify(line.meta)).toContain("[redacted]");
    } finally {
      log.restore();
    }
  });

  it("والمصفوفات تُعالَج كعناصرها لا كصندوقٍ مغلق", async () => {
    const log = captureLogs();
    try {
      await request(
        appThrowing(() =>
          withMeta({ items: [{ token: SECRET }, { name: "سليم" }] }),
        ),
      ).get("/boom");

      const line = structured(log.lines);
      expect(JSON.stringify(line.meta)).not.toContain(SECRET);
      expect(JSON.stringify(line.meta)).toContain("سليم");
    } finally {
      log.restore();
    }
  });

  /**
   * حدُّ العمق أربع طبقات. وهذا يعني أن سرّاً أعمق من ذلك **يُسجَّل كما هو** —
   * والتأكيد هنا يصف الحدّ بدل أن يتظاهر بغيابه، فيراه من يقرأ ويقرّر: أهو
   * حدٌّ مقبول لبنية `meta` التي تصل فعلاً، أم يُرفَع؟
   */
  it("وحدُّ العمق معروفٌ ومقصود: أعمق منه لا يُنزَع", async () => {
    const log = captureLogs();
    try {
      await request(
        appThrowing(() =>
          withMeta({ a: { b: { c: { d: { password: SECRET } } } } }),
        ),
      ).get("/boom");

      const line = structured(log.lines);
      expect(JSON.stringify(line.meta)).toContain(SECRET);
    } finally {
      log.restore();
    }
  });

  it("وخطأٌ بلا `meta` لا يُسقط النزع", async () => {
    const log = captureLogs();
    try {
      const res = await request(appThrowing(() => new Error("بلا meta"))).get(
        "/boom",
      );
      expect(res.status).toBe(500);
      expect(structured(log.lines).meta).toBeUndefined();
    } finally {
      log.restore();
    }
  });
});

//
// ═══ الفرع الأخير آخرٌ فعلاً ═══
//

describe("والمعروف لا يسقط إلى الفرع الأخير", () => {
  it.each([
    ["BadRequest", () => new BadRequestException("سببٌ مفهوم"), 400],
    ["NotFound", () => new NotFoundException("غير موجود"), 404],
  ])("%s يحتفظ برمزه ورسالته", async (_label, make, status) => {
    const log = captureLogs();
    try {
      const res = await request(appThrowing(make)).get("/boom");

      expect(res.status).toBe(status);
      expect(res.body.message).not.toBe("Internal Server Error");
      // ولا رقم حادثة: تلك للأعطال التي يتحمّلها الخادم.
      expect(res.body.incidentId).toBeUndefined();
      // ولا سطرَ سجلٍّ أصلاً: خطأ العميل ليس حادثة.
      expect(log.lines.filter((l) => l.includes('"level":"error"'))).toEqual([]);
    } finally {
      log.restore();
    }
  });
});
