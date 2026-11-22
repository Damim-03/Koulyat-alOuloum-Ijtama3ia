import type { ProposalWindowState } from "../types/admin";

/**
 * فترات السنة الجامعية كما تُقرأ في الواجهة — فترة اقتراح المواضيع
 * للأساتذة، ومهلة اختيارها للطلبة — بالقاعدة نفسها التي يرفض بها الخادم
 * (core/academic/proposal-window و selection-window): أيّامٌ كاملة بتوقيت
 * الجامعة، من بداية الأوّل إلى نهاية الأخير.
 */

export const UNIVERSITY_TZ = "Africa/Algiers";

/** A period of the year: its first moment and its last. Both null: none set. */
export interface Period {
  openAt?: string | null;
  closeAt?: string | null;
}

interface Windowed {
  proposalsOpenAt?: string | null;
  proposalsCloseAt?: string | null;
}

interface Selecting {
  selectionOpenAt?: string | null;
  selectionCloseAt?: string | null;
}

/** The professors' period to propose topics. */
export const proposalsOf = (y: Windowed): Period => ({ openAt: y.proposalsOpenAt, closeAt: y.proposalsCloseAt });
/** The students' deadline to choose them. */
export const selectionOf = (y: Selecting): Period => ({ openAt: y.selectionOpenAt, closeAt: y.selectionCloseAt });

export function periodState(p: Period, now = Date.now()): ProposalWindowState {
  if (!p.openAt || !p.closeAt) return "unset";
  if (now < Date.parse(p.openAt)) return "upcoming";
  if (now > Date.parse(p.closeAt)) return "closed";
  return "open";
}

/** A period's state, open or not: what may be done now — no period, nothing held back. */
export const periodAccepts = (p: Period, now = Date.now()) => {
  const s = periodState(p, now);
  return s === "open" || s === "unset";
};

/** ما مضى من الفترة، بين 0 و1. */
export function periodElapsed(p: Period, now = Date.now()): number {
  if (!p.openAt || !p.closeAt) return 0;
  const open = Date.parse(p.openAt);
  const close = Date.parse(p.closeAt);
  return Math.min(1, Math.max(0, (now - open) / (close - open)));
}

export const windowState = (y: Windowed, now = Date.now()) => periodState(proposalsOf(y), now);

/** يقبل اقتراحاً جديداً الآن: فترته مفتوحة، أو لا فترة له. */
export const acceptsProposals = (y: Windowed, now = Date.now()) => periodAccepts(proposalsOf(y), now);

/** اليوم بتوقيت الجامعة، كما يكتبه حقل التاريخ: «2026-11-11». */
export const universityDay = (at: string | number | Date) =>
  new Date(at).toLocaleDateString("en-CA", { timeZone: UNIVERSITY_TZ });

/** «2026-11-11» بعد `n` يوماً (أو قبله إن كان سالباً). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** كم يوماً من يومٍ إلى يوم: 0 لليوم نفسه. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** الساعة بتوقيت الجامعة، كما يكتبها حقل الوقت: «08:00:00». */
export const universityTime = (at: string | number | Date) =>
  new Date(at).toLocaleTimeString("en-GB", { timeZone: UNIVERSITY_TZ, hourCycle: "h23" });

/** «08:00» ⇒ «08:00:00». */
export const withSeconds = (time: string) => (time.length === 5 ? `${time}:00` : time);

/**
 * لحظةُ بدايةٍ أو نهاية من يومٍ وساعة، بتوقيت الجامعة — والنهاية تشمل
 * ثانيتها كلّها، كما يحسبها الخادم.
 */
export const momentOf = (day: string, time: string, end = false) =>
  Date.parse(`${day}T${withSeconds(time)}${end ? ".999" : ".000"}+01:00`);

const AT: Record<string, string> = { ar: "على الساعة", fr: "à", en: "at" };

/**
 * يومٌ بلغة الواجهة: «11 نوفمبر 2026» — وساعته إن لم يكن حدّ اليوم (منتصف
 * الليل لبدايةٍ، 23:59:59 لنهاية): «11 نوفمبر 2026 على الساعة 08:00».
 */
export function formatDay(at: string, lang: string) {
  const date = new Date(at).toLocaleDateString(lang === "ar" ? "ar-DZ" : lang, { dateStyle: "long", timeZone: UNIVERSITY_TZ });
  const time = universityTime(at);
  if (time === "00:00:00" || time === "23:59:59") return date;
  return `${date} ${AT[lang] ?? AT.en} ${time.endsWith(":00") ? time.slice(0, 5) : time}`;
}

/** ما مضى من فترة الاقتراح، بين 0 و1. */
export const elapsed = (y: Windowed, now = Date.now()) => periodElapsed(proposalsOf(y), now);
