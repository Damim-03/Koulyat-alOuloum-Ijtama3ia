import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { SiteLang } from "../../../../types/site.types";

export const CONTENT_LANGS: { code: SiteLang; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
];

export const langDir = (lang: SiteLang) => (lang === "ar" ? "rtl" : "ltr");

/** حال كلّ لغة: العربية مكتملةٌ أو ناقصة، والترجمة كاملةٌ أو جزئيةٌ أو غائبة. */
export type LangStatus = "done" | "missing" | "partial" | "empty";

/** مغادرة الصفحة بتغييراتٍ غير محفوظة تُنبَّه. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/**
 * الجزء الظاهر من التبويب، في الرابط (`?part=images`) كالتبويب نفسه: يُفتح
 * من حيث تُرك ويُشارَك. والجزء الأوّل لا يُكتب.
 */
export function usePart<T extends string>(parts: readonly [T, ...T[]]) {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("part") as T | null;
  const part: T = raw && parts.includes(raw) ? raw : parts[0];

  function select(next: T) {
    const params = new URLSearchParams(sp);
    if (next === parts[0]) params.delete("part");
    else params.set("part", next);
    setSp(params, { replace: true });
  }

  return [part, select] as const;
}
