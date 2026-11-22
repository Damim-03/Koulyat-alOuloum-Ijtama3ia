import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { setNameLanguage } from "../lib/person-name";

import {
  EMPTY_SITE_TEXTS,
  TEXT_LANGS,
  cacheTexts,
  cachedTexts as cached,
  withOverrides,
  type SiteTexts,
} from "./site-texts";
import { setHidden } from "./site-visibility";

// ── Supported languages ──
export const LANGUAGES = [
  { code: "ar", label: "العربية", labelShort: "AR", dir: "rtl" },
  { code: "en", label: "English", labelShort: "EN", dir: "ltr" },
  { code: "fr", label: "Français", labelShort: "FR", dir: "ltr" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export const DEFAULT_LANG: LangCode = "ar";
export const SUPPORTED_LANGS: LangCode[] = LANGUAGES.map((l) => l.code);

// ── Detect language from URL: /ar/... , /en/... , /fr/... ──
function detectLangFromURL(): LangCode {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  if (first && SUPPORTED_LANGS.includes(first as LangCode)) {
    return first as LangCode;
  }
  return DEFAULT_LANG;
}

// ── Direction for a language ──
export function getLangDir(lang: LangCode): "rtl" | "ltr" {
  return LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
}

// ── Init ──
// People's names follow the interface's script (Latin in French and English).
// Registered before init, which announces the first language too; and before
// react-i18next's own listener, so names are current when components re-render.
i18n.on("languageChanged", setNameLanguage);
//
// The admin's wording (واجهة الموقع ← النصوص) replaces the default texts by
// key. The last known set is cached in the browser so the first paint already
// shows it; the server's copy then refreshes it (applySiteTexts).
i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: withOverrides("ar", cached?.ar) },
    en: { translation: withOverrides("en", cached?.en) },
    fr: { translation: withOverrides("fr", cached?.fr) },
  },
  lng: detectLangFromURL(),
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false }, // React already escapes
  // Re-render on "added" too: that is how new wording reaches open screens.
  react: { useSuspense: false, bindI18nStore: "added" },
});

/** The wording alone — hiding something changes no text, so re-renders nothing here. */
const wording = (texts: Omit<SiteTexts, "hidden">) => JSON.stringify(TEXT_LANGS.map((l) => texts[l]));
let applied = wording(cached ?? EMPTY_SITE_TEXTS);

/**
 * Puts the admin's wording in place everywhere at once — every `t()` reads
 * it on the next render. Unchanged wording does nothing (no re-render).
 */
export function applySiteTexts(texts: SiteTexts) {
  cacheTexts(texts);
  setHidden(texts.hidden);
  const next = wording(texts);
  if (next === applied) return;
  applied = next;
  // The others quietly, the language on screen last and aloud: its "added"
  // event is what re-renders open screens — once, not three times.
  const current = TEXT_LANGS.find((l) => l === i18n.language) ?? DEFAULT_LANG;
  const order = [...TEXT_LANGS.filter((l) => l !== current), current];
  for (const lang of order)
    i18n.addResourceBundle(lang, "translation", withOverrides(lang, texts[lang]), false, true, {
      silent: lang !== current,
      skipCopy: true,
    });
}

export default i18n;
