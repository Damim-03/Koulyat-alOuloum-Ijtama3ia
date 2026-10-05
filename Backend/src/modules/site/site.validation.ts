import { z } from "zod";

import { entityId } from "../../core/validation/id";
import { imageUrl } from "../../core/validation/image-url";

/**
 * صورةُ الشريحة من رفع الإدارة وحده.
 *
 * `imageUrl` المشترك يقبل الروابط المطلقة لأنّ صفوفاً قديمة تحملها؛ وهذا
 * جدولٌ جديد لا ماضيَ له. والصفحة الرئيسية يقرؤها كلّ زائرٍ بلا تسجيل دخول،
 * فرابطٌ خارجيّ فيها يعني أن يطلب متصفّحُ كلّ زائرٍ نطاقاً لا نملكه.
 */
const uploadedImageUrl = imageUrl.refine(
  (v) => v.startsWith("/uploads/"),
  "Slide images must be uploaded",
);

/**
 * السطر الاختياريّ. والغائب غيرُ الفارغ: في التعديل يعني «لا تمسّه»، والفارغ
 * أو `null` مسحٌ له — والخدمة هي من تفرّق بينهما.
 */
const caption = z.string().trim().max(160).nullable().optional();

export const slideIdParamSchema = z.object({ id: entityId });

/** موضع الصورة — الصفحة الرئيسية ما لم يُذكر غيرها. */
export const slidePlacement = z
  .enum(["home", "about", "login", "aboutHero"])
  .default("home");
export const slidePlacementQuerySchema = z.object({ placement: slidePlacement });
export type SlidePlacementDTO = z.infer<typeof slidePlacement>;

export const createHomeSlideSchema = z.object({
  imageUrl: uploadedImageUrl,
  caption,
  isActive: z.boolean().optional(),
  placement: slidePlacement,
});

export const updateHomeSlideSchema = z.object({
  imageUrl: uploadedImageUrl.optional(),
  caption,
  isActive: z.boolean().optional(),
});

/**
 * عدّة صورٍ دفعةً واحدة — ما اختارته الإدارة في نافذة الإضافة.
 *
 * والسقف الحقيقيّ في الخدمة (`MAX_HOME_SLIDES` مع ما هو موجود)؛ وهذا حدٌّ
 * لحجم الطلب وحده.
 */
export const createHomeSlidesBatchSchema = z.object({
  slides: z
    .array(z.object({ imageUrl: uploadedImageUrl, caption }))
    .min(1)
    .max(50),
  isActive: z.boolean().optional(),
  placement: slidePlacement,
});

/** الترتيب الكامل الجديد لموضعٍ واحد: كلّ صوره، كلٌّ مرّةً واحدة. */
export const reorderHomeSlidesSchema = z.object({
  ids: z.array(entityId).min(1).max(50),
  placement: slidePlacement,
});

export type CreateHomeSlideDTO = z.infer<typeof createHomeSlideSchema>;
export type CreateHomeSlidesBatchDTO = z.infer<typeof createHomeSlidesBatchSchema>;
export type UpdateHomeSlideDTO = z.infer<typeof updateHomeSlideSchema>;

//
// ─── آخر الأخبار ──────────────────────────────────────────────
//

/** نصٌّ اختياريّ: الفارغ والـ`null` سواء — «لا ترجمة». */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null));

/**
 * رابطُ الخبر: مسارٌ داخليّ (`/topics`) أو عنوانٌ مطلق بـhttp(s).
 *
 * والقيمة تصير `href` في الصفحة الرئيسية التي يفتحها كلّ زائر، فلا يمرّ
 * `javascript:` ولا `data:`، ولا `//host` الذي يبدو داخلياً ويقصد نطاقاً آخر.
 */
