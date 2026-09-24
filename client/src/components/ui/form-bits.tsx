import type { ReactNode } from "react";

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
  error,
  children,
}: {
  label: string;
  note?: string;
  hint?: string;
  /** Validation message; it replaces the hint rather than stacking on it. */
  error?: string;
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
      {error ? (
        <span className="mt-1 block text-[10.5px] leading-relaxed text-brick">
          {error}
        </span>
      ) : (
        hint && (
          <span className="mt-1 block text-[10.5px] leading-relaxed text-clay/80">
            {hint}
          </span>
        )
      )}
    </label>
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
