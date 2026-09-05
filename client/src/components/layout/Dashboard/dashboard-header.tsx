import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  ChevronDown,
  LogOut,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { LanguageSwitcher } from "../../../i18n/locales/components/language-switcher";
import { ThemeToggle } from "../../theme-toggle";
import { UserAvatar } from "../../ui/user-avatar";

interface Props {
  onMenuClick: () => void;
  titleKey: string;
}

/**
 * The account menu every role sees — the four dashboard layouts all render
 * this one header, so the identity card here is the identity card everywhere.
 *
 * It leads with the person, not with a generic icon: the avatar the account
 * actually has, their name, and the role they signed in as. The login address
 * is the thing people are asked for most often, so it sits on its own row
 * with a copy button rather than as fine print.
 */
export function DashboardHeader({ onMenuClick, titleKey }: Props) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    // Escape returns focus to the button it came from, so keyboard users are
    // not dropped at the top of the document.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  // The account already carries a name; showing the login address instead made
  // the button say "...in@univ-eloued.dz". Name first, address as the fallback.
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const account =
    user?.universityEmail || user?.email || user?.registrationNumber || "";
  const displayName = fullName || account || t("dash.greeting");
  const roleLabel = role ? t(`roles.${role}`, { defaultValue: "" }) : "";
  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the address is selectable either way.
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-forest/10 bg-cream-2/90 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="grid size-9 place-items-center rounded-lg text-forest transition hover:bg-forest/5"
          aria-label="toggle menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="hidden truncate font-serif text-lg font-bold text-forest sm:block">
          {t(titleKey)}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <LanguageSwitcher className="text-forest" />

        <div className="relative" ref={ref}>
          <button
            ref={triggerRef}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`flex items-center gap-2.5 rounded-xl border py-1.5 pe-2.5 ps-1.5 transition duration-200 focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:outline-none ${
              open
                ? "border-gold/50 bg-forest/5 shadow-[0_2px_10px_rgba(38,66,61,0.08)]"
                : "border-forest/10 hover:border-gold/40 hover:bg-forest/5"
            }`}
          >
            <UserAvatar
              user={user}
              size={30}
              className={`ring-2 transition-colors ${open ? "ring-gold/50" : "ring-forest/10"}`}
            />

            {/* The role is the second thing people check on a shared machine,
                so it rides along with the name instead of hiding in the menu. */}
            <span className="hidden text-start leading-tight sm:block">
              <span className="block max-w-44 truncate text-[12.5px] font-semibold text-forest">
                {displayName}
              </span>
              {roleLabel && (
                <span className="block text-[10px] text-clay">{roleLabel}</span>
              )}
            </span>

            <ChevronDown
              size={14}
              className={`text-clay transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          <div
            role="menu"
            inert={!open}
            className={`absolute top-full end-0 z-50 mt-2.5 w-[min(19.5rem,calc(100vw-2rem))] origin-top transition-all duration-200 ease-out motion-reduce:transition-none ${
              open
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
          >
            <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_24px_60px_-16px_rgba(26,49,45,0.5)]">
              {/* ── who you are ─────────────────────────────────────
                  Centred, and given room to breathe: the account card
                  is something you read, not a list you scan, so the
                  photo leads and the identity sits under it. */}
              <div className="bg-linear-to-b from-cream-2 to-cream-card px-6 pt-6 pb-5 text-center">
                <UserAvatar
                  user={user}
                  size={72}
                  className="mx-auto ring-2 ring-gold/35"
                />

                <p className="mt-3 truncate font-serif text-base font-bold text-forest">
                  {displayName}
                </p>

                {account && account !== displayName && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    {/* the address wraps rather than truncates, so it is
                        always readable in full */}
                    <span
                      dir="ltr"
                      className="min-w-0 break-all text-[12px] leading-snug text-clay"
                    >
                      {account}
                    </span>
                    <button
                      onClick={copyAccount}
                      title={copied ? t("common.copied") : t("common.copy")}
                      aria-label={copied ? t("common.copied") : t("common.copy")}
                      className={`grid size-6 shrink-0 place-items-center rounded-md transition ${
                        copied
                          ? "text-sage"
                          : "text-clay/70 hover:bg-forest/8 hover:text-forest"
                      }`}
                    >
                      {copied ? <Check size={13} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {roleLabel && (
                  <span className="mt-2.5 inline-block rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/25">
                    {roleLabel}
                  </span>
                )}
              </div>

              {/* ── what you can do ── */}
              <div className="border-t border-forest/10 px-4 py-3.5">
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  className="mx-auto flex items-center gap-2 rounded-full border border-forest/15 px-5 py-2 text-[13px] font-semibold text-forest transition hover:border-brick/40 hover:bg-brick/8 hover:text-brick"
                >
                  <LogOut
                    size={14}
                    className={isRTL ? "rotate-180" : undefined}
                  />
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
