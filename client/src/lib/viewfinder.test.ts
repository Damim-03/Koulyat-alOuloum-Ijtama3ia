import { describe, expect, it } from "vitest";
import { bracketsPath, dimPath, grow, lerpQuad, restQuad, type Quad } from "./viewfinder";

/**
 * هندسة الإطار فوق الكاميرا: الزوايا تنتظر في الوسط، وتطير إلى زوايا رمز QR
 * حين يُرى، وتميل معه، ثمّ تعود.
 */
const square: Quad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("إطار الكاميرا", () => {
  it("ينتظر مربّعاً في وسط الصورة", () => {
    expect(restQuad(1280, 720, 0.5)).toEqual([
      { x: 460, y: 180 },
      { x: 820, y: 180 },
      { x: 820, y: 540 },
      { x: 460, y: 540 },
    ]);
  });

  it("يحيط بالرمز ولا يقع عليه", () => {
    expect(grow(square, 0.2)).toEqual([
      { x: -10, y: -10 },
      { x: 110, y: -10 },
      { x: 110, y: 110 },
      { x: -10, y: 110 },
    ]);
  });

  it("يقترب في كلّ إطارٍ خطوةً، فيصل ولا يقفز", () => {
    const moved = square.map((p) => ({ x: p.x + 50, y: p.y })) as Quad;
    expect(lerpQuad(square, moved, 0.5)[0]).toEqual({ x: 25, y: 0 });
    expect(lerpQuad(square, moved, 1)).toEqual(moved);
  });

  it("أربعة أقواسٍ، كلٌّ ذراعان على ضلعَي زاويته — فتميل مع الرمز", () => {
    expect(bracketsPath(square, 0.25)).toBe(
      "M0 25L0 0L25 0" + "M75 0L100 0L100 25" + "M100 75L100 100L75 100" + "M25 100L0 100L0 75",
    );
    // A code held tilted: the arms follow its sides, not the screen's.
    const tilted: Quad = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ];
    expect(bracketsPath(tilted, 0.5).startsWith("M25 25L50 0L75 25")).toBe(true);
  });

  it("يُعتِم ما حول الإطار", () => {
    expect(dimPath(square, 200, 150)).toBe("M0 0H200V150H0ZM0 0L100 0L100 100L0 100Z");
  });
});
