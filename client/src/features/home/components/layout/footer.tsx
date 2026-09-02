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

// ── Brand logos shown next to the name (right side, with a divider).
// Add your seal/logo image URLs here to show them like the reference footer.
// Leave empty to show only the gold graduation mark. e.g.:
//   { src: "/logos/univ-eloued.png", alt: "جامعة الوادي" },
const LOGOS: { src: string; alt: string }[] = [];

interface OfficialLink {
  label: string;
  url: string;
}

export function Footer() {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const official = t("officialLinks", {
    returnObjects: true,
  }) as OfficialLink[];

  const QUICK = [
    { to: PATHS.home, label: t("common.home") },
    { to: PATHS.topics, label: t("common.topics") },
    { to: PATHS.about, label: t("common.about") },
  ];

  const SOCIALS = [
    { icon: Mail, href: "mailto:contact@univ-eloued.dz", label: "Email" },
  ];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer dir={dir} className="relative font-body">
      <div className="relative overflow-hidden bg-forest-deep text-cream">
        {/* The wave is painted in the *page* colour so its top edge meets the
            section above with no seam. It must not use `text-cream`: that is
            pinned light for text on the brand chrome, which would leave a
            bright band across the top of the footer in dark mode. */}
        <svg
          className="page-fill pointer-events-none absolute inset-x-0 top-0 h-12 w-full sm:h-16"
          viewBox="0 0 1440 64"
          fill="currentColor"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,40 C240,8 480,8 720,32 C960,56 1200,56 1440,24 L1440,0 L0,0 Z" />
        </svg>

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
          style={{ backgroundImage: NOISE }}
        />
        <div className="pointer-events-none absolute right-[5%] top-10 size-72 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute bottom-20 left-[8%] size-48 rounded-full border border-white/5" />

        <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-20 lg:px-8 lg:pt-24">
          {/* brand (right) + back to top (left) */}
          <div className="mb-12 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* marks: gold graduation cap + optional logos with divider */}
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-lg shadow-gold/20">
                  <GraduationCap size={24} />
                </div>
                {LOGOS.map((lg) => (
                  <span key={lg.src} className="flex items-center gap-3">
                    <span className="h-9 w-px bg-white/15" />
                    <img
                      src={lg.src}
                      alt={lg.alt}
                      className="h-11 w-auto object-contain"
                    />
                  </span>
                ))}
              </div>
              {/* name + subtitle */}
              <div className="text-start">
                <p className="font-serif text-[15px] font-bold leading-tight text-cream">
                  {t("brand.name")}
                </p>
                <p className="mt-0.5 text-[11.5px] text-soft-sage">
                  {t("brand.system")}
                </p>
              </div>
            </div>

            <button
              onClick={scrollTop}
              className="group flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-cream/60 transition hover:border-white/30 hover:bg-white/5 hover:text-cream"
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
            {/* about + socials */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.about")}
              </h3>
              <p className="mb-5 text-[13px] leading-relaxed text-cream/60">
                {t("footer.aboutDesc")}
              </p>
              <div className="flex items-center gap-2">
                {SOCIALS.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/8 text-cream/55 transition hover:border-gold/40 hover:bg-gold/15 hover:text-gold"
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            </div>

            {/* quick links */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.quickLinks")}
              </h3>
              <ul className="space-y-2.5">
                {QUICK.map((l) => (
                  <li key={l.label}>
                    <LocaleLink
                      to={l.to}
                      className="group flex items-center gap-2 text-[13px] text-cream/60 transition hover:text-cream"
                    >
                      <span className="size-1 rounded-full bg-cream/30 transition group-hover:bg-gold" />
                      <span className="relative">
                        {l.label}
                        <span className="absolute -bottom-1 left-0 h-[1.5px] w-full origin-center scale-x-0 rounded-full bg-gold transition-all duration-300 ease-out group-hover:scale-x-100" />
                      </span>
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* official platforms */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.official")}
              </h3>
              <div className="space-y-2">
                {official.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12.5px] text-cream/55 transition hover:text-gold"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            {/* contact */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <span className="h-4 w-1 rounded-full bg-gold" />
                {t("footer.contact")}
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/8">
                    <MapPin size={14} className="text-gold/80" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-cream/65">
                    {t("footer.address")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8">
                    <Phone size={14} className="text-gold/80" />
                  </div>
                  <p dir="ltr" className="text-[13px] text-cream/65">
                    +213 32 12 34 56
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8">
                    <Mail size={14} className="text-gold/80" />
                  </div>
                  <a
                    href="mailto:contact@univ-eloued.dz"
                    dir="ltr"
                    className="text-[13px] text-cream/65 transition hover:text-gold"
                  >
                    contact@univ-eloued.dz
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* bottom bar: copyright (right) · credit (center) · language (left) */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="order-2 text-center text-[11px] text-cream/45 sm:order-1 sm:text-start">
                © {new Date().getFullYear()} {t("brand.name")} —{" "}
                {t("footer.rights")}
              </p>
              <p className="order-3 text-[11px] text-cream/35 sm:order-2">
                {t("footer.madeWith")}
              </p>
              <div className="order-1 sm:order-3">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
