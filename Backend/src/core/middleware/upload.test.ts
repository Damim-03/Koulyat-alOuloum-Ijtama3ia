/**
 * دالّتان في وسيط الرفع لا يبلغهما المسار، فلا يكشفهما اختبار API:
 *
 *   `verifyUploadedImage` — تُصدِّق البايتات وتمحو ما لا يُصدَّق. المسار
 *   يستدعيها، لكن حالاتِ حافّتها (ملفّ مبتور، امتداد لا قاعدة له، مسار
 *   غير موجود) لا تُبلَغ عبر HTTP.
 *
 *   `safeUploadPath` — حارسٌ لا يستعمله أحدٌ بعد. كُتب لأيّ مسارٍ مستقبليّ
 *   يقرأ ملفّاً بالاسم، وهو أخطر ما يُكتب ثم يُنسى: يوم يُستعمل سيُفترض أنه
 *   يعمل.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import JSZip from "jszip";

import express, { type ErrorRequestHandler } from "express";
import request from "supertest";

import {
  safeUploadPath,
  verifyUploadedImage,
  xlsxExpandsSafely,
  xlsxFileUpload,
} from "./upload.middleware";
import { tr } from "../i18n";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_SIG = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x40, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
]);

let dir = "";

/** يكتب ملفّاً مؤقّتاً ويُرجع مساره. */
const write = (name: string, bytes: Buffer) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-test-"));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("verifyUploadedImage", () => {
  it.each([
    [".png", PNG_SIG],
    [".jpg", JPEG_SIG],
    [".webp", WEBP_SIG],
  ])("بايتات %s الصحيحة ⇒ تُقبل ويبقى الملفّ", (ext, sig) => {
    const p = write(`ok${ext}`, Buffer.concat([sig, Buffer.alloc(32, 1)]));

    expect(verifyUploadedImage(p)).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });

  /**
   * الحالة التي وُضعت الدالّة من أجلها: الامتداد يقول صورة والبايتات تقول
   * صفحة. والمطلوب أمران — أن تُردّ، **وأن يُمحى الملفّ**. فردٌّ بلا محوٍ
   * يترك السكربت على القرص، وهو كل ما يحتاجه المهاجم إن عُرف اسمه.
   */
  it("وHTML بامتداد .png ⇒ تُردّ ويُمحى الملفّ", () => {
    const p = write("shell.png", Buffer.from("<html><script>x</script>"));

    expect(verifyUploadedImage(p)).toBe(false);
    expect(fs.existsSync(p)).toBe(false);
  });

  it("وبايتات نوعٍ مسموحٍ آخر تحت امتادٍ غير امتدادها ⇒ تُردّ وتُمحى", () => {
    const p = write("mismatch.png", Buffer.concat([JPEG_SIG, Buffer.alloc(32)]));

    expect(verifyUploadedImage(p)).toBe(false);
    expect(fs.existsSync(p)).toBe(false);
  });

  it("وامتدادٌ لا قاعدة له ⇒ تُردّ وتُمحى حتى لو كانت البايتات صورة", () => {
    const p = write("real.gif", Buffer.concat([PNG_SIG, Buffer.alloc(32)]));

    expect(verifyUploadedImage(p)).toBe(false);
    expect(fs.existsSync(p)).toBe(false);
  });

  /**
   * ملفٌّ أقصر من التوقيع. `fs.readSync` يملأ ما وجد ويترك الباقي أصفاراً،
   * فلولا فحوص الطول في `MAGIC` لَطابق ملفٌّ من صفرين توقيعاً ناقصاً.
   */
  it("وملفٌّ مبتور ⇒ تُردّ", () => {
    const p = write("short.png", PNG_SIG.subarray(0, 3));

    expect(verifyUploadedImage(p)).toBe(false);
    expect(fs.existsSync(p)).toBe(false);
  });

  it("وملفٌّ فارغ ⇒ تُردّ", () => {
    const p = write("empty.png", Buffer.alloc(0));

    expect(verifyUploadedImage(p)).toBe(false);
    expect(fs.existsSync(p)).toBe(false);
  });

  it("ومسارٌ غير موجود ⇒ تُردّ بلا رمية", () => {
    expect(() =>
      verifyUploadedImage(path.join(dir, "لا-وجود-له.png")),
    ).not.toThrow();
    expect(verifyUploadedImage(path.join(dir, "لا-وجود-له.png"))).toBe(false);
  });

  it("والامتداد يُقارَن بلا حساسيةٍ لحالة الأحرف", () => {
    const p = write("SHOUT.PNG", Buffer.concat([PNG_SIG, Buffer.alloc(32, 7)]));

    expect(verifyUploadedImage(p)).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });
});

