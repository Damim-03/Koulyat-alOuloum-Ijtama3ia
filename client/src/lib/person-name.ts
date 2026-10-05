/**
 * اسمُ الشخص كما تقرؤه لغةُ الواجهة.
 *
 * كلُّ حسابٍ يحمل اسمه بالعربية، وأكثرُها يحمله بالحروف اللاتينية أيضاً
 * (الاستمارات والاستيراد يأخذانه). فالعربية تعرض الاسمَ العربي، والفرنسية
 * والإنجليزية تعرضان اللاتيني — وتعودان إلى العربي إن خلا الحساب منه، فلا
 * يظهر أحدٌ بلا اسم.
 *
 * واللاتيني لا يُقدَّم إلا كاملاً (الاسم واللقب معاً): لقبٌ لاتينيّ وحده
 * يُسقط الاسم الأوّل، فالعربيّ الكامل أولى منه.
 *
 * واللغةُ الحالية يُبلغها بها i18n/i18n.ts عند كلّ تغيير (`setNameLanguage`)،
 * فلا تستورد هذه الوحدة i18next ولا تحتاج الاختباراتُ إلى محاكاته. والمكوّن
 * الذي يعرض الاسم يستعمل `useTranslation` لنصوصه، فيُعاد رسمه حين تتغيّر.
 */
export type Named =
  | {
      firstName?: string | null;
      lastName?: string | null;
      firstNameLatin?: string | null;
      lastNameLatin?: string | null;
    }
  | null
  | undefined;

const join = (...parts: (string | null | undefined)[]) =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");

let current = "ar";

/** يُنادى عند تغيّر لغة الواجهة — قبل أن يُعاد رسم المكوّنات. */
export function setNameLanguage(lang: string) {
  current = lang;
}

/** هل تُقرأ الأسماء بالحروف اللاتينية في هذه اللغة؟ */
export const readsLatin = (lang: string = current) => !!lang && !lang.startsWith("ar");

export const arabicName = (u: Named) => join(u?.firstName, u?.lastName);
export const latinName = (u: Named) => join(u?.firstNameLatin, u?.lastNameLatin);

/** بأيّ الخطّين يُعرض هذا الشخص في هذه اللغة. */
function scriptOf(u: Named, lang?: string): "latin" | "arabic" {
  if (!arabicName(u)) return "latin";
  const complete = !!(u?.firstNameLatin?.trim() && u?.lastNameLatin?.trim());
  return readsLatin(lang) && complete ? "latin" : "arabic";
}

/** الاسم الكامل بخطّ لغة الواجهة، أو بالخطّ الآخر إن لم يوجد. */
export function personName(u: Named, lang?: string): string {
  return scriptOf(u, lang) === "latin" ? latinName(u) : arabicName(u);
}

/** الاسم بالخطّ الآخر — يُعرض تحت الاسم الرئيسي — أو "" إن لم يكن غيره. */
export function otherScriptName(u: Named, lang?: string): string {
  const main = personName(u, lang);
  const other = scriptOf(u, lang) === "latin" ? arabicName(u) : latinName(u);
  return other && other !== main ? other : "";
}

/** الاسم الأوّل وحده، للتحيّة: «مرحباً خالد» / « Bonjour Khaled ». */
export function givenName(u: Named, lang?: string): string {
  const latin = scriptOf(u, lang) === "latin";
  return ((latin ? u?.firstNameLatin : u?.firstName) || (latin ? u?.firstName : u?.firstNameLatin) || "").trim();
}

/** اللقب وحده، لجداول الإدارة التي تفصل الاسم عن اللقب. */
export function familyName(u: Named, lang?: string): string {
  const latin = scriptOf(u, lang) === "latin";
  return ((latin ? u?.lastNameLatin : u?.lastName) || (latin ? u?.lastName : u?.lastNameLatin) || "").trim();
}

/** الحرفان الأوّلان، بالخطّ نفسه الذي يُعرض به الاسم. */
export function initials(u: Named, lang?: string): string {
  return (givenName(u, lang).charAt(0) + familyName(u, lang).charAt(0)).toLocaleUpperCase();
}

/** لاسمٍ حُفظ نصّاً جاهزاً (سجلّات الأرشيف): العربي واللاتيني جنباً إلى جنب. */
export function pickName(arabic?: string | null, latin?: string | null, lang?: string): string {
  const ar = arabic?.trim() ?? "";
  const la = latin?.trim() ?? "";
  return readsLatin(lang) ? la || ar : ar || la;
}
