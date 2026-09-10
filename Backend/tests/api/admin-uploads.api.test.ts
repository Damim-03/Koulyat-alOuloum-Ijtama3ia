/**
 * الإدارة — رفع صور البطاقات.
 *
 * فروع هذا الوسيط كانت **صفراً**. والفروع هنا هي الرفض نفسه: النوع والحجم
 * والبايتات والاسم. أي أن كل سطرٍ يقول «ارفض» لم يُنفَّذ قطّ.
 *
 * وتعليق `upload.middleware.ts` يصف ما كان يقع قبل الإصلاح:
 *
 *   `curl -F "file=@shell.html;type=image/png"` يمرّ من فحص النوع، ويُكتب
 *   على القرص باسم `<عشوائي>.html`، ثم يُقدَّم من `/uploads` بترويسة
 *   `text/html` — أي تنفيذُ سكربتٍ مخزَّنٍ على أصل الواجهة البرمجية نفسه.
 *
 * وثلاثة حُرّاس تحلّ محلّ ذلك، وكلٌّ منها يُختبَر هنا على حدة:
 *
 *   **الامتداد من جدولٍ ثابت** — لا حرفَ فيه من اسم العميل.
 *   **البايتات تُصدَّق** — الترويسة دعوى، وأوائل الملفّ هي البيّنة.
 *   **الحجم والعدد محدودان** — قبل أن يصل شيءٌ إلى القرص.
 */
import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "cards");

/**
 * لا يُحذف إلا ما كتبه هذا الملفّ.
 *
 * مجلّد الرفع مشتركٌ مع بيئة التطوير وفيه صور المستخدم الحقيقية — فلا يجوز
 * أن يمسح الاختبار «كل ما في المجلّد». نُسجّل ما أنشأناه بالاسم ونحذفه وحده.
 */
const written = new Set<string>();

const remember = (url: string) => {
  const name = url.split("/").pop();
  if (name) written.add(name);
  return name!;
};

const onDisk = (name: string) => fs.existsSync(path.join(UPLOAD_DIR, name));

//
// ─── بايتات حقيقية ────────────────────────────────────────────
//
// التصديق يقرأ أوّل ١٢ بايتاً فقط، فهذه تكفي لتكون صوراً «صحيحة» بمعنى
// ما يفحصه الخادم — ولا داعي لحمل صورةٍ حقيقية في المستودع.

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x11),
]);

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 0x22),
]);

const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x40, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
  Buffer.alloc(64, 0x33),
]);

/** صفحةٌ تحمل سكربتاً — وهي بالضبط ما كان يمرّ قبل الإصلاح. */
const HTML = Buffer.from(
  '<html><script>alert(document.domain)</script></html>',
  "utf8",
);

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  "utf8",
);

const upload = (
  body: Buffer,
  filename: string,
  contentType: string,
  field = "image",
) =>
  as(request(app).post("/api/admin/uploads/image")).attach(field, body, {
    filename,
    contentType,
  });

beforeAll(async () => {
  await teardown();
  f = await seed(2);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  for (const name of written) {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, name));
    } catch {
      /* حُذف أصلاً — وهو المتوقَّع في اختبارات الرفض */
    }
  }
  // لا يبقى من هذا الملفّ شيءٌ على القرص، كما لا يبقى في القاعدة.
  for (const name of written) expect(onDisk(name)).toBe(false);

  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ ما يُقبل ═══
//

