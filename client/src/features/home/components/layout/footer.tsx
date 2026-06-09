import { useTranslation } from "react-i18next";
import {
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  ChevronUp,
  GraduationCap,
} from "lucide-react";
import { useLanguage } from "../../../../hooks/use-language";
import { LocaleLink } from "../../../../i18n/locales/components/locale-link";
import { LanguageSwitcher } from "../../../../i18n/locales/components/language-switcher";
import { PATHS } from "../../../../routes/paths";

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

interface OfficialLink {
  label: string;
  url: string;
}

export function Footer() {
  const { t } = useTranslation();
  const { dir, isRTL } = useLanguage();
  const official = t("officialLinks", {
    returnObjects: true,
  }) as OfficialLink[];

  const QUICK = [
    { to: PATHS.home, label: t("common.home") },
    { href: "#features", label: t("common.topics") },
    { href: "#stats", label: t("common.about") },
  ];

  const SOCIALS = [{ icon: Mail, href: "mailto:contact@univ-eloued.dz" }];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer dir={dir} className="relative font-body">
      {/* Wave divider */}
      <div className="relative h-16 overflow-hidden bg-cream">
        <svg
          className="absolute bottom-0 w-full text-forest-deep"
          viewBox="0 0 1440 64"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0,32 C360,64 720,0 1080,32 C1260,48 1380,56 1440,56 L1440,64 L0,64 Z" />
        </svg>
      </div>

      <div className="relative overflow-hidden bg-forest-deep text-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-soft-light"
          style={{ backgroundImage: NOISE }}
        />
        <div className="pointer-events-none absolute right-[5%] top-10 size-72 rounded-full border border-white/[0.03]" />
        <div className="pointer-events-none absolute bottom-20 left-[8%] size-48 rounded-full border border-white/[0.02]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-14 lg:px-8">
          <div className="mb-12 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-soft text-forest-deep shadow-lg shadow-gold/20">
                <GraduationCap size={24} />
              </div>
              <div className={isRTL ? "mr-1" : "ml-1"}>
                <p className="text-sm font-bold text-cream">
                  {t("brand.name")}
                </p>
                <p className="mt-0.5 text-[11px] text-soft-sage">
                  {t("brand.system")}
                </p>
              </div>
            </div>
            <button
              onClick={scrollTop}
              className="group flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-cream/40 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-cream"
              aria-label={t("common.backToTop")}
            >
              <span className="hidden text-[11px] font-medium sm:inline">
                {t("common.backToTop")}
              </span>
              <ChevronUp
                size={14}
                className="transition-transform group-hover:-translate-y-0.5"
              />
            </button>
          </div>

          <div className="mb-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.about")}
              </h3>
              <p className="mb-5 text-[13px] leading-relaxed text-cream/35">
                {t("footer.aboutDesc")}
              </p>
              <div className="flex items-center gap-2">
                {SOCIALS.map(({ icon: Icon, href }, i) => (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.06] text-cream/30 transition hover:border-white/[0.12] hover:bg-white/[0.1] hover:text-cream"
                  >
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.quickLinks")}
              </h3>
              <ul className="space-y-2">
                {QUICK.map((l) => {
                  const inner = (
                    <>
                      <span className="size-1 rounded-full bg-cream/15 transition group-hover:bg-gold" />
                      {l.label}
                    </>
                  );
                  return (
                    <li key={l.label}>
                      {l.to ? (
                        <LocaleLink
                          to={l.to}
                          className="group flex items-center gap-2 text-[13px] text-cream/35 transition hover:text-cream"
                        >
                          {inner}
                        </LocaleLink>
                      ) : (
                        <a
                          href={l.href}
                          className="group flex items-center gap-2 text-[13px] text-cream/35 transition hover:text-cream"
                        >
                          {inner}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("common.about")}
              </h3>
              <LanguageSwitcher />
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/20">
                  {t("footer.official")}
                </p>
                {official.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-1.5 flex items-center gap-1.5 text-[12px] text-cream/25 transition hover:text-gold"
                  >
                    <ExternalLink size={10} className="shrink-0" />
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.contact")}
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
                    <MapPin size={14} className="text-gold/60" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-cream/50">
                    {t("footer.address")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
                    <Phone size={14} className="text-gold/60" />
                  </div>
                  <p dir="ltr" className="text-[13px] text-cream/50">
                    +213 32 12 34 56
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
                    <Mail size={14} className="text-gold/60" />
                  </div>
                  <a
                    href="mailto:contact@univ-eloued.dz"
                    dir="ltr"
                    className="text-[13px] text-cream/50 transition hover:text-gold"
                  >
                    contact@univ-eloued.dz
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-6">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-center text-[11px] text-cream/20 sm:text-start">
                © {new Date().getFullYear()} {t("brand.name")} —{" "}
                {t("footer.rights")}
              </p>
              <p className="text-[10px] text-cream/15">
                {t("footer.madeWith")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
