import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ui";

interface UIState {
  /** What the user picked. "system" follows the OS setting. */
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  /** Whether interface sound cues are audible. Off silences all of them. */
  sound: boolean;
  setSound: (sound: boolean) => void;
}

/**
 * Persisted UI preferences. The key and shape are mirrored by the inline
 * boot script in index.html, which paints the theme before React mounts —
 * keep them in sync if either changes.
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      sound: true,
      setSound: (sound) => set({ sound }),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);

/** What the OS is asking for right now. */
export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/** Writes the theme to <html>; the CSS tokens key off this attribute. */
export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  // Kept in step for the leftover shadcn `.dark` variant and any library
  // that looks for the class rather than the attribute.
  root.classList.toggle("dark", resolved === "dark");
}
