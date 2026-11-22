import type { Point, Quad } from "./viewfinder";

/**
 * Senses a QR code in a picture before it can be read.
 *
 * A decoder (jsQR) says where a code is only once it has read it — and a
 * laptop camera seldom reads the small code on a student card at once: a
 * couple of pixels per module, a fixed focus. So, as Telegram's scanner does,
 * the code is first *sensed*: its three finder patterns — the squares in three
 * of its corners, dark–light–dark–light–dark in the proportions 1:1:3:1:1
 * across any line through their middle — are looked for, and three of them
 * forming a right angle say where the code is and how it is turned. The
 * viewfinder goes there, and the decoder is pointed at that patch, enlarged.
 */

export interface Gray {
  data: Uint8Array;
  width: number;
  height: number;
}

/** A code sensed: its corners, its module's size in pixels — and the middles of its three finder patterns. */
export interface SensedQr {
  quad: Quad;
  module: number;
  /** The pattern at the corner between the other two first; those two in either order. */
  finders: [Point, Point, Point];
}

/** The picture's brightness, one byte per pixel. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) {
    data[j] = (rgba[i]! * 77 + rgba[i + 1]! * 150 + rgba[i + 2]! * 29) >> 8;
  }
  return { data, width, height };
}

/**
 * Two neighbourhoods, each the picture's shorter side divided by its number:
 * a small one, for the thin rings of a small, blurred code; and a large one,
 * for the solid middle of a big code held close — wider than the small one.
 */
const NEAR_DIV = 48;
const FAR_DIV = 12;
/** Dark: below this share of the small neighbourhood's mean brightness… */
const DARK_NEAR = 0.92;
/** …or below this share of the large one's. */
const DARK_FAR = 0.7;
/**
 * The second look's neighbourhood — about a module of a small code across —
 * and how much darker than it a pixel must be: a little (see binarizeFine).
 */
const FINE_DIV = 180;
const DARK_FINE = 0.965;

/** Sums of brightness over every rectangle from the top-left corner: any box's mean, in four lookups. */
function integral({ data, width: w, height: h }: Gray): Uint32Array {
  const sum = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x]!;
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1]! + row;
    }
  }
  return sum;
}

/**
 * Dark (1) or light (0), each pixel against the brightness around it — so a
 * shadow across the card, or a dim room, does not turn the code into one blot.
 */
function binarize(gray: Gray): Uint8Array {
  const { data, width: w, height: h } = gray;
  const sum = integral(gray);
  const near = Math.max(6, Math.round(Math.min(w, h) / NEAR_DIV));
  const far = Math.max(near * 2, Math.round(Math.min(w, h) / FAR_DIV));
  const stride = w + 1;
  const out = new Uint8Array(w * h);
  // Plain arithmetic in the loop: it runs for every pixel of every frame.
  for (let y = 0; y < h; y++) {
    const ny0 = y - near < 0 ? 0 : y - near;
    const ny1 = y + near + 1 > h ? h : y + near + 1;
    const fy0 = y - far < 0 ? 0 : y - far;
    const fy1 = y + far + 1 > h ? h : y + far + 1;
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x]!;
      const nx0 = x - near < 0 ? 0 : x - near;
      const nx1 = x + near + 1 > w ? w : x + near + 1;
      const sn = sum[ny1 * stride + nx1]! - sum[ny0 * stride + nx1]! - sum[ny1 * stride + nx0]! + sum[ny0 * stride + nx0]!;
      if (v * (ny1 - ny0) * (nx1 - nx0) < sn * DARK_NEAR) {
        out[y * w + x] = 1;
        continue;
      }
      const fx0 = x - far < 0 ? 0 : x - far;
      const fx1 = x + far + 1 > w ? w : x + far + 1;
      const sf = sum[fy1 * stride + fx1]! - sum[fy0 * stride + fx1]! - sum[fy1 * stride + fx0]! + sum[fy0 * stride + fx0]!;
      if (v * (fy1 - fy0) * (fx1 - fx0) < sf * DARK_FAR) out[y * w + x] = 1;
    }
  }
  return out;
}

