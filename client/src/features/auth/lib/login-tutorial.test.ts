import { describe, expect, it } from "vitest";
import { CODE, frameAt, scenesFor, totalOf, type Plan, type SceneKey } from "./login-tutorial";

/**
 * شرح الدخول المتحرّك: كلّ لحظةٍ صورةٌ واحدة للنموذج، مشتقّةٌ من الزمن وحده —
 * والشرح واحدٌ للأدوار الثلاثة، يختلف بما يُطلب من كلٍّ منها.
 */
const EMAIL = "admin@univ-eloued.dz".length;
const ADMIN: Plan = { role: true, code: true, reveal: false, idLen: EMAIL, passwordLen: 8 };
const PROFESSOR: Plan = { ...ADMIN, code: false };
const STUDENT: Plan = { role: false, code: false, reveal: true, idLen: 12, passwordLen: 10 };
const admin = scenesFor(ADMIN);
const professor = scenesFor(PROFESSOR);
const student = scenesFor(STUDENT);
const start = (k: SceneKey, scenes = admin) => scenes.find((s) => s.key === k)!.start;
const at = (k: SceneKey, ms: number, scenes = admin, plan = ADMIN) => frameAt(start(k, scenes) + ms, scenes, plan);
const st = (k: SceneKey, ms: number) => at(k, ms, student, STUDENT);

describe("المشاهد", () => {
  it("للمسؤول مشهد الرمز بعد الدخول، وللأستاذ لا، وللطالب لا دور يُختار؛ وتتتابع بلا فجوة", () => {
    expect(admin.map((s) => s.key)).toEqual(["intro", "role", "id", "password", "submit", "code", "done"]);
    expect(professor.map((s) => s.key)).toEqual(["intro", "role", "id", "password", "submit", "done"]);
    expect(student.map((s) => s.key)).toEqual(["intro", "id", "password", "submit", "done"]);
    for (const list of [admin, professor, student])
      list.forEach((s, i) => i > 0 && expect(s.start).toBe(list[i - 1]!.start + list[i - 1]!.ms));
    expect(totalOf(admin) - totalOf(professor)).toBe(admin.find((s) => s.key === "code")!.ms);
  });

  it("وكلّ مشهدٍ بخطوته في دليل دوره؛ والافتتاح والختام بلا خطوة", () => {
    expect(admin.map((s) => s.step)).toEqual([null, 1, 2, 3, 3, 4, null]);
    expect(professor.map((s) => s.step)).toEqual([null, 1, 2, 3, 3, null]);
    // دليل الطالب: رقم التسجيل، فكلمة المرور، فزرّ الدخول.
    expect(student.map((s) => s.step)).toEqual([null, 1, 2, 3, null]);
  });

  it("وكلمة المرور التي تُكشف تأخذ وقتاً أطول", () => {
    const pw = (list: typeof admin) => list.find((s) => s.key === "password")!.ms;
    expect(pw(student)).toBeGreaterThan(pw(admin));
  });
});

