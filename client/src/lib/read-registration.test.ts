import { describe, expect, it } from "vitest";
import { cardQrVerdict, readRegistration } from "./read-registration";

/**
 * رقم التسجيل فيما وصل إلى حقل المكتب — مكتوباً باليد، أو رابطاً من رمز
 * البطاقة، أو مكتوباً بقارئ QR يظنّ لوحة المفاتيح إنجليزيّة وهي فرنسيّة أو
 * عربيّة.
 */
describe("رقم التسجيل فيما قُرئ", () => {
  it.each([
    ["الرقم وحده", "202039012345"],
    ["بمسافاتٍ وشرطات", " 2020 3901-2345 "],
    ["بأرقامٍ عربية", "٢٠٢٠٣٩٠١٢٣٤٥"],
    ["رابط رمز البطاقة", "https://progres.mesrs.dz/check/202039012345"],
    ["رابطٌ لُصق بسطرٍ زائد", "  https://progres.mesrs.dz/check/202039012345\n"],
    // The digit row of a French keyboard, typed by a scanner that thinks it is QWERTY.
    ["قارئٌ على لوحةٍ فرنسيّة", "httpsM!!progres;mesrs;dz!check!éàéà\"çà&é\"'("],
    // Letters come out Arabic; the digit row still types digits.
    ["قارئٌ على لوحةٍ عربيّة", "اففحسظظحقخلقثسةثسقسيئظؤاثؤنظ202039012345"],
  ])("%s ⇒ الرقم", (_, input) => {
    expect(readRegistration(input)).toBe("202039012345");
  });

  it.each([
    ["فارغ", ""],
    ["لا أرقام فيه", "bonjour"],
    ["أقصر من رقم تسجيل", "12345"],
    ["رابطٌ بلا رقم", "https://progres.mesrs.dz/check/"],
    ["أطول من رقم تسجيل", "1".repeat(21)],
  ])("%s ⇒ لا شيء", (_, input) => {
    expect(readRegistration(input)).toBeNull();
  });
});

describe("ما يقوله رمز البطاقة عن الحساب", () => {
  it.each([
    ["رقم الحساب نفسه", "https://progres.mesrs.dz/check/202039012345", "match"],
    ["رقم طالبٍ آخر", "https://progres.mesrs.dz/check/202039099999", "other"],
    ["رمزٌ لا رقم فيه", "https://example.com/menu", "foreign"],
  ] as const)("%s ⇒ %s", (_, text, verdict) => {
    expect(cardQrVerdict(text, "202039012345")).toBe(verdict);
  });
});