/**
 * Dark or light again, each pixel against only the few around it, and dark
 * if a little darker than they are. A small code a webcam holds close and out
 * of focus — two or three pixels a module — has rings a module thin, washed
 * almost into the light on either side: against the larger neighbourhoods,
 * which take in the dark middle of the pattern too, such a ring comes out
 * light, and the pattern is lost. Here it stays dark.
 */
function binarizeFine(gray: Gray): Uint8Array {
  const { data, width: w, height: h } = gray;
  const sum = integral(gray);
  const r = Math.max(3, Math.round(Math.min(w, h) / FINE_DIV));
  const stride = w + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = y - r < 0 ? 0 : y - r;
    const y1 = y + r + 1 > h ? h : y + r + 1;
    for (let x = 0; x < w; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r + 1 > w ? w : x + r + 1;
      const s = sum[y1 * stride + x1]! - sum[y0 * stride + x1]! - sum[y1 * stride + x0]! + sum[y0 * stride + x0]!;
      if (data[y * w + x]! * (y1 - y0) * (x1 - x0) < s * DARK_FINE) out[y * w + x] = 1;
    }
  }
  return out;
}

/** Five runs in the proportions 1:1:3:1:1 — the module size, or 0. A webcam's blur is allowed for. */
function finderModule(runs: number[]): number {
  const total = runs[0]! + runs[1]! + runs[2]! + runs[3]! + runs[4]!;
  if (total < 7) return 0;
  const m = total / 7;
  const slack = m * 0.75;
  return Math.abs(runs[0]! - m) < slack &&
    Math.abs(runs[1]! - m) < slack &&
    Math.abs(runs[2]! - 3 * m) < 3 * slack &&
    Math.abs(runs[3]! - m) < slack &&
    Math.abs(runs[4]! - m) < slack
    ? m
    : 0;
}

/** Up and down from a horizontal hit: the same proportions across — and the true middle. */
function crossCheck(bin: Uint8Array, w: number, h: number, x: number, y: number, limit: number): { y: number; m: number } | null {
  const at = (yy: number) => bin[yy * w + x]!;
  const runs = [0, 0, 0, 0, 0];
  /** Counts pixels of one colour into `runs[slot]`, stepping by `step` from `from`; where it stopped. */
  const walk = (from: number, step: 1 | -1, dark: 0 | 1, slot: number) => {
    let yy = from;
    while (yy >= 0 && yy < h && at(yy) === dark && runs[slot]! <= limit) {
      runs[slot]!++;
      yy += step;
    }
    return yy;
  };
  // Up from the middle: the dark middle, the light ring, the dark ring…
  walk(walk(walk(y, -1, 1, 2), -1, 0, 1), -1, 1, 0);
  // …and down: the rest of the middle, the light ring, the dark ring.
  const end = walk(walk(walk(y + 1, 1, 1, 2), 1, 0, 3), 1, 1, 4);
  const m = finderModule(runs);
  if (!m) return null;
  return { y: end - runs[4]! - runs[3]! - runs[2]! / 2, m };
}

interface Candidate extends Point {
  m: number;
  hits: number;
}

/**
 * Every finder pattern in the picture, made dark-or-light as `bin`: its
 * middle, its module size, how many lines crossed it — added to those `found`
 * already (one seen again counts as crossed once more).
 */
