import i18next from "i18next";

/**
 * قائمةٌ في جملة، بفاصلة لغة الواجهة: «19 طالباً، 6 مواضيع» بالعربية،
 * و«19 students, 6 topics» بغيرها. فالفاصلة العربية في جملةٍ إنجليزية تُقرأ
 * خطأً مطبعيّاً.
 */
export function joinList(items: (string | false | null | undefined)[], lang = i18next.language ?? "ar"): string {
  return items.filter((x): x is string => !!x).join(lang.startsWith("ar") ? "، " : ", ");
}
