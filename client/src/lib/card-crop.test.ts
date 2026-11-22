import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { cardCrop, cardInside, type CardCrop, type Picture } from "./card-crop";
import { senseQr, toGray } from "./qr-sense";
import type { Point, Quad } from "./viewfinder";

/**
 * قصّ البطاقة من صورتها: تُرسم بطاقةٌ بتخطيط بطاقة الجامعة (الرمز قرب حافتها
 * اليسرى في منتصف ارتفاعها) في غرفة، بزوايا وأحجام مختلفة — ويُتحقّق أنّ ما
 * يُحفظ هو البطاقة كلّها، بلا كثيرٍ من الغرفة، ومعدولة.
 */

const MODULES = QRCode.create("https://progres.mesrs.dz/check/123456789012", { errorCorrectionLevel: "M" }).modules;

interface Scene {
  pic: Picture;
  /** The card's corners and the code's, in the picture — top-left first, as printed. */
  card: Quad;
  qr: Quad;
}

/** A room (a wall, a dark shape) and a card held in it: centred at (cx, cy), `h` pixels tall, turned `deg`. */
function scene({
  w = 640,
  h: H = 360,
  cx = 320,
  cy = 180,
  cardH = 180,
  deg = 0,
  wall = [222, 216, 190],
  face = [222, 228, 230],
}: {
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  cardH?: number;
  deg?: number;
  wall?: number[];
  face?: number[];
}): Scene {
  const cardW = cardH * 1.586;
  const q = cardH / 4.78;
  const th = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const toPic = (u: number, v: number): Point => {
    const a = u - cardW / 2;
    const b = v - cardH / 2;
    return { x: cx + a * c - b * s, y: cy + a * s + b * c };
  };
  /** What is printed at (u, v) on the card, or null off it. */
  const print = (u: number, v: number): number[] | null => {
    if (u < 0 || v < 0 || u >= cardW || v >= cardH) return null;
    const qu = (u - q * 0.5) / q;
    const qv = (v - q * 1.98) / q;
    if (qu >= 0 && qv >= 0 && qu < 1 && qv < 1) return MODULES.get(Math.floor(qu * MODULES.size), Math.floor(qv * MODULES.size)) ? [25, 25, 25] : [245, 245, 242];
    if (u > cardW * 0.72 && u < cardW * 0.95 && v > cardH * 0.36 && v < cardH * 0.82) return [196, 200, 204]; // the photo
    if (u > cardW * 0.3 && u < cardW * 0.7 && v % (q * 0.3) < q * 0.12 && v < q * 1.1) return [40, 40, 40]; // the heading
    return face;
  };
  const data = new Uint8ClampedArray(w * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * c + dy * s + cardW / 2;
      const v = -dx * s + dy * c + cardH / 2;
      // The room: a wall, a dark shape low on the right (a head), a frame on the left.
      const room = (x - w * 0.82) ** 2 + (y - H * 0.85) ** 2 < (H * 0.25) ** 2 ? [40, 34, 30] : x > w * 0.05 && x < w * 0.08 ? [120, 90, 60] : wall;
      const px = print(u, v) ?? room;
      const i = (y * w + x) * 4;
      data[i] = px[0]!;
      data[i + 1] = px[1]!;
      data[i + 2] = px[2]!;
      data[i + 3] = 255;
    }
  const corner = (u: number, v: number) => toPic(u, v);
  return {
    pic: { data, width: w, height: H },
    card: [corner(0, 0), corner(cardW, 0), corner(cardW, cardH), corner(0, cardH)],
    qr: [corner(q * 0.5, q * 1.98), corner(q * 1.5, q * 1.98), corner(q * 1.5, q * 2.98), corner(q * 0.5, q * 2.98)],
  };
}

