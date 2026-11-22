/**
 * «24 / 1000» under a text field with a ceiling — so the ceiling is seen before
 * the field stops taking letters, and in red once it is reached.
 */
export function CharCount({ value, max, className = "" }: { value: string; max: number; className?: string }) {
  const full = value.length >= max;
  return (
    <span
      dir="ltr"
      data-testid="char-count"
      className={`block text-end font-serif text-[11px] tabular-nums ${full ? "font-bold text-brick" : "text-clay/70"} ${className}`}
    >
      {value.length} / {max}
    </span>
  );
}
