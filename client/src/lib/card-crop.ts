import type { Point, Quad } from "./viewfinder";

/**
 * The student card in a photo, found from its QR code — so the photo kept is
 * the card, without the room around it.
 *
 * The code is printed on the card, upright with it: where it is, how big and
 * how turned says roughly where the card's edges are (the faculty's card,
 * measured below). Each edge is then looked for near there — a line where the
 * colour changes, all along it — and the photo cut a little outside the edges
 * found; outside where they should be, a little further, for those not found.
 * Never inside the card: an edge in doubt costs some background, not a corner.
 */

/** A picture's pixels, four bytes each (as a canvas gives them). */
export interface Picture {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** A part of the photo, upright, in its pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The card in the photo, with a little room around it. */
export interface CardCrop {
  /** Its corners — top-left, top-right, bottom-right, bottom-left as printed — in the photo's pixels (maybe off it). */
  corners: Quad;
  /** How far it is turned, in radians: 0 upright, π upside down. */
  angle: number;
  /** The part of the photo around it, upright, within the photo. */
  box: Box;
}

/**
 * The card's edges around its code, in the code's own sides — the code from
 * (0, 0) to (1, 1), across and down as printed. Measured on the university's
 * student card (85.6 × 54 mm): the code near the left edge, halfway down.
 */
const CARD = { left: -0.5, right: 7.05, top: -1.98, bottom: 2.8 };

/** A colour change at least this strong (|ΔR|+|ΔG|+|ΔB| across the line) may be an edge — a white card on a cream wall is about 50. */
const EDGE_MIN = 36;
/** Steps along each look across an edge, and the half-gap of the colours compared — in the code's sides. */
const STEP = 0.03;
const GAP = 0.06;

type Side = "left" | "right" | "top" | "bottom";

interface SideRule {
  /** Across the edge: the code's x (`a`) or y (`b`) — and which way is out. */
  across: "a" | "b";
  out: 1 | -1;
  /** Where the edge should be, across. */
  at: number;
  /** How far in and out of there to look — further out than in: in is the card's own print. */
  look: [inward: number, outward: number];
  /** Where along the edge to look across it. */
  along: [number, number];
  /** Kept outside the edge: found, and not found (only where it should be). */
  margin: [found: number, guessed: number];
}

const RULES: Record<Side, SideRule> = {
  left: { across: "a", out: -1, at: CARD.left, look: [0.35, 0.9], along: [CARD.top + 0.5, CARD.bottom - 0.5], margin: [0.25, 0.5] },
  // The far edge: furthest from the code, so the least sure where it is.
  right: { across: "a", out: 1, at: CARD.right, look: [1, 1.2], along: [CARD.top + 0.5, CARD.bottom - 0.5], margin: [0.35, 0.9] },
  top: { across: "b", out: -1, at: CARD.top, look: [0.25, 0.9], along: [CARD.left + 0.4, CARD.right - 0.8], margin: [0.25, 0.5] },
  bottom: { across: "b", out: 1, at: CARD.bottom, look: [0.25, 0.9], along: [CARD.left + 0.4, CARD.right - 0.8], margin: [0.25, 0.5] },
};
const LOOKS = 18;
/** Turned less than this (2°), a card is left as it is — upright enough. */
export const STRAIGHT = (2 * Math.PI) / 180;

interface Line {
  p: Point;
  /** Its direction, of length 1. */
  d: Point;
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const len = (p: Point) => Math.hypot(p.x, p.y);
const unit = (p: Point): Point => {
  const l = len(p) || 1;
  return { x: p.x / l, y: p.y / l };
};
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

/** The code's own axes: across and down as printed (a sensed code may come with two corners swapped). */
function codeFrame(q: Quad) {
  const [tl, , br] = q;
  let [, tr, , bl] = q;
  if (cross(sub(tr, tl), sub(bl, tl)) < 0) [tr, bl] = [bl, tr];
  const u = { x: (tr.x - tl.x + br.x - bl.x) / 2, y: (tr.y - tl.y + br.y - bl.y) / 2 };
  const v = { x: (bl.x - tl.x + br.x - tr.x) / 2, y: (bl.y - tl.y + br.y - tr.y) / 2 };
  const c = { x: (tl.x + tr.x + br.x + bl.x) / 4, y: (tl.y + tr.y + br.y + bl.y) / 4 };
  const o = { x: c.x - (u.x + v.x) / 2, y: c.y - (u.y + v.y) / 2 };
  return {
    at: (a: number, b: number): Point => ({ x: o.x + a * u.x + b * v.x, y: o.y + a * u.y + b * v.y }),
    u,
    v,
    center: c,
    side: (len(u) + len(v)) / 2,
  };
}

/** The layout is known within about this share of the code's side: a card past an edge by less is still whole. */
const INSIDE_SLACK = 0.3;

/**
 * The whole card in a `width`×`height` picture, by where its code is and the
 * layout above: no part of it past an edge. Past one — the card held half out
 * of the camera's sight — its photo would be cut there, whatever is done with
 * it afterwards: the card is to be brought in first.
 */
export function cardInside(qr: Quad, width: number, height: number): boolean {
  const f = codeFrame(qr);
  const [l, r, t, b] = [CARD.left + INSIDE_SLACK, CARD.right - INSIDE_SLACK, CARD.top + INSIDE_SLACK, CARD.bottom - INSIDE_SLACK];
  return [f.at(l, t), f.at(r, t), f.at(r, b), f.at(l, b)].every((p) => p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height);
}

/** The colour around a point (3 × 3 pixels), or null off the picture. */
function colourAt(pic: Picture, p: Point): [number, number, number] | null {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (x < 1 || y < 1 || x >= pic.width - 1 || y >= pic.height - 1) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const i = ((y + dy) * pic.width + x + dx) * 4;
      r += pic.data[i]!;
      g += pic.data[i + 1]!;
      b += pic.data[i + 2]!;
    }
  return [r / 9, g / 9, b / 9];
}

/** The straight line most of the points lie on — the stray ones (print, a finger) left out — or null. */
function fitLine(points: Point[], tolerance: number, need: number): Line | null {
  let kept = points;
  for (let round = 0; round < 3; round++) {
    if (kept.length < need) return null;
    const m = { x: kept.reduce((s, p) => s + p.x, 0) / kept.length, y: kept.reduce((s, p) => s + p.y, 0) / kept.length };
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of kept) {
      sxx += (p.x - m.x) ** 2;
      sxy += (p.x - m.x) * (p.y - m.y);
      syy += (p.y - m.y) ** 2;
    }
    const angle = Math.atan2(2 * sxy, sxx - syy) / 2;
    const line = { p: m, d: { x: Math.cos(angle), y: Math.sin(angle) } };
    const off = (p: Point) => Math.abs(cross(sub(p, line.p), line.d));
    const next = points.filter((p) => off(p) <= tolerance);
    if (round === 2 || next.length === kept.length) return next.length >= need ? line : null;
    kept = next;
  }
  return null;
}

