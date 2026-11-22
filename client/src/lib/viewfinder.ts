/**
 * The viewfinder over a live picture, in the picture's own pixels: four
 * corner brackets that wait in the middle, fly to the four corners of a QR
 * code once one is seen — tilting with it, in perspective — follow it as it
 * moves, and glide back when it is lost. Outside them the picture is dimmed.
 */

export type Point = { x: number; y: number };
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** Where the brackets wait: a square in the middle, `side` of the picture's height. */
export function restQuad(width: number, height: number, side = 0.46): Quad {
  const s = height * side;
  const x = (width - s) / 2;
  const y = (height - s) / 2;
  return [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];
}

const center = (q: Quad): Point => ({
  x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
  y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
});

/** The corners moved away from the middle by `by` — the brackets around the code, not on it. */
export function grow(q: Quad, by = 0.2): Quad {
  const c = center(q);
  return q.map((p) => ({ x: c.x + (p.x - c.x) * (1 + by), y: c.y + (p.y - c.y) * (1 + by) })) as Quad;
}

/** A step of `k` (0–1) from `a` towards `b`: called every frame, it eases in. */
export function lerpQuad(a: Quad, b: Quad, k: number): Quad {
  return a.map((p, i) => ({ x: p.x + (b[i]!.x - p.x) * k, y: p.y + (b[i]!.y - p.y) * k })) as Quad;
}

const round = (n: number) => Math.round(n * 10) / 10;
const toward = (from: Point, to: Point, length: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / d) * length, y: from.y + (dy / d) * length };
};

/**
 * The four brackets as one SVG path: from each corner, an arm along each of
 * its two sides — `ratio` of the shorter side long — so they lean with the code.
 */
export function bracketsPath(q: Quad, ratio = 0.28): string {
  const side = (i: number) => Math.hypot(q[(i + 1) % 4]!.x - q[i]!.x, q[(i + 1) % 4]!.y - q[i]!.y);
  const arm = Math.min(side(0), side(1), side(2), side(3)) * ratio;
  return q
    .map((p, i) => {
      const a = toward(p, q[(i + 3) % 4]!, arm);
      const b = toward(p, q[(i + 1) % 4]!, arm);
      return `M${round(a.x)} ${round(a.y)}L${round(p.x)} ${round(p.y)}L${round(b.x)} ${round(b.y)}`;
    })
    .join("");
}

/** Everything outside the brackets, to be dimmed (drawn with fill-rule evenodd). */
export function dimPath(q: Quad, width: number, height: number): string {
  const hole = q.map((p, i) => `${i ? "L" : "M"}${round(p.x)} ${round(p.y)}`).join("");
  return `M0 0H${width}V${height}H0Z${hole}Z`;
}
