/**
 * شرط الانتماء الأكاديميّ للطالب — يقرؤه الجدول والتصدير معاً.
 *
 * الهرم يُطبَّق بأدقّ ما اختير: الشعبة قبل القسم، والقسم قبل الكلية. والمستوى
 * يُضاف إليه لا يحلّ محلّه.
 */
import { studentAcademicWhere } from "./student-filters";

describe("studentAcademicWhere", () => {
  it("القسم وحده ⇒ تخصّصات شعب القسم؛ والكلية وحدها ⇒ تخصّصات أقسامها", () => {
    expect(studentAcademicWhere({ departmentId: "dep" })).toEqual({ specialization: { filiere: { departmentId: "dep" } } });
    expect(studentAcademicWhere({ facultyId: "fac", level: "master" })).toEqual({
      specialization: { filiere: { department: { facultyId: "fac" } }, level: "master" },
    });
  });

  it("والأدقّ يغلب: شعبةٌ مع قسمها ⇒ الشعبة وحدها", () => {
    expect(studentAcademicWhere({ filiereId: "fil", departmentId: "dep", facultyId: "fac" })).toEqual({
      specialization: { filiereId: "fil" },
    });
  });
});
