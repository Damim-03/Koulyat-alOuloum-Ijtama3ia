import { useEffect, useState } from "react";

/**
 * شرح الدخول المتحرّك: مشاهد متتالية، ولكلّ لحظةٍ منها صورةٌ واحدة للنموذج
 * (ما كُتب، وأين المؤشّر، وإلى أين تقترب الكاميرا). كلّ شيءٍ مشتقٌّ من
 * الزمن وحده، فيُوقَف ويُعاد ويُقفز إلى خطوةٍ بتغيير رقمٍ واحد.
 *
 * والشرح واحدٌ للأدوار الثلاثة، يختلف بما يُطلب من كلٍّ منها (`Plan`).
 */

/** `id`: حقل التعريف — البريد للأستاذ والمسؤول، ورقم التسجيل للطالب. */
export type SceneKey = "intro" | "role" | "id" | "password" | "submit" | "code" | "done";

export interface Scene {
  key: SceneKey;
  start: number;
  ms: number;
  /** خطوة الدليل التي يشرحها المشهد — تُضاء في القائمة بجانبه. */
  step: number | null;
}

export interface Plan {
  /** يُختار الدور أوّلاً (والطالب مختارٌ من الأصل، فلا). */
  role: boolean;
  /** رمز التحقّق بعد الدخول — للمسؤول. */
  code: boolean;
  /** تُكشف كلمة المرور بعد كتابتها، فتُرى صيغتها — للطالب: تاريخ ميلاده. */
  reveal: boolean;
  /** طول ما يُكتب في حقل التعريف، وفي كلمة المرور. */
  idLen: number;
  passwordLen: number;
}

const MS: Record<SceneKey, number> = {
  intro: 1200,
  role: 2400,
  id: 3800,
  password: 2400,
  submit: 1600,
  code: 4400,
  done: 2400,
};
/** وكلمة المرور تُكشف: وقتٌ للنقر على العين ولقراءتها. */
const REVEAL_MS = 4400;

export function scenesFor(plan: Pick<Plan, "role" | "code" | "reveal">): Scene[] {
  const keys: SceneKey[] = [
    "intro",
    ...(plan.role ? (["role"] as const) : []),
    "id",
    "password",
    "submit",
    ...(plan.code ? (["code"] as const) : []),
    "done",
  ];
  // الخطوات بترتيب الدليل: الدور (إن كان)، فالتعريف، فكلمة المرور ومعها
  // زرّ الدخول، فالرمز. وللطالب زرّ الدخول خطوةٌ وحدها.
  const first = plan.role ? 2 : 1;
  const step: Record<SceneKey, number | null> = {
    intro: null,
    role: 1,
    id: first,
    password: first + 1,
    submit: plan.role ? first + 1 : first + 2,
    code: first + 2,
    done: null,
  };
  let start = 0;
  return keys.map((key) => {
    const ms = key === "password" && plan.reveal ? REVEAL_MS : MS[key];
    const s = { key, start, ms, step: step[key] };
    start += ms;
    return s;
  });
}

export const totalOf = (scenes: Scene[]) => scenes.reduce((n, s) => n + s.ms, 0);

/** ما تقترب إليه الكاميرا أو يقف عليه المؤشّر. */
export type Target = "all" | "start" | "roleTab" | "id" | "password" | "reveal" | "eye" | "submit" | "phone" | "code" | "verify";

/**
 * أقصى ما تكبُر كلّ منطقةٍ حين تقترب الكاميرا منها — تكبيرٌ يلفت ولا يقصّ:
 * وما لا يتّسع له الإطار يكبُر أقلّ (انظر المسرح).
 */
export const ZOOM: Record<Target, number> = {
  all: 1,
  start: 1,
  roleTab: 1.3,
  id: 1.3,
  password: 1.3,
  reveal: 1.3,
  eye: 1.3,
  submit: 1.25,
  phone: 1.3,
  code: 1.3,
  verify: 1.25,
};

export const CODE = "482913";
const DOT_MS = 110;
const DIGIT_MS = 170;

export interface Frame {
  scene: SceneKey;
  step: number | null;
  /** ما مضى من المشهد، من 0 إلى 1. */
  progress: number;
  /** اختير الدور (وقبلها «طالب» هو المختار). */
  picked: boolean;
  /** كم حرفاً كُتب في حقل التعريف. */
  typed: number;
  /** حقل التعريف كاملاً ومفصّلاً إلى جزأيه. */
  split: boolean;
  /** كم حرفاً كُتب من كلمة المرور، وهل كُشفت. */
  dots: number;
  revealed: boolean;
  digits: number;
  screen: "login" | "code";
  /** الحقل الذي فيه المؤشّر الكاتب. */
  field: "id" | "password" | "code" | null;
  pressed: "submit" | "verify" | null;
  focus: Target;
  cursor: Target;
  /** رقم النقرة الجارية (لتُرسم موجتها مرّةً واحدة)، أو لا نقرة. */
  click: number | null;
  done: boolean;
}

