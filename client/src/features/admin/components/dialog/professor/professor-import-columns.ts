import type { ImportColumn, ImportColumnKey } from "../../../../../types/admin";

/**
 * أعمدة ملفّ استيراد الأساتذة كما في نموذج المنصّة — لدليل الأعمدة قبل الرفع.
 *
 * الخادم مصدرها (PROFESSOR_COLUMNS)، ويُرسلها مع كلّ تقرير؛ وهذه نسختها لما
 * قبل الرفع، حين لا تقرير بعد. العناوين عربيةٌ في كلّ اللغات: هي ما في الملف.
 */
export const PROFESSOR_GUIDE: Omit<ImportColumn, "letter">[] = (
  [
    ["firstNameLatin", "الاسم باللاتينية", "req", "personal"],
    ["lastNameLatin", "اللقب باللاتينية", "req", "personal"],
    ["firstName", "الاسم", "opt", "personal"],
    ["lastName", "اللقب", "opt", "personal"],
    ["gender", "الجنس", "opt", "personal"],
    ["verified", "حالة التوثيق", "opt", "personal"],
    ["email", "البريد الشخصي", "opt", "personal"],
    ["phone", "رقم الهاتف", "opt", "personal"],
    ["password", "كلمة المرور", "opt", "personal"],
    ["universityEmail", "البريد الجامعي", "req", "professional"],
    ["employeeNumber", "الرقم الوظيفي", "opt", "professional"],
    ["faculty", "الكلية", "auto", "professional"],
    ["department", "القسم", "req", "professional"],
    ["grade", "الرتبة", "opt", "professional"],
    ["tags", "الصفة", "opt", "professional"],
  ] as [ImportColumnKey, string, ImportColumn["kind"], ImportColumn["group"]][]
).map(([key, header, kind, group]) => ({ key, header, kind, group }));
