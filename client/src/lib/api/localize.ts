import i18next, { t } from "i18next";

/**
 * رسائل الخادم بلغة الواجهة.
 *
 * الخادم يكتب رسائله بلغةٍ واحدة لكلٍّ منها — أغلبها بالعربية، وبعضها
 * بالإنجليزية («Specialization not found»). فكانت الواجهة الإنجليزية تُري
 * تنبيهاً عربيّاً، والعربية تُري «not found». والإشعارات العابرة ونوافذ
 * الخطأ كلّها تقرأ `response.data.message`، فتُصحَّح هنا مرّةً للجميع:
 *
 *   رسالةٌ بلغة الواجهة — تبقى كما هي، بتفاصيلها.
 *   رسالةٌ بغيرها — تحلّ محلّها رسالةٌ بلغة الواجهة بحسب نوع الخطأ (رمزه أو
 *     حالته)، ويُحفظ الأصل في `originalMessage` فيظهر في «التفاصيل التقنية».
 *
 * والترجمة تُقرأ لحظة العرض لا لحظة التحميل، فتتبع تبديل اللغة.
 */

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;

/** أتُقرأ الرسالة بلغة الواجهة؟ العربية بحروفها، والإنجليزية والفرنسية بغيرها. */
export function speaksUiLanguage(text: string, lang = i18next.language ?? "ar"): boolean {
  const arabic = ARABIC.test(text);
  if (lang.startsWith("ar")) return arabic || !LATIN.test(text);
  return !arabic;
}

/** رموز الخادم التي لها رسالتها — تُترجم عند العرض. */
const BY_CODE: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "apiError.badCredentials",
  AUTH_ACCOUNT_SUSPENDED: "apiError.suspended",
  AUTH_INVALID_TOKEN: "apiError.sessionExpired",
  AUTH_USER_NOT_FOUND: "apiError.accountGone",
  RESOURCE_NOT_FOUND: "apiError.notFound",
  ACCESS_UNAUTHORIZED: "apiError.forbidden",
};

/** رسالةٌ بلغة الواجهة لنوع الخطأ: برمزه إن عُرف، وإلّا بحالته. */
export function fallbackFor(status: number, code?: string): string {
  if (code && BY_CODE[code]) return t(BY_CODE[code]);
  if (status === 400 || status === 422) return t("apiError.refused");
  if (status === 401) return t("apiError.sessionExpired");
  if (status === 403) return t("apiError.forbidden");
  if (status === 404) return t("apiError.notFound");
  if (status === 409) return t("apiError.conflict");
  if (status === 413) return t("apiError.tooLarge");
  if (status === 429) return t("apiError.tooManyRequests");
  if (status >= 500) return t("apiError.server");
  return t("apiError.unexpected");
}

/** في مكانه: رسالة الخادم بغير لغة الواجهة تُستبدل، ويُحفظ أصلها. */
export function localizeServerMessage(data: unknown, status: number): void {
  if (!data || typeof data !== "object") return;
  const d = data as { message?: unknown; errorCode?: string; originalMessage?: string };
  if (typeof d.message !== "string" || !d.message.trim()) return;
  if (speaksUiLanguage(d.message)) return;
  d.originalMessage = d.message;
  d.message = fallbackFor(status, d.errorCode);
}
