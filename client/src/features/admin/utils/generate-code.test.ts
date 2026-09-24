/**
 * مولِّد الرموز.
 *
 * الوعد المقطوع هنا: **رمزٌ لا يتكرّر**. وكان الذيل أربعةَ أرقامٍ عشوائية
 * — عشرةُ آلافِ احتمالٍ لكل بادئة، تصطدم أوّلَ مرّةٍ بعد نحو مئةٍ وعشرين
 * رمزاً بحكم مفارقة أعياد الميلاد. فصار ختمَ الوقت بالميلّي ثانية.
 *
 * وموضع الانكسار الحقيقيّ ليس الشكل بل **التتابع**: `Date.now()` يعيد
 * الرقم نفسه لنداءين في الميلّي ثانية الواحدة، وذلك يقع فعلاً حين يولّد
 * المعالج صفوفاً متتابعة. فهذا ما يُسأل عنه هنا قبل كل شيء.
 */
import { describe, it, expect } from "vitest";
import { generateCode, isStampedCode, stampCode } from "./generate-code";

describe("مولِّد الرموز", () => {
  it("حروفٌ ثمّ ثلاثةَ عشرَ رقماً", () => {
    expect(stampCode("FAC")).toMatch(/^FAC-\d{13}$/);
    expect(stampCode("d")).toMatch(/^D-\d{13}$/);
  });

  /** ألفُ نداءٍ متتابعٍ داخل الميلّي ثانية الواحدة — ولا تكرار. */
  it("ولا يتكرّر ولو صُرف ألفُ رمزٍ في لحظة", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(stampCode("D"));

    expect(codes.size).toBe(1000);
  });

  it("ويطّرد صعوداً، فترتيب الإصدار مقروءٌ من الرمز", () => {
    const a = Number(stampCode("F").split("-")[1]);
    const b = Number(stampCode("F").split("-")[1]);

    expect(b).toBeGreaterThan(a);
  });

  it("ويتجنّب ما هو مأخوذ", () => {
    const first = stampCode("F");
    // صفٌّ يحمل الرمز التالي مباشرةً: على المولِّد أن يتخطّاه.
    const next = `F-${Number(first.split("-")[1]) + 1}`;
    const code = generateCode("F", [{ id: "x", code: next }]);

    expect(code).not.toBe(next);
    expect(code).toMatch(/^F-\d{13}$/);
  });

  /**
   * فاحصُ الشكل هو ما يقرّر أيُّ رمزٍ يُستبدل عند التعديل. فلو قبِل القديم
   * لبقي `FSSH` أبداً، ولو ردّ الجديد لتغيّر الرمز في كل فتحة.
   */
  it("ويعرف الشكل الجديد من القديم", () => {
    expect(isStampedCode(stampCode("F"))).toBe(true);
    expect(isStampedCode("FAC-1789412345678")).toBe(true);

    for (const old of [
      "FSSH",
      "DSOC",
      "FAC-1234",
      "F-178941234567",
      "F-17894123456789",
      "f-1789412345678",
      "",
      null,
      undefined,
    ]) {
      expect(isStampedCode(old)).toBe(false);
    }
  });

  /** والصفّ المُعدَّل لا يصطدم برمزه هو. */
  it("ولا يعدّ رمز الصفّ المُعدَّل مأخوذاً", () => {
    const mine = stampCode("F");
    const code = generateCode("F", [{ id: "me", code: mine }], "me");

    expect(code).toMatch(/^F-\d{13}$/);
  });
});
