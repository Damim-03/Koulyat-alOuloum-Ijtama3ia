import { useTranslation } from "react-i18next";
import { GraduationCap, Compass, BookOpen } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { LocaleLink } from "../../../i18n/locales/components/locale-link";
import { PATHS } from "../../../routes/paths";

export function Hero() {
  const { t } = useTranslation();
  const { dir } = useLanguage();

  return (
    <section
      id="home"
      dir={dir}
      className="forest-glow relative overflow-hidden border-b border-forest-deep px-5 py-28 font-body lg:px-8"
    >
      <div className="dot-matrix absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full border border-soft-sage/10 bg-soft-sage/3 backdrop-blur-sm" />
      <div className="pointer-events-none absolute -left-12 bottom-8 size-64 rounded-full border border-gold/10 bg-gold/4 backdrop-blur-sm" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-forest-deep/40 px-4 py-2 text-[12.5px] font-medium text-gold-soft animate-[riseIn_0.5s_both]">
          <GraduationCap size={15} />
          {t("hero.badge")}
        </div>

        <h1 className="mb-3 font-serif text-4xl font-bold leading-[1.2] text-cream md:text-6xl animate-[riseIn_0.5s_0.05s_both]">
          {t("hero.title")}
        </h1>

        <p className="mb-5 font-serif text-lg text-soft-sage md:text-2xl animate-[riseIn_0.5s_0.1s_both]">
          {t("hero.subtitle")}
        </p>

        <p className="mb-9 max-w-2xl text-[15px] leading-[1.9] text-cream/55 animate-[riseIn_0.5s_0.15s_both]">
          {t("hero.desc")}
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row animate-[riseIn_0.5s_0.2s_both]">
          <a href="#features" className="flex h-12 items-center justify-center
            gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-7
            text-sm font-bold text-forest-deep shadow-lg shadow-gold/20
            transition hover:-translate-y-0.5 hover:brightness-105"
          >
            <Compass size={17} />
            {t("hero.ctaPrimary")}
          </a>
          <LocaleLink
            to={PATHS.login}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-cream/15 px-7 text-sm font-semibold text-cream transition hover:bg-white/5"
          >
            <BookOpen size={17} />
            {t("hero.ctaSecondary")}
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}
