import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import {
  useUIStore,
  applyTheme,
  resolveTheme,
  systemTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from "../store/ui.store";

/* The circle has to cross the whole viewport, so a fixed duration reads
   differently on a laptop and on a wide monitor: the same milliseconds make
   the edge crawl on one and flash past on the other. Pinning the *speed*
   instead keeps the reveal looking identical everywhere, clamped so it never
   drags and never becomes a wipe. */
const EDGE_SPEED = 4.6; // px per ms
const MIN_REVEAL_MS = 200;
const MAX_REVEAL_MS = 340;

function revealDuration(radius: number) {
  const ms = radius / EDGE_SPEED;
  return Math.round(Math.min(MAX_REVEAL_MS, Math.max(MIN_REVEAL_MS, ms)));
}

/** Grows from the click point to whichever viewport corner is farthest. */
function radiusToFarthestCorner(x: number, y: number) {
  const { innerWidth: w, innerHeight: h } = window;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Reads a theme's page colour without committing to that theme. */
function pageColorFor(theme: ResolvedTheme) {
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.cssText = "position:fixed;left:-9999px;background:var(--t-cream)";
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

/** Subscribes to the OS setting so "system" tracks it live. */
function subscribeToSystem(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setStoredTheme = useUIStore((s) => s.setTheme);

  // Re-renders when the OS flips while the choice is "system".
  const osTheme = useSyncExternalStore(
    subscribeToSystem,
    systemTheme,
    () => "light" as ResolvedTheme,
  );
  const resolved: ResolvedTheme = theme === "system" ? osTheme : theme;

  // While a reveal is running it owns <html>; the sync effect must not race it
  // and paint the new theme before the old frame has been captured.
  const revealing = useRef(false);

  useEffect(() => {
    if (revealing.current) return;
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback(
    (next: ThemeChoice, origin?: { x: number; y: number }) => {
      const target = resolveTheme(next);

      if (target === resolved) {
        setStoredTheme(next); // e.g. light → system while already light
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 2;
      const root = document.documentElement;
      root.style.setProperty("--reveal-x", `${x}px`);
      root.style.setProperty("--reveal-y", `${y}px`);
      const radius = radiusToFarthestCorner(x, y);
      const revealMs = revealDuration(radius);
      root.style.setProperty("--reveal-r", `${radius}px`);
      root.style.setProperty("--reveal-ms", `${revealMs}ms`);

      if (prefersReducedMotion()) {
        setStoredTheme(next);
        applyTheme(target);
        return;
      }

      const start = (document as DocWithVT).startViewTransition;

      // ── preferred: View Transitions ──
      if (typeof start === "function") {
        revealing.current = true;
        root.classList.add("theme-reveal");

        const transition = start.call(document, () => {
          // Both halves must land in the SAME commit so the captured "new"
          // frame carries the new colours *and* the swapped icon. flushSync
          // forces React to paint the store change before the snapshot.
          flushSync(() => setStoredTheme(next));
          applyTheme(target);
        });

        const done = () => {
          root.classList.remove("theme-reveal");
          revealing.current = false;
        };
        // `finished` rejects if the browser aborts (hidden tab, interruption) —
        // settle either way so nothing is left half-applied.
        transition.finished.then(done, () => {
          applyTheme(target); // make sure the theme still lands
          done();
        });
        return;
      }

      // ── fallback: an overlay in the incoming colour opens from the point ──
      revealing.current = true;
      const overlay = document.createElement("div");
      overlay.className = "theme-reveal-fallback";
      overlay.style.setProperty("--reveal-color", pageColorFor(target));
      document.body.appendChild(overlay);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        setStoredTheme(next);
        applyTheme(target);
        revealing.current = false;
        overlay.style.transition = "opacity 90ms ease";
        overlay.style.opacity = "0";
        const drop = () => overlay.remove();
        overlay.addEventListener("transitionend", drop, { once: true });
        // Safety net: a throttled/aborted animation must never strand the
        // overlay on the page.
        window.setTimeout(drop, 200);
      };

      overlay.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, revealMs + 120);
    },
    [resolved, setStoredTheme],
  );

  return { theme, resolved, setTheme };
}
