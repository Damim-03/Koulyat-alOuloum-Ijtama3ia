import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../../i18n/i18n";
import { PlatformGallery, type GalleryVariant } from "./platform-gallery";

/**
 * معرض صور المنصّة: يدور وحده كلّ ستّ ثوانٍ، ويُقلَّب بالأسهم والنقاط
 * والمصغّرات ولوحة المفاتيح والسحب — باتّجاه اللغة.
 *
 * يُحرس: أنّ «السابق» نحو بداية السطر (يمينٌ في العربية، يسارٌ في
 * الفرنسية)؛ وأنّ الدوران يقف بالإيقاف وبالمرور فوقه؛ وأنّ السحب القصير
 * لا يقلب؛ وأنّ المعرض الفارغ لا يُرسم.
 */
const slides = ["أ", "ب", "ج"].map((caption, i) => ({ id: `s${i}`, imageUrl: `/uploads/cards/${i}.jpg`, caption }));
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

function setup(variant: GalleryVariant = "full", lang = "ar") {
  i18n.changeLanguage(lang);
  const user = userEvent.setup({ delay: null });
  const view = render(
    <MemoryRouter initialEntries={[`/${lang}/about`]}>
      <PlatformGallery slides={slides} variant={variant} />
    </MemoryRouter>,
  );
  const region = () => screen.getByRole("region");
  // المصغّرة (أو شريط التقدّم في hero) الحاليّة تحمل aria-current.
  const current = () => screen.getAllByRole("button", { current: true })[0]!.getAttribute("aria-label");
  const goTo = (n: number) => t("hero.slides.goTo", { n, total: 3 });
  return { user, view, region, current, goTo };
}

afterEach(() => {
  vi.useRealTimers();
  i18n.changeLanguage("ar");
});

describe("معرض الصور", () => {
  it("يدور وحده؛ والإيقاف يوقفه، والتشغيل يعيده؛ والمرور فوقه يوقفه", () => {
    vi.useFakeTimers();
    const { region, current, goTo } = setup();
    expect(current()).toBe(goTo(1));
    act(() => vi.advanceTimersByTime(6000));
    expect(current()).toBe(goTo(2));

    fireEvent.click(screen.getByRole("button", { name: t("hero.slides.pause") }));
    act(() => vi.advanceTimersByTime(12_000));
    expect(current()).toBe(goTo(2));
    fireEvent.click(screen.getByRole("button", { name: t("hero.slides.play") }));

    fireEvent.mouseEnter(region());
    act(() => vi.advanceTimersByTime(12_000));
    expect(current()).toBe(goTo(2));
    fireEvent.mouseLeave(region());
    act(() => vi.advanceTimersByTime(6000));
    expect(current()).toBe(goTo(3));
  });

  it("الأسهم والنقاط والمصغّرات تقلّب، والدوران يلتفّ من الأخيرة إلى الأولى", async () => {
    const { user, current, goTo } = setup();
    await user.click(screen.getByRole("button", { name: t("hero.slides.previous") }));
    expect(current()).toBe(goTo(3));
    await user.click(screen.getByRole("button", { name: t("hero.slides.next") }));
    expect(current()).toBe(goTo(1));
    await user.click(screen.getByRole("button", { name: goTo(2) }));
    expect(current()).toBe(goTo(2));
    await user.click(screen.getByRole("button", { name: goTo(3) }));
    expect(current()).toBe(goTo(3));
  });

  it("لوحة المفاتيح والسحب باتّجاه اللغة: في العربية اليمين «سابق» والسحب نحو اليمين «تالٍ»", () => {
    const { region, current, goTo } = setup();
    fireEvent.keyDown(region(), { key: "ArrowLeft" });
    expect(current()).toBe(goTo(2));
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    expect(current()).toBe(goTo(1));

    fireEvent.pointerDown(region(), { clientX: 100 });
    fireEvent.pointerUp(region(), { clientX: 200 });
    expect(current()).toBe(goTo(2));
    // سحبٌ قصير لا يقلب، ورفعٌ بلا ضغط لا يُحسب.
    fireEvent.pointerDown(region(), { clientX: 100 });
    fireEvent.pointerUp(region(), { clientX: 120 });
    fireEvent.pointerUp(region(), { clientX: 400 });
    expect(current()).toBe(goTo(2));
    fireEvent.pointerDown(region(), { clientX: 300 });
    fireEvent.pointerCancel(region());
    fireEvent.pointerUp(region(), { clientX: 0 });
    expect(current()).toBe(goTo(2));
  });

  it("وفي الفرنسية ينقلب الاتّجاه", () => {
    const { region, current } = setup("full", "fr");
    const goTo = (n: number) => String(i18n.t("hero.slides.goTo", { n, total: 3 }));
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    expect(current()).toBe(goTo(2));
    fireEvent.pointerDown(region(), { clientX: 300 });
    fireEvent.pointerUp(region(), { clientX: 100 });
    expect(current()).toBe(goTo(3));
  });

  it("hero: أشرطة تقدّمٍ بدل المؤقّت — انتهاء الشريط يقلب، والنقر على شريطٍ ينقل إليه", async () => {
    const { user, current, goTo } = setup("hero");
    const bar = () => screen.getByRole("button", { name: goTo(Number(current()!.match(/\d/)![0])) }).querySelector("span span") as HTMLElement;
    // jsdom بلا AnimationEvent، فيستمع React إلى الاسم ذي البادئة.
    fireEvent(bar(), new Event("webkitAnimationEnd", { bubbles: true }));
    expect(current()).toBe(goTo(2));
    await user.click(screen.getByRole("button", { name: goTo(1) }));
    expect(current()).toBe(goTo(1));
    // موقوفاً: الشريط ممتلئٌ بلا حركة.
    await user.click(screen.getByRole("button", { name: t("hero.slides.pause") }));
    expect(bar().style.animation).toBe("");
  });

  it("المضغوط بلا إيقافٍ ولا مصغّرات؛ والفارغ لا يُرسم", () => {
    const { view, goTo } = setup("compact");
    expect(screen.queryByRole("button", { name: t("hero.slides.pause") })).toBeNull();
    expect(screen.queryByRole("button", { name: goTo(1) })).toBeNull();
    view.unmount();
    const empty = render(
      <MemoryRouter initialEntries={["/ar/about"]}>
        <PlatformGallery slides={[]} />
      </MemoryRouter>,
    );
    expect(empty.container).toBeEmptyDOMElement();
  });
});
