import i18n from "../../../i18n/i18n";
import type {
  AboutBlock,
  AboutPage,
  DirectorBlock,
  DirectorMessage,
  LoginBlock,
  LoginContent,
  PublicNewsItem,
  SiteLang,
} from "../../../types/site.types";

/**
 * العربية أصلُ ما تكتبه الإدارة، والفرنسية والإنجليزية اختياريّتان: ما لم
 * يُترجَم يُعرض بالعربية. والعناصر التي تعرضه تحمل `dir="auto"`، فيُقرأ
 * النصّ العربيّ من اليمين حتى داخل واجهةٍ يسارية.
 */
export const newsText = (item: PublicNewsItem, lang: SiteLang) =>
  (lang === "fr" ? item.textFr : lang === "en" ? item.textEn : null) || item.text;

/**
 * «16 مارس» / «16 mars» / «Mar 16».
 *
 * `ar-DZ` لا `ar`: أسماء الأشهر الجزائرية (جوان، جويلية، أوت…) — وهي ما كتبه
 * الشريط بيده من قبل. والمنطقة الزمنية UTC: العمود يومٌ لا لحظة، ويُخزَّن
 * منتصف ليل غرينتش؛ وقراءته بتوقيتٍ غربيّ كانت ستُرجعه يوماً.
 */
export function newsDate(iso: string, lang: SiteLang) {
  const locale = lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: lang === "en" ? "short" : "long",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** رابطٌ داخل المنصّة (`/topics`) — يُفتح في الصفحة نفسها وبلغة الزائر. */
export const isInternalLink = (url: string) => url.startsWith("/") && !url.startsWith("//");

/** نصوص «كلمة رئيس القسم» الافتراضية بلغةٍ ما — من ملفّات الترجمة. */
export function directorDefaults(lang: SiteLang): DirectorBlock {
  const t = i18n.getFixedT(lang);
  const raw = t("director.messages", { returnObjects: true });
  return {
    sectionTitle: t("director.sectionTitle"),
    title: t("director.title"),
    paragraphs: Array.isArray(raw) ? (raw as string[]) : [],
    quote: t("director.highlightQuote"),
    fullName: t("director.fullName"),
    role: t("director.role"),
    initials: t("director.initials"),
  };
}

/** المحتوى الافتراضيّ كاملاً — حين لم تحفظ الإدارة شيئاً بعد. */
export const defaultDirectorMessage = (): DirectorMessage => ({
  isVisible: true,
  photoUrl: null,
  ar: directorDefaults("ar"),
  fr: directorDefaults("fr"),
  en: directorDefaults("en"),
});

/** ما يُعرض بلغة الزائر: كلّ حقلٍ فارغٍ في الترجمة يأخذ قيمته العربية. */
export function resolveDirector(content: DirectorMessage, lang: SiteLang): DirectorBlock {
  const ar = content.ar;
  if (lang === "ar") return ar;
  const tr = content[lang];
  const pick = (k: Exclude<keyof DirectorBlock, "paragraphs">) => tr[k]?.trim() || ar[k];
  return {
    sectionTitle: pick("sectionTitle"),
    title: pick("title"),
    paragraphs: tr.paragraphs.some((p) => p.trim()) ? tr.paragraphs : ar.paragraphs,
    quote: pick("quote"),
    fullName: pick("fullName"),
    role: pick("role"),
    initials: pick("initials"),
  };
}

/**
 * الحرف في الدائرة إن لم يُكتب: أوّل حرفٍ من الاسم بعد اللقب العلميّ —
 * «أ.د. أحمد…» ⇐ «أ»، لا النقطة ولا «د».
 */
export function initialsOf(fullName: string) {
  const name = fullName
    .trim()
    .replace(/^((أ\.?\s?د|د|أ|Pr|Prof|Dr|Mr|Mme|M)\.?\s+)+/i, "");
  return (name[0] ?? "").toUpperCase();
}

//
// ─── صفحة «عن المنصة» ────────────────────────────────────────
//

/** نصوص «عن المنصة» الافتراضية بلغةٍ ما — من ملفّات الترجمة. */
export function aboutDefaults(lang: SiteLang): AboutBlock {
  const t = i18n.getFixedT(lang);
  const list = <T,>(key: string): T[] => {
    const raw = t(key, { returnObjects: true });
    return Array.isArray(raw) ? (raw as T[]) : [];
  };
  return {
    title: t("aboutPage.title"),
    subtitle: t("aboutPage.subtitle"),
    introTitle: t("aboutPage.introTitle"),
    intro: list<string>("aboutPage.intro"),
    galleryTitle: t("aboutPage.galleryTitle"),
    featuresTitle: t("aboutPage.featuresTitle"),
    features: list("aboutPage.features"),
    stats: list("aboutPage.stats"),
  };
}

export const defaultAboutPage = (): AboutPage => ({
  ar: aboutDefaults("ar"),
  fr: aboutDefaults("fr"),
  en: aboutDefaults("en"),
});

/**
 * ما يُعرض بلغة الزائر: كلّ نصٍّ فارغٍ في الترجمة يأخذ قيمته العربية، وكلّ
 * قائمةٍ فارغة تُعرض بقائمتها العربية كاملة.
 */
export function resolveAbout(content: AboutPage, lang: SiteLang): AboutBlock {
  const ar = content.ar;
  if (lang === "ar") return ar;
  const tr = content[lang];
  const text = (k: "title" | "subtitle" | "introTitle" | "galleryTitle" | "featuresTitle") =>
    tr[k]?.trim() || ar[k];
  const filled = <T,>(xs: T[], ok: (x: T) => boolean, fallback: T[]) =>
    xs.some(ok) ? xs.filter(ok) : fallback;
  return {
    title: text("title"),
    subtitle: text("subtitle"),
    introTitle: text("introTitle"),
    intro: filled(tr.intro, (p) => !!p.trim(), ar.intro),
    galleryTitle: text("galleryTitle"),
    featuresTitle: text("featuresTitle"),
    features: filled(tr.features, (f) => !!f.title.trim(), ar.features),
    stats: filled(tr.stats, (x) => !!x.value.trim() && !!x.label.trim(), ar.stats),
  };
}

/** نصوص لوحة الترحيب كما كانت في ملفّات الترجمة — ما يُعرض قبل أن تحفظ الإدارة. */
export function loginDefaults(lang: SiteLang): LoginBlock {
  const t = i18n.getFixedT(lang);
  return {
    university: t("hero.subtitle"),
    platform: t("auth.heroSystem"),
    welcome: t("auth.heroWelcomeBack"),
    highlight: t("auth.heroJourney"),
    body: t("auth.heroBody"),
    note: t("auth.heroCredentialsNote"),
  };
}

export const defaultLoginContent = (): LoginContent => ({
  ar: loginDefaults("ar"),
  fr: loginDefaults("fr"),
  en: loginDefaults("en"),
});

/** ما يُعرض بلغة الزائر: كلّ نصٍّ فارغٍ في الترجمة يأخذ قيمته العربية. */
export function resolveLogin(content: LoginContent, lang: SiteLang): LoginBlock {
  const ar = content.ar;
  if (lang === "ar") return ar;
  const tr = content[lang];
  const text = (k: keyof LoginBlock) => tr[k]?.trim() || ar[k];
  return {
    university: text("university"),
    platform: text("platform"),
    welcome: text("welcome"),
    highlight: text("highlight"),
    body: text("body"),
    note: text("note"),
  };
}
