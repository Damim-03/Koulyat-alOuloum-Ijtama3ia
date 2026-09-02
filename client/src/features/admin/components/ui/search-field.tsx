import { Search, X } from "lucide-react";

/**
 * One labelled search box in a filter panel.
 *
 * Each field targets a single identifier, so the label says what the admin is
 * typing rather than leaving them to guess what the box accepts.
 */
export function SearchField({
  icon: Icon = Search,
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  icon?: typeof Search;
  label: string;
  /** Small badge next to the label, for a caveat like "students only". */
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-clay">
        {label}
        {hint && (
          <span className="rounded-full bg-forest/8 px-1.5 py-px text-[10px] text-forest/70">
            {hint}
          </span>
        )}
      </span>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-clay"
          size={17}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // The icon sits at the end and the clear button at the start, so the
          // padding follows the reading direction rather than a fixed side.
          // Latin text and digits still render left-to-right inside an RTL
          // field on their own, so no direction is forced here.
          className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pe-10 ps-9 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </label>
  );
}
