/**
 * نصُّ ورقة «طلب الموافقة على الإشراف» وشعاراها — كما تعدّلها الإدارة من
 * «واجهة الموقع» (Backend: modules/site/supervision-sheet.ts).
 *
 * وكلّ وثيقةٍ تحمل نصّها في لقطتها (`snapshot.template`) منذ صدورها، فتُطبع
 * كما وقّع عليها الأستاذ وإن تغيّر القالب بعدها. والوثائق الأقدم من هذه
 * الميزة لا قالب في لقطتها، فتُقرأ بالنصّ الأصليّ — وهو ما صدرت به.
 */
export interface SupervisionTemplate {
  /** Above the title, under the logos: the state, the ministry, the university… */
  header: string[];
  /** The line naming the specialization's department: «{prefix} {specialization}», or none. */
  department: { show: boolean; prefix: string };
  title: string;
  supervisorLead: string;
  topicLead: string;
  degreeLead: string;
  /** The degrees' names; an empty one is not printed. */
  degrees: Record<SheetDegree, string>;
  /**
   * Under the degrees' boxes: «{label} {the topic's specialization}», or none.
   * Missing from a sheet printed before the line was added — it is read as none.
   */
  specialization?: { show: boolean; label: string };
  studentsLead: string;
  studentLabel: string;
  yearLabel: string;
  signLabel: string;
  /** An uploaded logo, or `null` for the platform's own. */
  universityLogo: string | null;
  facultyLogo: string | null;
}

export type SheetDegree = "licence" | "master" | "doctorate";
export const SHEET_DEGREES: SheetDegree[] = ["licence", "master", "doctorate"];

/**
 * A document issued before the sheet's text could be edited: printed with
 * the original — which had no specialization line.
 */
export const legacyTemplate = (): SupervisionTemplate => ({ ...DEFAULT_SUPERVISION_TEMPLATE, specialization: { show: false, label: "" } });

/** The sheet as the administration prints it now, unless it changed it — the server's `DEFAULT_SUPERVISION_SHEET`. */
export const DEFAULT_SUPERVISION_TEMPLATE: SupervisionTemplate = {
  header: ["الجمهورية الجزائرية الديمقراطية الشعبية", "وزارة التعليم العالي والبحث العلمي", "جامعة الشهيد حمه لخضر الوادي"],
  department: { show: true, prefix: "قسم" },
  title: "طلب الموافقة على الإشراف",
  supervisorLead: "أنا الأستاذ الممضي أسفله:",
  topicLead: "أعلمكم بأني صادقت على عنوان المذكرة:",
  degreeLead: "لنيل شهادة:",
  degrees: { licence: "الليسانس", master: "الماستر", doctorate: "" },
  specialization: { show: true, label: "التخصّص:" },
  studentsLead: "من إعداد الطلبة الآتية أسماؤهم:",
  studentLabel: "الطالب (ة):",
  yearLabel: "السنة الجامعية:",
  signLabel: "إمضاء الأستاذ:",
  universityLogo: null,
  facultyLogo: null,
};
