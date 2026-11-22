import type { ImportColumn, ImportSpec } from "../import-kit/columns";

/**
 * أعمدة ملفّ استيراد المواضيع — مصدرٌ واحد يقرؤه النموذج والمحلِّل معاً.
 *
 * صفٌّ لكلّ موضوع: الأستاذ الذي اقترحه، ثم الموضوع نفسه كما في نافذة «إنشاء
 * موضوع» (العنوان والوصف والأهداف والمتطلّبات والمراجع وعدد الطلبة)، ثم
 * التخصص الذي يُطرح فيه بترتيب الهرم، ثم قرار الإدارة فيه.
 */

export type TopicKey =
  | "professor"
  | "title"
  | "description"
  | "objectives"
  | "requirements"
  | "references"
  | "maxStudents"
  | "maxRequests"
  | "academicYear"
  | "faculty"
  | "department"
  | "filiere"
  | "level"
  | "specialization"
  | "status";

/** حدود الخانات — العنوان بحدّ عموده في القاعدة، والباقي بما يُقرأ. */
export const LIMITS = {
  title: 191,
  description: 5000,
  item: 500,
  items: 50,
  references: 20,
  url: 2048,
  maxStudents: 10,
  maxRequests: 50,
} as const;

export const TOPIC_COLUMNS: ImportColumn<TopicKey>[] = [
  { key: "professor", header: "الأستاذ", kind: "req", width: 30, group: "supervisor", note: "من القائمة — أو بريده الجامعي، أو رقمه الوظيفي." },
  { key: "title", header: "عنوان الموضوع", kind: "req", width: 44, group: "topic", note: `حتى ${LIMITS.title} حرفاً، ولا يتكرّر للأستاذ نفسه في السنة نفسها.` },
  { key: "description", header: "الوصف", kind: "req", width: 60, group: "topic", note: `ما يُنجز في المذكّرة — حتى ${LIMITS.description} حرف.` },
  { key: "objectives", header: "الأهداف", kind: "opt", width: 38, group: "topic", note: "هدفٌ في كلّ سطر (Alt+Enter)، أو تُفصل بفاصلةٍ منقوطة «؛»." },
  { key: "requirements", header: "المتطلّبات", kind: "opt", width: 38, group: "topic", note: "متطلَّبٌ في كلّ سطر (Alt+Enter)، أو تُفصل بفاصلةٍ منقوطة «؛»." },
  { key: "references", header: "المراجع", kind: "opt", width: 42, group: "topic", note: "مرجعٌ في كلّ سطر: عنوانه ثم رابطه (https://…)، أو الرابط وحده." },
  { key: "maxStudents", header: "عدد الطلبة", kind: "req", width: 12, group: "topic", note: `من 1 إلى ${LIMITS.maxStudents}.` },
  { key: "maxRequests", header: "سقف الطلبات", kind: "opt", width: 13, group: "topic", note: `من 1 إلى ${LIMITS.maxRequests} — كم فريقاً يتقدّم إليه معاً قبل أن يُغلق، والإدارة تختار منهم. الفارغ بلا سقف.` },
  { key: "academicYear", header: "السنة الجامعية", kind: "auto", width: 14, group: "academic", note: "من القائمة — أو اتركها فتكون السنة الجامعية الجارية." },
  { key: "faculty", header: "الكلية", kind: "auto", width: 32, group: "academic", note: "من القائمة لتضييق الأقسام والتخصصات — أو اتركها تُملأ من التخصص." },
  { key: "department", header: "القسم", kind: "auto", width: 24, group: "academic", note: "من القائمة (أقسام الكلية المختارة) — أو اتركه يُملأ من التخصص." },
  { key: "filiere", header: "الشعبة", kind: "auto", width: 20, group: "academic", note: "من القائمة (شعب القسم المختار) — أو اتركها تُملأ من التخصص." },
  { key: "level", header: "المستوى", kind: "auto", width: 12, group: "academic", note: "من القائمة لتضييق التخصصات — أو اتركه يُملأ من التخصص." },
  { key: "specialization", header: "التخصص", kind: "req", width: 27, group: "academic", note: "من القائمة — تضيق بما اختير قبله. وما تُرك فارغاً من الكلية والقسم والشعبة والمستوى يُملأ منه." },
  { key: "status", header: "الحالة", kind: "req", width: 16, group: "decision", note: "قيد الانتظار أو تمت الموافقة أو منشور — من القائمة، بأسمائها في الموقع. «تمت الموافقة» لا يراه الطلبة حتى يُنشر." },
];

/** ما تكتبه صيغ الأعمدة التلقائية حين لا تجد التخصص — كنموذج الطلبة. */
export const AUTO_UNKNOWN = "تخصصٌ غير معروف";

export const TOPIC_SPEC: ImportSpec<TopicKey> = {
  sheetName: "المواضيع",
  columns: TOPIC_COLUMNS,
  anchor: "title",
  autoUnknown: AUTO_UNKNOWN,
  noun: "topic",
};

/**
 * قرار الإدارة في الموضوع المستورَد — والنشر قرارٌ معه. بأسماء الحالات في
 * الموقع نفسها (status.* في ترجمة الواجهة)، وبترتيب مسار الموضوع: ينتظر، ثم
 * يُوافَق عليه، ثم يُنشر. و«مسند» ليس منها: لا يُسنَد موضوعٌ إلا بمجموعة.
 */
export type ImportStatus = "pending" | "approved" | "open";
export const STATUS_LABEL: Record<ImportStatus, string> = {
  pending: "قيد الانتظار",
  approved: "تمت الموافقة",
  open: "منشور",
};

export interface ProfessorForLabel {
  id: string;
  universityEmail: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    firstNameLatin: string | null;
    lastNameLatin: string | null;
  };
}

/** «HAMADI Youcef» — باللاتينية ما وُجدت (اللقب أوّلاً، كقوائم الإدارة)، وإلّا بالعربية. */
export const personName = (p: Pick<ProfessorForLabel, "user">) =>
  [p.user.lastNameLatin, p.user.firstNameLatin].filter(Boolean).join(" ").trim() ||
  [p.user.lastName, p.user.firstName].filter(Boolean).join(" ").trim();

/**
 * اسم الأستاذ كما يظهر في القائمة المنسدلة — ويدلّ على أستاذٍ واحد: الاسم
 * وحده ما لم يتكرّر، فإن تكرّر أُضيف بريده الجامعي.
 */
export const professorName = personName;

export function professorLabels<P extends ProfessorForLabel>(profs: P[]): Map<string, P> {
  const count = new Map<string, number>();
  for (const p of profs) count.set(professorName(p), (count.get(professorName(p)) ?? 0) + 1);
  return new Map(
    profs.map((p) => {
      const name = professorName(p) || p.universityEmail;
      return [count.get(professorName(p))! > 1 ? `${name} — ${p.universityEmail}` : name, p];
    }),
  );
}