describe("safeUploadPath", () => {
  it("اسمٌ عاديّ ⇒ مسارٌ داخل مجلّد الرفع", () => {
    const resolved = safeUploadPath("abc.png");

    expect(resolved).not.toBeNull();
    expect(resolved!.endsWith(`${path.sep}abc.png`)).toBe(true);
    expect(resolved).toContain(path.join("uploads", "cards"));
  });

  /**
   * الشرطة المائلة فاصلٌ في كل نظام، فما بعدها هو الاسم أينما شُغِّل.
   */
  it.each([
    ["../../../etc/passwd", "passwd"],
    ["/etc/shadow", "shadow"],
    ["dir/sub/a.png", "a.png"],
  ])("و«%s» يُجرَّد إلى «%s» داخل المجلّد", (input, expected) => {
    const resolved = safeUploadPath(input);

    expect(resolved).not.toBeNull();
    expect(path.basename(resolved!)).toBe(expected);
    expect(resolved).toContain(path.join("uploads", "cards"));
  });

  /**
   * أمّا الشرطة العكسية فليست فاصلاً إلّا على ويندوز — وهي على لينكس محرفٌ
   * صالحٌ في اسم الملفّ. فـ`path.basename` يُجرّدها هنا ولا يُجرّدها هناك،
   * والنتيجة تختلف باختلاف النظام.
   *
   * وهذا ما أوقع الاختبار: كنتُ أؤكّد «يصير `cmd.exe`» — وهو صحيحٌ على
   * ويندوز وحده، فاحمرّ أوّل ما عمل على لينكس في التشغيل الآلي.
   *
   * والوعد الذي يهمّ لا يتغيّر بينهما: **لا يخرج المسار من مجلّد الرفع**.
   * على ويندوز يُجرَّد الاسم فيبقى داخله، وعلى لينكس يبقى اسماً واحداً
   * غريباً — داخله أيضاً. فهذا ما يُؤكَّد، لا الشكل الذي يتّخذه.
   */
  it("والشرطة العكسية: النتيجة تختلف بالنظام، والاحتواء لا يختلف", () => {
    const resolved = safeUploadPath("..\\..\\windows\\system32\\cmd.exe");

    expect(resolved).not.toBeNull();
    const uploadDir = path.join(process.cwd(), "uploads", "cards");
    expect(path.resolve(resolved!).startsWith(path.resolve(uploadDir))).toBe(
      true,
    );
    expect(resolved).toContain(path.join("uploads", "cards"));
  });

  it("و«..» وحدها ⇒ null، لأنها تخرج من المجلّد بعد التجريد", () => {
    expect(safeUploadPath("..")).toBeNull();
  });
});

/**
 * حدّ الخمسة ميغابايت يقع على الملفّ المضغوط لا على ما فيه: أرشيفٌ صغير
 * يتمدّد إلى غيغابايتات، ويفكّه ExcelJS في الذاكرة كلّه. والحارس يفكّ هو
 * أوّلاً بسقفٍ على الناتج — فلا يصدّق الحجم الذي يُعلنه الملف عن نفسه.
 */