describe("الصور المقبولة", () => {
  it.each([
    ["PNG", PNG, "image/png", ".png"],
    ["JPEG", JPEG, "image/jpeg", ".jpg"],
    ["WEBP", WEBP, "image/webp", ".webp"],
  ])("%s صالح ⇒ يُحفظ ويُعاد رابطه", async (_label, bytes, mime, ext) => {
    const res = await upload(bytes, `card${ext}`, mime).expect(200);

    expect(res.body.url).toContain("/uploads/cards/");
    const name = remember(res.body.url);
    expect(name.endsWith(ext)).toBe(true);
    expect(onDisk(name)).toBe(true);
  });

  /**
   * الاسم المخزَّن لا يحمل حرفاً واحداً ممّا أرسله العميل: لا اسمَه الأصلي،
   * ولا امتداده. فلا «..»، ولا بايت صفري، ولا امتدادٌ مزدوج، ولا شيء
   * يُتسلَّل به خارج المجلّد.
   */
  it("والاسم المخزَّن لا يحمل شيئاً من اسم العميل", async () => {
    const hostile = "..%2F..%2Fetc%2Fpasswd.png.html";
    const res = await upload(PNG, hostile, "image/png").expect(200);

    const name = remember(res.body.url);
    expect(name).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    expect(name).not.toContain("passwd");
    expect(name).not.toContain("..");
    expect(name).not.toContain("html");

    // وموضعه داخل مجلّد الرفع لا خارجه.
    expect(onDisk(name)).toBe(true);
  });

  /**
   * الرابط يُبنى من الإعداد لا من ترويسة `Host`. ولولا ذلك لَصكَّ هذا المسار
   * — بطلبٍ يحمل `Host: attacker.example` — رابطاً يشير إلى خادم المهاجم، ثم
   * حفظته الإدارة في بطاقةٍ تُعرض للجميع.
   */
  it("والرابط يُبنى من الإعداد لا من ترويسة Host", async () => {
    const res = await as(request(app).post("/api/admin/uploads/image"))
      .set("Host", "attacker.example")
      .attach("image", PNG, { filename: "c.png", contentType: "image/png" })
      .expect(200);

    remember(res.body.url);
    expect(res.body.url).not.toContain("attacker.example");
    expect(res.body.url.startsWith(config.PUBLIC_API_URL)).toBe(true);
  });
});

//
// ═══ ما يُردّ ═══
//

