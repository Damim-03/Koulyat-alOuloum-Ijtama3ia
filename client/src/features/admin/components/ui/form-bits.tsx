import type { ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * Shared pieces of the topic dialogs, so the create and edit forms cannot
 * drift apart visually — they were previously two separate implementations of
 * the same form, and only one of them ever got improved.
 */

export const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream px-3.5 py-2.5 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20";

/** A titled block of the form, with a line saying what belongs in it. */
export function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border-b border-forest/10 pb-2.5">
      <h3 className="font-serif text-[15px] font-bold text-forest">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-relaxed text-clay">{hint}</p>
    </div>
  );
}

/** A labelled control, optionally flagged as optional and explained below. */
export function Field({
  label,
  note,
  hint,
  children,
}: {
  label: string;
  note?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-clay">{label}</span>
        {note && (
          <span className="rounded-full bg-forest/8 px-1.5 py-0.5 text-[9px] font-medium text-clay">
            {note}
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10.5px] leading-relaxed text-clay/80">
          {hint}
        </span>
      )}
    </label>
  );
}

/** One tab of a two-step wizard header. */
export function StepTab({
  n,
  title,
  hint,
  active,
  done,
  disabled,
  onClick,
}: {
  n: number;
  title: string;
  hint: string;
  active: boolean;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-5 py-3.5 text-start transition ${
        active ? "bg-cream-card" : "hover:bg-forest/5"
      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold transition ${
          active
            ? "bg-gold text-forest-deep"
            : done
              ? "bg-forest text-cream"
              : "bg-forest/10 text-forest/60"
        }`}
      >
        {done ? <Check size={15} /> : n}
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-sm font-semibold ${active ? "text-forest" : "text-forest/70"}`}
        >
          {title}
        </span>
        <span className="block truncate text-[11px] text-clay">{hint}</span>
      </span>
    </button>
  );
}

/** One line of the review list in step two. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-clay">{label}</dt>
      <dd className="truncate text-end font-medium text-forest">{value}</dd>
    </div>
  );
}
