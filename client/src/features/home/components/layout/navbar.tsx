import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  User,
  LogIn,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../../../hooks/use-auth";
import { useLanguage } from "../../../../hooks/use-language";
import { LocaleLink } from "../../../../i18n/locales/components/locale-link";
import { LanguageSwitcher } from "../../../../i18n/locales/components/language-switcher";
import { PATHS } from "../../../../routes/paths";

// ┌─────────────────────────────────────────────────────────┐
// │  ضع صور اللوغو هنا:                                        │
// │  1. انسخ الصور إلى المجلد:  src/assets/                    │
// │  2. ألغِ التعليق عن السطرين التاليين وعدّل أسماء الملفات:    │
// └─────────────────────────────────────────────────────────┘
import universityLogo from "../../../../assets/university-logo.png"; // لوغو الجامعة
// import facultyLogo from "../../../../assets/faculty-logo.png";       // لوغو الكلية

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

/* ── Dashboard spotlight (shows once after login) ── */
function DashboardSpotlight({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    setShow(false);
    setTimeout(onDismiss, 250);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      <div
        className={`absolute top-full z-50 mt-3 w-72 transition-all duration-300 ${isRTL ? "left-0" : "right-0"} ${
          show
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div
          className={`absolute -top-2 size-4 rotate-45 border-l border-t border-gold/40 bg-cream-card ${isRTL ? "left-6" : "right-6"}`}
        />
        <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-cream-card shadow-2xl">
          <div className="h-1 bg-linear-to-r from-forest via-gold to-forest" />
          <div className="p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-forest to-forest-deep text-cream">
                <LayoutDashboard size={18} />
                <div className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border-2 border-cream-card bg-gold">
                  <Sparkles size={8} className="text-forest-deep" />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                  {t("spotlight.badge")}
                </span>
                <h3 className="font-serif text-sm font-bold text-forest">
                  {t("spotlight.title")}
                </h3>
              </div>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-clay">
              {t("spotlight.desc")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={close}
                className="flex-1 rounded-lg border border-forest/15 py-2 text-xs font-medium text-clay transition hover:bg-forest/5"
              >
                {t("spotlight.later")}
              </button>
              <LocaleLink
                to={PATHS.dashboard}
                onClick={close}
                className="flex-1"
              >
                <span className="flex h-full w-full items-center justify-center gap-1.5 rounded-lg bg-linear-to-br from-forest to-forest-deep py-2 text-xs font-semibold text-cream">
                  <LayoutDashboard size={13} /> {t("spotlight.go")}
                </span>
              </LocaleLink>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Logo slot ── */
function Emblem({
  small,
  src,
  alt,
}: {
  small?: boolean;
  src?: string;
  alt?: string;
}) {
  const size = small ? "size-9" : "size-12";

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? "logo"}
        className={`${size} shrink-0 rounded-xl object-contain transition-all duration-500`}
      />
    );
  }

  return (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-xl border-2 border-dashed border-forest/30 bg-forest/5 text-[8px] font-bold text-forest/40 transition-all duration-500`}
      title="ضع صورة اللوغو هنا"
    >
      LOGO
    </div>
  );
}

