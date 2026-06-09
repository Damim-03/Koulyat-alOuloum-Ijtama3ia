// ── i18n System ──
// Import this file once in your app entry (main.tsx) to initialize i18n.
export { default as i18n } from "./i18n";
export {
  LANGUAGES,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  getLangDir,
  type LangCode,
} from "./i18n";

// ── Hooks ──
export { useLanguage } from "../hooks/use-language";

// ── Components ──
export { LanguageLayout } from "./locales/components/language-layout";
export { LanguageSwitcher } from "./locales/components/language-switcher";
export { LocaleLink } from "./locales/components/locale-link";