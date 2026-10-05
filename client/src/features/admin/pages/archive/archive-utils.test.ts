/**
 * أدوات صفحة الأرشيف.
 *
 * السنة التالية تُقترح من عنوان الحالية — فإن أخطأ الاقتراح أُنشئت سنةٌ بعنوانٍ
 * خاطئ بنقرةٍ واحدة. والبحث يجب أن يجد «أمينة» وإن كُتبت «امينه»، كما يكتبها
 * الناس فعلاً.
 */
import { describe, it, expect } from "vitest";
import { matches, nextYearTitle, pct } from "./archive-utils";

describe("nextYearTitle", () => {
  it("2025/2026 ⇒ 2026/2027", () => {
    expect(nextYearTitle("2025/2026")).toBe("2026/2027");
    expect(nextYearTitle(" 2029/2030 ")).toBe("2030/2031");
  });

  it("عنوانٌ بغير الصيغة ⇒ لا تخمين", () => {
    expect(nextYearTitle("السنة الأولى")).toBe("");
    expect(nextYearTitle("2025-2026")).toBe("");
    expect(nextYearTitle("__TEST__ 2099/2100")).toBe("");
  });
});

describe("matches", () => {
  it("استعلامٌ فارغ يطابق كلّ شيء", () => {
    expect(matches("", "أي شيء")).toBe(true);
  });

  it("لا يفرّق بين الهمزات والتاء المربوطة والألف المقصورة والتشكيل", () => {
    expect(matches("امينه", "أمينة زروقي")).toBe(true);
    expect(matches("مصطفي", "مصطفى")).toBe(true);
    expect(matches("محمد", "مُحَمَّد")).toBe(true);
  });

  it("ولا بين الأحرف الكبيرة والصغيرة، ويبحث في كلّ الحقول", () => {
    expect(matches("ZEROUKI", null, "Amina Zerouki")).toBe(true);
    expect(matches("2020390", "سارة", "202039012345")).toBe(true);
    expect(matches("غائب", "سارة", undefined, "202039012345")).toBe(false);
  });
});

describe("pct", () => {
  it("لا قسمة على صفر", () => {
    expect(pct(3, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
    expect(pct(4, 21)).toBe(19);
  });
});
