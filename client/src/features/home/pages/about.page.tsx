import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  BellRing,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Milestone,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useAuth } from "../../../hooks/use-auth";
import { LocaleLink } from "../../../i18n/locales/components/locale-link";
import { PATHS } from "../../../routes/paths";
import { useAboutPage, useHomeSlides } from "../hooks/site-hook";
import { defaultAboutPage, resolveAbout } from "../lib/site-content";
import type { AboutBlock, PublicHomeSlide, SiteLang } from "../../../types/site.types";
import { Reveal } from "../components/reveal";
import { AboutHeroVisual } from "../components/about/about-hero-visual";
import { SlideBackdrop } from "../components/slide-backdrop";
import { CountUp } from "../components/about/count-up";
import { Ornament, SectionHeading, StarPattern } from "../components/about/about-ornaments";

/** أيقونات المزايا بالدور — تكتب الإدارة النصّ، والشكل من المنصّة. */
const FEATURE_ICONS = [ListChecks, UsersRound, Milestone, CalendarCheck, BellRing, FileCheck2, ShieldCheck, LayoutDashboard];

/** «01»، «02»… — رقم الميزة بخطٍّ كبيرٍ خافت. */
const ordinal = (i: number) => String(i + 1).padStart(2, "0");

/**
 * «عن المنصة» — تعريفٌ بالمنصّة للزائر: ما هي، وأرقامها، وصورٌ منها، وما تقدّمه.
 *
 * والصور في رأس الصفحة نفسه، ساحةً تتعاقب فيها: صور «عن المنصة» إن أضافتها
 * الإدارة، وإلّا صور الصفحة الرئيسية — فلا يبقى نصف الرأس شعاراً ما دامت في
 * المنصّة صورةٌ واحدة.
 *
 * كلّ نصوصها وصورها من «واجهة الموقع» في لوحة الإدارة؛ وما لم تحفظ الإدارة
 * شيئاً بعد، تُعرض نصوصها الافتراضية. وكلّ قسمٍ فارغٍ يُطوى: معرضٌ بلا صور
 * أو مزايا بلا عناصر لا تُرسم عناوينها وحدها.
 *
 * والهيئة على لغة الصفحة الرئيسية — أخضر العلامة وذهبها وخطّها المزخرف —
 * مع نقشٍ هندسيٍّ خافت على الأقسام الداكنة، وفواصل ذهبيةٍ تحت العناوين.
 */
export function AboutPage() {
  const { currentLang } = useLanguage();
  const { data: content, isLoading, isError } = useAboutPage();
  const { data: aboutSlides = [] } = useHomeSlides("about");
  const { data: homeSlides = [] } = useHomeSlides("home");
  const { data: backdrop = [] } = useHomeSlides("aboutHero");
  const slides = aboutSlides.length ? aboutSlides : homeSlides;

  // الرابط إليها في تذييل الصفحات أيضاً؛ والنافذة تحفظ موضعها بين الصفحات،
  // فكانت تُفتح من أسفلها.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  if (isLoading) return <div className="forest-glow min-h-[80vh]" />;

  const block = resolveAbout((!isError && content) || defaultAboutPage(), currentLang as SiteLang);
  return <AboutContent block={block} slides={slides} backdrop={backdrop} />;
}