/** كم ظهر من سلسلةٍ تُكتب منذ `from`، حرفاً كلّ `step`. */
const typedSince = (at: number, from: number, step: number, max: number) =>
  at < from ? 0 : Math.min(max, Math.floor((at - from) / step) + 1);

export function frameAt(t: number, scenes: Scene[], plan: Pick<Plan, "reveal" | "idLen" | "passwordLen">): Frame {
  const found = scenes.findIndex((s) => t < s.start + s.ms);
  const index = found === -1 ? scenes.length - 1 : found;
  const s = scenes[index]!;
  const at = Math.min(t - s.start, s.ms);
  const pos = (k: SceneKey) => scenes.findIndex((x) => x.key === k);
  const past = (k: SceneKey) => pos(k) !== -1 && pos(k) < index;
  const here = (k: SceneKey) => s.key === k;
  const during = (a: number, b: number) => at >= a && at < b;
  const hasCode = pos("code") !== -1;
  const { reveal } = plan;
  // حقل التعريف يُكتب في ثانيةٍ ونصف مهما طال.
  const perChar = Math.min(70, 1500 / Math.max(1, plan.idLen));

  const f: Frame = {
    scene: s.key,
    step: s.step,
    progress: at / s.ms,
    picked: past("role") || (here("role") && at >= 1300),
    typed: past("id") ? plan.idLen : here("id") ? typedSince(at, 1000, perChar, plan.idLen) : 0,
    split: past("id") || (here("id") && at >= 2800),
    dots: past("password") ? plan.passwordLen : here("password") ? typedSince(at, 900, DOT_MS, plan.passwordLen) : 0,
    revealed: reveal && (past("password") || (here("password") && at >= 2900)),
    digits: past("code") ? CODE.length : here("code") ? typedSince(at, 2300, DIGIT_MS, CODE.length) : 0,
    screen: here("code") || (here("done") && hasCode) ? "code" : "login",
    field: null,
    pressed: null,
    focus: "all",
    cursor: "start",
    click: null,
    done: here("done"),
  };

  switch (s.key) {
    case "role":
      f.focus = at < 200 ? "all" : "roleTab";
      f.cursor = at < 300 ? "start" : "roleTab";
      if (during(1300, 1600)) f.click = 1;
      break;
    case "id":
      f.focus = f.cursor = "id";
      if (at >= 800) f.field = "id";
      if (during(800, 1100)) f.click = 2;
      break;
    case "password":
      f.focus = f.cursor = "password";
      if (at >= 700 && !(reveal && at >= 2300)) f.field = "password";
      if (during(700, 1000)) f.click = 3;
      // ثمّ إلى العين — والكاميرا تُري الحقل كلّه، فالعين في طرفه — فتظهر
      // كلمة المرور كما كُتبت.
      if (reveal && at >= 2300) {
        f.focus = "reveal";
        f.cursor = "eye";
      }
      if (reveal && during(2900, 3200)) f.click = 7;
      break;
    case "submit":
      f.focus = f.cursor = "submit";
      if (during(700, 1000)) {
        f.click = 4;
        f.pressed = "submit";
      }
      break;
    case "code":
      // أولاً الهاتف وفيه الرمز، ثمّ الحقل يُكتب فيه، ثمّ «تحقّق ودخول».
      f.focus = at < 1700 ? "phone" : at < 3500 ? "code" : "verify";
      f.cursor = at < 1500 ? "submit" : at < 3500 ? "code" : "verify";
      if (at >= 2100 && at < 3500) f.field = "code";
      if (during(2100, 2400)) f.click = 5;
      if (during(3900, 4200)) {
        f.click = 6;
        f.pressed = "verify";
      }
      break;
    case "done":
      f.cursor = hasCode ? "verify" : "submit";
      break;
  }
  return f;
}

const TICK = 50;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * الشرح يعمل وحده ويعود من أوّله؛ ومن طلب تقليل الحركة يراه واقفاً على
 * نهايته، ويتنقّل بين خطواته بنفسه.
 */
export function useLoginTutorial(plan: Plan) {
  const scenes = scenesFor(plan);
  const total = totalOf(scenes);
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(!reduced);
  const [t, setT] = useState(() => (reduced ? scenes.at(-1)!.start : 0));

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((v) => (v + TICK) % total), TICK);
    return () => clearInterval(id);
  }, [playing, total]);

  return {
    t,
    total,
    scenes,
    frame: frameAt(t, scenes, plan),
    playing,
    toggle: () => setPlaying((p) => !p),
    replay: () => {
      setT(0);
      setPlaying(true);
    },
    /** إلى أوّل مشهدٍ من الخطوة؛ وموقوفاً: إلى آخره، حيث تمّت. */
    jump: (step: number) => {
      const s = scenes.find((x) => x.step === step);
      if (s) setT(playing ? s.start : s.start + s.ms - TICK);
    },
  };
}

export type LoginTutorial = ReturnType<typeof useLoginTutorial>;
