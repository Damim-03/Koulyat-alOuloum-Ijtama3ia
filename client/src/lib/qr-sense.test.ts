import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { senseQr, type Gray } from "./qr-sense";
import type { Point } from "./viewfinder";

/**
 * استشعار رمز QR قبل قراءته: من مربّعات زواياه الثلاثة.
 *
 * يُحرس: أنّه يجد الرمز مستقيماً ومائلاً وصغيراً، ويعطي زواياه هو لا زوايا
 * مربّعاته؛ وأنّ صورةً فارغة، أو خطوطاً متكرّرة كشبّاك نافذة، لا تُحسب رمزاً.
 */
const TEXT = "https://progres.mesrs.dz/check/202039012345";

/** A picture with the code drawn in it: `scale` pixels per module, turned by `angle`, its top-left corner at `at`. */
function picture(width: number, height: number, scale: number, at: Point, angle = 0): { gray: Gray; corners: Point[] } {
  const { modules } = QRCode.create(TEXT, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const data = new Uint8Array(width * height).fill(235);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // Back from the picture into the code's own grid.
      const dx = x - at.x;
      const dy = y - at.y;
      const col = Math.floor((dx * cos + dy * sin) / scale);
      const row = Math.floor((-dx * sin + dy * cos) / scale);
      if (row >= 0 && col >= 0 && row < n && col < n && modules.get(row, col)) data[y * width + x] = 35;
    }
  const side = n * scale;
  const corner = (u: number, v: number) => ({ x: at.x + u * cos - v * sin, y: at.y + u * sin + v * cos });
  return { gray: { data, width, height }, corners: [corner(0, 0), corner(side, 0), corner(side, side), corner(0, side)] };
}

/** A box blur, three pixels across, `passes` times over: a fixed-focus webcam, up close. */
function blur(gray: Gray, passes: number) {
  const { width: w, height: h } = gray;
  for (let pass = 0; pass < passes; pass++) {
    const src = gray.data.slice();
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[(y + dy) * w + x + dx]!;
        gray.data[y * w + x] = s / 9;
      }
  }
}

const centre = (ps: Point[]) => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length });
const side = (ps: Point[]) => Math.hypot(ps[1]!.x - ps[0]!.x, ps[1]!.y - ps[0]!.y);

describe("استشعار رمز QR قبل قراءته", () => {
  it.each([
    ["مستقيماً", 4, 0],
    ["صغيراً — ثلاث نقاطٍ للوحدة", 3, 0],
    ["مائلاً", 4, 0.35],
    ["مائلاً إلى الجهة الأخرى", 4, -0.5],
  ])("%s ⇒ يجده، وزواياه زوايا الرمز نفسه", (_, scale, angle) => {
    const { gray, corners } = picture(640, 400, scale, { x: 230, y: 90 }, angle);
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    const got = centre(sensed!.quad);
    const want = centre(corners);
    // Within two modules of where it is, and of its size.
    expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(scale * 2);
    expect(Math.abs(side(sensed!.quad) - side(corners))).toBeLessThan(scale * 3);
  });

  it("مغبّشاً كما تراه كاميرا الحاسوب ⇒ يجده", () => {
    const { gray, corners } = picture(640, 400, 4, { x: 200, y: 80 }, 0.2);
    blur(gray, 2);
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    const got = centre(sensed!.quad);
    const want = centre(corners);
    expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(8);
  });

  /**
   * كما في إطارٍ حقيقيّ من كاميرا حاسوب: رمزٌ صغير (نحو نقطتين ونصف للوحدة)،
   * باهتٌ رماديٌّ على رماديّ، مغبّش — الحلقة الرفيعة حول مربّعٍ من مربّعاته
   * تذوب في البياض حولها. النظرة الأولى تفوتها؛ الثانية، الأدقّ، تجدها.
   */
  it("صغيراً باهتاً مغبّشاً كما تراه كاميرا الحاسوب ⇒ يجده", () => {
    const { gray, corners } = picture(1280, 720, 2.6, { x: 900, y: 180 });
    for (let i = 0; i < gray.data.length; i++) gray.data[i] = 70 + ((gray.data[i]! - 35) * 40) / 200;
    blur(gray, 2);
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    const got = centre(sensed!.quad);
    const want = centre(corners);
    expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(2.6 * 3);
    expect(Math.abs(side(sensed!.quad) - side(corners))).toBeLessThan(2.6 * 4);
  });

  it("ضجيج الكاميرا على جدارٍ مستوٍ ⇒ لا تخترع النظرة الدقيقة رمزاً منه", () => {
    const [width, height] = [640, 400];
    const data = new Uint8Array(width * height);
    let seed = 7;
    const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 16;
    for (let i = 0; i < data.length; i++) data[i] = 150 + noise();
    const gray = { data, width, height };
    blur(gray, 1);
    expect(senseQr(gray)).toBeNull();
  });

  it("كبيراً قريباً من الكاميرا ⇒ يجده: وسط مربّعه أعرض من الجوار الصغير", () => {
    const { gray, corners } = picture(1280, 720, 12, { x: 460, y: 160 });
    const sensed = senseQr(gray);
    expect(sensed).not.toBeNull();
    const got = centre(sensed!.quad);
    const want = centre(corners);
    expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(24);
  });

  it("صورةٌ بلا رمز ⇒ لا شيء", () => {
    expect(senseQr({ data: new Uint8Array(320 * 200).fill(200), width: 320, height: 200 })).toBeNull();
  });

  it("خطوطٌ متكرّرة كشبّاك نافذة ⇒ لا تُحسب رمزاً", () => {
    const width = 400;
    const height = 300;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = Math.floor(x / 6) % 2 && Math.floor(y / 6) % 2 ? 30 : 220;
    expect(senseQr({ data, width, height })).toBeNull();
  });
});
