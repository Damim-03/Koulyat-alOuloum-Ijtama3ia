/**
 * أين تُعرض الصورة: خلف عنوان الرئيسية، أو في معرض «عن المنصة»، أو خلف لوحة
 * الترحيب في صفحة الدخول، أو خلف رأس «عن المنصة».
 */
export type SlidePlacement = "home" | "about" | "login" | "aboutHero";

/** صورةٌ تختارها الإدارة — كما يقرؤها الزائر. */
export interface PublicHomeSlide {
  id: string;
  /** مسارٌ نسبيّ من رفع الإدارة (`/uploads/cards/<file>`). */
  imageUrl: string;
  caption: string | null;
}

/** وكما تديرها الإدارة: بحالتها وترتيبها. */
export interface HomeSlide extends PublicHomeSlide {
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HomeSlideInput {
  imageUrl: string;
  caption?: string | null;
  isActive?: boolean;
}

/** خبرٌ في شريط «آخر الأخبار» — كما يقرؤه الزائر. */
export interface PublicNewsItem {
  id: string;
  /** بالعربية — الأصل. */
  text: string;
  textFr: string | null;
  textEn: string | null;
  /** يومُ الخبر، بصيغة ISO (منتصف الليل بتوقيت غرينتش). */
  date: string;
  /** مسارٌ داخليّ (`/topics`) أو عنوانٌ مطلق. */
  linkUrl: string | null;
}

export interface NewsItem extends PublicNewsItem {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewsInput {
  text: string;
  textFr?: string | null;
  textEn?: string | null;
  /** `YYYY-MM-DD`. */
  date: string;
  linkUrl?: string | null;
  isActive?: boolean;
}

export type SiteLang = "ar" | "fr" | "en";

/** «كلمة رئيس القسم» بلغةٍ واحدة. في الفرنسية والإنجليزية: الفارغ يُعرض بالعربية. */
export interface DirectorBlock {
  sectionTitle: string;
  title: string;
  paragraphs: string[];
  quote: string;
  fullName: string;
  role: string;
  initials: string;
}

export interface DirectorMessage {
  isVisible: boolean;
  /** `null` ⇐ صورة الواجهة الافتراضية. */
  photoUrl: string | null;
  ar: DirectorBlock;
  fr: DirectorBlock;
  en: DirectorBlock;
}

/** للزائر: `content` فارغٌ إن لم تُحفظ قطّ (فالنصّ الافتراضيّ)، أو إن كانت مخفيّة. */
export interface PublicDirectorMessage {
  visible: boolean;
  content: DirectorMessage | null;
}

/** ميزةٌ في صفحة «عن المنصة». */
export interface AboutFeature {
  title: string;
  desc: string;
}

/** رقمٌ في شريط الأرقام: «+2000» / «طالب مستفيد». */
export interface AboutStat {
  value: string;
  label: string;
}

/** نصوص صفحة «عن المنصة» بلغةٍ واحدة. في الترجمة: الفارغ يُعرض بالعربية. */
export interface AboutBlock {
  title: string;
  subtitle: string;
  introTitle: string;
  intro: string[];
  galleryTitle: string;
  featuresTitle: string;
  features: AboutFeature[];
  stats: AboutStat[];
}

export interface AboutPage {
  ar: AboutBlock;
  fr: AboutBlock;
  en: AboutBlock;
}

/**
 * نصوص لوحة الترحيب في صفحة الدخول بلغةٍ واحدة. في الترجمة: الفارغ يُعرض
 * بالعربية؛ وفي العربية: الجزء الذهبيّ والتعريف والملاحظة إن فرغت لم تظهر.
 */
export interface LoginBlock {
  university: string;
  platform: string;
  welcome: string;
  /** تكملة الترحيب، في سطرٍ ثانٍ بالذهبيّ — «رحلة التخرّج». */
  highlight: string;
  body: string;
  /** سطرٌ صغير أسفل اللوحة — عن بيانات الدخول مثلاً. */
  note: string;
}

export interface LoginContent {
  ar: LoginBlock;
  fr: LoginBlock;
  en: LoginBlock;
}
