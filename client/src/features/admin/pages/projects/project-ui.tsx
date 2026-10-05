import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Small pieces the two project pages share. Components only, so fast refresh
 * keeps working; the helpers they use live in `project-utils.ts`.
 */

const TONE_STROKE = {
  sage: "stroke-sage",
  gold: "stroke-gold",
  danger: "stroke-red-500",
  cream: "stroke-gold-soft",
} as const;

/** A progress ring with the percentage in its middle. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone = "sage",
  label,
  track = "stroke-forest/10",
  textClass = "text-forest",
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONE_STROKE;
  label?: string;
  track?: string;
  textClass?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center font-serif font-bold tabular-nums ${textClass}`}
        style={{ fontSize: Math.max(11, size / 4.2) }}
      >
        {clamped}%
      </span>
    </div>
  );
}

/** A titled card; the page is built from these. */
export function SectionCard({
  id,
  icon: Icon,
  title,
  count,
  subtitle,
  actions,
  children,
  className = "",
  bodyClass = "p-5",
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  count?: number | string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)] ${className}`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-forest/10 bg-linear-to-l from-gold/5 to-transparent px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-serif text-base font-bold text-forest">
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-forest/10 px-2 py-0.5 font-sans text-[11px] font-bold text-forest tabular-nums">
                {count}
              </span>
            )}
          </h2>
          {subtitle && <p className="mt-0.5 truncate text-[11px] text-clay">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** A label/value line inside a card. */
export function InfoRow({
  icon: Icon,
  label,
  children,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-clay">
        <Icon size={13} className="text-clay/80" />
        {label}
      </dt>
      <dd
        className={`min-w-0 text-end text-[12.5px] font-semibold break-words text-forest ${mono ? "tabular-nums" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {children}
      </dd>
    </div>
  );
}

const BTN = {
  primary: "bg-forest text-cream hover:bg-forest-deep",
  gold: "bg-gold text-forest-deep hover:bg-gold-soft",
  outline: "border border-forest/20 text-forest hover:bg-forest/5",
  ghost: "text-clay hover:bg-forest/5 hover:text-forest",
  danger: "border border-red-300 text-red-600 hover:bg-red-500/10 dark:border-red-400/40 dark:text-red-400",
} as const;

export function ActionButton({
  icon: Icon,
  children,
  onClick,
  variant = "outline",
  disabled,
  title,
  size = "md",
  testId,
}: {
  icon?: LucideIcon;
  children?: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BTN;
  disabled?: boolean;
  title?: string;
  size?: "sm" | "md";
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"
      } ${BTN[variant]}`}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

const TILE_TONE = {
  gold: "bg-gold/15 text-gold",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
} as const;

/**
 * One fact of the project record: a coloured icon, its label, the value in
 * a size that can be read at a glance, and an optional second line.
 */
export function RecordTile({
  icon: Icon,
  label,
  tone = "gold",
  sub,
  span,
  children,
}: {
  icon: LucideIcon;
  label: string;
  tone?: keyof typeof TILE_TONE;
  sub?: ReactNode;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-forest/10 bg-cream-2/50 p-3 transition hover:border-gold/30 ${
        span ? "col-span-2" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${TILE_TONE[tone]}`}>
          <Icon size={14} />
        </span>
        <span className="truncate text-[11.5px] font-medium text-clay">{label}</span>
      </div>
      <div className="text-[14px] leading-snug font-bold break-words text-forest">{children}</div>
      {sub && <div className="mt-1 text-[11.5px] leading-snug text-clay">{sub}</div>}
    </div>
  );
}

/** A quiet, centred "nothing here yet" with an optional call to action. */
export function EmptyNote({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-forest/15 px-4 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-forest/5 text-clay">
        <Icon size={20} />
      </span>
      <p className="text-sm font-semibold text-forest">{title}</p>
      {hint && <p className="max-w-xs text-[11px] leading-relaxed text-clay">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
