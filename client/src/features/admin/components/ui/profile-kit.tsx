import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, Copy, Sparkles, type LucideIcon } from "lucide-react";
import { isNone } from "../../../../lib/none-text";

/**
 * A person, as the administration sees them — a professor, a student, any
 * account. The three pages open the same way: a dark hero with the person,
 * what they are and how to reach them, the actions on them and their numbers;
 * then their record in titled cards; then what they have done.
 *
 * The hero is dark in both themes, so what sits on it uses fixed light shades.
 * Text on gold uses a fixed dark ink: `forest-deep` turns light in dark mode.
 */

export type Tone = "gold" | "emerald" | "amber" | "rose" | "sky" | "glass";

/** Dark ink for anything printed on gold — the same in both themes. */
export const ON_GOLD = "text-[#1a312d]";

const CHIP: Record<Tone, string> = {
  gold: "border-gold/35 bg-gold/15 text-gold-soft",
  emerald: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200",
  amber: "border-amber-300/30 bg-amber-400/15 text-amber-200",
  rose: "border-rose-300/30 bg-rose-400/15 text-rose-200",
  sky: "border-sky-300/30 bg-sky-400/15 text-sky-200",
  glass: "border-white/15 bg-white/[0.06] text-cream/85",
};
const ICON: Record<Tone, string> = {
  gold: "bg-gold/15 text-gold-soft",
  emerald: "bg-emerald-400/15 text-emerald-300",
  amber: "bg-amber-400/15 text-amber-300",
  rose: "bg-rose-400/15 text-rose-300",
  sky: "bg-sky-400/15 text-sky-300",
  glass: "bg-white/[0.08] text-cream/85",
};

/* ── the hero ────────────────────────────────────────────── */

