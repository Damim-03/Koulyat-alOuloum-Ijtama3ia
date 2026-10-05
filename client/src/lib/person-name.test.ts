import { describe, it, expect } from "vitest";
import { familyName, givenName, initials, otherScriptName, personName, pickName } from "./person-name";

const khaled = { firstName: "خالد", lastName: "مرابط", firstNameLatin: "Khaled", lastNameLatin: "MERABET" };
const arabicOnly = { firstName: "أمينة", lastName: "زروقي", firstNameLatin: null, lastNameLatin: null };

describe("personName", () => {
  it("العربية تعرض الاسم العربي", () => {
    expect(personName(khaled, "ar")).toBe("خالد مرابط");
  });

  it("الفرنسية والإنجليزية تعرضان اللاتيني", () => {
    expect(personName(khaled, "fr")).toBe("Khaled MERABET");
    expect(personName(khaled, "en")).toBe("Khaled MERABET");
  });

  it("وتعودان إلى العربي إن خلا الحساب من اللاتيني", () => {
    expect(personName(arabicOnly, "fr")).toBe("أمينة زروقي");
  });

  it("والعربية تعرض اللاتيني إن لم يكن غيره", () => {
    expect(personName({ firstNameLatin: "Sara", lastNameLatin: "BOUALAM" }, "ar")).toBe("Sara BOUALAM");
  });

  it("واللاتيني الناقص لا يُقدَّم على العربي الكامل", () => {
    const partial = { firstName: "خالد", lastName: "مرابط", lastNameLatin: "MERABET" };
    expect(personName(partial, "fr")).toBe("خالد مرابط");
    expect(otherScriptName(partial, "fr")).toBe("MERABET");
  });

  it("ولا شيء لمن لا اسم له", () => {
    expect(personName(null, "ar")).toBe("");
    expect(personName({ firstName: "  ", lastName: null }, "fr")).toBe("");
  });
});

describe("otherScriptName", () => {
  it("الخطّ الآخر تحت الاسم الرئيسي", () => {
    expect(otherScriptName(khaled, "ar")).toBe("Khaled MERABET");
    expect(otherScriptName(khaled, "en")).toBe("خالد مرابط");
  });

  it("لا يتكرّر الاسم حين لا يوجد إلا خطٌّ واحد", () => {
    expect(otherScriptName(arabicOnly, "fr")).toBe("");
    expect(otherScriptName(arabicOnly, "ar")).toBe("");
  });
});

describe("givenName / pickName", () => {
  it("الاسم الأوّل للتحيّة", () => {
    expect(givenName(khaled, "ar")).toBe("خالد");
    expect(givenName(khaled, "fr")).toBe("Khaled");
    expect(givenName(arabicOnly, "en")).toBe("أمينة");
  });

  it("الاسم واللقب والحرفان الأوّلان بخطّ الاسم نفسه", () => {
    expect([givenName(khaled, "fr"), familyName(khaled, "fr"), initials(khaled, "fr")]).toEqual(["Khaled", "MERABET", "KM"]);
    expect([givenName(khaled, "ar"), familyName(khaled, "ar"), initials(khaled, "ar")]).toEqual(["خالد", "مرابط", "خم"]);
  });

  it("الأسماء المحفوظة نصّاً (الأرشيف القديم بلا لاتيني)", () => {
    expect(pickName("خالد مرابط", "Khaled MERABET", "fr")).toBe("Khaled MERABET");
    expect(pickName("خالد مرابط", undefined, "fr")).toBe("خالد مرابط");
  });
});
