import ar from "./locales/ar.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

/**
 * نصوص الموقع التي تغيّرها الإدارة — من «واجهة الموقع ← النصوص».
 *
 * كلّ عبارةٍ في الواجهة لها مفتاحٌ في ملفّات الترجمة («hero.title»،
 * «features.items.0.title»)، وما تحفظه الإدارة عبارةٌ بمفتاحها لكلّ لغة. فتُبنى
 * لكلّ لغةٍ نسخةٌ من ملفّها وفيها ما غُيِّر، فيقرؤه كلّ `t()` كما هو: لا مكوّن
 * يعرف أنّ نصّه قد تغيّر.
 *
 * ولا يُستبدل إلّا نصٌّ موجود: مفتاحٌ لا يعرفه ملفّ الترجمة، أو يدلّ على
 * قائمةٍ لا على نصّ، يُترك.
 */

export type TextLang = "ar" | "en" | "fr";
/** عبارات كلّ لغة بمفاتيحها، وما أُخفي من الموقع (للّغات كلّها — site-visibility). */
export type SiteTexts = Record<TextLang, Record<string, string>> & { hidden: string[] };

export const EMPTY_SITE_TEXTS: SiteTexts = { ar: {}, fr: {}, en: {}, hidden: [] };

type Tree = Record<string, unknown>;

/** ملفّات الترجمة كما هي — الأصل الذي يعود إليه كلّ نصٍّ يُمسح. */
export const DEFAULT_TEXTS: Record<TextLang, Tree> = { ar, en, fr };

export const TEXT_LANGS: TextLang[] = ["ar", "fr", "en"];

const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const CACHE_KEY = "mudhakkarati:site-texts";

/** النصّ الافتراضيّ بمفتاحه — أو undefined إن لم يكن المفتاح نصّاً. */
export function defaultText(lang: TextLang, key: string): string | undefined {
  let node: unknown = DEFAULT_TEXTS[lang];
  for (const seg of key.split(".")) {
    if (FORBIDDEN.has(seg) || node === null || typeof node !== "object") return undefined;
    node = (node as Tree)[seg];
  }
  return typeof node === "string" ? node : undefined;
}

/** نسخةٌ من ملفّ اللغة وفيها عبارات الإدارة مكان نصوصها. */
export function withOverrides(lang: TextLang, overrides?: Record<string, string>): Tree {
  const bundle = JSON.parse(JSON.stringify(DEFAULT_TEXTS[lang])) as Tree;
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value !== "string" || !value.trim() || defaultText(lang, key) === undefined) continue;
    const segs = key.split(".");
    let node = bundle;
    for (const seg of segs.slice(0, -1)) node = node[seg] as Tree;
    node[segs[segs.length - 1]!] = value;
  }
  return bundle;
}

const isTextMap = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string");

/** ما يصلح نصوصاً للموقع — ممّا جاء من الخادم أو من ذاكرة المتصفّح. */
export function asSiteTexts(v: unknown): SiteTexts | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const hidden = o.hidden ?? [];
  if (!Array.isArray(hidden) || !hidden.every((x) => typeof x === "string")) return null;
  const out = { hidden: [...hidden] } as SiteTexts;
  for (const lang of TEXT_LANGS) {
    const m = o[lang] ?? {};
    if (!isTextMap(m)) return null;
    out[lang] = m;
  }
  return out;
}

/**
 * آخر ما عُرف منها، محفوظاً في المتصفّح — ليُرسم أوّل ما يُرسم بعبارات
 * الإدارة لا بالنصّ الافتراضيّ ثم يتبدّل أمام الزائر.
 */
export function readCachedTexts(): SiteTexts | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? asSiteTexts(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function cacheTexts(texts: SiteTexts) {
  try {
    const empty = !texts.hidden.length && TEXT_LANGS.every((l) => Object.keys(texts[l]).length === 0);
    if (empty) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(texts));
  } catch {
    // ذاكرةٌ ممتلئة أو محجوبة: تُقرأ النصوص من الخادم في كلّ زيارة.
  }
}

/** رابطٌ آمن من نصٍّ غيّرته الإدارة: http(s) وحده، وإلّا لا رابط. */
export function safeHttpUrl(v: string): string | undefined {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** بريدٌ يصلح لرابط `mailto:` — وإلّا يُعرض نصّاً بلا رابط. */
export const looksLikeEmail = (v: string) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v);

/** ما حُفظ في المتصفّح عند تحميل الصفحة — لأوّل رسمٍ بالنصوص والإخفاء معاً. */
export const cachedTexts = readCachedTexts();
