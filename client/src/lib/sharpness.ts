import type { Gray } from "./qr-sense";

/**
 * How sharp a picture is: how strongly its brightness bends from pixel to
 * pixel (the variance of its Laplacian). A blurred picture — the hand moved,
 * the focus hunted — has soft edges and scores low; the same picture in focus
 * scores higher. Only comparable between pictures of the same thing at the
 * same size: it picks the best of a few frames, it says nothing alone.
 */
export function sharpness({ data, width: w, height: h }: Gray): number {
  let sum = 0;
  let squares = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += l;
      squares += l * l;
      n++;
    }
  }
  return n ? squares / n - (sum / n) ** 2 : 0;
}
