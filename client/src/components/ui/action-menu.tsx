import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export interface ActionMenuItem {
  key: string;
  label: string;
  /** One line under the label saying what it does. */
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  testId?: string;
}

/**
 * A button that opens a short list of related actions — so several ways of
 * doing one thing (importing, say) take one place in a toolbar, not three.
 *
 * Opens and closes like the account menu: it fades and settles in, closes on
 * a press outside it, on Escape (focus back on its button) or on choosing an
 * item. The arrow keys move between the items, and ArrowDown on the button
 * opens it straight onto the first.
 */
export function ActionMenu({
  label,
  icon: Icon,
  items,
  testId,
}: {
  label: string;
  icon: LucideIcon;
  items: ActionMenuItem[];
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPress = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPress);
    return () => document.removeEventListener("mousedown", onPress);
  }, [open]);

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    setOpen(true);
    // The items are always rendered (only hidden), so they can take focus
    // as soon as the menu stops being inert.
    requestAnimationFrame(() => focusItem(0));
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const at = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusItem(e.key === "Home" ? 0 : items.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={testId}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-forest transition ${
          open ? "border-gold bg-gold/10" : "border-forest/20 hover:border-gold hover:bg-gold/10"
        }`}
      >
        <Icon size={18} />
        {label}
        <ChevronDown size={15} className={`text-clay transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label={label}
        inert={!open}
        onKeyDown={onMenuKey}
        className={`absolute top-full end-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top transition-all duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-1.5 shadow-[0_24px_60px_-16px_rgba(26,49,45,0.45)]">
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              data-testid={item.testId}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
            >
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-gold/12 text-gold">
                <item.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-forest">{item.label}</span>
                {item.hint && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
