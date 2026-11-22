import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { Countdown } from "./countdown";

/**
 * العدّ التنازليّ: المدّة أيّاماً وساعاتٍ ودقائقَ وثوانيَ، كلٌّ في لوحه
 * برقمين؛ واسمٌ يقرؤه قارئ الشاشة بالمدّة كاملة — والمدّة المنقضية أصفار
 * لا أرقامٌ سالبة.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const unit = (key: string) => document.querySelector(`[data-unit="${key}"] span[dir="ltr"]`)!.textContent;
const ms = (d: number, h: number, m: number, s: number) => ((d * 24 + h) * 60 + m) * 60_000 + s * 1000 + 400;

describe("Countdown", () => {
  it("يومان و03:04:05 ⇒ لوحٌ لكلّ وحدةٍ برقمين واسمها، واسمٌ كاملٌ للمؤقّت", () => {
    render(<Countdown ms={ms(2, 3, 4, 5)} label="تنتهي الفترة بعد" />);
    expect(["days", "hours", "minutes", "seconds"].map(unit)).toEqual(["02", "03", "04", "05"]);
    for (const k of ["days", "hours", "minutes", "seconds"]) expect(screen.getByText(t(`countdown.${k}`))).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: `تنتهي الفترة بعد ${t("countdown.aria", { count: 2, time: "03:04:05" })}` })).toBeInTheDocument();
  });

  it("ومئة يومٍ وأكثر تُكتب كاملة؛ والصغير بالأرقام نفسها", () => {
    render(<Countdown ms={ms(120, 0, 0, 9)} label="x" size="sm" />);
    expect(unit("days")).toBe("120");
    expect(unit("seconds")).toBe("09");
  });

  it("وما انقضى أصفار، لا أرقامٌ سالبة", () => {
    render(<Countdown ms={-5000} label="x" />);
    expect(["days", "hours", "minutes", "seconds"].map(unit)).toEqual(["00", "00", "00", "00"]);
  });
});
