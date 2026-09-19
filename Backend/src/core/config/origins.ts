/**
 * مَن يُسمح له بمناداة هذا الخادم.
 *
 * القائمة البيضاء وحدها لا تكفي مع أنفاق التطوير (VS Code Dev Tunnels،
 * ngrok، cloudflared): النفق يُعطي اسماً عشوائياً يتبدّل مع كل مرّة
 * (`4hfr6hdk-5173.uks1.devtunnels.ms`)، فلا يُكتب في قائمةٍ ثابتة — وكتابته
 * اليوم تعني تحريرها غداً.
 *
 * فيُقبل النمط بدل الاسم، **في التطوير وحده**. وهذا هو الشرط الذي لا يجوز
 * التساهل فيه: نفقٌ مفتوحٌ على الإنترنت يُقبل في الإنتاج يعني أن أيّ أحدٍ
 * يُنشئ نفقاً باسمٍ عشوائيّ يملك أصلاً موثوقاً عند خادمك.
 *
 * ودالّةٌ صرفة عمداً: الإعداد يقرأ البيئة وينفّذ `process.exit` عند الخطأ،
 * فلا يُختبر بسهولة. أمّا هذه فتُختبر بسطرين — وهي موضع الخطر.
 */

/** أنفاق التطوير المعروفة. `https` وحدها: النفق لا يُقدّم غيرها. */
const DEV_TUNNEL_PATTERNS: RegExp[] = [
  // VS Code / GitHub Dev Tunnels: <id>-<port>.<region>.devtunnels.ms
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.devtunnels\.ms$/i,
];

export interface OriginPolicy {
  /** ما نصّت عليه البيئة صراحةً. */
  allowList: string[];
  isProduction: boolean;
}

/**
 * أصلٌ مسموح؟
 *
 * الترتيب مقصود: القائمة الصريحة أوّلاً — فما نصّ عليه صاحب النشر يُقبل في
 * كل بيئة — ثم أنماط الأنفاق، وهي محجوبةٌ عن الإنتاج حجباً تامّاً.
 */
export function isOriginAllowed(
  origin: string,
  { allowList, isProduction }: OriginPolicy,
): boolean {
  if (allowList.includes(origin)) return true;
  if (isProduction) return false;
  return DEV_TUNNEL_PATTERNS.some((pattern) => pattern.test(origin));
}
