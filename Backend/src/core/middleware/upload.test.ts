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

import {
  safeUploadPath,
  verifyUploadedImage,
} from "./upload.middleware";

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
