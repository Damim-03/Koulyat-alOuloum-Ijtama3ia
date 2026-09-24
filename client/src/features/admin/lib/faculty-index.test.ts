/**
 * فهرس الكلّيات.
 *
 * شيئان يستحقّان اختباراً، وكلاهما لا يُرى في الشاشة حتى يقع الضرر:
 *
 *   ١. أن يبحث المستعمل باسم قسمٍ أو تخصّصٍ فلا يجد كلّيته، مع أنّ العدد
 *      معروضٌ أمامه في البطاقة؛
 *   ٢. أن تبدو الكلّية عامرةً بعدّاداتها وهي لا تقبل موضوعاً ولا طالباً،
 *      لأنّ شعبها بلا تخصّصات — وإنشاء الموضوع يطلب تخصّصاً.
 */
import { describe, it, expect } from "vitest";
import { buildFacultyIndex, hasGap } from "./faculty-index";

// كلّية المستعمل كما هي في القاعدة: قسمٌ بلا شعب، وشعبتان بلا تخصّص.
const faculties = [{ id: "f1", name: "كلية العلوم الاجتماعية", code: "FSSH" }];
const departments = [
  { id: "d1", name: "UUUUU", code: "DEP1", facultyId: "f1" },
  { id: "d2", name: "قسم العلوم الاجتماعية", code: "DSOC", facultyId: "f1" },
];
const filieres = [
  { id: "l1", name: "شعبة علم الاجتماع", code: "SOC", departmentId: "d2" },
  { id: "l2", name: "QQQQQQ", code: "QQQ", departmentId: "d2" },
  { id: "l3", name: "شعبة علم النفس", code: "PSY", departmentId: "d2" },
];
const specializations = [
  { id: "s1", name: "علم النفس العيادي", filiereId: "l3" },
  { id: "s2", name: "علم النفس المدرسي", filiereId: "l3" },
];

const index = () =>
  buildFacultyIndex(faculties, departments, filieres, specializations);

describe("فهرس الكلّيات", () => {
  it("يجمع أسماء السلسلة كلّها ورموزها للبحث", () => {
    const h = index().get("f1")!.haystack;

    for (const term of [
      "كلية العلوم الاجتماعية",
      "fssh",
      "قسم العلوم الاجتماعية",
      "شعبة علم النفس",
      "علم النفس العيادي",
      "qqq",
    ]) {
      expect(h).toContain(term.toLowerCase());
    }
  });

  it("ولا يخلط ما تحت كلّيةٍ بما تحت أخرى", () => {
    const two = buildFacultyIndex(
      [...faculties, { id: "f2", name: "كلية الآداب", code: "FLET" }],
      [...departments, { id: "d9", name: "قسم اللغات", facultyId: "f2" }],
      filieres,
      specializations,
    );

    expect(two.get("f2")!.haystack).toContain("قسم اللغات");
    expect(two.get("f2")!.haystack).not.toContain("علم النفس");
    expect(two.get("f1")!.haystack).not.toContain("اللغات");
  });

  it("ويعدّ الأقسام بلا شعب والشعب بلا تخصّص", () => {
    const g = index().get("f1")!.gaps;

    expect(g).toEqual({ noDept: false, deptNoFiliere: 1, filiereNoSpec: 2 });
    expect(hasGap(g)).toBe(true);
  });

  it("وكلّيةٌ بلا أقسام تُعلَم بذلك", () => {
    const g = buildFacultyIndex(faculties, [], [], []).get("f1")!.gaps;

    expect(g.noDept).toBe(true);
    expect(hasGap(g)).toBe(true);
  });

  /** السلسلة التامّة لا وسم عليها — وإلّا لصار التنبيه ضجيجاً. */
  it("وسلسلةٌ تامّة لا فراغ فيها", () => {
    const g = buildFacultyIndex(
      faculties,
      [departments[1]!],
      [filieres[2]!],
      specializations,
    ).get("f1")!.gaps;

    expect(hasGap(g)).toBe(false);
  });
});