export function ProfileHero({
  trail,
  avatar,
  active,
  activeLabel,
  eyebrow,
  name,
  otherName,
  chips,
  facts,
  actions,
  stats,
}: {
  /** The breadcrumb strip (`HeaderTrail`). */
  trail?: ReactNode;
  avatar: ReactNode;
  /** The account's state, as a dot on the photo; leave out to show none. */
  active?: boolean;
  activeLabel?: string;
  eyebrow?: string;
  name: string;
  /** The same name in the other script, under the main one. */
  otherName?: string;
  chips?: ReactNode;
  facts?: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
}) {
  const otherIsLatin = /[A-Za-z]/.test(otherName ?? "");
  return (
    <section className="forest-glow relative overflow-hidden rounded-3xl text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)]">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 -end-16 size-96 rounded-full bg-gold/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 start-1/3 size-72 rounded-full bg-soft-sage/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent" />

      {trail && <div className="relative border-b border-white/[0.07]">{trail}</div>}

      <div className="relative px-6 pt-7 pb-7 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-5">
          <div className="relative shrink-0">
            <span className="absolute -inset-2 rounded-[1.75rem] bg-linear-to-br from-gold/60 via-gold/10 to-transparent blur-[2px]" />
            <div className="relative">{avatar}</div>
            {active !== undefined && (
              <span
                title={activeLabel}
                className={`absolute -end-1.5 -bottom-1.5 size-5 rounded-full ring-4 ring-[color:var(--t-brand)] ${active ? "bg-emerald-400" : "bg-rose-400"}`}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                <Sparkles size={12} />
                {eyebrow}
              </p>
            )}
            <h1 className="font-serif text-[28px] leading-tight font-bold text-cream lg:text-[34px]">
              <bdi>{name}</bdi>
            </h1>
            {otherName && (
              <p className="mt-2 flex items-center gap-3">
                <span aria-hidden className="h-px w-10 shrink-0 bg-linear-to-l from-gold/10 to-gold ltr:bg-linear-to-r" />
                {/* Letter-spacing suits Latin capitals; it would break Arabic apart. */}
                <bdi className={`text-[17px] leading-none text-gold-soft ${otherIsLatin ? "font-serif font-semibold tracking-[0.12em]" : "font-semibold"}`}>
                  {otherName}
                </bdi>
              </p>
            )}
            {chips && <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div>}
            {facts && <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">{facts}</div>}
          </div>

          {/* One row of actions: beside the name when it fits, on a line of its own when it does not. */}
          {actions && <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">{actions}</div>}
        </div>

        {stats && <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats}</div>}
      </div>
    </section>
  );
}

export function HeroChip({
  icon: Icon,
  tone = "glass",
  title,
  ltr,
  mono,
  children,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title?: string;
  ltr?: boolean;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold backdrop-blur-sm ${CHIP[tone]}`}>
      <Icon size={13} className="shrink-0" />
      {ltr ? (
        <bdi dir="ltr" className={mono ? "font-mono tracking-wide" : undefined}>
          {children}
        </bdi>
      ) : (
        children
      )}
    </span>
  );
}

/** One fact under the name: a label, and its value bright enough to read. */
export function HeroFact({ icon: Icon, label, value, ltr, copy }: { icon: LucideIcon; label?: string; value: ReactNode; ltr?: boolean; copy?: string }) {
  return (
    <span className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
      <Icon size={13} className="shrink-0 text-gold-soft" />
      {label && <span className="shrink-0 text-cream/65">{label}</span>}
      <b className="truncate font-semibold text-cream">{ltr ? <bdi dir="ltr">{value}</bdi> : value}</b>
      {copy && <CopyButton value={copy} onDark />}
    </span>
  );
}

type ButtonVariant = "primary" | "glass" | "positive" | "danger";
const BUTTON: Record<ButtonVariant, string> = {
  primary: `bg-linear-to-l from-gold to-gold-soft ${ON_GOLD} shadow-[0_10px_24px_-12px_rgba(193,150,90,0.9)] hover:-translate-y-0.5`,
  glass: "border border-white/15 bg-white/[0.06] text-cream hover:bg-white/[0.12]",
  positive: "border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
  danger: "border border-rose-300/30 bg-rose-400/10 text-rose-200 hover:bg-rose-500/20",
};

export function HeroButton({
  icon: Icon,
  variant = "glass",
  onClick,
  disabled,
  children,
}: {
  icon: LucideIcon;
  variant?: ButtonVariant;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap backdrop-blur-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${BUTTON[variant]}`}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

/** A number on the hero: glass, with its icon in its colour. */
export function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "gold",
  leading,
  compact,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** In place of the icon — a progress ring, say. */
  leading?: ReactNode;
  /** A word rather than a number: a smaller face. */
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-white/[0.08]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-cream/70">{label}</p>
        {leading ?? (
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ICON[tone]}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className={`mt-2 truncate font-serif leading-tight font-bold text-cream tabular-nums ${compact ? "text-[19px]" : "text-[28px]"}`}>{value}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-cream/55">{hint}</p>}
    </div>
  );
}

/* ── the record ──────────────────────────────────────────── */

export function RecordCard({
  icon: Icon,
  title,
  count,
  action,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)] ${className}`}>
      <header className="relative flex items-center gap-3 border-b border-forest/8 px-6 py-4 sm:px-7">
        <span className="pointer-events-none absolute inset-x-7 -bottom-px h-px bg-linear-to-l from-transparent via-gold/40 to-transparent" />
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-gold/20 to-gold/5 text-gold ring-1 ring-gold/20">
          <Icon size={18} />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-serif text-[17px] font-bold text-forest">{title}</h2>
        {count != null && <span className="rounded-full bg-gold/12 px-2.5 py-0.5 text-[12px] font-bold text-gold tabular-nums">{count}</span>}
        {action}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

/** Rows of a record: one column on a phone, two or three as the room allows. */
export function FieldGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ReactNode }) {
  const grid = cols === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "";
  return <div className={`grid grid-cols-1 gap-x-2 gap-y-0.5 ${grid}`}>{children}</div>;
}

export function Field({
  icon: Icon,
  label,
  value,
  ltr,
  copy,
  valueClass,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  ltr?: boolean;
  /** Offer to copy the value (an address, a number). */
  copy?: boolean;
  /** A colour for a value that is a state rather than text. */
  valueClass?: string;
}) {
  // "None" is written, and dimmed — so a missing value never looks like data.
  const empty = isNone(value);
  return (
    <div className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-forest/[0.03]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest/[0.05] text-forest/80 ring-1 ring-forest/[0.06] transition group-hover:bg-gold/10 group-hover:text-gold">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-clay">{label}</p>
        {/* An address or a number wraps rather than losing its start to an ellipsis. */}
        <p className={`mt-0.5 text-[14px] ${ltr ? "[overflow-wrap:anywhere]" : "truncate"} ${empty ? "text-clay/70" : `font-semibold ${valueClass ?? "text-forest"}`}`}>
          {ltr && !empty ? <bdi dir="ltr">{value}</bdi> : value}
        </p>
      </div>
      {copy && !empty && value && <CopyButton value={value} />}
    </div>
  );
}

export function CopyButton({ value, onDark }: { value: string; onDark?: boolean }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={t("common.copy")}
      title={t("common.copy")}
      onClick={() =>
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        })
      }
      className={`grid size-7 shrink-0 place-items-center rounded-lg transition focus-visible:opacity-100 ${done ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${
        onDark ? "text-cream/60 hover:bg-white/10 hover:text-cream" : "text-clay hover:bg-forest/5 hover:text-forest"
      }`}
    >
      {done ? <Check size={14} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

/** Faculty → department → filière → specialization, as a path walked down. */
export function AcademicPath({ steps }: { steps: { icon: LucideIcon; label: string; value?: string | null }[] }) {
  const shown = steps.filter((s) => !!s.value && !isNone(s.value));
  return (
    <ol className="px-3 py-1">
      {shown.map((s, i) => {
        const last = i === shown.length - 1;
        return (
          <li key={s.label} className="relative flex items-center gap-3 py-2">
            {!last && <span aria-hidden className="absolute start-[1.2rem] top-[3.1rem] h-[calc(100%-2.6rem)] w-px bg-linear-to-b from-gold/45 to-gold/5" />}
            <span
              className={`relative grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${
                last ? `bg-linear-to-br from-gold to-gold-soft ${ON_GOLD} shadow-[0_8px_20px_-10px_rgba(193,150,90,0.9)] ring-gold/40` : "bg-cream-2 text-forest/75 ring-forest/10"
              }`}
            >
              <s.icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] text-clay">{s.label}</p>
              <p className={`truncate text-[14px] font-semibold ${last ? "text-gold" : "text-forest"}`}>{s.value}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── what they have done ─────────────────────────────────── */

/** States as soft pills that read in both themes. */
const STATE_PILL: Record<string, string> = {
  pending: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  accepted: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  approved: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  open: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  full: "bg-gold/15 text-gold ring-gold/30",
  rejected: "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  archived: "bg-clay/12 text-clay ring-clay/25",
};
const STATE_EDGE: Record<string, string> = {
  pending: "bg-amber-400",
  accepted: "bg-emerald-500",
  approved: "bg-emerald-500",
  open: "bg-sky-500",
  full: "bg-gold",
  rejected: "bg-rose-400",
  archived: "bg-clay/60",
};

export function ListRow({
  title,
  badge,
  meta,
  state,
  stateLabel,
  onClick,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  state?: string;
  stateLabel?: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-forest/10 bg-cream-2/40 px-4 py-3.5 text-start transition duration-300 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-gold/[0.05] hover:shadow-[0_10px_26px_-14px_rgba(38,66,61,0.35)]"
      >
        <span className={`absolute inset-y-3 start-0 w-1 rounded-e-full ${STATE_EDGE[state ?? ""] ?? "bg-forest/15"}`} />
        <div className="min-w-0 flex-1 ps-1.5">
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-forest">
            <span className="min-w-0 truncate">{title}</span>
            {badge}
          </p>
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-clay">{meta}</div>}
        </div>
        {state && stateLabel && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ${STATE_PILL[state] ?? STATE_PILL.archived}`}>{stateLabel}</span>
        )}
        <ChevronLeft size={18} className="shrink-0 text-clay/40 transition group-hover:text-gold ltr:rotate-180 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

export function MetaItem({ icon: Icon, children, className = "" }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon size={12} className="shrink-0" />
      {children}
    </span>
  );
}

/** Nothing here yet — said kindly, with what would fill it. */
export function EmptyNote({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 grid size-16 place-items-center rounded-3xl border border-gold/25 bg-linear-to-br from-gold/12 to-transparent text-gold shadow-[0_10px_30px_-18px_rgba(193,150,90,0.8)]">
        <Icon size={26} strokeWidth={1.7} />
      </span>
      <p className="text-[15px] font-bold text-forest">{title}</p>
      {hint && <p className="max-w-sm text-[12.5px] leading-relaxed text-clay">{hint}</p>}
    </div>
  );
}