describe("xlsxExpandsSafely", () => {
  const MB = 1024 * 1024;

  /** أرشيفٌ بملفٍّ واحد من أصفارٍ بهذا الحجم — ينضغط إلى لا شيء تقريباً. */
  const zerosZip = (bytes: number) =>
    new JSZip()
      .file("xl/worksheets/sheet1.xml", Buffer.alloc(bytes))
      .generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  it("ملفّ Excel حقيقيّ يمرّ", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("الطلبة");
    for (let i = 0; i < 1000; i++) ws.addRow([`2024${i}`, "اسم", "لقب", "student@example.dz"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    expect(await xlsxExpandsSafely(buf)).toBe(true);
  });

  it("وأرشيفٌ يتمدّد فوق السقف يُردّ", async () => {
    const buf = await zerosZip(4 * MB);
    expect(buf.length).toBeLessThan(64 * 1024); // صغيرٌ مضغوطاً
    expect(await xlsxExpandsSafely(buf, 4 * MB)).toBe(true);
    expect(await xlsxExpandsSafely(buf, 1 * MB)).toBe(false);
  });

  /**
   * الحجم المُعلَن في فهرس الأرشيف رقمٌ يكتبه صانع الملف. أرشيفٌ يُعلن ١٠
   * بايتات ويتمدّد إلى ميغابايتات يُردّ، لأن الفكّ الفعليّ هو الذي يُقاس.
   */
  it("ولا يُخدع بحجمٍ مُعلَنٍ كاذب", async () => {
    const buf = await zerosZip(4 * MB);
    for (let i = 0; i + 4 <= buf.length; i++) {
      const sig = buf.readUInt32LE(i);
      if (sig === 0x02014b50) buf.writeUInt32LE(10, i + 24); // في الفهرس
      if (sig === 0x04034b50) buf.writeUInt32LE(10, i + 22); // وفي الترويسة المحلّية
    }
    expect(await xlsxExpandsSafely(buf, 1 * MB)).toBe(false);
  });

  it("وما ليس أرشيفاً سليماً يُردّ بلا رمية", async () => {
    const buf = await zerosZip(1024);
    expect(await xlsxExpandsSafely(buf.subarray(0, buf.length - 30))).toBe(false);
    expect(await xlsxExpandsSafely(Buffer.from("PK not really a zip"))).toBe(false);
    expect(await xlsxExpandsSafely(Buffer.alloc(0))).toBe(false);
  });
});

describe("verifyUploadedImage — عطلٌ بعد فتح الملف", () => {
  it("القراءة تسقط ⇒ يُغلق الملفّ ويُمحى ويُردّ", () => {
    const p = write("broken-read.png", PNG_SIG);
    const read = jest.spyOn(fs, "readSync").mockImplementationOnce(() => {
      throw new Error("EIO");
    });
    const close = jest.spyOn(fs, "closeSync");
    try {
      expect(verifyUploadedImage(p)).toBe(false);
      expect(close).toHaveBeenCalled();
      expect(fs.existsSync(p)).toBe(false);
    } finally {
      read.mockRestore();
      close.mockRestore();
    }
  });
});

describe("xlsxExpandsSafely — فهرسٌ لا يُصدَّق", () => {
  const sample = () =>
    new JSZip().file("xl/workbook.xml", "<workbook/>").generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const eocdOf = (b: Buffer) => b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

  /** كلّ رقمٍ في الفهرس يكتبه صانع الملف: يُتحقّق منه قبل أن يُبنى عليه. */
  it.each<[string, (b: Buffer, eocd: number, dir: number) => void]>([
    ["ZIP64 — عددٌ لا يُقرأ", (b, e) => b.writeUInt16LE(0xffff, e + 10)],
    ["أكثر من 2000 ملف", (b, e) => b.writeUInt16LE(2001, e + 10)],
    ["فهرسٌ يتجاوز نهاية الأرشيف", (b, e) => b.writeUInt32LE(b.readUInt32LE(e + 12) + 1000, e + 12)],
    ["مدخلٌ في الفهرس بلا توقيعه", (b, _e, d) => b.writeUInt32LE(0, d)],
    ["ترويسةٌ محلّية بلا توقيعها", (b, _e, d) => b.writeUInt32LE(0, b.readUInt32LE(d + 42))],
    ["حجمٌ مضغوط يتجاوز الملف", (b, _e, d) => b.writeUInt32LE(0x7fffffff, d + 20)],
    ["طريقة ضغطٍ لا تُعرف", (b, _e, d) => b.writeUInt16LE(12, d + 10)],
  ])("%s ⇒ يُردّ", async (_l, corrupt) => {
    const b = await sample();
    expect(await xlsxExpandsSafely(b)).toBe(true);
    const e = eocdOf(b);
    corrupt(b, e, b.readUInt32LE(e + 16));
    expect(await xlsxExpandsSafely(b)).toBe(false);
  });

  it("ومخزَّنٌ بلا ضغطٍ يُحسب بحجمه: فوق الميزانية ⇒ يُردّ", async () => {
    const b = await new JSZip().file("a.xml", Buffer.alloc(1024)).generateAsync({ type: "nodebuffer", compression: "STORE" });
    expect(await xlsxExpandsSafely(b, 1024)).toBe(true);
    expect(await xlsxExpandsSafely(b, 100)).toBe(false);
  });
});

describe("xlsxFileUpload — ما لا يصل ملفَّ Excel", () => {
  const app = express();
  app.post("/import", xlsxFileUpload, (req, res) => res.json({ name: req.file?.originalname ?? null }));
  const seen: ErrorRequestHandler = (err, _req, res, _next) => {
    res.status(400).json({ kind: err.constructor.name, code: err.code ?? null, message: err.message });
  };
  app.use(seen);

  it("ملفٌّ ليس xlsx ⇒ يُردّ قبل أن يُقرأ، بسببه", async () => {
    const res = await request(app)
      .post("/import")
      .attach("file", Buffer.from("a,b"), { filename: "t.csv", contentType: "text/csv" });
    expect(res.body).toMatchObject({ kind: "BadRequestException", message: tr("upload.xlsxType") });
  });

  it("وفي خانةٍ غير «file» ⇒ خطأ multer كما هو", async () => {
    const res = await request(app).post("/import").attach("upload", Buffer.from("PK"), "t.xlsx");
    expect(res.body).toMatchObject({ kind: "MulterError", code: "LIMIT_UNEXPECTED_FILE" });
  });

  /** طلبٌ مقطوعٌ في وسطه: خطأ المحلّل نصٌّ تقنيّ — يصل «رفعٌ غير صالح» بدله. */
  it("وطلبٌ مقطوع ⇒ «رفعٌ غير صالح»، لا نصّ المحلّل", async () => {
    const res = await request(app)
      .post("/import")
      .set("Content-Type", "multipart/form-data; boundary=x")
      .send('--x\r\nContent-Disposition: form-data; name="file"; filename="t.xlsx"\r\n');
    expect(res.body).toMatchObject({ kind: "BadRequestException", message: tr("upload.invalid") });
  });
});
