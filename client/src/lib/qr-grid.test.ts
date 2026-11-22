import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { readGrid } from "./qr-grid";
import { senseQr, type Gray } from "./qr-sense";

/**
 * قراءة رمزٍ مغبّشٍ من شبكة وحداته: كاميرا الحاسوب تغبّش رمز البطاقة الصغير
 * فلا يقرؤه jsQR — لكنّ وسط كلّ وحدةٍ يحفظ لونه، فيُؤخذ من هناك ويُعاد رسم
 * الرمز حادّاً. ويُحرس أنّ رمزاً تلف أكثر ممّا يصلحه تصحيح الأخطاء لا يُقرأ
 * أبداً خطأً.
 */
const TEXT = "https://progres.mesrs.dz/check/202039012345";
// The card's own code is 29 modules across: version 3.
const { modules } = QRCode.create(TEXT, { version: 3, errorCorrectionLevel: "L" });
const N = modules.size;

/**
 * A 1280×720 frame with the code in it, as a laptop camera gives it: `scale`
 * pixels a module, faint (`dark` on `light`), blurred `passes` times, with
 * noise — and turned by `angle`. `scramble`: its data modules made random.
 */
function frame({ scale = 4.4, passes = 2, dark = 72, light = 112, noise = 6, seed = 11, angle = 0, scramble = false }) {
  const [W, H] = [1280, 720];
  const g = new Float32Array(W * H).fill(light);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  let state = seed;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const finder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
  const dots = Array.from({ length: N * N }, (_, i) => {
    const [r, c] = [Math.floor(i / N), i % N];
    return scramble && !finder(r, c) ? random() < 0.5 : modules.get(r, c);
  });
  const [ox, oy] = [640 - (N * scale) / 2, 360 - (N * scale) / 2];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Turned about the code's middle.
      const [dx, dy] = [x - 640, y - 360];
      const col = Math.floor((dx * cos + dy * sin + 640 - ox) / scale);
      const row = Math.floor((-dx * sin + dy * cos + 360 - oy) / scale);
      if (row >= 0 && col >= 0 && row < N && col < N && dots[row * N + col]) g[y * W + x] = dark;
    }
  for (let p = 0; p < passes; p++)
    for (const [sx, sy] of [
      [1, 0],
      [0, W],
    ]) {
      const src = g.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) g[y * W + x] = (src[y * W + x - sx - sy]! + src[y * W + x]! + src[y * W + x + sx + sy]!) / 3;
    }
  const data = new Uint8Array(W * H);
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.max(0, Math.min(255, Math.round(g[i]! + (random() - 0.5) * 2 * noise)));
    data[i] = v;
    rgba.set([v, v, v, 255], i * 4);
  }
  return { gray: { data, width: W, height: H } as Gray, rgba };
}

describe("قراءة رمزٍ مغبّش من شبكة وحداته", () => {
  it("رمزٌ بحجم رمز البطاقة، باهتٌ مغبّش: jsQR لا يقرؤه — والشبكة تقرؤه", () => {
    const { gray, rgba } = frame({});
    expect(jsQR(rgba, gray.width, gray.height, { inversionAttempts: "attemptBoth" })).toBeNull();
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    expect(readGrid(jsQR, gray, sensed!, true)).toBe(TEXT);
  });

  it("في الصورة الحيّة، بمحاولاتٍ قليلة: يُقرأ رمزٌ أخفّ غبشاً", () => {
    const { gray } = frame({ passes: 1 });
    expect(readGrid(jsQR, gray, senseQr(gray)!)).toBe(TEXT);
  });

  it("مقلوباً ومائلاً: تُعرف جهته من مربّعات زواياه", () => {
    for (const angle of [Math.PI, 0.25]) {
      const { gray } = frame({ angle });
      const sensed = senseQr(gray);
      expect(sensed).not.toBeNull();
      expect(readGrid(jsQR, gray, sensed!, true)).toBe(TEXT);
    }
  });

  it("وحداتٌ تالفةٌ أكثر ممّا يُصلَح: لا يُقرأ شيء — لا يُقرأ خطأً", () => {
    const { gray } = frame({ scramble: true, passes: 0, noise: 0 });
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    expect(readGrid(jsQR, gray, sensed!, true)).toBeNull();
  });
});