/** The crop, turned upright: its size, and how much room it leaves around each of the card's corners in sight. */
function inCrop(crop: CardCrop, sc: Scene) {
  const q = crop.corners;
  const c = { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 };
  const [cos, sin] = [Math.cos(crop.angle), Math.sin(crop.angle)];
  const f = (p: Point) => [(p.x - c.x) * cos + (p.y - c.y) * sin, -(p.x - c.x) * sin + (p.y - c.y) * cos] as const;
  const xs = q.map((p) => f(p)[0]);
  const ys = q.map((p) => f(p)[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const seen = sc.card.filter((p) => p.x >= 0 && p.y >= 0 && p.x <= sc.pic.width && p.y <= sc.pic.height).map(f);
  return {
    w: x1 - x0,
    h: y1 - y0,
    /** The least room around any card corner in sight: negative, the card was cut. */
    room: Math.min(...seen.flatMap(([x, y]) => [x - x0, x1 - x, y - y0, y1 - y])),
  };
}

const degrees = (rad: number) => (rad * 180) / Math.PI;

describe("قصّ البطاقة من صورتها", () => {
  it("بطاقة معتدلة على جدار: تُحفظ كلّها بهامشٍ صغير، وتُترك الغرفة", () => {
    const sc = scene({});
    const crop = cardCrop(sc.pic, sc.qr)!;
    expect(crop).not.toBeNull();
    expect(Math.abs(degrees(crop.angle))).toBeLessThan(1.5);
    const r = inCrop(crop, sc);
    expect(r.room).toBeGreaterThan(0);
    // Its edges found, not only guessed: a guess keeps more room.
    expect(r.w).toBeLessThan(180 * 1.586 * 1.12);
    expect(r.h).toBeLessThan(180 * 1.15);
    // An upright card: a plain box, well inside the photo.
    expect(crop.box.w * crop.box.h).toBeLessThan(640 * 360 * 0.45);
  });

  it("بطاقة مائلة: تُعدَل بزاويتها، ولا يُقصّ منها شيء", () => {
    for (const deg of [12, -20]) {
      const sc = scene({ deg });
      const crop = cardCrop(sc.pic, sc.qr)!;
      expect(degrees(crop.angle)).toBeCloseTo(deg, 0);
      const r = inCrop(crop, sc);
      expect(r.room).toBeGreaterThan(0);
      expect(r.w).toBeLessThan(180 * 1.586 * 1.15);
    }
  });

  it("بطاقة مقلوبة: تُدار لتظهر معتدلة", () => {
    const sc = scene({ deg: 180 });
    const crop = cardCrop(sc.pic, sc.qr)!;
    expect(Math.abs(degrees(crop.angle))).toBeCloseTo(180, 0);
    expect(inCrop(crop, sc).room).toBeGreaterThan(0);
  });

  it("رمزٌ رُصد بزاويتين مبدّلتين (مقلوب الاتجاه): النتيجة نفسها", () => {
    const sc = scene({ deg: 8 });
    const [tl, tr, br, bl] = sc.qr;
    const a = cardCrop(sc.pic, sc.qr)!;
    const b = cardCrop(sc.pic, [tl, bl, br, tr])!;
    expect(b.angle).toBeCloseTo(a.angle, 5);
    expect(b.box).toEqual(a.box);
  });

  it("بطاقة يخرج جزءٌ منها عن الصورة: يُحفظ ما ظهر منها، داخل الصورة", () => {
    const sc = scene({ cx: 560 });
    const crop = cardCrop(sc.pic, sc.qr)!;
    expect(crop.box.x + crop.box.w).toBeLessThanOrEqual(640);
    expect(crop.box.x).toBeGreaterThanOrEqual(0);
    expect(inCrop(crop, sc).room).toBeGreaterThan(0);
  });

  it("بطاقة بلون الجدار (حوافّها لا تُرى): تُحفظ كلّها — بهامشٍ أوسع", () => {
    const sc = scene({ deg: 5, wall: [222, 228, 230] });
    const crop = cardCrop(sc.pic, sc.qr)!;
    const r = inCrop(crop, sc);
    expect(r.room).toBeGreaterThan(0);
    expect(r.w).toBeLessThan(180 * 1.586 * 1.45);
  });

  it("بطاقة تملأ الصورة معتدلة: لا شيء يُقصّ", () => {
    const sc = scene({ w: 300, h: 190, cx: 150, cy: 95, cardH: 186 });
    expect(cardCrop(sc.pic, sc.qr)).toBeNull();
  });

  it("رمزٌ أصغر من أن يُعرف منه مكان البطاقة: لا قصّ", () => {
    const sc = scene({ cardH: 40 });
    expect(cardCrop(sc.pic, sc.qr)).toBeNull();
  });

  it("من الصورة وحدها: يُرصد الرمز، فتُقصّ البطاقة حوله", () => {
    const sc = scene({ w: 1280, h: 720, cx: 640, cy: 360, cardH: 420, deg: -7 });
    const sensed = senseQr(toGray(sc.pic.data, sc.pic.width, sc.pic.height));
    expect(sensed).not.toBeNull();
    const crop = cardCrop(sc.pic, sensed!.quad)!;
    expect(degrees(crop.angle)).toBeCloseTo(-7, 0);
    expect(inCrop(crop, sc).room).toBeGreaterThan(0);
  });
});

/**
 * البطاقة كلّها في الصورة، بموضع رمزها وتخطيط البطاقة — وإلّا فلا التقاط
 * تلقائي: بطاقةٌ نصفها خارج نظر الكاميرا تخرج صورتها مقطوعة، أيّاً كان القصّ.
 */
describe("البطاقة كلّها في الصورة؟", () => {
  const inside = (sc: Scene) => cardInside(sc.qr, sc.pic.width, sc.pic.height);

  it("في وسط الصورة: نعم", () => {
    expect(inside(scene({}))).toBe(true);
  });

  it("جانبها الأيمن — الشعار والصورة الشخصية — خارج الصورة: لا", () => {
    expect(inside(scene({ cx: 560 }))).toBe(false);
  });

  it("أعلاها خارج الصورة: لا", () => {
    expect(inside(scene({ cy: 60 }))).toBe(false);
  });

  it("تتجاوز الحافة بأقلّ من دقّة التخطيط — بضعة مليمترات من هامشها: نعم", () => {
    // Its right edge some 0.2 of the code's side past the picture's.
    const cardH = 180;
    const q = cardH / 4.78;
    expect(inside(scene({ cardH, cx: 640 + 0.2 * q - (cardH * 1.586) / 2 }))).toBe(true);
  });

  it("مقلوبة: الرمز على يمينها، فجانبها الآخر إلى اليسار", () => {
    expect(inside(scene({ deg: 180 }))).toBe(true);
    expect(inside(scene({ deg: 180, cx: 80 }))).toBe(false);
  });
});
