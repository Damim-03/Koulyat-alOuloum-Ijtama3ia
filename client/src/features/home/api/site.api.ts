import { client } from "../../../lib/api/client";
import { EMPTY_SITE_TEXTS, asSiteTexts, type SiteTexts } from "../../../i18n/site-texts";
import type {
  AboutPage,
  LoginContent,
  PublicDirectorMessage,
  PublicHomeSlide,
  PublicNewsItem,
  SlidePlacement,
} from "../../../types/site.types";

/** واجهة الموقع للزائر — بلا تسجيل دخول. */
export const siteApi = {
  listHomeSlides: (placement: SlidePlacement = "home") =>
    client
      .get<{ slides: PublicHomeSlide[] }>("/site/home-slides", { params: { placement } })
      .then((r) => r.data.slides),

  getAboutPage: () =>
    client
      .get<{ content: AboutPage | null }>("/site/about-page")
      .then((r) => r.data.content),

  getLoginPage: () =>
    client
      .get<{ content: LoginContent | null }>("/site/login-page")
      .then((r) => r.data.content),

  listNews: () =>
    client.get<{ news: PublicNewsItem[] }>("/site/news").then((r) => r.data.news),

  /** عبارات الإدارة مكان نصوص الواجهة — ولا شيء إن جاء ما لا يصلح. */
  getTexts: () =>
    client
      .get<{ texts: SiteTexts }>("/site/texts")
      .then((r) => asSiteTexts(r.data.texts) ?? EMPTY_SITE_TEXTS),

  getDirectorMessage: () =>
    client
      .get<PublicDirectorMessage>("/site/director-message")
      .then((r) => r.data),
};
