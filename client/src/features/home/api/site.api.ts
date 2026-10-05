import { client } from "../../../lib/api/client";
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

  getDirectorMessage: () =>
    client
      .get<PublicDirectorMessage>("/site/director-message")
      .then((r) => r.data),
};