/** One edge of the card: where it was found, or null. */
function findEdge(pic: Picture, frame: ReturnType<typeof codeFrame>, rule: SideRule): Line | null {
  const point = (across: number, along: number) => (rule.across === "a" ? frame.at(across, along) : frame.at(along, across));
  const points: Point[] = [];
  let looks = 0;
  for (let n = 0; n < LOOKS; n++) {
    const along = rule.along[0] + ((rule.along[1] - rule.along[0]) * n) / (LOOKS - 1);
    // From inside the card outwards: how strongly the colour changes at each step.
    const steps: { t: number; g: number }[] = [];
    let inside = false;
    for (let t = rule.at - rule.out * rule.look[0]; rule.out * (t - rule.at) <= rule.look[1]; t += rule.out * STEP) {
      const a = colourAt(pic, point(t - GAP, along));
      const b = colourAt(pic, point(t + GAP, along));
      if (!a || !b) continue;
      inside = true;
      steps.push({ t, g: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) });
    }
    if (!inside) continue;
    looks++;
    // The changes strong enough, at their peak — the one nearest where the edge should be.
    let best: { t: number; g: number } | null = null;
    for (let i = 1; i < steps.length - 1; i++) {
      const s = steps[i]!;
      if (s.g < EDGE_MIN || s.g < steps[i - 1]!.g || s.g < steps[i + 1]!.g) continue;
      if (!best || Math.abs(s.t - rule.at) < Math.abs(best.t - rule.at)) best = s;
    }
    if (best) points.push(point(best.t, along));
  }
  // Half the looks that saw the picture agree on one straight edge — or it is not found.
  return fitLine(points, Math.max(1.5, frame.side * 0.08), Math.max(5, Math.ceil(looks / 2)));
}

