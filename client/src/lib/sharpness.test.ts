import { describe, expect, it } from "vitest";
import { sharpness } from "./sharpness";
import type { Gray } from "./qr-sense";

/** أوضح الإطارات: الصورة الحادّة الحوافّ أعلى درجةً من نفسها مموّهةً. */

/** Black and white squares, `cell` pixels each — a QR code's kind of detail. */
function squares(size = 96, cell = 6): Gray {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? 230 : 25;
  return { data, width: size, height: size };
}

/** The same, blurred: each pixel the mean of the (2r+1)² around it. */
function blurred(g: Gray, r: number): Gray {
  const { width: w, height: h } = g;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const [sx, sy] = [x + dx, y + dy];
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          sum += g.data[sy * w + sx]!;
          n++;
        }
      data[y * w + x] = Math.round(sum / n);
    }
  return { data, width: w, height: h };
}

describe("حدّة الصورة", () => {
  it("الحادّة أعلى من المموّهة، والأشدّ تمويهاً أدنى", () => {
    const sharp = sharpness(squares());
    const soft = sharpness(blurred(squares(), 1));
    const softer = sharpness(blurred(squares(), 3));
    expect(sharp).toBeGreaterThan(soft);
    expect(soft).toBeGreaterThan(softer);
  });

  it("صورة مستوية بلا تفاصيل: صفر", () => {
    const flat: Gray = { data: new Uint8Array(64 * 64).fill(128), width: 64, height: 64 };
    expect(sharpness(flat)).toBe(0);
  });

  it("صورة أصغر من أن تُقاس: صفر", () => {
    expect(sharpness({ data: new Uint8Array(4), width: 2, height: 2 })).toBe(0);
  });
});
