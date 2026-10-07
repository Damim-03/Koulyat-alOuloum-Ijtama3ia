import type { ImportColumn, ImportColumnKey } from "../../../../../types/admin";

/**
 * أعمدة ملفّ الاستيراد كما في نموذج المنصّة — لدليل الأعمدة قبل الرفع.
 *
 * الخادم مصدرها (IMPORT_COLUMNS)، ويُرسلها مع كلّ تقرير؛ وهذه نسختها لما قبل
 * الرفع، حين لا تقرير بعد. العناوين عربيةٌ في كلّ اللغات: هي ما في الملف.
 */
export const IMPORT_GUIDE: Omit<ImportColumn, "letter">[] = (
  [
    ["registrationNumber", "رقم التسجيل", "req", "personal"],
    ["firstNameLatin", "الاسم باللاتينية", "req", "personal"],
    ["lastNameLatin", "اللقب باللاتينية", "req", "personal"],
    ["firstName", "الاسم", "opt", "personal"],
    ["lastName", "اللقب", "opt", "personal"],
    ["gender", "الجنس", "opt", "personal"],
    ["verified", "حالة التوثيق", "opt", "personal"],
    ["email", "البريد الشخصي", "opt", "personal"],
    ["phone", "رقم الهاتف", "opt", "personal"],
    ["password", "كلمة المرور", "opt", "personal"],
    ["academicYear", "السنة الجامعية", "req", "academic"],
    ["faculty", "الكلية", "auto", "academic"],
    ["department", "القسم", "auto", "academic"],
    ["filiere", "الشعبة", "auto", "academic"],
    ["level", "المستوى", "auto", "academic"],
    ["specialization", "التخصص", "req", "academic"],
  ] as [ImportColumnKey, string, ImportColumn["kind"], ImportColumn["group"]][]
).map(([key, header, kind, group]) => ({ key, header, kind, group }));
