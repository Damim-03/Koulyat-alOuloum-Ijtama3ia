import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` (768px): the sidebar becomes a drawer, tables cards. */
export const PHONE_QUERY = "(max-width: 767.98px)";

// jsdom (the unit tests) has no matchMedia: there nothing matches.
const matches = (query: string) => window.matchMedia?.(query).matches ?? false;

/** Whether the screen is phone-sized right now — for a one-time default. */
export const isPhoneNow = () => matches(PHONE_QUERY);

/**
 * Whether a CSS media query matches right now — and re-renders when that
 * changes (a phone rotated, a window resized past a breakpoint).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia?.(query);
      mql?.addEventListener("change", onChange);
      return () => mql?.removeEventListener("change", onChange);
    },
    () => matches(query),
    () => false,
  );
}
