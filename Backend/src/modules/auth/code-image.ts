import crypto from "node:crypto";

/**
 * ============================================================
 * THE CODE IMAGE (the second layer of the sign-in check)
 * ============================================================
 *
 * A few digits drawn as an SVG for a person to read and type. Drawn here,
 * stroke by stroke, rather than with a library: the usual one is unmaintained
 * and pulls in a font engine from 2017 — two old dependencies on the sign-in
 * path for a hundred lines of drawing.
 *
 * The digits are **paths**, never `<text>`: SVG text is markup, and a script
 * would read the code out of the file without looking at the picture. Each
 * digit is tilted, scaled and shaken on its own, and noise curves cross it.
 *
 * No image test stops a determined machine for long; this one is asked for
 * only on top of the proof of work, and only when something is already wrong
 * (./captcha): it adds a cost a script must pay on every guess.
 */

/** Digits only, and not 0 or 1 — too close to O and l or I on a small screen. */
const ALPHABET = "23456789";

/**
 * Each digit as strokes on a 10 × 16 grid (x right, y down). Points are joined
 * by smooth curves, so a few suffice for each shape.
 */
const GLYPHS: Record<string, number[][][]> = {
  "2": [[[1.5, 4], [3, 1.5], [6, 1], [8.5, 3], [8.5, 5.5], [6, 9], [1, 15], [9, 15]]],
  "3": [
    [[1.5, 2.5], [4, 1], [7.5, 1.5], [8.5, 4], [6.5, 7], [4, 7.5]],
    [[6.5, 7], [9, 10], [8.5, 13.5], [5, 15.2], [1.5, 14]],
  ],
  // Sharp corners, each doubled: rounded, a tilted 4 closes into a 9.
  "4": [[[7, 15], [7, 1.2], [6.6, 1], [6.2, 1.6], [1, 10.2], [1.3, 10.6], [9.5, 10.6]]],
  "5": [[[8.5, 1], [2.5, 1], [1.8, 7], [5, 6], [8.5, 8], [9, 11.5], [7, 14.5], [4, 15.2], [1.2, 13.5]]],
  "6": [[[8, 1.5], [5, 1.2], [2.5, 3.5], [1.2, 8], [1.5, 12], [3.5, 15], [6.5, 15], [8.8, 12.5], [8.5, 9.5], [6, 7.8], [3, 8.5], [1.4, 10.5]]],
  // Two points at the corner keep it sharp: rounded, a tilted 7 reads as ">".
  "7": [[[0.3, 1.6], [8.8, 1], [9.1, 1.4], [5.8, 7], [4.2, 15]]],
  "8": [[[5, 7.5], [2.2, 5.5], [2.2, 2.5], [5, 1], [7.8, 2.5], [7.8, 5.5], [5, 7.5], [1.5, 10.5], [2, 14], [5, 15.3], [8, 14], [8.5, 10.5], [5, 7.5]]],
  "9": [[[8.5, 6], [6, 8], [3, 7.8], [1.3, 5], [2, 2], [5, 1], [8, 2.5], [8.7, 6], [8, 11], [5.5, 14.5], [2, 15]]],
};

const WIDTH = 200;
const HEIGHT = 72;
const INK = ["#1a312d", "#26423d", "#4a3426", "#3a2f5c", "#5c2a22"];
const NOISE = ["#9c8f78", "#b8a98a", "#8aa39b", "#c7a27a"];

/** A random code of the given length — from the system's secure source. */
export function randomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

/** Drawing randomness: unpredictable enough; it decides shapes, not secrets. */
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
const fmt = (n: number) => n.toFixed(1);

/** Points joined by quadratic curves through their midpoints — a hand-drawn line. */
function smoothPath(points: number[][]): string {
  const [first, ...rest] = points;
  let d = `M${fmt(first![0]!)} ${fmt(first![1]!)}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const [x, y] = rest[i]!;
    const [nx, ny] = rest[i + 1]!;
    d += ` Q${fmt(x!)} ${fmt(y!)} ${fmt((x! + nx!) / 2)} ${fmt((y! + ny!) / 2)}`;
  }
  const last = rest[rest.length - 1] ?? first!;
  return `${d} L${fmt(last[0]!)} ${fmt(last[1]!)}`;
}

/** A curve across the whole image. */
function noiseCurve(color: string, width: number): string {
  const y = () => rand(8, HEIGHT - 8);
  const d = `M${fmt(rand(-10, 15))} ${fmt(y())} C${fmt(rand(40, 80))} ${fmt(y())} ${fmt(rand(110, 160))} ${fmt(y())} ${fmt(rand(185, 210))} ${fmt(y())}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${fmt(width)}" stroke-linecap="round" opacity="0.85"/>`;
}

/** The code drawn as an SVG, as a `data:` URL for an `<img>`. */
export function codeImage(code: string): string {
  const parts: string[] = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="#f4efe3"/>`];

  for (let i = 0; i < 4; i++) parts.push(noiseCurve(pick(NOISE), rand(1, 2.2)));
  for (let i = 0; i < 40; i++)
    parts.push(`<circle cx="${fmt(rand(0, WIDTH))}" cy="${fmt(rand(0, HEIGHT))}" r="${fmt(rand(0.6, 1.6))}" fill="${pick(NOISE)}"/>`);

  const step = (WIDTH - 30) / code.length;
  [...code].forEach((ch, i) => {
    const scale = rand(2.5, 3.1);
    const angle = (rand(-18, 18) * Math.PI) / 180;
    const cx = 15 + step * (i + 0.5) + rand(-4, 4);
    const cy = HEIGHT / 2 + rand(-5, 5);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ink = pick(INK);
    const width = rand(2.6, 3.8);
    for (const stroke of GLYPHS[ch] ?? []) {
      const points = stroke.map(([x, y]) => {
        const px = (x! - 5 + rand(-0.35, 0.35)) * scale;
        const py = (y! - 8 + rand(-0.35, 0.35)) * scale;
        return [cx + px * cos - py * sin, cy + px * sin + py * cos];
      });
      parts.push(
        `<path d="${smoothPath(points)}" fill="none" stroke="${ink}" stroke-width="${fmt(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  });

  // Two thin curves over the digits, in ink: they cross the strokes they touch.
  for (let i = 0; i < 2; i++) parts.push(noiseCurve(pick(INK), rand(1, 1.6)));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
