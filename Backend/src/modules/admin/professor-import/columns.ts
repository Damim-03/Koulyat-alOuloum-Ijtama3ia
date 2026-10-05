import type { ImportColumn, ImportSpec } from "../import-kit/columns";

/**
 * أعمدة ملفّ استيراد الأساتذة — مصدرٌ واحد يقرؤه النموذج والمحلِّل معاً.
 *
 * بترتيب نافذة «إضافة أستاذ»: البيانات الشخصية، ثم المهنية — البريد الجامعي
 * (به يدخل الأستاذ)، والرقم الوظيفي (يُولَّد إن تُرك)، ثم الكلية ← القسم،
 * ثم الرتبة والصفة.
 */

export type ProfessorKey =
  | "firstName"
  | "lastName"
  | "firstNameLatin"
  | "lastNameLatin"
  | "gender"
  | "verified"
  | "email"
  | "phone"
  | "password"
  | "universityEmail"
  | "employeeNumber"
  | "faculty"
  | "department"
  | "grade"
  | "tags";

export const PROFESSOR_COLUMNS: ImportColumn<ProfessorKey>[] = [
  { key: "firstName", header: "الاسم", kind: "req", width: 14, group: "personal", note: "الاسم الأوّل." },
  { key: "lastName", header: "اللقب", kind: "req", width: 13, group: "personal", note: "اللقب." },
  { key: "firstNameLatin", header: "الاسم باللاتينية", kind: "opt", width: 17, group: "personal", note: "اختياري. حروف لاتينية فقط، مثل Youcef." },
  { key: "lastNameLatin", header: "اللقب باللاتينية", kind: "opt", width: 17, group: "personal", note: "اختياري. حروف لاتينية فقط، مثل HAMADI." },
  { key: "gender", header: "الجنس", kind: "opt", width: 9, group: "personal", note: "ذكر أو أنثى — من القائمة." },
  { key: "verified", header: "حالة التوثيق", kind: "opt", width: 13, group: "personal", note: "موثّق أو غير موثّق — الفارغ يُعدّ غير موثّق." },
  { key: "email", header: "البريد الشخصي", kind: "opt", width: 27, group: "personal", note: "اختياري، ولا يتكرّر." },
  { key: "phone", header: "رقم الهاتف", kind: "opt", width: 13, group: "personal", note: "اختياري، أرقام فقط (9 إلى 13)." },
  { key: "password", header: "كلمة المرور", kind: "opt", width: 14, group: "personal", note: "اختيارية، 8 إلى 72 حرفاً. الفارغة يولّدها النظام." },
  { key: "universityEmail", header: "البريد الجامعي", kind: "req", width: 30, group: "professional", note: "به يدخل الأستاذ إلى المنصّة — بنطاقٍ جامعيٍّ مسجَّل، ولا يتكرّر." },
  { key: "employeeNumber", header: "الرقم الوظيفي", kind: "opt", width: 17, group: "professional", note: "13 رقماً — أو اتركه يُولَّد تلقائياً." },
  { key: "faculty", header: "الكلية", kind: "auto", width: 32, group: "professional", note: "من القائمة لتضييق الأقسام — أو اتركها تُملأ من القسم." },
  { key: "department", header: "القسم", kind: "req", width: 28, group: "professional", note: "من القائمة — تضيق بالكلية المختارة. ومنه تُملأ الكلية إن تُركت." },
  { key: "grade", header: "الرتبة", kind: "opt", width: 22, group: "professional", note: "من القائمة (الرتب الرسمية) أو غيرها؛ وأكثر من رتبةٍ تُفصل بفاصلة." },
  { key: "tags", header: "الصفة", kind: "opt", width: 28, group: "professional", note: "اختيارية، مثل: رئيس قسم، مسؤول ماستر — تُفصل بفاصلة." },
];

/** ما تكتبه صيغة «الكلية» حين لا تجد القسم في قوائم النموذج. */
export const AUTO_UNKNOWN = "قسمٌ غير معروف";

export const PROFESSOR_SPEC: ImportSpec<ProfessorKey> = {
  sheetName: "الأساتذة",
  columns: PROFESSOR_COLUMNS,
  anchor: "universityEmail",
  autoUnknown: AUTO_UNKNOWN,
  nounOne: "أستاذ",
  nounCount: "أستاذاً",
};

/** السلّم الرسميّ للرتب — كما تقترحه نافذة الإضافة (constants/academic-ranks). */
export const ACADEMIC_RANKS = [
  "أستاذ التعليم العالي",
  "أستاذ محاضر أ",
  "أستاذ محاضر ب",
  "أستاذ مساعد أ",
  "أستاذ مساعد ب",
];

export interface DepartmentForLabel {
  id: string;
  name: string;
  facultyId: string;
  faculty: { id: string; name: string };
}

/**
 * اسم القسم كما يظهر في القائمة المنسدلة — ويدلّ على قسمٍ واحد: الاسم وحده
 * ما لم يتكرّر، فإن تكرّر بين كليتين أُضيفت الكلية.
 */
export function departmentLabels<D extends DepartmentForLabel>(deps: D[]): Map<string, D> {
  const count = new Map<string, number>();
  for (const d of deps) count.set(d.name, (count.get(d.name) ?? 0) + 1);
  return new Map(deps.map((d) => [(count.get(d.name) ?? 0) > 1 ? `${d.name} (${d.faculty.name})` : d.name, d]));
}
