import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, User, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { LanguageSwitcher } from "../../../i18n/locales/components/language-switcher";

interface Props {
  onMenuClick: () => void;
  titleKey: string;
}

export function DashboardHeader({ onMenuClick, titleKey }: Props) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const displayName =
    user?.registrationNumber ||
    user?.email ||
    user?.universityEmail ||
    t("dash.greeting");
  const roleLabel = role ? t(`roles.${role}`, { defaultValue: "" }) : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-forest/10 bg-cream-2/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="grid size-9 place-items-center rounded-lg text-forest transition hover:bg-forest/5"
          aria-label="toggle menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-serif text-lg font-bold text-forest">
          {t(titleKey)}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher className="text-forest" />

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 rounded-lg border border-forest/10 py-1 transition hover:bg-forest/5 ${isRTL ? "pl-2 pr-1" : "pl-1 pr-2"}`}
          >
            <span className="grid size-7 place-items-center rounded-md bg-forest/10">
              <User size={15} className="text-forest/70" />
            </span>
            <span className="hidden max-w-32 truncate text-[12px] font-medium text-forest sm:inline">
              {displayName}
            </span>
            <ChevronDown
              size={13}
              className={`text-clay transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`absolute top-full z-50 mt-2 w-56 origin-top transition-all duration-200 ${isRTL ? "left-0" : "right-0"} ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}
          >
            <div className="overflow-hidden rounded-xl border border-forest/10 bg-cream-card shadow-2xl">
              <div className="border-b border-forest/10 bg-cream-2 px-4 py-3">
                <p className="truncate text-sm font-semibold text-forest">
                  {displayName}
                </p>
                {roleLabel && (
                  <p className="truncate text-[10px] text-clay">{roleLabel}</p>
                )}
              </div>
              <div className="border-t border-forest/10 py-1.5">
                <button
                  onClick={() => {
                    setOpen(false);
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
      </div>
    </header>
  );
}