function AboutContent({
  block,
  slides,
  backdrop,
}: {
  block: AboutBlock;
  slides: PublicHomeSlide[];
  /** خلفية الرأس — صورٌ تختارها الإدارة، وإلّا الأخضر المزخرف وحده. */
  backdrop: PublicHomeSlide[];
}) {
  const { t } = useTranslation();
  const { dir, isRTL } = useLanguage();
  const { isAuthenticated } = useAuth();
  const Crumb = isRTL ? ChevronLeft : ChevronRight;

  const scrollToIntro = () =>
    document.getElementById("about-intro")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div dir={dir} className="font-body">
      {/* ════════════ الرأس ════════════ */}
      {/* المسافة السفلية تتّسع لشريط الأرقام الراكب على الحافّة — وبلا أرقامٍ لا داعي لها. */}
      <section
        className={`forest-glow relative overflow-hidden px-5 pt-16 lg:px-8 lg:pt-20 ${
          block.stats.length ? "pb-36 lg:pb-44" : "pb-20 lg:pb-24"
        }`}
      >
        {/* الخلفية وأزرارها — في الشريط الفارغ فوق شريط الأرقام الراكب على
            الحافّة، أو في أسفل الرأس إن لم تكن أرقام. */}
        <SlideBackdrop
          slides={backdrop}
          variant="wash"
          controls
          controlsClassName={
            block.stats.length ? "bottom-[6.25rem] end-5 lg:bottom-[7.5rem] lg:end-8" : "bottom-5 end-5 lg:end-8"
          }
        />
        <StarPattern className="text-gold opacity-[0.045]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -end-24 size-96 rounded-full bg-soft-sage/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          {/* النصّ */}
          <div className="text-center lg:text-start">
            <nav
              aria-label="breadcrumb"
              className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-4 py-1.5 text-[12px] text-cream/60 backdrop-blur-sm animate-[riseIn_0.5s_both]"
            >
              <LocaleLink to={PATHS.home} className="transition hover:text-cream">
                {t("common.home")}
              </LocaleLink>
              <Crumb size={12} />
              <span className="text-gold-soft">{block.title}</span>
            </nav>

            <p className="mb-5 flex items-center justify-center gap-3 text-[12px] font-bold uppercase tracking-[0.22em] text-gold-soft animate-[riseIn_0.5s_0.05s_both] lg:justify-start">
              <GraduationCap size={16} />
              {t("hero.badge")}
            </p>

            <h1
              dir="auto"
              className="font-serif text-[2.6rem] font-bold leading-[1.15] text-cream drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] animate-[riseIn_0.6s_0.1s_both] md:text-6xl xl:text-7xl"
            >
              {block.title}
            </h1>

            <span className="mx-auto mt-6 block h-1 w-24 rounded-full bg-linear-to-l from-gold-soft via-gold to-gold/30 animate-[riseIn_0.6s_0.15s_both] lg:mx-0" />

            {block.subtitle && (
              <p
                dir="auto"
                className="mx-auto mt-6 max-w-xl text-base leading-[1.95] text-cream/75 animate-[riseIn_0.6s_0.2s_both] md:text-lg lg:mx-0"
              >
                {block.subtitle}
              </p>
            )}

            <div className="mt-10 flex flex-col items-center gap-3 animate-[riseIn_0.6s_0.25s_both] sm:flex-row sm:justify-center lg:justify-start">
              <button
                type="button"
                onClick={scrollToIntro}
                className="group inline-flex h-12 items-center gap-2.5 rounded-xl bg-linear-to-br from-gold to-gold-soft px-7 text-sm font-bold text-[#1a312d] shadow-lg shadow-gold/25 transition hover:-translate-y-0.5 hover:brightness-105"
              >
                {t("aboutPage.discover")}
                <ArrowDown size={16} className="transition group-hover:translate-y-0.5" />
              </button>
              <LocaleLink
                to={PATHS.topics}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-semibold text-cream transition hover:border-gold/50 hover:bg-white/5"
              >
                <Compass size={16} className="text-gold-soft" />
                {t("hero.ctaPrimary")}
              </LocaleLink>
            </div>
          </div>

          {/* المرئيّ */}
          <AboutHeroVisual slides={slides} stat={block.stats[0]} title={block.galleryTitle} />
        </div>
      </section>

      {/* ════════════ الأرقام — شريطٌ زجاجيّ يركب حافّة الرأس ════════════ */}
      {block.stats.length > 0 && (
        <div className="relative z-10 -mt-20 px-5 lg:-mt-24 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className="rounded-[2rem] bg-linear-to-br from-gold/60 via-gold/15 to-gold/50 p-px shadow-[0_30px_80px_-30px_rgba(22,36,31,0.5)]">
              <div
                className={`grid grid-cols-2 gap-y-8 rounded-[calc(2rem-1px)] bg-cream-card px-6 py-9 ${
                  block.stats.length === 3 ? "md:grid-cols-3" : block.stats.length >= 4 ? "md:grid-cols-4" : ""
                }`}
              >
                {block.stats.map((s, i) => (
                  <div key={i} className="relative flex flex-col items-center px-4 text-center">
                    {i > 0 && (
                      <span className="absolute inset-y-2 start-0 hidden w-px bg-linear-to-b from-transparent via-gold/40 to-transparent md:block" />
                    )}
                    <CountUp
                      value={s.value}
                      className="bg-linear-to-b from-gold-soft to-gold bg-clip-text font-serif text-4xl font-bold leading-none text-transparent md:text-5xl"
                    />
                    <span dir="auto" className="mt-3 text-sm font-semibold text-forest/80">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      )}

      {/* ════════════ ما هي المنصة ════════════ */}
      <section id="about-intro" className="scroll-mt-28 bg-cream px-5 pb-24 pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-gold">{t("aboutPage.eyebrow")}</p>
            <h2 dir="auto" className="font-serif text-3xl font-bold leading-snug text-forest md:text-[2.6rem]">
              {block.introTitle}
            </h2>
            <Ornament className="mt-5" />
          </Reveal>

          <div className="mt-10 space-y-6">
            {block.intro.map((p, i) => (
              <Reveal key={i} delay={i * 120}>
                <p
                  dir="auto"
                  className={`whitespace-pre-line ${
                    i === 0
                      ? "font-serif text-xl leading-[1.9] text-forest md:text-[1.4rem]"
                      : "text-[15.5px] leading-[2] text-clay"
                  }`}
                >
                  {p}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ ما تقدّمه المنصة ════════════ */}
      {block.features.length > 0 && (
        <section className="relative bg-cream-2 px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {block.featuresTitle && (
              <SectionHeading eyebrow={t("aboutPage.featuresEyebrow")} title={block.featuresTitle} />
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {block.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
                return (
                  <Reveal key={i} delay={(i % 3) * 110} className="h-full">
                    <article className="group relative h-full overflow-hidden rounded-3xl border border-forest/10 bg-cream-card p-8 transition duration-500 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_30px_70px_-30px_rgba(193,150,90,0.45)]">
                      {/* شريطٌ ذهبيّ يمتدّ أعلى البطاقة عند المرور */}
                      <span className="absolute inset-x-8 top-0 h-[3px] scale-x-0 rounded-b-full bg-linear-to-r from-gold/0 via-gold to-gold/0 transition-transform duration-500 group-hover:scale-x-100" />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-3 end-5 font-serif text-[5.5rem] font-bold leading-none text-forest/[0.06] transition-colors duration-500 group-hover:text-gold/20"
                      >
                        {ordinal(i)}
                      </span>

                      <div className="forest-glow relative mb-7 grid size-14 place-items-center rounded-2xl text-gold-soft shadow-lg ring-1 ring-gold/30 transition duration-500 group-hover:-rotate-6 group-hover:scale-105">
                        <Icon size={24} strokeWidth={1.7} />
                      </div>
                      <h3 dir="auto" className="relative mb-3 font-serif text-xl font-bold text-forest">
                        {f.title}
                      </h3>
                      {f.desc && (
                        <p dir="auto" className="relative text-[14.5px] leading-[1.9] text-clay">
                          {f.desc}
                        </p>
                      )}
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ════════════ دعوة ════════════ */}
      <section className="bg-cream px-5 py-24 lg:px-8">
        <Reveal className="mx-auto max-w-5xl">
          <div className="rounded-[2.25rem] bg-linear-to-br from-gold/80 via-gold/20 to-gold/70 p-px shadow-[0_40px_100px_-35px_rgba(22,36,31,0.6)]">
            <div className="forest-glow relative overflow-hidden rounded-[calc(2.25rem-1px)] px-6 py-16 text-center sm:px-12">
              <StarPattern className="text-gold opacity-[0.05]" />
              <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />

              <div className="relative">
                <span className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-linear-to-br from-gold to-gold-soft shadow-lg shadow-gold/30">
                  <GraduationCap size={30} className="text-[#1a312d]" strokeWidth={1.6} />
                </span>
                <h2 className="font-serif text-3xl font-bold text-cream md:text-4xl">{t("aboutPage.ctaTitle")}</h2>
                <Ornament className="mt-5" />
                <p className="mx-auto mt-6 max-w-xl text-[15.5px] leading-relaxed text-cream/70">{t("aboutPage.ctaDesc")}</p>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <LocaleLink
                    to={PATHS.topics}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-7 text-sm font-bold text-[#1a312d] shadow-lg shadow-gold/25 transition hover:-translate-y-0.5 hover:brightness-105"
                  >
                    <Compass size={17} />
                    {t("hero.ctaPrimary")}
                  </LocaleLink>
                  <LocaleLink
                    to={isAuthenticated ? PATHS.dashboard : PATHS.login}
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-7 text-sm font-semibold text-cream transition hover:border-gold/50 hover:bg-white/5"
                  >
                    {isAuthenticated ? <LayoutDashboard size={17} /> : <LogIn size={17} />}
                    {isAuthenticated ? t("aboutPage.ctaDashboard") : t("aboutPage.ctaLogin")}
                  </LocaleLink>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