const newsLink = z
  .string()
  .trim()
  .max(2048)
  .nullable()
  .optional()
  .refine((v) => {
    if (!v) return true;
    if (/\s/.test(v)) return false;
    if (v.startsWith("/")) return !v.startsWith("//");
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid link")
  .transform((v) => (v === undefined ? undefined : v ? v : null));

/** يومٌ بصيغة `YYYY-MM-DD` — كما يرسله حقل التاريخ. */
const newsDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

export const createNewsSchema = z.object({
  text: z.string().trim().min(1).max(300),
  textFr: optionalText(300),
  textEn: optionalText(300),
  date: newsDate,
  linkUrl: newsLink,
  isActive: z.boolean().optional(),
});

export const updateNewsSchema = createNewsSchema.partial();

export type CreateNewsDTO = z.infer<typeof createNewsSchema>;
export type UpdateNewsDTO = z.infer<typeof updateNewsSchema>;

//
// ─── كلمة رئيس القسم ─────────────────────────────────────────
//

const paragraphs = z.array(z.string().trim().min(1).max(1500)).max(8);

/** العربية أصل: الحقول الأساسية مطلوبة. */
const directorArabic = z.object({
  sectionTitle: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(220),
  paragraphs: paragraphs.min(1),
  quote: z.string().trim().max(400).default(""),
  fullName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  initials: z.string().trim().max(3).default(""),
});

/**
 * والفرنسية والإنجليزية اختياريّتان حقلاً حقلاً: ما تُرك فارغاً يُعرض
 * بالعربية. فترجمةُ الاسم وحده، أو العنوان وحده، تكفي ولا تُلزم بالباقي.
 */
const directorTranslation = z.object({
  sectionTitle: z.string().trim().max(80).default(""),
  title: z.string().trim().max(220).default(""),
  paragraphs: paragraphs.default([]),
  quote: z.string().trim().max(400).default(""),
  fullName: z.string().trim().max(120).default(""),
  role: z.string().trim().max(160).default(""),
  initials: z.string().trim().max(3).default(""),
});

export const directorMessageSchema = z.object({
  isVisible: z.boolean(),
  /** صورةٌ من رفع الإدارة، أو `null` لصورة الواجهة الافتراضية. */
  photoUrl: uploadedImageUrl.nullable(),
  ar: directorArabic,
  fr: directorTranslation,
  en: directorTranslation,
});

export type DirectorMessageDTO = z.infer<typeof directorMessageSchema>;

//
// ─── صفحة «عن المنصة» ────────────────────────────────────────
//

const aboutFeature = (required: boolean) =>
  z.object({
    title: required ? z.string().trim().min(1).max(80) : z.string().trim().max(80),
    desc: z.string().trim().max(400).default(""),
  });

const aboutStat = (required: boolean) =>
  z.object({
    value: required ? z.string().trim().min(1).max(20) : z.string().trim().max(20),
    label: required ? z.string().trim().min(1).max(60) : z.string().trim().max(60),
  });

/** العربية أصل: العنوان والتعريف مطلوبان، وما سواهما قد يُترك فارغاً فيُخفى قسمه. */
const aboutArabic = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(300).default(""),
  introTitle: z.string().trim().min(1).max(120),
  intro: paragraphs.min(1),
  galleryTitle: z.string().trim().max(120).default(""),
  featuresTitle: z.string().trim().max(120).default(""),
  features: z.array(aboutFeature(true)).max(8).default([]),
  stats: z.array(aboutStat(true)).max(4).default([]),
});

/**
 * والفرنسية والإنجليزية اختياريّتان: كلّ نصٍّ فارغ يُعرض بالعربية، وكلّ
 * قائمةٍ فارغة (المزايا، الأرقام) تُعرض بقائمتها العربية كاملة.
 */
const aboutTranslation = z.object({
  title: z.string().trim().max(80).default(""),
  subtitle: z.string().trim().max(300).default(""),
  introTitle: z.string().trim().max(120).default(""),
  intro: paragraphs.default([]),
  galleryTitle: z.string().trim().max(120).default(""),
  featuresTitle: z.string().trim().max(120).default(""),
  features: z.array(aboutFeature(false)).max(8).default([]),
  stats: z.array(aboutStat(false)).max(4).default([]),
});

export const aboutPageSchema = z.object({
  ar: aboutArabic,
  fr: aboutTranslation,
  en: aboutTranslation,
});

export type AboutPageDTO = z.infer<typeof aboutPageSchema>;

//
// ─── لوحة الترحيب في صفحة الدخول ──────────────────────────────
//

/**
 * العربية أصل: اسم الجامعة واسم المنصة وجملة الترحيب مطلوبة؛ والجزء الذهبيّ
 * والتعريف والملاحظة السفلى قد تُترك فارغةً فلا تظهر.
 */
const loginArabic = z.object({
  university: z.string().trim().min(1).max(120),
  platform: z.string().trim().min(1).max(80),
  welcome: z.string().trim().min(1).max(80),
  highlight: z.string().trim().max(80).default(""),
  body: z.string().trim().max(400).default(""),
  note: z.string().trim().max(200).default(""),
});

/** والترجمتان اختياريّتان: كلّ نصٍّ فارغ يُعرض بالعربية. */
const loginTranslation = z.object({
  university: z.string().trim().max(120).default(""),
  platform: z.string().trim().max(80).default(""),
  welcome: z.string().trim().max(80).default(""),
  highlight: z.string().trim().max(80).default(""),
  body: z.string().trim().max(400).default(""),
  note: z.string().trim().max(200).default(""),
});

export const loginPageSchema = z.object({
  ar: loginArabic,
  fr: loginTranslation,
  en: loginTranslation,
});

export type LoginPageDTO = z.infer<typeof loginPageSchema>;
