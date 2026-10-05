/**
 * ما يبلغه كلّ مستوى من الهيكل.
 *
 * الطلبة والمواضيع على التخصّصات وحدها، فكلّ رقمٍ فوقها مجموعٌ صاعد. وخطأٌ في
 * سلسلة الصعود — شعبةٌ بلا ميدان، أو تخصّصٌ بلا شعبة — يجب ألّا يُسقط شيئاً
 * ولا يعدّه في غير موضعه.
 */
import { describe, it, expect } from "vitest";
import { buildReach, matchesQuery } from "./structure-stats";

const depts = [
  { id: "d1", facultyId: "f1", _count: { professors: 4 } },
  { id: "d2", facultyId: "f1", _count: { professors: 1 } },
  { id: "d3", facultyId: "f2", _count: { professors: 2 } },
];
const filieres = [
  { id: "fl1", departmentId: "d1", domainId: "dm1" },
  { id: "fl2", departmentId: "d2", domainId: null },
  { id: "fl3", departmentId: "d3", domainId: "dm3" },
];
const specs = [
  { id: "s1", level: "master", filiereId: "fl1", _count: { students: 15, topics: 2 } },
  { id: "s2", level: "licence", filiereId: "fl1", _count: { students: 6, topics: 0 } },
  { id: "s3", level: "licence", filiere: { id: "fl2" }, _count: { students: 3, topics: 1 } },
  { id: "s4", level: "doctorate", filiereId: "fl3", _count: { students: 1, topics: 1 } },
  { id: "s5", level: "master", filiereId: null, _count: { students: 9, topics: 9 } },
];

describe("buildReach", () => {
  const r = buildReach(depts, filieres, specs);

  it("يصعد بالطلبة والمواضيع من التخصّص إلى الشعبة فالميدان فالقسم فالكلّية", () => {
    expect(r.filiere("fl1")).toMatchObject({ specializations: 2, students: 21, topics: 2, levels: { master: 1, licence: 1 } });
    expect(r.domain("dm1")).toMatchObject({ specializations: 2, students: 21 });
    expect(r.department("d1")).toMatchObject({ students: 21, topics: 2 });
    expect(r.faculty("f1")).toMatchObject({ specializations: 3, students: 24, topics: 3, professors: 5 });
    expect(r.faculty("f2")).toMatchObject({ specializations: 1, students: 1, professors: 2 });
  });

  it("الشعبة بلا ميدان تُحسب لقسمها وكلّيتها، ولا لميدانٍ ما", () => {
    expect(r.department("d2")).toMatchObject({ specializations: 1, students: 3 });
    expect(r.domain("dm-none")).toMatchObject({ specializations: 0, students: 0 });
  });

  it("التخصّص بلا شعبة يدخل المجموع العامّ وحده", () => {
    expect(r.total).toMatchObject({ specializations: 5, students: 34, topics: 13, professors: 7 });
  });

  it("معرّفٌ مجهول ⇒ أصفار لا خطأ", () => {
    expect(r.faculty("nope")).toEqual({ specializations: 0, students: 0, topics: 0, levels: {}, professors: 0 });
  });
});

describe("matchesQuery", () => {
  it("يطابق الاسم أو الرمز، متسامحاً مع الهمزات والتاء المربوطة", () => {
    expect(matchesQuery("كليه العلوم", "كلّية العلوم الاجتماعية", "FSSH")).toBe(true);
    expect(matchesQuery("fssh", "كلية", "FSSH")).toBe(true);
    expect(matchesQuery("", "أيّ شيء")).toBe(true);
    expect(matchesQuery("طب", "علم النفس", null)).toBe(false);
  });
});
