import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { applySiteTexts } from "../../../i18n/i18n";
import { siteApi } from "../api/site.api";
import type { SlidePlacement } from "../../../types/site.types";

/**
 * مفاتيح تحمل اسم المورد كما يسمّيه الخادم («home-slides»، «news»،
 * «director-message») عمداً: البثّ الحيّ يُبطل كلّ استعلامٍ فيه اسم المورد،
 * فتعديلُ الإدارة يصل إلى صفحةٍ رئيسية مفتوحة لمن سجّل دخوله.
 */
/** بادئةٌ تشمل الموضعين؛ ولكلّ موضعٍ مفتاحه تحتها. */
export const HOME_SLIDES_KEY = ["site", "home-slides"] as const;
export const SITE_NEWS_KEY = ["site", "news"] as const;
export const SITE_DIRECTOR_KEY = ["site", "director-message"] as const;
export const SITE_ABOUT_KEY = ["site", "about-page"] as const;
export const SITE_LOGIN_KEY = ["site", "login-page"] as const;
/** «site-texts» كما يسمّيه مسار الإدارة — فيصل حفظها حيّاً إلى كلّ شاشةٍ مفتوحة. */
export const SITE_TEXTS_KEY = ["site", "site-texts"] as const;

// المحتوى يتغيّر نادراً، ولا يُعاد تحميله في كلّ رجوعٍ إلى الصفحة.
const STALE = 5 * 60 * 1000;

export function useHomeSlides(placement: SlidePlacement = "home") {
  return useQuery({
    queryKey: [...HOME_SLIDES_KEY, placement],
    queryFn: () => siteApi.listHomeSlides(placement),
    staleTime: STALE,
    retry: 1,
  });
}

export function useSiteNews() {
  return useQuery({
    queryKey: SITE_NEWS_KEY,
    queryFn: siteApi.listNews,
    staleTime: STALE,
    retry: 1,
  });
}

export function useSiteDirectorMessage() {
  return useQuery({
    queryKey: SITE_DIRECTOR_KEY,
    queryFn: siteApi.getDirectorMessage,
    staleTime: STALE,
    retry: 1,
  });
}

export function useAboutPage() {
  return useQuery({
    queryKey: SITE_ABOUT_KEY,
    queryFn: siteApi.getAboutPage,
    staleTime: STALE,
    retry: 1,
  });
}

export function useLoginContent() {
  return useQuery({
    queryKey: SITE_LOGIN_KEY,
    queryFn: siteApi.getLoginPage,
    staleTime: STALE,
    retry: 1,
  });
}

/**
 * عبارات الإدارة في الواجهة كلّها — مرّةً في جذر التطبيق. وما حُفظ منها في
 * المتصفّح يُرسم أوّلاً، ثم يُحدَّث بما يردّه الخادم.
 */
export function useSiteTextsSync() {
  const { data } = useQuery({
    queryKey: SITE_TEXTS_KEY,
    queryFn: siteApi.getTexts,
    staleTime: STALE,
    retry: 1,
  });
  useEffect(() => {
    if (data) applySiteTexts(data);
  }, [data]);
}
