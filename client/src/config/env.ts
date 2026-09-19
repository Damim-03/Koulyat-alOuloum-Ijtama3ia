import { z } from "zod";

/**
 * يتحقّق من متغيّرات Vite عند الإقلاع، فيفشل المتغيّر الناقص أو المكتوب خطأً
 * بصوتٍ عالٍ بدل أن يظهر `undefined` في عمق طلب.
 *
 * ويقبل **المسار النسبيّ** كما يقبل العنوان المطلق. وهذا هو الوضع الافتراضيّ
 * الآن: الصفحة والـAPI من أصلٍ واحد — وسيط Vite في التطوير، وExpress نفسه في
 * الإنتاج. وعنوانٌ مطلقٌ مثبّت (`http://localhost:3000`) يعمل على حاسوبك
 * وحده: افتح التطبيق عبر نفقٍ أو من هاتفٍ على الشبكة، فيذهب كل نداءٍ إلى
 * **حاسوب الزائر** لا إلى خادمك.
 */
const urlOrPath = (fallback: string) =>
  z
    .string()
    .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), {
      error: "must be an absolute http(s) URL or a path starting with /",
    })
    .default(fallback);

const schema = z.object({
  VITE_API_URL: urlOrPath("/api"),
  /** فارغٌ = نفس أصل الصفحة. */
  VITE_SOCKET_URL: urlOrPath(""),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
