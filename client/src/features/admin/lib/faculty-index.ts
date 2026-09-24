/**
 * فهرسُ الكلّيات: ما تحت كلّ كلّية بأسمائه، وأين تنقطع سلسلتها.
 *
 * القاعدة هنا لا في الشاشة، فتُختبر بلا متصفّح — كما في `topic-actions`
 * و`user-form-steps`.
 *
 * وشيئان يحلّهما هذا الفهرس:
 *
 * ١. **البحث.** كان يطابق اسم الكلّية ورمزها وحدهما، فاسمُ قسمٍ أو شعبةٍ
 *    أو تخصّصٍ لا يجد شيئاً — والبطاقة تعرض عدده أمام عينيك.
 *
 * ٢. **الفراغات.** الأعداد تقول كم، ولا تقول أين انقطعت السلسلة. وإنشاء
 *    موضوعٍ يطلب `specializationId`، وتسجيلُ طالبٍ كذلك؛ فكلّيةٌ بقسمين
 *    وصفرِ تخصّصات لا تقبل موضوعاً ولا طالباً وعدّادُها يبدو عامراً.
 */

export interface FacultyGaps {
  /** لا قسم فيها أصلاً. */
  noDept: boolean;
  /** أقسامٌ لا شعبة تحتها. */
  deptNoFiliere: number;
  /** شعبٌ لا تخصّص تحتها. */
  filiereNoSpec: number;
}

export interface FacultyIndexEntry {
  /** أسماءُ السلسلة كلّها ورموزُها، صغيرةَ الحروف، للبحث. */
  haystack: string;
  gaps: FacultyGaps;
}

/** أقلُّ ما يلزم من كلّ صفّ — فلا يرتبط الفهرس بشكل الحمولة كاملاً. */
interface FacultyLite {
  id: string;
  name: string;
  code?: string | null;
}
interface DepartmentLite {
  id: string;
  name: string;
  code?: string | null;
  facultyId: string;
}
interface FiliereLite {
  id: string;
  name: string;
  code?: string | null;
  departmentId: string;
}
interface SpecializationLite {
  id: string;
  name: string;
  filiereId?: string | null;
}

export const hasGap = (g: FacultyGaps) =>
  g.noDept || g.deptNoFiliere > 0 || g.filiereNoSpec > 0;

export function buildFacultyIndex(
  faculties: FacultyLite[],
  departments: DepartmentLite[],
  filieres: FiliereLite[],
  specializations: SpecializationLite[],
): Map<string, FacultyIndexEntry> {
  const filsByDept = new Map<string, FiliereLite[]>();
  for (const f of filieres) {
    const arr = filsByDept.get(f.departmentId) ?? [];
    arr.push(f);
    filsByDept.set(f.departmentId, arr);
  }

  const specsByFil = new Map<string, SpecializationLite[]>();
  for (const sp of specializations) {
    if (!sp.filiereId) continue;
    const arr = specsByFil.get(sp.filiereId) ?? [];
    arr.push(sp);
    specsByFil.set(sp.filiereId, arr);
  }

  const depsByFac = new Map<string, DepartmentLite[]>();
  for (const d of departments) {
    const arr = depsByFac.get(d.facultyId) ?? [];
    arr.push(d);
    depsByFac.set(d.facultyId, arr);
  }

  const out = new Map<string, FacultyIndexEntry>();
  for (const f of faculties) {
    const words: (string | null | undefined)[] = [f.name, f.code];
    const myDeps = depsByFac.get(f.id) ?? [];
    let deptNoFiliere = 0;
    let filiereNoSpec = 0;

    for (const d of myDeps) {
      words.push(d.name, d.code);
      const myFils = filsByDept.get(d.id) ?? [];
      if (myFils.length === 0) deptNoFiliere++;
      for (const fl of myFils) {
        words.push(fl.name, fl.code);
        const mySpecs = specsByFil.get(fl.id) ?? [];
        if (mySpecs.length === 0) filiereNoSpec++;
        for (const sp of mySpecs) words.push(sp.name);
      }
    }

    out.set(f.id, {
      haystack: words.filter(Boolean).join(" ").toLowerCase(),
      gaps: { noDept: myDeps.length === 0, deptNoFiliere, filiereNoSpec },
    });
  }
  return out;
}
