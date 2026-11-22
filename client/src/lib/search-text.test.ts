import { describe, expect, it } from "vitest";
import { foldText, matchRanges, searchWords } from "./search-text";

/** البحث كما يكتبه الناس: بلا تشكيلٍ ولا همزاتٍ ولا حالة أحرف. */
describe("search-text", () => {
  it("يطوي الهمزات والتاء المربوطة والألف المقصورة والتشكيل والتطويل والحالة والنبرات", () => {
    expect(foldText("أحمد إبراهيم آمنة ٱلوصل")).toBe("احمد ابراهيم امنه الوصل");
    expect(foldText("مُذَكِّرَة")).toBe("مذكره");
    expect(foldText("مصطفى")).toBe("مصطفي");
    expect(foldText("الـــمرحلة")).toBe("المرحله");
    expect(foldText("Élodie ALI")).toBe("elodie ali");
  });

  it("الكلمات مطويّةً بلا فراغ", () => {
    expect(searchWords("  أحمد   الاستمارة ")).toEqual(["احمد", "الاستماره"]);
    expect(searchWords("   ")).toEqual([]);
  });

  it("المواضع في النصّ الأصليّ: الهمزة والتشكيل داخلان في المطابقة", () => {
    const text = "مُذَكِّرَة أحمد";
    const [[a, b], [c, d]] = matchRanges(text, searchWords("مذكره احمد")) as [[number, number], [number, number]];
    expect(text.slice(a, b)).toBe("مُذَكِّرَة");
    expect(text.slice(c, d)).toBe("أحمد");
  });

  it("المتداخلة تُدمج؛ والمتكرّرة كلّها؛ وبلا كلماتٍ أو نصٍّ لا شيء", () => {
    expect(matchRanges("abcabc", ["abc", "bca"])).toEqual([[0, 6]]);
    expect(matchRanges("ali Ali", ["ali"])).toEqual([[0, 3], [4, 7]]);
    expect(matchRanges("abc", [])).toEqual([]);
    expect(matchRanges("", ["a"])).toEqual([]);
  });
});
