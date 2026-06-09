import { useEffect } from "react";
import { useParams, Outlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  getLangDir,
  type LangCode,
} from "../../i18n";

// Reads :lang from the URL, syncs i18n + <html lang/dir>,
// and redirects invalid language codes to the default.
export function LanguageLayout() {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();

  const isValid = lang && SUPPORTED_LANGS.includes(lang as LangCode);

  useEffect(() => {
    if (!isValid) return;
    const langCode = lang as LangCode;
    if (i18n.language !== langCode) i18n.changeLanguage(langCode);
    document.documentElement.lang = langCode;
    document.documentElement.dir = getLangDir(langCode);
  }, [lang, isValid, i18n]);

  if (!isValid) return <Navigate to={`/${DEFAULT_LANG}`} replace />;
  return <Outlet />;
}