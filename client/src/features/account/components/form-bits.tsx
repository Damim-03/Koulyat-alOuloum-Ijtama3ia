import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, KeyRound, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";

/**
 * The account page's form pieces — a labelled field, a password input that
 * can be shown, the gold button — shared with the screens in front of the
 * dashboard (AccountSetupGate), so those look like the page they lead to.
 */

import { inputCls } from "../lib/input-class";

/** `group` for a field of several controls: a label would pass every click on its text to the first one. */
export function Field({
  label,
  hint,
  error,
  required,
  group,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-forest">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-[11.5px] text-red-600 dark:text-red-300">
          <TriangleAlert size={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11px] text-clay">{hint}</span>
      ) : null}
    </Tag>
  );
}

export function Secret({ value, onChange, autoComplete, testId }: { value: string; onChange: (v: string) => void; autoComplete: string; testId?: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <KeyRound size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
      <input
        type={show ? "text" : "password"}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        data-testid={testId}
        className={`${inputCls()} ps-11 pe-12`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t("admin.account.hide") : t("admin.account.show")}
        className="absolute end-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-clay transition hover:bg-forest/6 hover:text-forest"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function PrimaryBtn({
  type = "button",
  disabled,
  busy,
  icon: Icon,
  onClick,
  testId,
  children,
}: {
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
  icon: LucideIcon;
  onClick?: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      data-testid={testId}
      className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-l from-gold to-gold-soft px-5 py-3 text-sm font-bold text-forest-deep shadow-[0_10px_24px_-12px_rgba(193,150,90,0.9)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      {children}
    </button>
  );
}
