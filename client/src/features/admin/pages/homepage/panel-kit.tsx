import type { ReactNode } from "react";
import { ExternalLink, type LucideIcon } from "lucide-react";

/**
 * شريط رأس كلّ تبويبٍ في «واجهة الموقع»: ما يقوله عن نفسه في البداية،
 * وأرقامه وإجراءاته في النهاية — الشكل نفسه في التبويبات الثلاثة.
 */
export function PanelBar({
  icon: Icon,
  title,
  hint,
  stats,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  stats?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-cream-card px-5 py-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-bold text-forest">{title}</h2>
          <p className="text-xs leading-relaxed text-clay">{hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stats}
        {actions}
      </div>
    </div>
  );
}

export function StatChip({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value?: ReactNode;
  tone?: "default" | "good" | "muted";
}) {
  const tones = {
    default: "border-forest/12 text-forest",
    good: "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
    muted: "border-forest/10 text-clay",
  };
  return (
    <span
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-medium ${tones[tone]}`}
    >
      <Icon size={14} className="opacity-80" />
      {label}
      {value !== undefined && <b className="font-serif text-sm tabular-nums">{value}</b>}
    </span>
  );
}

/** الزرّ الذهبيّ الرئيسيّ في رأس التبويب. */
export function PrimaryAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  type = "button",
  form,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-9 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/**
 * أجزاء التبويب الواحد — «النصوص / الصور» في «عن المنصة» و«صفحة الدخول» —
 * ورابطٌ يفتح الصفحة نفسها في الطرف الآخر.
 */
export function PartTabs<T extends string>({
  parts,
  value,
  onChange,
  link,
}: {
  parts: { id: T; icon: LucideIcon; label: string; badge?: string }[];
  value: T;
  onChange: (part: T) => void;
  link: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" className="inline-flex rounded-2xl border border-forest/10 bg-cream-card p-1 shadow-sm">
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={value === p.id}
            onClick={() => onChange(p.id)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              value === p.id ? "bg-gold/15 text-forest ring-1 ring-gold/50" : "text-forest/70 hover:text-forest"
            }`}
          >
            <p.icon size={15} className="text-gold" />
            {p.label}
            {p.badge !== undefined && (
              <span className="rounded-full bg-forest/8 px-1.5 py-px text-[10.5px] font-bold tabular-nums">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <a
        href={link.href}
        target="_blank"
        rel="noopener"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-forest/15 px-3.5 text-sm font-semibold text-forest transition hover:border-gold hover:text-gold"
      >
        <ExternalLink size={15} />
        {link.label}
      </a>
    </div>
  );
}
