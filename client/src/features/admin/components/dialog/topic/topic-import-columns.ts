import type { ImportColumn, ImportColumnKey } from "../../../../../types/admin";

/**
 * أعمدة ملفّ استيراد المواضيع كما في نموذج المنصّة — لدليل الأعمدة قبل الرفع.
 *
 * الخادم مصدرها (TOPIC_COLUMNS)، ويُرسلها مع كلّ تقرير؛ وهذه نسختها لما قبل
 * الرفع، حين لا تقرير بعد. العناوين عربيةٌ في كلّ اللغات: هي ما في الملف.
 */
export const TOPIC_GUIDE: Omit<ImportColumn, "letter">[] = (
  [
    ["professor", "الأستاذ", "req", "supervisor"],
    ["title", "عنوان الموضوع", "req", "topic"],
    ["description", "الوصف", "req", "topic"],
    ["objectives", "الأهداف", "opt", "topic"],
    ["requirements", "المتطلّبات", "opt", "topic"],
    ["references", "المراجع", "opt", "topic"],
    ["maxStudents", "عدد الطلبة", "req", "topic"],
    ["maxRequests", "سقف الطلبات", "opt", "topic"],
    ["academicYear", "السنة الجامعية", "auto", "academic"],
    ["faculty", "الكلية", "auto", "academic"],
    ["department", "القسم", "auto", "academic"],
    ["filiere", "الشعبة", "auto", "academic"],
    ["level", "المستوى", "auto", "academic"],
    ["specialization", "التخصص", "req", "academic"],
    ["status", "الحالة", "req", "decision"],
  ] as [ImportColumnKey, string, ImportColumn["kind"], ImportColumn["group"]][]
).map(([key, header, kind, group]) => ({ key, header, kind, group }));