function meet(a: Line, b: Line): Point | null {
  const den = cross(a.d, b.d);
  if (Math.abs(den) < 0.2) return null; // nearly parallel: not two sides of a card
  const t = cross(sub(b.p, a.p), b.d) / den;
  return { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
}

/** The four corners the edges make — if they make a card's shape, more or less (perspective, the room kept). */
function cornersOf(by: Record<Side, Line>, side: number): Point[] | null {
  const c = [meet(by.top, by.left), meet(by.top, by.right), meet(by.bottom, by.right), meet(by.bottom, by.left)];
  if (c.some((p) => !p)) return null;
  const [tl, tr, br, bl] = c as Point[];
  const wide = (len(sub(tr!, tl!)) + len(sub(br!, bl!))) / 2;
  const tall = (len(sub(bl!, tl!)) + len(sub(br!, tr!))) / 2;
  const ratio = wide / tall;
  if (ratio < 1.15 || ratio > 2.1 || tall < side * 3 || tall > side * 8) return null;
  return c as Point[];
}

/**
 * The card around the code at `qr` (its four corners, in the photo's pixels),
 * with a little room — or null when there is nothing to gain (an upright card
 * filling the photo) or no card to speak of.
 */
export function cardCrop(pic: Picture, qr: Quad): CardCrop | null {
  const frame = codeFrame(qr);
  if (frame.side < 12) return null; // too small a code to say where its card is

  const sides = (Object.keys(RULES) as Side[]).map((side) => {
    const rule = RULES[side];
    // Where it should be: along the code's own side.
    const guess: Line = {
      p: rule.across === "a" ? frame.at(rule.at, 0.5) : frame.at(0.5, rule.at),
      d: unit(rule.across === "a" ? frame.v : frame.u),
    };
    return { side, rule, guess, found: findEdge(pic, frame, rule) };
  });
  /** The edges moved outwards — away from the code — by the room kept. */
  const edges = (useFound: boolean) =>
    Object.fromEntries(
      sides.map(({ side, rule, guess, found }) => {
        const line = (useFound && found) || guess;
        const n = { x: -line.d.y, y: line.d.x };
        const away = cross(sub(line.p, frame.center), line.d) < 0 ? 1 : -1;
        const room = (useFound && found ? rule.margin[0] : rule.margin[1]) * frame.side * away;
        return [side, { p: { x: line.p.x + n.x * room, y: line.p.y + n.y * room }, d: line.d }];
      }),
    ) as Record<Side, Line>;

  // The edges found — unless they make no card (something else taken for an
  // edge): then where they should be.
  const pts = cornersOf(edges(true), frame.side) ?? cornersOf(edges(false), frame.side);
  if (!pts) return null;

  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))));
  const x1 = Math.min(pic.width, Math.ceil(Math.max(...pts.map((p) => p.x))));
  const y1 = Math.min(pic.height, Math.ceil(Math.max(...pts.map((p) => p.y))));
  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  if (box.w < 64 || box.h < 40) return null;
  const [tl, tr, br, bl] = pts as [Point, Point, Point, Point];
  const angle = Math.atan2(tr.y - tl.y + br.y - bl.y, tr.x - tl.x + br.x - bl.x);
  // An upright card already filling the photo: nothing to cut, nothing to turn.
  if (Math.abs(angle) < STRAIGHT && box.w * box.h > pic.width * pic.height * 0.9) return null;
  return { corners: [tl, tr, br, bl], angle, box };
}

