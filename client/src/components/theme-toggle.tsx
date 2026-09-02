import { useRef } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { useTranslation } from "react-i18next";

/**
 * Light/dark switch. The circle opens from this button's centre, so the
 * reveal reads as the theme spreading out from where the user pressed.
 *
 * Both icons are always mounted and cross-faded with a rotation, which keeps
 * the swap continuous instead of a hard icon replacement.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { resolved, setTheme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);
  const isDark = resolved === "dark";

  function toggle() {
    const el = ref.current;
    const box = el?.getBoundingClientRect();

    // Phase 1 — a short press before the reveal opens, so the animation reads
    // as coming *from* the button. Web Animations rather than a CSS class:
    // it composites on transform only and needs no state to unwind.
    if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.88)" },
          { transform: "scale(1)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    }

    setTheme(
      isDark ? "light" : "dark",
      box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : undefined,
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t("common.switchToLight") : t("common.switchToDark")}
      title={isDark ? t("common.lightMode") : t("common.darkMode")}
      // Inherits the surface it sits on — cream on the dark navbar, forest on a
      // light dashboard header — the same way the language switcher does.
      className={`theme-toggle-vt group relative grid size-9 shrink-0 place-items-center rounded-xl border border-current/20 text-current transition-colors duration-300 hover:border-gold hover:bg-current/10 hover:text-gold focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none ${className}`}
    >
      {/* the two icons occupy the same cell and trade places */}
      <span className="relative grid size-[18px] place-items-center">
        <Sun
          size={17}
          aria-hidden
          className={`col-start-1 row-start-1 transition-all duration-500 ease-[cubic-bezier(0.22,0.9,0.24,1)] ${
            isDark
              ? "scale-50 rotate-90 opacity-0"
              : "scale-100 rotate-0 opacity-100"
          }`}
        />
        <Moon
          size={16}
          aria-hidden
          className={`col-start-1 row-start-1 transition-all duration-500 ease-[cubic-bezier(0.22,0.9,0.24,1)] ${
            isDark
              ? "scale-100 rotate-0 opacity-100"
              : "-rotate-90 scale-50 opacity-0"
          }`}
        />
      </span>
    </button>
  );
}
