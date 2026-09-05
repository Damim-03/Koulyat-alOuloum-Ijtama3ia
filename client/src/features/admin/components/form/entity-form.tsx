import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The vocabulary the account dialogs are written in.
 *
 * These three lived twice, byte for byte, in the professor and student edit
 * dialogs. The create dialog is a third caller, and three copies of a border
 * radius is how two dialogs stop looking like each other.
 */

export const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";

/** One of the two side-by-side panels a dialog is built from. */
export function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_2px_12px_rgba(38,66,61,0.04)]">
      <h4 className="flex items-center gap-2 border-b border-forest/10 pb-2 text-sm font-bold text-forest">
        <span className="grid size-7 place-items-center rounded-lg bg-gold/15 text-gold">
          <Icon size={15} />
        </span>
        {title}
      </h4>
      {children}
    </section>
  );
}

export function FieldBox({
  label,
  icon: Icon,
  required,
  error,
  children,
}: {
  label: string;
  icon: LucideIcon;
  required?: boolean;
  /** Validation message for this field; the edit dialogs report at the top. */
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-clay">
        <Icon size={12} className="text-clay/70" />
        {label}
        {required && <span className="text-brick">*</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-[11px] text-brick">{error}</p>}
    </label>
  );
}
