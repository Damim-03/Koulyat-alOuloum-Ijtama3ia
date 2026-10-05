import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  Images,
  Info,
  LayoutTemplate,
  LogIn,
  Newspaper,
  Quote,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAdminHomeSlides } from "../../hooks/home-slides-hook";
import { useAdminDirectorMessage, useAdminNews } from "../../hooks/site-content-hook";
import { useLanguage } from "../../../../hooks/use-language";
import { SlidesPanel } from "./slides-panel";
import { NewsPanel } from "./news-panel";
import { DirectorPanel } from "./director-panel";
import { AboutPanel } from "./about-panel";
import { LoginPanel } from "./login-panel";

type Tab = "slides" | "news" | "director" | "about" | "login";
const TABS: Tab[] = ["slides", "news", "director", "about", "login"];

/**
 * واجهة الموقع — كلّ ما يراه الزائر أوّلاً، من مكانٍ واحد: الصور المتعاقبة
 * خلف العنوان، وشريط آخر الأخبار، وكلمة رئيس القسم، وصفحة «عن المنصة»،
 * وخلفية لوحة الترحيب في صفحة الدخول.
 *
 * والتبويب في الرابط (`?tab=news`)، فيُفتح من حيث تُرك ويُشارَك. والتبويب
 * الذي زير يبقى مرسوماً مخفيّاً لا يُهدم: نصٌّ في «كلمة رئيس القسم» لم يُحفظ
 * لا يضيع بالانتقال إلى الأخبار والعودة.
 */
export function AdminHomepagePage() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "slides";
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set([tab]));
  // والتبويب الحاليّ مرسومٌ دائماً — ولو جاء من رابطٍ أو من زرّ «رجوع».
  const mounted = (x: Tab) => x === tab || seen.has(x);

  const { data: slides } = useAdminHomeSlides();
  const { data: news } = useAdminNews();
  const { data: director } = useAdminDirectorMessage();
  const { data: loginSlides } = useAdminHomeSlides("login");

  function select(next: Tab) {
    setSeen((s) => (s.has(next) ? s : new Set(s).add(next)));
    const params = new URLSearchParams(sp);
    if (next === "slides") params.delete("tab");
    else params.set("tab", next);
    // الجزء (نصوص / صور) يخصّ تبويبه؛ والتبويب الجديد يُفتح على أوّل أجزائه.
    if (next !== tab) params.delete("part");
    setSp(params, { replace: true });
  }

  const tabs: { id: Tab; icon: LucideIcon; label: string; badge?: string }[] = [
    {
      id: "slides",
      icon: Images,
      label: t("admin.site.tabSlides"),
      badge: slides ? String(slides.filter((s) => s.isActive).length) : undefined,
    },
    {
      id: "news",
      icon: Newspaper,
      label: t("admin.site.tabNews"),
      badge: news ? String(news.filter((n) => n.isActive).length) : undefined,
    },
    {
      id: "director",
      icon: Quote,
      label: t("admin.site.tabDirector"),
      badge: director === undefined ? undefined : director && !director.isVisible ? t("admin.site.hiddenBadge") : undefined,
    },
    { id: "about", icon: Info, label: t("admin.site.tabAbout") },
    {
      id: "login",
      icon: LogIn,
      label: t("admin.site.tabLogin"),
      badge: loginSlides ? String(loginSlides.filter((s) => s.isActive).length) : undefined,
    },
  ];

  return (
    <div className="font-body">
      {/* ── hero ── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-6 pt-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
                <LayoutTemplate size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.site.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">{t("admin.site.title")}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.site.subtitle")}</p>
              </div>
            </div>
            <a
              href={localePath("/")}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-cream/10 px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream/20"
            >
              <ExternalLink size={16} className="text-gold-soft" />
              {t("admin.slides.openHome")}
            </a>
          </div>

          {/* التبويبات — على حافّة الرأس */}
          <div role="tablist" className="-mx-1 mt-6 flex gap-1 overflow-x-auto pb-0">
            {tabs.map((x) => {
              const active = tab === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(x.id)}
                  className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-cream text-forest" : "text-cream/75 hover:bg-cream/10 hover:text-cream"
                  }`}
                >
                  <x.icon size={16} className={active ? "text-gold" : "text-gold-soft"} />
                  {x.label}
                  {x.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums ${
                        active ? "bg-gold/15 text-gold" : "bg-cream/15 text-cream"
                      }`}
                    >
                      {x.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* كلّ تبويبٍ زير يبقى مرسوماً، والظاهر واحد. */}
      {mounted("slides") && (
        <div role="tabpanel" hidden={tab !== "slides"}>
          <SlidesPanel />
        </div>
      )}
      {mounted("news") && (
        <div role="tabpanel" hidden={tab !== "news"}>
          <NewsPanel />
        </div>
      )}
      {mounted("director") && (
        <div role="tabpanel" hidden={tab !== "director"}>
          <DirectorPanel />
        </div>
      )}
      {mounted("about") && (
        <div role="tabpanel" hidden={tab !== "about"}>
          <AboutPanel />
        </div>
      )}
      {mounted("login") && (
        <div role="tabpanel" hidden={tab !== "login"}>
          <LoginPanel />
        </div>
      )}
    </div>
  );
}
