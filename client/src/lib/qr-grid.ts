import type { Gray, SensedQr } from "./qr-sense";
import type { Point } from "./viewfinder";

/**
 * Reads a QR code too blurred for the decoder, from where its modules are.
 *
 * A laptop's camera, its focus fixed, blurs the small code on a student card
 * held close: the edges between modules run together, and jsQR — which finds
 * them by those edges — reads nothing. But once the code is sensed
 * (lib/qr-sense), the middles of its three finder patterns say where every
 * module is: on a grid, the patterns' middles 3.5 modules in from its corners.
 * The middle of a module keeps its colour through a blur its edge does not;
 * so each module's colour is taken there, against the modules around it, and
 * the code drawn again, sharp, for jsQR to read. A module or two taken wrong
 * are put right by the code's own error correction — and a code taken too
 * wrong to be put right is not read at all, never misread.
 */

type JsQR = typeof import("jsqr").default;

/** The sizes a code can be, in modules: versions 1 to 10 — the card's is small. */
const SIZES = [21, 25, 29, 33, 37, 41, 45, 49, 53, 57];
/**
 * The grid moved by a little, in modules: the patterns' middles are found
 * within a fraction of a module, and a grid off by half a module reads nothing.
 */
const SHIFTS: [number, number][] = [
  [0, 0],
  [0.2, 0],
  [-0.2, 0],
  [0, 0.2],
  [0, -0.2],
  [0.2, 0.2],
  [-0.2, -0.2],
  [0.2, -0.2],
  [-0.2, 0.2],
];
/** A module's colour: the mean of its middle and four points this share of a module from it — less of the camera's noise. */
const SPREAD = 0.22;
/** Dark: darker than the mean of the modules this many around it, which a shadow across the code does not fool. */
const AROUND = [2, 1, 3];
/** The code drawn again: pixels a module, and modules of light around it. */
const DRAWN_MODULE = 4;
const QUIET = 4;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

/** The brightness between pixels, from the four around. */
function brightness({ data, width: w, height: h }: Gray, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const at = (xx: number, yy: number) => data[(yy < 0 ? 0 : yy >= h ? h - 1 : yy) * w + (xx < 0 ? 0 : xx >= w ? w - 1 : xx)]!;
  return (
    at(xi, yi) * (1 - fx) * (1 - fy) + at(xi + 1, yi) * fx * (1 - fy) + at(xi, yi + 1) * (1 - fx) * fy + at(xi + 1, yi + 1) * fx * fy
  );
}

/**
 * The text of the sensed code in `gray`, read off its grid of modules — or
 * null. `thorough`: every size near the one measured, every small shift of
 * the grid, every neighbourhood (some fifty tries, for a photo taken); else a
 * few (for each frame of the live picture).
 */
export function readGrid(jsQR: JsQR, gray: Gray, sensed: SensedQr, thorough = false): string | null {
  const [a, p, q] = sensed.finders;
  // Along the top, then down the side: so a code seen as printed reads the right way.
  const [b, c] = cross(sub(p, a), sub(q, a)) >= 0 ? [p, q] : [q, p];
  const span = (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y)) / 2;
  const measured = span / sensed.module + 7;
  const sizes = [...SIZES].sort((m, n) => Math.abs(m - measured) - Math.abs(n - measured)).slice(0, thorough ? 2 : 1);
  const shifts = thorough ? SHIFTS : SHIFTS.slice(0, 5);
  const around = thorough ? AROUND : AROUND.slice(0, 1);

  for (const n of sizes) {
    // A module's step along the top and down the side.
    const u = { x: (b.x - a.x) / (n - 7), y: (b.y - a.y) / (n - 7) };
    const v = { x: (c.x - a.x) / (n - 7), y: (c.y - a.y) / (n - 7) };
    const at = (col: number, row: number) => brightness(gray, a.x + (col - 3.5) * u.x + (row - 3.5) * v.x, a.y + (col - 3.5) * u.y + (row - 3.5) * v.y);
    for (const [dx, dy] of shifts) {
      const taken = new Float32Array(n * n);
      for (let row = 0; row < n; row++)
        for (let col = 0; col < n; col++) {
          const [x, y] = [col + 0.5 + dx, row + 0.5 + dy];
          taken[row * n + col] =
            (at(x, y) + at(x + SPREAD, y) + at(x - SPREAD, y) + at(x, y + SPREAD) + at(x, y - SPREAD)) / 5;
        }
      for (const r of around) {
        const text = drawnAndRead(jsQR, taken, n, r);
        if (text) return text;
      }
    }
  }
  return null;
}

/** The modules taken, each dark or light against those `r` around it, drawn sharp — and read. */
function drawnAndRead(jsQR: JsQR, taken: Float32Array, n: number, r: number): string | null {
  const side = (n + 2 * QUIET) * DRAWN_MODULE;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, row - r); i <= Math.min(n - 1, row + r); i++)
        for (let j = Math.max(0, col - r); j <= Math.min(n - 1, col + r); j++) {
          sum += taken[i * n + j]!;
          count++;
        }
      if (taken[row * n + col]! >= sum / count) continue;
      for (let y = 0; y < DRAWN_MODULE; y++)
        for (let x = 0; x < DRAWN_MODULE; x++) {
          const i = (((row + QUIET) * DRAWN_MODULE + y) * side + (col + QUIET) * DRAWN_MODULE + x) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
    }
  return jsQR(pixels, side, side, { inversionAttempts: "dontInvert" })?.data || null;
}
