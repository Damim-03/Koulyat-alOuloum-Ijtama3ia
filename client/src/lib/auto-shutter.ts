import type { CardQrVerdict } from "./read-registration";
import type { Point, Quad } from "./viewfinder";

/**
 * When the photo of a student card takes itself: once the viewfinder is on
 * the card's QR code and the card is held still there for a moment.
 *
 * The code need not be read for that: a laptop camera often only *senses* it
 * (lib/qr-sense) — the frame is on it, the decoder cannot make it out yet —
 * and it is read from the photo afterwards. Held a little longer then, in case
 * it reads in the meantime. A code read that is no student card's (a poster's,
 * a phone's) never takes the photo; one of another student's does — and the
 * photo then says so.
 */

/** Held this long with its number read: the photo is taken. */
export const READ_HOLD_MS = 1000;
/** Held this long while only sensed: the photo is taken, and the code read from it. */
export const SENSED_HOLD_MS = 1800;
/** Moved more than this share of its own size from one look to the next: not held still — the hold starts over. */
const STILL = 0.25;

export interface Hold {
  /** Since when the code has been held still in sight. */
  since: number;
  /** Where it was at the last look, and how big — the next look says whether it moved. */
  center: Point;
  side: number;
}

const middle = (q: Quad): Point => ({
  x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
  y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
});
const sideOf = (q: Quad) =>
  (Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) + Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y)) / 2;

/**
 * The code at least this share of the picture's shorter side: the card then
 * fills about two fifths of it — big enough, cut out of the photo, to be read.
 */
export const MIN_CODE_SHARE = 0.1;

/** The card near enough the camera to be photographed: farther, it is asked to come closer first. */
export function closeEnough(quad: Quad, width: number, height: number): boolean {
  return sideOf(quad) >= MIN_CODE_SHARE * Math.min(width, height);
}

/** The code seen at `quad` now: the hold goes on — or, if it moved, starts again from here. */
export function lookAt(hold: Hold | null, quad: Quad, now: number): Hold {
  const center = middle(quad);
  const side = sideOf(quad);
  if (!hold) return { since: now, center, side };
  const moved = Math.hypot(center.x - hold.center.x, center.y - hold.center.y) > STILL * Math.max(side, hold.side);
  return { since: moved ? now : hold.since, center, side };
}

/**
 * How far along the hold is, from 0 to 1 — at 1 the photo is taken. `verdict`
 * is what the code was read as, or null while it is only sensed.
 */
export function holdShare(hold: Hold | null, verdict: CardQrVerdict | null, now: number): number {
  if (!hold || verdict === "foreign") return 0;
  return Math.min(1, Math.max(0, (now - hold.since) / (verdict ? READ_HOLD_MS : SENSED_HOLD_MS)));
}
