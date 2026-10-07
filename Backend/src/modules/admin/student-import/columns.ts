import type { ImportColumn, ImportSpec } from "../import-kit/columns";

/**
 * أعمدة ملفّ استيراد الطلبة — مصدرٌ واحد يقرؤه النموذج والمحلِّل معاً.
 */

export type ColumnKey =
  | "registrationNumber"
  | "firstName"
  | "lastName"
  | "firstNameLatin"
  | "lastNameLatin"
  | "gender"
  | "verified"
  | "email"
  | "phone"
  | "password"
  | "academicYear"
  | "faculty"
  | "department"
  | "filiere"
  | "level"
  | "specialization";

/**
 * بترتيب نافذة «إضافة طالب»: البيانات الشخصية ثم الجامعية، والجامعية بترتيب
 * الهرم — الكلية ← القسم ← الشعبة ← المستوى ← التخصص.
 *
 * والاسم واللقب باللاتينية إلزاميان ويسبقان العربيّين، وهما اختياريان: كلّ
 * طالبٍ له اسمٌ لاتينيّ في وثائقه، وليس لكلّ ملفٍّ إداريّ اسمٌ عربيّ.
 */
export const IMPORT_COLUMNS: ImportColumn<ColumnKey>[] = [
  { key: "registrationNumber", header: "رقم التسجيل", kind: "req", width: 16, group: "personal", note: "أرقام فقط (6 إلى 20)، ولا يتكرّر." },
  { key: "firstNameLatin", header: "الاسم باللاتينية", kind: "req", width: 17, group: "personal", note: "حروف لاتينية فقط، مثل Youcef." },
  { key: "lastNameLatin", header: "اللقب باللاتينية", kind: "req", width: 17, group: "personal", note: "حروف لاتينية فقط، مثل HAMADI." },
  { key: "firstName", header: "الاسم", kind: "opt", width: 14, group: "personal", note: "اختياري. الاسم الأوّل بالعربية." },
  { key: "lastName", header: "اللقب", kind: "opt", width: 13, group: "personal", note: "اختياري. اللقب بالعربية." },
  { key: "gender", header: "الجنس", kind: "opt", width: 9, group: "personal", note: "ذكر أو أنثى — من القائمة." },
  { key: "verified", header: "حالة التوثيق", kind: "opt", width: 13, group: "personal", note: "موثّق أو غير موثّق — الفارغ يُعدّ غير موثّق." },
  { key: "email", header: "البريد الشخصي", kind: "opt", width: 27, group: "personal", note: "اختياري، ولا يتكرّر." },
  { key: "phone", header: "رقم الهاتف", kind: "opt", width: 13, group: "personal", note: "اختياري، أرقام فقط (9 إلى 13)." },
  { key: "password", header: "كلمة المرور", kind: "opt", width: 14, group: "personal", note: "اختيارية، 8 إلى 72 حرفاً. الفارغة يولّدها النظام." },
  { key: "academicYear", header: "السنة الجامعية", kind: "req", width: 14, group: "academic", note: "من القائمة." },
  { key: "faculty", header: "الكلية", kind: "auto", width: 32, group: "academic", note: "من القائمة لتضييق الأقسام والتخصصات — أو اتركها تُملأ من التخصص." },
  { key: "department", header: "القسم", kind: "auto", width: 24, group: "academic", note: "من القائمة (أقسام الكلية المختارة) — أو اتركه يُملأ من التخصص." },
  { key: "filiere", header: "الشعبة", kind: "auto", width: 20, group: "academic", note: "من القائمة (شعب القسم المختار) — أو اتركها تُملأ من التخصص." },
  { key: "level", header: "المستوى", kind: "auto", width: 12, group: "academic", note: "من القائمة لتضييق التخصصات — أو اتركه يُملأ من التخصص." },
  { key: "specialization", header: "التخصص", kind: "req", width: 27, group: "academic", note: "من القائمة — تضيق بما اختير قبله. وما تُرك فارغاً من الكلية والقسم والشعبة والمستوى يُملأ منه." },
];

/**
 * ما تكتبه صيغ الأعمدة التلقائية في النموذج حين لا تجد التخصص في قوائمه.
 * المحلِّل يعرفها فلا يعدّها قيمةً كتبها المسؤول.
 */
export const AUTO_UNKNOWN = "تخصصٌ غير معروف";

export const STUDENT_SPEC: ImportSpec<ColumnKey> = {
  sheetName: "الطلبة",
  columns: IMPORT_COLUMNS,
  anchor: "registrationNumber",
  autoUnknown: AUTO_UNKNOWN,
  nounOne: "طالب",
  nounCount: "طالباً",
};

export const LEVEL_LABEL: Record<string, string> = {
  licence: "ليسانس",
  master: "ماستر",
  doctorate: "دكتوراه",
};

export interface SpecForLabel {
  id: string;
  name: string;
  level: string;
  filiere: {
    name: string;
    department: { name: string; faculty: { name: string } };
  };
}

/**
 * اسم التخصص كما يظهر في القائمة المنسدلة — ويجب أن يدلّ على تخصّصٍ واحد.
 *
 * الاسم وحده ما لم يتكرّر؛ فإن تكرّر بين مستويين أُضيف المستوى، وإن تكرّر في
 * المستوى نفسه بين شعبتين أُضيفت الشعبة. والمستوى له عموده، فلا يُكرَّر في
 * الاسم بلا حاجة.
 */
export function specLabels<S extends SpecForLabel>(specs: S[]): Map<string, S> {
  const byName = new Map<string, number>();
  const byNameLevel = new Map<string, number>();
  for (const s of specs) {
    byName.set(s.name, (byName.get(s.name) ?? 0) + 1);
    const k = `${s.name}\u0000${s.level}`;
    byNameLevel.set(k, (byNameLevel.get(k) ?? 0) + 1);
  }
  const out = new Map<string, S>();
  for (const s of specs) {
    let label = s.name;
    if ((byName.get(s.name) ?? 0) > 1) label += ` — ${LEVEL_LABEL[s.level] ?? s.level}`;
    if ((byNameLevel.get(`${s.name}\u0000${s.level}`) ?? 0) > 1)
      label += ` (${s.filiere.name})`;
    out.set(label, s);
  }
  return out;
}