/* ── User avatar — صورة ← أحرف الاسم ← أيقونة، مع نقطة "متصل" خضراء ── */
function Avatar({
  src,
  initials,
  size = 24,
  rounded = "rounded-[5px]",
  dotBorder = "border-forest",
}: {
  src?: string;
  initials: string;
  size?: number;
  rounded?: string;
  dotBorder?: string;
}) {
  const dot = Math.max(8, Math.round(size * 0.32));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt="avatar"
          style={{ width: size, height: size }}
          className={`${rounded} border border-cream/20 object-cover`}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className={`grid place-items-center ${rounded} bg-linear-to-br from-forest to-forest-deep text-cream`}
        >
          {initials ? (
            <span className="text-[10px] font-bold">
              {initials.toUpperCase()}
            </span>
          ) : (
            <User size={Math.round(size * 0.55)} className="text-cream/70" />
          )}
        </div>
      )}
      {/* نقطة "متصل" */}
      <span
        className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-400 border-2 ${dotBorder}`}
        style={{ width: dot, height: dot }}
      />
    </div>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const { dir, isRTL } = useLanguage();
  const { isAuthenticated, user, role, logout } = useAuth();
  const [active, setActive] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (sessionStorage.getItem("dash_spotlight")) return;
    const id = setTimeout(() => {
      setSpotlight(true);
      sessionStorage.setItem("dash_spotlight", "1");
    }, 1000);
    return () => clearTimeout(id);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName =
    fullName ||
    user?.registrationNumber ||
    user?.email ||
    user?.universityEmail ||
    t("common.dashboard");
  const roleLabel = role ? t(`roles.${role}`, { defaultValue: "" }) : "";
  // أحرف فقط لو فيه اسم؛ غير ذلك فاضي → الأفاتار يعرض أيقونة
  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join("");
  const avatarUrl = user?.avatarUrl;

  return (
    <header
      dir={dir}
      className={`sticky top-0 z-50 font-body transition-shadow duration-500 ${scrolled ? "shadow-[0_8px_30px_rgba(26,49,45,0.35)]" : ""}`}
    >
      {/* ═══ TOP BAR ═══ */}
      <div className="relative overflow-hidden bg-cream-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-gold/40 to-transparent" />
        <div
          className={`relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 transition-all duration-500 lg:px-8 ${scrolled ? "h-16" : "h-21"}`}
        >
          <LocaleLink to={PATHS.home}>
            <Emblem
              small={scrolled}
              src={universityLogo}
              alt="جامعة الشهيد حمه لخضر - الوادي"
            />
          </LocaleLink>

          <div className="flex flex-1 flex-col items-center text-center">
            <h1
              dir="ltr"
              className={`font-serif font-bold tracking-tight text-forest transition-all duration-500 ${scrolled ? "text-base lg:text-lg" : "text-lg lg:text-2xl"}`}
            >
              {t("brand.nameLatin")}
            </h1>

            <div className="mt-1 flex items-center gap-3">
              <span className="h-px w-8 bg-linear-to-r from-transparent to-gold/50" />
              <p className="text-[11px] font-medium text-clay lg:text-[13px]">
                {t("brand.system")}
              </p>
              <span className="h-px w-8 bg-linear-to-l from-transparent to-gold/50" />
            </div>

            <p
              className={`overflow-hidden text-clay/70 transition-all duration-500 ${
                scrolled
                  ? "mt-0 max-h-0 text-[0px] opacity-0"
                  : "mt-1 max-h-5 text-[11px] opacity-100"
              }`}
            >
              {t("brand.nameAr")}
            </p>
          </div>

          <LocaleLink to={PATHS.home}>
            <Emblem
              small={
                scrolled
              } /* src={universityLogo} alt="كلية العلوم الاجتماعية و الانسانية" */
            />
          </LocaleLink>
        </div>
      </div>

      {/* ═══ NAV BAR ═══ */}
      <div className="relative bg-forest text-cream">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
            style={{ backgroundImage: NOISE }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-gold/0 via-gold/30 to-gold/0" />
        </div>

        <div className="relative mx-auto flex h-12 max-w-7xl items-center justify-between px-5 lg:px-8">
          <nav className="hidden items-center gap-1 md:flex">
            <LocaleLink
              to={PATHS.home}
              onClick={() => setActive("home")}
              className={`group relative rounded-md px-4 py-1.5 text-[13px] font-medium transition ${
                active === "home"
                  ? "text-cream"
                  : "text-cream/60 hover:bg-white/6 hover:text-cream/90"
              }`}
            >
              {t("common.home")}

              <span
                className={`absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold transition-all duration-300 ${
                  active === "home"
                    ? "scale-x-100 opacity-100"
                    : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                }`}
              />
            </LocaleLink>
            <LocaleLink
              to={PATHS.topics}
              onClick={() => setActive("topics")}
              className={`group relative rounded-md px-4 py-1.5 text-[13px] font-medium transition ${
                active === "topics"
                  ? "text-cream"
                  : "text-cream/60 hover:bg-white/6 hover:text-cream/90"
              }`}
            >
              {t("common.topics")}

              <span
                className={`absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold transition-all duration-300 ${
                  active === "topics"
                    ? "scale-x-100 opacity-100"
                    : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                }`}
              />
            </LocaleLink>
            <LocaleLink
              to={PATHS.about}
              onClick={() => setActive("about")}
              className={`group relative rounded-md px-4 py-1.5 text-[13px] font-medium transition ${
                active === "about"
                  ? "text-cream"
                  : "text-cream/60 hover:bg-white/6 hover:text-cream/90"
              }`}
            >
              {t("common.about")}

              <span
                className={`absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold transition-all duration-300 ${
                  active === "about"
                    ? "scale-x-100 opacity-100"
                    : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                }`}
              />
            </LocaleLink>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => {
                    setMenuOpen((o) => !o);
                    if (spotlight) setSpotlight(false);
                  }}
                  className={`flex items-center gap-2 rounded-md border py-1 transition ${isRTL ? "pl-2 pr-1" : "pl-1 pr-2"} ${
                    spotlight
                      ? "border-gold/60 bg-white/10 shadow-[0_0_0_3px_rgba(193,150,90,0.2)]"
                      : menuOpen
                        ? "border-cream/20 bg-white/10"
                        : "border-cream/10 hover:bg-white/[0.07]"
                  }`}
                >
                  <Avatar
                    src={avatarUrl}
                    initials={initials}
                    size={24}
                    dotBorder="border-forest"
                  />
                  <span className="max-w-28 truncate text-[11px] font-medium text-cream/75">
                    {displayName}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-cream/40 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {spotlight && !menuOpen && (
                  <DashboardSpotlight onDismiss={() => setSpotlight(false)} />
                )}

                <div
                  className={`absolute top-full z-50 mt-2 w-56 origin-top transition-all duration-200 ${isRTL ? "left-0" : "right-0"} ${menuOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}
                >
                  <div
                    className={`absolute -top-1.5 size-3 rotate-45 border-l border-t border-forest/10 bg-cream-card ${isRTL ? "left-4" : "right-4"}`}
                  />
                  <div className="relative overflow-hidden rounded-xl border border-forest/10 bg-cream-card shadow-2xl">
                    <div className="border-b border-forest/10 bg-cream-2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={avatarUrl}
                          initials={initials}
                          size={36}
                          rounded="rounded-lg"
                          dotBorder="border-cream-card"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-forest">
                            {displayName}
                          </p>
                          {roleLabel && (
                            <p className="truncate text-[10px] text-clay">
                              {roleLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="py-1.5">
                      <LocaleLink
                        to={PATHS.dashboard}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-forest/70 transition hover:bg-forest/5 hover:text-forest"
                      >
                        <LayoutDashboard size={15} />
                        {t("common.dashboard")}
                      </LocaleLink>
                    </div>
                    <div className="border-t border-forest/10 py-1.5">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-500/80 transition hover:bg-red-500/5 hover:text-red-500"
                      >
                        <LogOut size={15} />
                        {t("common.logout")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <LocaleLink
                to={PATHS.login}
                className="flex items-center gap-2 rounded-md bg-linear-to-br from-gold to-gold-soft px-4 py-1.5 text-[13px] font-bold text-forest-deep transition hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(193,150,90,0.35)]"
              >
                <LogIn size={14} />
                {t("common.login")}
              </LocaleLink>
            )}

            <div
              className={`flex items-center ${isRTL ? "border-r pr-3" : "border-l pl-3"} border-cream/10`}
            >
              <LanguageSwitcher />
            </div>
          </div>

          <button
            className="grid size-9 place-items-center rounded-md text-cream md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* mobile menu */}
        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${mobileOpen ? "max-h-96" : "max-h-0"}`}
        >
          <nav className="space-y-1 px-5 py-3">
            <LocaleLink
              to={PATHS.home}
              onClick={() => {
                setActive("home");
                setMobileOpen(false);
              }}
              className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm transition ${
                active === "home"
                  ? "border-gold bg-white/5 text-gold"
                  : "border-transparent text-cream/70 hover:bg-white/5 hover:text-cream"
              }`}
            >
              {t("common.home")}
            </LocaleLink>

            <LocaleLink
              to={PATHS.topics}
              onClick={() => {
                setActive("topics");
                setMobileOpen(false);
              }}
              className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm transition ${
                active === "topics"
                  ? "border-gold bg-white/5 text-gold"
                  : "border-transparent text-cream/70 hover:bg-white/5 hover:text-cream"
              }`}
            >
              {t("common.topics")}
            </LocaleLink>

            <LocaleLink
              to={PATHS.about}
              onClick={() => {
                setActive("about");
                setMobileOpen(false);
              }}
              className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm transition ${
                active === "about"
                  ? "border-gold bg-white/5 text-gold"
                  : "border-transparent text-cream/70 hover:bg-white/5 hover:text-cream"
              }`}
            >
              {t("common.about")}
            </LocaleLink>

            <div className="px-3 py-2">
              <LanguageSwitcher variant="menu" />
            </div>
            {isAuthenticated ? (
              <>
                <LocaleLink
                  to={PATHS.dashboard}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-linear-to-br from-gold to-gold-soft px-4 py-2.5 text-sm font-bold text-forest-deep"
                >
                  <LayoutDashboard size={15} /> {t("common.dashboard")}
                </LocaleLink>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 px-4 py-2.5 text-sm font-medium text-red-300/80 transition hover:bg-red-400/10"
                >
                  <LogOut size={15} /> {t("common.logout")}
                </button>
              </>
            ) : (
              <LocaleLink
                to={PATHS.login}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-linear-to-br from-gold to-gold-soft px-4 py-2.5 text-sm font-bold text-forest-deep"
              >
                <LogIn size={15} /> {t("common.login")}
              </LocaleLink>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
