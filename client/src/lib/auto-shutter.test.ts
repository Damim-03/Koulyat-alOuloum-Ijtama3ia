import { describe, expect, it } from "vitest";
import { closeEnough, holdShare, lookAt, READ_HOLD_MS, SENSED_HOLD_MS } from "./auto-shutter";
import type { Quad } from "./viewfinder";

/**
 * متى تُلتقط صورة البطاقة وحدها: حين يقف الإطار على رمز QR وتثبت البطاقة
 * لحظة — قُرئ الرمز أم رُصد فقط — إلّا رمزاً ليس رمز بطاقة طالب.
 */
const at = (x: number, y: number, side = 100): Quad => [
  { x, y },
  { x: x + side, y },
  { x: x + side, y: y + side },
  { x, y: y + side },
];

describe("الالتقاط التلقائي لصورة البطاقة", () => {
  it("يبدأ العدّ حين يقف الإطار على الرمز", () => {
    const hold = lookAt(null, at(200, 200), 1000);
    expect(hold.since).toBe(1000);
    expect(holdShare(hold, "match", 1000)).toBe(0);
  });

  it("رمزٌ مقروء رقمه رقم الحساب: تُلتقط بعد ثانية من الثبات", () => {
    let hold = lookAt(null, at(200, 200), 0);
    hold = lookAt(hold, at(203, 198), 500);
    expect(holdShare(hold, "match", 500)).toBeCloseTo(500 / READ_HOLD_MS);
    hold = lookAt(hold, at(201, 202), READ_HOLD_MS);
    expect(holdShare(hold, "match", READ_HOLD_MS)).toBe(1);
  });

  it("رمزٌ رُصد ولم يُقرأ بعد: تُلتقط أيضاً، بعد ثباتٍ أطول قليلاً", () => {
    const hold = lookAt(null, at(200, 200), 0);
    expect(holdShare(hold, null, READ_HOLD_MS)).toBeLessThan(1);
    expect(holdShare(hold, null, SENSED_HOLD_MS)).toBe(1);
    expect(SENSED_HOLD_MS).toBeGreaterThan(READ_HOLD_MS);
  });

  it("قُرئ الرمز أثناء الثبات: لا يبدأ العدّ من جديد", () => {
    let hold = lookAt(null, at(200, 200), 0); // رُصد
    hold = lookAt(hold, at(202, 201), 1100); // ثمّ قُرئ
    expect(holdShare(hold, "match", 1100)).toBe(1);
  });

  it("بطاقة طالبٍ آخر: تُلتقط أيضاً (وتقول الصورة إنّ الرقم غير رقم الحساب)", () => {
    const hold = lookAt(null, at(200, 200), 0);
    expect(holdShare(hold, "other", READ_HOLD_MS)).toBe(1);
  });

  it("رمزٌ ليس رمز بطاقة طالب: لا تُلتقط وحدها أبداً", () => {
    const hold = lookAt(null, at(200, 200), 0);
    expect(holdShare(hold, "foreign", 60_000)).toBe(0);
  });

  it("تحرّكت البطاقة: يبدأ العدّ من جديد، فلا تُلتقط صورةٌ مهتزّة", () => {
    let hold = lookAt(null, at(200, 200), 0);
    hold = lookAt(hold, at(260, 200), 800); // ٦٠٪ من حجم الرمز
    expect(hold.since).toBe(800);
    expect(holdShare(hold, "match", 800)).toBe(0);
    expect(holdShare(hold, "match", 800 + READ_HOLD_MS)).toBe(1);
  });

  it("اهتزازٌ صغير من اليد لا يعيد العدّ", () => {
    let hold = lookAt(null, at(200, 200), 0);
    for (let t = 90; t <= 900; t += 90) hold = lookAt(hold, at(200 + (t % 180 ? 8 : -8), 200 + (t % 270 ? 6 : -6)), t);
    expect(hold.since).toBe(0);
  });

  it("رمزٌ أبعد صغير الحجم: الحركة تُقاس بحجمه هو", () => {
    let hold = lookAt(null, at(200, 200, 40), 0);
    hold = lookAt(hold, at(220, 200, 40), 100); // ٢٠ بكسل = نصف حجم الرمز
    expect(hold.since).toBe(100);
  });

  it("لا إطار على رمز: لا التقاط", () => {
    expect(holdShare(null, "match", 10_000)).toBe(0);
  });

  it("بطاقة بعيدة: يُطلب تقريبها أوّلاً — رمزها أقلّ من عُشر ضلع الصورة الأقصر", () => {
    expect(closeEnough(at(0, 0, 60), 1280, 720)).toBe(false);
    expect(closeEnough(at(0, 0, 72), 1280, 720)).toBe(true);
    // على الهاتف، والصورة طوليّة: الضلع الأقصر هو العرض.
    expect(closeEnough(at(0, 0, 100), 1080, 1920)).toBe(false);
    expect(closeEnough(at(0, 0, 110), 1080, 1920)).toBe(true);
  });
});
