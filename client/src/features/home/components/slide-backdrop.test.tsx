import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../i18n/i18n";
import { SlideBackdrop } from "./slide-backdrop";

/**
 * خلفية الرأس من صور الإدارة: تتعاقب كلّ تسع ثوانٍ، ولا تظهر صورةٌ قبل أن
 * تكتمل، وتقف ما دام المؤشّر أو التركيز على أزرارها — ولا تتحرّك أصلاً لمن
 * طلب من نظامه تقليل الحركة.
 */
const slides = ["أ", "ب", "ج"].map((caption, i) => ({ id: `s${i}`, imageUrl: `/uploads/cards/${i}.jpg`, caption }));
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const goTo = (n: number) => t("hero.slides.goTo", { n, total: 3 });
const current = () => screen.getAllByRole("button", { current: true })[0]!.getAttribute("aria-label");
const images = (c: HTMLElement) => Array.from(c.querySelectorAll("img"));
// أزرارها تقرأ اتّجاه اللغة من الرابط.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter initialEntries={["/ar/about"]}>{children}</MemoryRouter> });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("خلفية الشرائح", () => {
  it("الصورة لا تظهر قبل اكتمالها، ثمّ تتعاقب وحدها", () => {
    vi.useFakeTimers();
    const { container } = render(<SlideBackdrop slides={slides} controls />);
    expect(images(container)[0]!.className).toContain("opacity-0");
    fireEvent.load(images(container)[0]!);
    fireEvent.load(images(container)[0]!);
    expect(images(container)[0]!.className).toContain("opacity-100");
    expect(current()).toBe(goTo(1));
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(goTo(2));
  });

  it("المؤشّر والتركيز على الأزرار يوقفانها؛ والخروج يعيدها؛ والإيقاف يوقفها", () => {
    vi.useFakeTimers();
    render(<SlideBackdrop slides={slides} controls />);
    const box = screen.getByRole("button", { name: goTo(1) }).closest("div.absolute") as HTMLElement;
    fireEvent.mouseEnter(box);
    act(() => vi.advanceTimersByTime(20_000));
    expect(current()).toBe(goTo(1));
    fireEvent.mouseLeave(box);

    fireEvent.focus(screen.getByRole("button", { name: goTo(2) }));
    act(() => vi.advanceTimersByTime(20_000));
    expect(current()).toBe(goTo(1));
    // تركيزٌ ينتقل داخل الأزرار لا يُعيدها.
    fireEvent.blur(screen.getByRole("button", { name: goTo(2) }), { relatedTarget: screen.getByRole("button", { name: goTo(3) }) });
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(goTo(1));
    fireEvent.blur(screen.getByRole("button", { name: goTo(3) }), { relatedTarget: null });
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(goTo(2));

    fireEvent.click(screen.getByRole("button", { name: goTo(1) }));
    expect(current()).toBe(goTo(1));
    fireEvent.click(screen.getByRole("button", { name: t("hero.slides.pause") }));
    act(() => vi.advanceTimersByTime(20_000));
    expect(current()).toBe(goTo(1));
  });

  it("من طلب تقليل الحركة ⇒ لا تعاقب ولا تقريب", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<SlideBackdrop slides={slides} controls />);
    fireEvent.load(images(container)[0]!);
    expect(images(container)[0]!.className).toContain("scale-100");
    act(() => vi.advanceTimersByTime(20_000));
    expect(current()).toBe(goTo(1));
    expect(screen.getByRole("button", { name: t("hero.slides.play") })).toBeInTheDocument();
  });

  it("بلا أزرار في لوحة الدخول، وصورةٌ واحدة بلا أزرار، ولا صور ⇒ لا شيء", () => {
    const { container, rerender } = render(<SlideBackdrop slides={slides} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    rerender(<SlideBackdrop slides={slides.slice(0, 1)} controls />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(images(container)).toHaveLength(1);
    rerender(<SlideBackdrop slides={[]} controls />);
    expect(container).toBeEmptyDOMElement();
  });
});
