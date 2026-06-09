import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LANGUAGES,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  getLangDir,
  type LangCode,
} from "../i18n/i18n";

export function useLanguage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // المصدر الحقيقي للّغة = أول جزء في الرابط
  const segments = location.pathname.split("/").filter(Boolean);
  const langInUrl = SUPPORTED_LANGS.includes(segments[0] as LangCode)
    ? (segments[0] as LangCode)
    : DEFAULT_LANG;

  const currentLang = langInUrl;
  const dir = getLangDir(currentLang);

  const localePath = (to: string) => {
    const clean = to.startsWith("/") ? to : `/${to}`;
    return `/${currentLang}${clean === "/" ? "" : clean}`;
  };

  const switchLanguage = (next: LangCode) => {
    // ابنِ المسار الجديد من الرابط الحالي
    const segs = location.pathname.split("/").filter(Boolean);
    if (SUPPORTED_LANGS.includes(segs[0] as LangCode)) {
      segs[0] = next; // استبدل اللغة
    } else {
      segs.unshift(next); // أضف اللغة
    }
    const newPath = "/" + segs.join("/") + location.search + location.hash;

    i18n.changeLanguage(next);
    navigate(newPath, { replace: true });
  };

  return {
    t,
    currentLang,
    languages: LANGUAGES,
    dir,
    isRTL: dir === "rtl",
    localePath,
    switchLanguage,
  };
}