describe("الصورة في كلّ لحظة", () => {
  it("الافتتاح: نموذجٌ فارغ، والكاميرا بعيدة، و«طالب» هو المختار", () => {
    expect(frameAt(0, admin, ADMIN)).toMatchObject({
      scene: "intro",
      step: null,
      picked: false,
      typed: 0,
      dots: 0,
      digits: 0,
      screen: "login",
      focus: "all",
      cursor: "start",
      click: null,
      done: false,
    });
  });

  it("الدور: تقترب الكاميرا منه، والمؤشّر ينقر، فيُختار", () => {
    expect(at("role", 100)).toMatchObject({ focus: "all", cursor: "start", picked: false, step: 1 });
    expect(at("role", 500)).toMatchObject({ focus: "roleTab", cursor: "roleTab", picked: false, click: null });
    expect(at("role", 1350)).toMatchObject({ picked: true, click: 1 });
    expect(at("role", 1700).click).toBeNull();
  });

  it("حقل التعريف: نقرةٌ فيه، ثمّ يُكتب حرفاً حرفاً، ثمّ يُفصَّل إلى جزأيه", () => {
    expect(at("id", 500)).toMatchObject({ focus: "id", field: null, typed: 0 });
    expect(at("id", 900)).toMatchObject({ field: "id", click: 2, typed: 0 });
    const mid = at("id", 1500).typed;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(EMAIL);
    expect(at("id", 2700)).toMatchObject({ typed: EMAIL, split: false });
    expect(at("id", 2900).split).toBe(true);
    // وما كُتب يبقى فيما بعده.
    expect(at("password", 0)).toMatchObject({ typed: EMAIL, split: true, picked: true });
  });

  it("والطويل يُكتب في الوقت نفسه", () => {
    expect(frameAt(start("id") + 2700, admin, { ...ADMIN, idLen: 60 }).typed).toBe(60);
  });

  it("كلمة المرور نقطةً نقطة، ولا تُكشف؛ ثمّ زرّ الدخول يُضغط", () => {
    expect(at("password", 800)).toMatchObject({ focus: "password", field: "password", click: 3, dots: 0 });
    expect(at("password", 1100)).toMatchObject({ click: null, dots: 2 });
    expect(at("password", 2350)).toMatchObject({ dots: 8, revealed: false, cursor: "password", focus: "password" });
    expect(at("submit", 800)).toMatchObject({ focus: "submit", pressed: "submit", click: 4 });
    expect(at("submit", 1200)).toMatchObject({ pressed: null, screen: "login", revealed: false });
  });

  it("الرمز: الهاتف أوّلاً، ثمّ الحقل يُملأ رقماً رقماً، ثمّ «تحقّق ودخول»", () => {
    expect(at("code", 0)).toMatchObject({ screen: "code", focus: "phone", digits: 0, dots: 8, step: 4 });
    expect(at("code", 2200)).toMatchObject({ focus: "code", cursor: "code", field: "code", click: 5 });
    const mid = at("code", 2700).digits;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(CODE.length);
    expect(at("code", 3400).digits).toBe(CODE.length);
    expect(at("code", 3600)).toMatchObject({ focus: "verify", cursor: "verify", field: null });
    expect(at("code", 4000)).toMatchObject({ pressed: "verify", click: 6 });
  });

  it("الختام: الكاميرا تبتعد، و«تمّ الدخول» — على شاشة الرمز للمسؤول، وعلى النموذج للأستاذ", () => {
    expect(at("done", 100)).toMatchObject({ scene: "done", done: true, focus: "all", screen: "code", cursor: "verify", digits: CODE.length });
    expect(at("done", 100, professor, PROFESSOR)).toMatchObject({ done: true, screen: "login", cursor: "submit", digits: 0 });
  });

  it("وبعد آخره يبقى على الختام", () => {
    expect(frameAt(totalOf(admin) + 500, admin, ADMIN)).toMatchObject({ scene: "done", progress: 1 });
  });
});

describe("الطالب", () => {
  it("«طالب» مختارٌ من الأصل: يبدأ برقم التسجيل، خطوته الأولى", () => {
    expect(st("intro", 0)).toMatchObject({ picked: false, focus: "all" });
    expect(st("id", 900)).toMatchObject({ step: 1, focus: "id", field: "id", click: 2 });
    expect(st("id", 2900)).toMatchObject({ typed: 12, split: true });
  });

  it("كلمة المرور تُكتب نقاطاً، ثمّ ينقر المؤشّر العين فتظهر — والكاميرا تُري الحقل كلّه", () => {
    expect(st("password", 1500)).toMatchObject({ step: 2, field: "password", revealed: false, focus: "password" });
    expect(st("password", 2200).dots).toBe(10);
    expect(st("password", 2500)).toMatchObject({ focus: "reveal", cursor: "eye", field: null, revealed: false });
    expect(st("password", 3000)).toMatchObject({ click: 7, revealed: true });
    // وتبقى ظاهرةً إلى زرّ الدخول.
    expect(st("submit", 800)).toMatchObject({ step: 3, revealed: true, pressed: "submit" });
    expect(st("done", 100)).toMatchObject({ done: true, screen: "login", cursor: "submit" });
  });
});
