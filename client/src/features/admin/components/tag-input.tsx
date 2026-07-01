import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

/**
 * Reusable free-tag input (add with Enter/comma, remove with × or Backspace).
 * Controlled component — drive it with watch()/setValue() from react-hook-form.
 */
export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <label className="block">
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
              className="text-clay hover:text-red-500"
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
    </label>
  );
}
