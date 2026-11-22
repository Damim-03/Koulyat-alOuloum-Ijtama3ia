import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUIStore } from "../store/ui.store";
import { useTheme } from "./use-theme";

/**
 * تبديل السمة — دائرةٌ تنبسط من موضع النقرة.
 *
 * ثلاث طرق، بحسب المتصفّح ومن يستعمله: من طلب تقليل الحركة يُبدَّل له فوراً؛
 * ومتصفّحٌ فيه View Transitions يرسمها هو؛ وغيره يُغطّى بطبقةٍ تُزال بعدها.
 * والسمة تقع في كلّ الأحوال — ولو فشل الانتقال نفسه.
 */
/** المستند كما يراه الاختبار: View Transitions حاضرةٌ أو غائبة، بشكلٍ مختصر. */
const doc = document as unknown as { startViewTransition?: unknown };
const html = document.documentElement;
let reduced = false;

beforeEach(() => {
  reduced = false;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (q: string) =>
      ({
        matches: q.includes("reduced-motion") ? reduced : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  useUIStore.setState({ theme: "light" });
  delete doc.startViewTransition;
  html.className = "";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete doc.startViewTransition;
});

describe("useTheme", () => {
  it("السمة المحفوظة تُطبَّق، و«النظام» يتبع نظام التشغيل", () => {
    const { result, rerender } = renderHook(() => useTheme());
    expect([result.current.resolved, html.dataset.theme]).toEqual(["light", "light"]);
    act(() => useUIStore.setState({ theme: "system" }));
    rerender();
    expect(result.current).toMatchObject({ theme: "system", resolved: "light" });
  });

  it("اختيارٌ لا يغيّر ما يُرى (فاتح ⇒ النظام وهو فاتح) ⇒ يُحفظ بلا حركة", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("system"));
    expect(useUIStore.getState().theme).toBe("system");
    expect(html.style.getPropertyValue("--reveal-r")).toBe("");
  });

  it("من طلب تقليل الحركة ⇒ فوراً، والدائرة من وسط الشاشة إن لم تُذكر النقرة", () => {
    reduced = true;
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect([useUIStore.getState().theme, html.dataset.theme]).toEqual(["dark", "dark"]);
    expect(html.style.getPropertyValue("--reveal-x")).toBe(`${window.innerWidth / 2}px`);
  });

  /** المدّة بسرعة الحافّة لا بزمنٍ ثابت، محصورةً بين 200 و340ms. */
  it("View Transitions: الدائرة من موضع النقرة، والسمة تقع، والصنف يُزال بعد انتهائها", async () => {
    let finish!: () => void;
    doc.startViewTransition = (cb: () => void) => {
      cb();
      return { ready: Promise.resolve(), finished: new Promise<void>((r) => (finish = r)) };
    };
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("dark", { x: 0, y: 0 }));
    expect(html.style.getPropertyValue("--reveal-x")).toBe("0px");
    expect(html.style.getPropertyValue("--reveal-ms")).toMatch(/^(2\d\d|3[0-3]\d|340)ms$/);
    expect(html.classList.contains("theme-reveal")).toBe(true);
    expect(html.dataset.theme).toBe("dark");

    await act(async () => finish());
    expect(html.classList.contains("theme-reveal")).toBe(false);
  });

  it("وانتقالٌ يفشل ⇒ السمة تقع رغم ذلك", async () => {
    let fail!: () => void;
    doc.startViewTransition = () => ({ ready: Promise.resolve(), finished: new Promise<void>((_, r) => (fail = () => r(new Error("skipped")))) });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    await act(async () => fail());
    expect([html.dataset.theme, html.classList.contains("theme-reveal")]).toEqual(["dark", false]);
  });

  it("وبلا View Transitions ⇒ طبقةٌ بلون السمة الجديدة، تُزال بعد الحركة أو بعد مهلتها", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    const overlay = document.querySelector(".theme-reveal-fallback") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(useUIStore.getState().theme).toBe("light");

    act(() => void overlay.dispatchEvent(new Event("animationend")));
    expect([useUIStore.getState().theme, html.dataset.theme, overlay.style.opacity]).toEqual(["dark", "dark", "0"]);
    act(() => void overlay.dispatchEvent(new Event("transitionend")));
    expect(document.querySelector(".theme-reveal-fallback")).toBeNull();

    // والمهلة بعدها لا تُعيد شيئاً.
    act(() => void vi.runAllTimers());
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("وحركةٌ لم تُطلق حدثها ⇒ تنتهي بالمهلة", () => {
    vi.useFakeTimers();
    useUIStore.setState({ theme: "dark" });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("light"));
    act(() => void vi.runAllTimers());
    expect([useUIStore.getState().theme, document.querySelector(".theme-reveal-fallback")]).toEqual(["light", null]);
  });
});
