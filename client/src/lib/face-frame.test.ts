import { describe, expect, it } from "vitest";
import { lookAt } from "./auto-shutter";
import { FACE_HOLD_MS, faceHeld, faceQuad, judgeFaces, MAX_FACE_WIDE, MIN_FACE, type FaceBox } from "./face-frame";

/**
 * متى تُلتقط صورة الوجه وحدها: وجهٌ واحد في الصورة، كاملٌ، لا بعيدٌ ولا قريبٌ
 * حتى لا تتّسع الصورة للبطاقة بجانبه — ثمّ ثباتٌ لحظة.
 */
const box = (x: number, y: number, width: number, height = width): FaceBox => ({ x, y, width, height });
const [W, H] = [1280, 720];

describe("الحكم على الوجه في الصورة", () => {
  it("لا وجه: لا حكم", () => {
    expect(judgeFaces([], W, H)).toBeNull();
  });

  it("وجهٌ كامل على مسافة الذراع: جاهز", () => {
    const face = box(400, 200, 260, 300);
    expect(judgeFaces([face], W, H)).toEqual({ face, verdict: "ready" });
  });

  it("وجهٌ بعيد: اقترب", () => {
    const side = MIN_FACE * H - 10;
    expect(judgeFaces([box(600, 300, side)], W, H)?.verdict).toBe("closer");
  });

  it("وجهٌ يملأ الصورة: ابتعد — لا مكان للبطاقة بجانبه", () => {
    expect(judgeFaces([box(200, 100, MAX_FACE_WIDE * W + 10, 500)], W, H)?.verdict).toBe("farther");
    // صورةٌ قائمة (هاتف): الوجه عريضٌ بالنسبة لعرضها.
    expect(judgeFaces([box(100, 500, 420)], 720, 1280)?.verdict).toBe("farther");
    expect(judgeFaces([box(150, 500, 300)], 720, 1280)?.verdict).toBe("ready");
  });

  it("وجهٌ يقطعه طرف الصورة: أدخله كاملاً", () => {
    expect(judgeFaces([box(-30, 200, 260)], W, H)?.verdict).toBe("edge");
    expect(judgeFaces([box(500, 600, 200)], W, H)?.verdict).toBe("edge");
    expect(judgeFaces([box(W - 200, 100, 240)], W, H)?.verdict).toBe("edge");
    // Cut on the left or the top, the detector puts the box on the edge itself.
    expect(judgeFaces([box(0, 432, 286)], W, H)?.verdict).toBe("edge");
    expect(judgeFaces([box(500, 0, 260)], W, H)?.verdict).toBe("edge");
  });

  it("الذقن عند أسفل الصورة ولم يخرج منها: كامل — كما في لقطة كاميرا حاسوبٍ حقيقية", () => {
    expect(judgeFaces([box(530, 440, 274)], W, H)?.verdict).toBe("ready");
  });

  it("وجهٌ كبير يقطعه طرف الصورة: ابتعد، لا «أدخله»", () => {
    expect(judgeFaces([box(378, 318, 530)], W, H)?.verdict).toBe("farther");
  });

  it("شخصٌ آخر في الصورة: وجهٌ واحد فقط", () => {
    const me = box(300, 200, 260);
    expect(judgeFaces([box(800, 220, 200), me], W, H)).toEqual({ face: me, verdict: "many" });
  });

  it("وجهٌ صغيرٌ جداً بجانبه — صورة البطاقة نفسها — لا يُحسب", () => {
    const me = box(300, 200, 260);
    expect(judgeFaces([me, box(700, 300, 50, 60)], W, H)).toEqual({ face: me, verdict: "ready" });
  });

  it("إطار الوجه أوسع من الوجه: الجبهة فوقه والذقن تحته", () => {
    const [tl, , br] = faceQuad(box(100, 100, 200));
    expect(tl.x).toBeLessThan(100);
    expect(tl.y).toBeLessThan(100 - 200 * 0.2);
    expect(br.x).toBeGreaterThan(300);
    expect(br.y).toBeGreaterThan(300);
  });
});

describe("الالتقاط التلقائي لصورة الوجه", () => {
  const still = (x: number) => faceQuad(box(x, 200, 260));

  it("يمتلئ في ثانيةٍ ونصف من الثبات، ثمّ تُلتقط", () => {
    let hold = lookAt(null, still(400), 0);
    expect(faceHeld(hold, 0)).toBe(0);
    hold = lookAt(hold, still(405), FACE_HOLD_MS / 2);
    expect(faceHeld(hold, FACE_HOLD_MS / 2)).toBeCloseTo(0.5);
    hold = lookAt(hold, still(402), FACE_HOLD_MS);
    expect(faceHeld(hold, FACE_HOLD_MS)).toBe(1);
  });

  it("تحرّك الوجه كثيراً: يبدأ العدّ من جديد", () => {
    let hold = lookAt(null, still(400), 0);
    hold = lookAt(hold, still(560), 1000);
    expect(faceHeld(hold, 1000)).toBe(0);
  });

  it("لا ثبات: صفر", () => {
    expect(faceHeld(null, 5000)).toBe(0);
  });

  it("أطول من ثبات البطاقة: وقتٌ لرفعها بجانب الوجه", () => {
    expect(FACE_HOLD_MS).toBeGreaterThanOrEqual(1500);
  });
});