describe("الرفوض", () => {
  it("بلا ملفّ ⇒ 400 يقول إنه لم يُرفَع شيء", async () => {
    const res = await as(request(app).post("/api/admin/uploads/image")).expect(
      400,
    );
    expect(res.body.message).toContain("لم يُرفَع");
  });

  it("وحقلٌ باسمٍ آخر ⇒ 400 لا 500", async () => {
    const res = await upload(PNG, "c.png", "image/png", "avatar");
    expect(res.status).toBe(400);
    expect(res.body.message).not.toContain("Internal");
  });

  /**
   * النوع المرفوض يُردّ **برسالةٍ تقول أي الأنواع مقبولة**. وردُّ «خطأ خادم»
   * هنا ليس مسألة ذوق: الإدارة لا تعرف هل الخلل في ملفّها أم في النظام، فتُعيد
   * المحاولة بلا طائل — وهو ما تعالجه القاعدة الخامسة: أن يُفهَم سببُ المنع
   * دائماً.
   *
   * والرسالة تُطابَق **حرفياً**، لا بنمطٍ فضفاض. فحارسان مستقلّان يردّان هذه
   * الملفّات: قائمة الأنواع أوّلاً، وتصديق البايتات بعدها. وتأكيدٌ يقبل رسالة
   * أيٍّ منهما يبقى أخضر حين يُنزع الأوّل — جرّبتُه: أزلتُ قائمة الأنواع فلم
   * يحمرّ شيء، لأن الملفّ كان يُكتب `.bin` ثم يردّه فحص البايتات برسالةٍ
   * مختلفة تُطابق النمط نفسه.
   */
  it.each([
    ["نصّ عادي", Buffer.from("hello"), "note.txt", "text/plain"],
    ["PDF", Buffer.from("%PDF-1.4"), "doc.pdf", "application/pdf"],
    ["SVG", SVG, "logo.svg", "image/svg+xml"],
    ["GIF", Buffer.from("GIF89a"), "a.gif", "image/gif"],
  ])("و%s ⇒ 400 يقول إن النوع غير مدعوم", async (_l, bytes, name, mime) => {
    const res = await upload(bytes, name, mime);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("نوع الملفّ غير مدعوم");
    expect(res.body.message).not.toContain("Internal Server Error");
  });

  /**
   * وهذا هو نصّ الثغرة: الترويسة تدّعي PNG والبايتات صفحةٌ فيها سكربت.
   * الادّعاء وحده كان يكفي للمرور. والمطلوب أمران معاً — أن يُردّ الطلب،
   * **وأن يُمحى الملفّ** الذي كتبه multer قبل الفحص.
   */
  it("وHTML متنكّرٌ في هيئة PNG ⇒ يُردّ ولا يبقى له أثرٌ على القرص", async () => {
    const before = fs.readdirSync(UPLOAD_DIR);

    const res = await upload(HTML, "shell.png", "image/png");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("صورة");

    // لا ملفّ جديد بقي — لا باسمٍ نعرفه ولا بغيره.
    const after = fs.readdirSync(UPLOAD_DIR);
    expect(after.filter((n) => !before.includes(n))).toEqual([]);
  });

  it("وامتدادٌ صحيح ببايتات نوعٍ آخر ⇒ يُردّ كذلك", async () => {
    const before = fs.readdirSync(UPLOAD_DIR);

    // بايتات JPEG تحت ادّعاء PNG: كلاهما مسموح، والتطابق هو المطلوب.
    const res = await upload(JPEG, "x.png", "image/png");
    expect(res.status).toBe(400);

    const after = fs.readdirSync(UPLOAD_DIR);
    expect(after.filter((n) => !before.includes(n))).toEqual([]);
  });

  /**
   * الحدّ يقطع الكتابة في منتصفها، فالسؤال ليس «هل يُردّ الطلب» وحده بل «ماذا
   * يبقى على القرص». ولو بقي النصف المكتوب لكفى تكرارُ الطلب لملء القرص —
   * منعُ خدمةٍ من بابٍ يبدو محروساً.
   */
  it("وملفٌّ أكبر من الحدّ ⇒ 400، ولا يبقى نصفه على القرص", async () => {
    const before = fs.readdirSync(UPLOAD_DIR);

    const huge = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024, 0x44)]);
    const res = await upload(huge, "big.png", "image/png");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large|كبير/i);

    const after = fs.readdirSync(UPLOAD_DIR);
    expect(after.filter((n) => !before.includes(n))).toEqual([]);
  });

  /**
   * بايتٌ صفريّ داخل اسم الملفّ — الحيلة الكلاسيكية لقطع الاسم عند الكتابة
   * فيتغيّر امتداده. محلّل `multipart` يرفض الترويسة ويرمي خطأً عادياً نصّه
   * «Malformed part header»، وكان يسقط إلى الفرع الأخير في معالج الأخطاء
   * فيُجاب عنه بـ٥٠٠: الخادم يتّهم نفسه بينما العطب في الطلب.
   *
   * (وجدتُه بالخطأ: بايتٌ صفريّ تسلّل إلى نصّ اختبارٍ آخر. والصدفة لا تُنقص
   * من كونه مدخلاً معادياً حقيقياً يستحقّ جواباً صحيحاً.)
   */
  it("واسمٌ فيه بايتٌ صفريّ ⇒ 400 لا 500", async () => {
    const res = await upload(PNG, "passwd\u0000.png", "image/png");

    expect(res.status).toBe(400);
    expect(res.body.message).not.toContain("Internal Server Error");
    // ولا رقم حادثة: تلك للأعطال التي يتحمّلها الخادم، لا لطلبٍ معطوب.
    expect(res.body.incidentId).toBeUndefined();
  });

  it("وجسمٌ متعدّد الأجزاء معطوب ⇒ 400 كذلك", async () => {
    const res = await as(request(app).post("/api/admin/uploads/image"))
      .set("Content-Type", "multipart/form-data; boundary=BOUND")
      .send("--BOUND\r\nnot-a-header\r\n\r\nx\r\n--BOUND--\r\n");

    expect(res.status).toBe(400);
    expect(res.body.message).not.toContain("Internal Server Error");
  });

  it("وملفّان في طلبٍ واحد ⇒ يُردّ", async () => {
    const res = await as(request(app).post("/api/admin/uploads/image"))
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" })
      .attach("image", PNG, { filename: "b.png", contentType: "image/png" });

    expect(res.status).toBe(400);
  });
});

//
// ═══ الصلاحية ═══
//

describe("من يملك الرفع", () => {
  it("طالبٌ لا يرفع صور بطاقات", async () => {
    const [s] = f.nextStudents(1);
    const token = (
      await request(app)
        .post("/api/auth/student/login")
        .send({ registrationNumber: s!.reg, password: TEST_PASSWORD })
        .expect(200)
    ).body.accessToken;

    await request(app)
      .post("/api/admin/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", PNG, { filename: "c.png", contentType: "image/png" })
      .expect(403);
  });
});
