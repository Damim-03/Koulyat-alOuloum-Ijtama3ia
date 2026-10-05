/**
 * الاسم باللاتينية على عادة الوثائق الفرنسية — القاعدة نفسها في الخادم.
 */
import { describe, it, expect } from "vitest";
import { LATIN_NAME, toLatinFirst, toLatinLast } from "./latin-name";

describe("توحيد الاسم باللاتينية", () => {
  it.each([
    ["youcef", "Youcef"],
    ["  nour   el houda ", "Nour El Houda"],
    ["MOHAMED-AMINE", "Mohamed-Amine"],
    ["abd el-kader", "Abd El-Kader"],
    ["o'neil", "O'Neil"],
    ["élise", "Élise"],
  ])("الاسم: «%s» ⇐ «%s»", (input, out) => {
    expect(toLatinFirst(input)).toBe(out);
  });

  it.each([
    ["hamadi", "HAMADI"],
    ["ben  ali", "BEN ALI"],
    ["bel-kacem", "BEL-KACEM"],
  ])("اللقب: «%s» ⇐ «%s»", (input, out) => {
    expect(toLatinLast(input)).toBe(out);
  });

  it.each(["Youcef", "Nour El Houda", "Bel-Kacem", "O'Neil", "Élise"])(
    "«%s» مقبول",
    (name) => expect(LATIN_NAME.test(name)).toBe(true),
  );

  it.each(["يوسف", "Hamadi2", "Youcef!", "-Ali", "Ali-", "Ali  Ben"])(
    "«%s» مرفوض",
    (name) => expect(LATIN_NAME.test(name)).toBe(false),
  );
});
