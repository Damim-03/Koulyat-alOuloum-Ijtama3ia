import { useState } from "react";
import {
  Check,
  ChevronDown,
  Crown,
  GraduationCap,
  Presentation,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type RoleValue = "student" | "professor" | "admin" | "owner";

/** Each role carries its own icon + tint, in the trigger and in the menu. */
const ROLE_STYLE: Record<RoleValue, { Icon: LucideIcon; chip: string }> = {
  student: { Icon: GraduationCap, chip: "bg-soft-sage/35 text-forest" },
  professor: { Icon: Presentation, chip: "bg-sage/20 text-sage" },
  admin: { Icon: Shield, chip: "bg-gold/20 text-gold" },
  owner: { Icon: Crown, chip: "bg-brick/15 text-brick" },
};

export interface RoleOption {
  value: RoleValue;
  label: string;
}

/**
 * Role picker with a per-role icon — a native <select> cannot render icons
 * inside its options, so this is a lightweight custom listbox.
 *
 * The menu closes via an invisible overlay rather than a document listener:
 * the dialog shell stops mousedown propagation, so a document-level handler
 * would never fire for clicks inside the panel.
 */
export function RoleSelect({
  value,
  onChange,
  options,
}: {
  value: RoleValue;
  onChange: (next: RoleValue) => void;
  options: RoleOption[];
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const { Icon, chip } = ROLE_STYLE[selected.value];

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-forest/15 bg-cream-2 px-3 py-2 text-start outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
      >
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${chip}`}>
          <Icon size={15} />
        </span>
        <span className="flex-1 text-sm font-medium text-forest">
          {selected.label}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-clay transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Click-away catcher; stops the click from reaching the dialog. */}
          <div
            className="fixed inset-0 z-20"
            onMouseDown={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <ul
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-forest/15 bg-cream-card p-1 shadow-xl"
          >
            {options.map((option) => {
              const style = ROLE_STYLE[option.value];
              const active = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition ${
                      active ? "bg-gold/10" : "hover:bg-forest/5"
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-lg ${style.chip}`}
                    >
                      <style.Icon size={15} />
                    </span>
                    <span className="flex-1 text-sm font-medium text-forest">
                      {option.label}
                    </span>
                    {active && <Check size={15} className="shrink-0 text-gold" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
