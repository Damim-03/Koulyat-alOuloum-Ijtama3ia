import { useMemo, useState, type KeyboardEvent } from "react";
import { X, Check, Plus } from "lucide-react";

/**
 * Values that must agree across records, entered by choosing rather than by
 * typing.
 *
 * These two fields were plain free text, so the same rank reached the database
 * as "أستاذ محاضر أ" from one admin and "استاذ محاضر ا" from the next — two
 * different strings for one rank, and no way to group professors by it. The
 * field still accepts anything (the API is unchanged); it just stops being the
 * only option:
 *
 *   - the known values are offered as one-click chips;
 *   - typing filters them, so the list narrows instead of being scrolled;
 *   - and a typed value that matches a known one — ignoring hamza, tāʾ
 *     marbūṭa, diacritics and spacing — is stored in the known spelling.
 *
 * Duplicate detection uses the same comparison, so a second spelling of a rank
 * already chosen is rejected rather than added beside it.
 */

/**
 * Arabic written by hand varies in ways that carry no meaning here: أ/إ/آ for
 * ا, ة for ه, ى for ي, optional diacritics, and stray spacing. Comparison
 * folds all of that away; only the display keeps the canonical spelling.
 */
function fold(s: string) {
  return s
    .trim()
    .replace(/[ً-ْـ]/g, "") // tashkīl + tatwīl
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  hint,
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Known spellings, offered as chips and used to correct what is typed. */
  suggestions?: string[];
  hint?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  const chosen = useMemo(() => new Set(value.map(fold)), [value]);

  // What is left to offer, narrowed by what is being typed.
  const offered = useMemo(() => {
    const q = fold(draft);
    return suggestions.filter(
      (s) => !chosen.has(fold(s)) && (!q || fold(s).includes(q)),
    );
  }, [suggestions, chosen, draft]);

  const typedIsNew =
    draft.trim().length > 0 &&
    !chosen.has(fold(draft)) &&
    !suggestions.some((s) => fold(s) === fold(draft));

  function commit(raw: string) {
    const typed = raw.trim().replace(/\s+/g, " ");
    if (!typed) return;
    // A known spelling wins over the typed one.
    const canonical = suggestions.find((s) => fold(s) === fold(typed)) ?? typed;
    if (chosen.has(fold(canonical))) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, canonical]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      // Enter on a narrowed list takes the single remaining match, so the
      // common case never depends on spelling it correctly.
      commit(offered.length === 1 ? offered[0] : draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-forest/15 bg-cream-2 px-2.5 py-2 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-soft-sage/40 px-2.5 py-0.5 text-xs font-medium text-forest"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((tg) => tg !== tag))}
              className="text-clay transition hover:text-brick"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-sm text-forest outline-none"
        />
      </div>

      {/* The list of known values sits open rather than behind a click: it is
          the intended way in, not a hint. */}
      {offered.length > 0 && value.length < max && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {offered.map((s) => (
            <button
              key={s}
              type="button"
              // mousedown, not click: the input's blur would otherwise commit
              // the half-typed draft before this button ever fires.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-forest/15 bg-cream-card px-2.5 py-1 text-[11px] font-medium text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
            >
              <Check size={11} className="text-gold" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Anything outside the known list is still allowed — it just has to be
          asked for, so it is never the result of a slip. */}
      {typedIsNew && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            commit(draft);
          }}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-gold/50 px-2.5 py-1 text-[11px] font-medium text-gold transition hover:bg-gold/10"
        >
          <Plus size={11} />
          {draft.trim()}
        </button>
      )}

      {hint && !typedIsNew && (
        <p className="mt-1 text-[10px] leading-relaxed text-clay/80">{hint}</p>
      )}
    </div>
  );
}