function finderPatterns(gray: Gray, bin: Uint8Array, found: Candidate[] = []): Candidate[] {
  const { width: w, height: h } = gray;
  const add = (x: number, y: number, m: number) => {
    const near = found.find((c) => Math.abs(c.x - x) < c.m * 2.5 && Math.abs(c.y - y) < c.m * 2.5 && Math.max(c.m, m) / Math.min(c.m, m) < 1.8);
    if (!near) return void found.push({ x, y, m, hits: 1 });
    const n = near.hits;
    near.x = (near.x * n + x) / (n + 1);
    near.y = (near.y * n + y) / (n + 1);
    near.m = (near.m * n + m) / (n + 1);
    near.hits = n + 1;
  };

  for (let y = 0; y < h; y += 2) {
    const runs = [0, 0, 0, 0, 0];
    let state = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (bin[row + x] === 1) {
        if (state === 1 || state === 3) state++;
        runs[state]!++;
      } else if (state === 0 || state === 2) {
        if (state === 0 && runs[0] === 0) continue;
        state++;
        runs[state]!++;
      } else if (state === 4) {
        const m = finderModule(runs);
        if (m) {
          const cx = Math.round(x - runs[4]! - runs[3]! - runs[2]! / 2);
          const v = crossCheck(bin, w, h, cx, y, Math.ceil(m * 5));
          if (v && Math.max(v.m, m) / Math.min(v.m, m) < 1.6) add(cx, v.y, (m + v.m) / 2);
        }
        runs[0] = runs[2]!;
        runs[1] = runs[3]!;
        runs[2] = runs[4]!;
        runs[3] = 1;
        runs[4] = 0;
        state = 3;
      } else {
        runs[state]!++;
      }
    }
  }
  return found;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Where a QR code is in the picture, sensed from its finder patterns — the
 * four corners of the code itself, in order around it — or null.
 *
 * Looked for twice if need be: the second look, finer (binarizeFine), finds
 * the patterns of a small blurred code that the first misses — and specks in
 * a plain wall too, so it is taken only when the first found no code, and
 * only as three patterns at a right angle, with what the first found.
 */
export function senseQr(gray: Gray): SensedQr | null {
  const found = finderPatterns(gray, binarize(gray));
  const best = codeCorners(found) ?? codeCorners(finderPatterns(gray, binarizeFine(gray), found));
  if (!best) return null;

  // From the patterns' middles to the code's own corners: 3.5 modules out along each side.
  const { a, b, c } = best;
  const m = (a.m + b.m + c.m) / 3;
  const unit = (p: Point, q: Point) => {
    const d = dist(p, q) || 1;
    return { x: (q.x - p.x) / d, y: (q.y - p.y) / d };
  };
  const u = unit(a, b);
  const v = unit(a, c);
  const d = { x: b.x + c.x - a.x, y: b.y + c.y - a.y };
  const out = (p: Point, su: number, sv: number) => ({ x: p.x + 3.5 * m * (su * u.x + sv * v.x), y: p.y + 3.5 * m * (su * u.y + sv * v.y) });
  return {
    quad: [out(a, -1, -1), out(b, 1, -1), out(d, 1, 1), out(c, -1, 1)],
    module: m,
    finders: [a, b, c].map(({ x, y }) => ({ x, y })) as SensedQr["finders"],
  };
}

/**
 * Of the patterns found, the three that are a code's: at a right angle, two
 * equal sides, the same size — `a` at the corner between `b` and `c` — or null.
 */
function codeCorners(found: Candidate[]): { a: Candidate; b: Candidate; c: Candidate } | null {
  const all = found
    .filter((c) => c.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 12);
  let best: { score: number; a: Candidate; b: Candidate; c: Candidate } | null = null;

  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      for (let k = j + 1; k < all.length; k++) {
        const t = [all[i]!, all[j]!, all[k]!];
        const ms = t.map((p) => p.m);
        if (Math.max(...ms) / Math.min(...ms) > 1.6) continue;
        // The corner with the right angle is the one opposite the longest side.
        const sides = [dist(t[1]!, t[2]!), dist(t[0]!, t[2]!), dist(t[0]!, t[1]!)];
        const hyp = Math.max(...sides);
        const corner = sides.indexOf(hyp);
        const a = t[corner]!;
        const [b, c] = t.filter((_, n) => n !== corner) as [Candidate, Candidate];
        const l1 = dist(a, b);
        const l2 = dist(a, c);
        const m = (ms[0]! + ms[1]! + ms[2]!) / 3;
        // Version 1 has 14 modules between the patterns' middles; past version 10, the card's code is not one.
        if (Math.min(l1, l2) < m * 11 || Math.max(l1, l2) > m * 60) continue;
        const legs = Math.max(l1, l2) / Math.min(l1, l2);
        const square = Math.abs(hyp / Math.hypot(l1, l2) - 1);
        if (legs > 1.35 || square > 0.18) continue;
        const score = (legs - 1) + square;
        if (!best || score < best.score) best = { score, a, b, c };
      }
  return best;
}
