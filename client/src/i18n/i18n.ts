import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

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
i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: detectLangFromURL(),
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false }, // React already escapes
  react: { useSuspense: false },
});

export default i18n;
