import type { Hold } from "./auto-shutter";
import type { Quad } from "./viewfinder";

/**
 * When the photo of the face — the card held beside it — takes itself: one
 * face in the picture, whole, neither too far nor so near that the card would
 * not fit beside it, and held still a moment (as the card's code is held,
 * lib/auto-shutter).
 *
 * The card itself is not looked for: at arm's length its QR code is a couple
 * of dozen pixels across, too few to be read or even made out. The hold is
 * longer than the card's for that — time to raise it.
 */

/** A face found in the picture: its box, in the picture's pixels. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the face found says: ready to be photographed — or what to do first. */
export type FaceVerdict = "ready" | "closer" | "farther" | "edge" | "many";

/** Held still this long, ready: the photo is taken. */
export const FACE_HOLD_MS = 1500;
/** The face shorter than this share of the picture's shorter side: too far — closer. */
export const MIN_FACE = 0.2;
/** Wider than this share of the picture, or taller than MAX_FACE_TALL of it: too near — no room for the card beside it. */
export const MAX_FACE_WIDE = 0.5;
export const MAX_FACE_TALL = 0.8;
/** Cut by an edge and taller than this share of the picture: too near, rather than off to one side. */
const CUT_AND_BIG = 0.6;
/** A second face at least this share of the first's area: someone else is in the picture. The card's own photo is far smaller. */
const SOMEONE_ELSE = 0.3;

const area = (b: FaceBox) => b.width * b.height;

/** The face's box as corners — with room above for the forehead and hair, below for the chin: what the frame goes around. */
export function faceQuad(b: FaceBox): Quad {
  const [x0, x1] = [b.x - b.width * 0.1, b.x + b.width * 1.1];
  const [y0, y1] = [b.y - b.height * 0.25, b.y + b.height * 1.1];
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * The faces found in a `width`×`height` picture, judged: the main one (the
 * largest) and what it says — or null when there is none.
 */
export function judgeFaces(faces: FaceBox[], width: number, height: number): { face: FaceBox; verdict: FaceVerdict } | null {
  const [face, next] = [...faces].sort((a, b) => area(b) - area(a));
  if (!face) return null;
  if (next && area(next) >= SOMEONE_ELSE * area(face)) return { face, verdict: "many" };
  // The detector misses a face cut much; one it finds whose box runs off the
  // picture is cut a little — past the right or the bottom edge; on the left
  // or the top, the box is stopped at the edge itself. Near the bottom, the
  // chin just above it, is whole.
  const whole = face.x > 0 && face.y > 0 && face.x + face.width <= width && face.y + face.height <= height;
  const big = face.width > MAX_FACE_WIDE * width || face.height > MAX_FACE_TALL * height;
  if (big || (!whole && face.height > CUT_AND_BIG * height)) return { face, verdict: "farther" };
  if (!whole) return { face, verdict: "edge" };
  if (face.height < MIN_FACE * Math.min(width, height)) return { face, verdict: "closer" };
  return { face, verdict: "ready" };
}

/** How far along the hold is, from 0 to 1 — at 1 the photo is taken. */
export function faceHeld(hold: Hold | null, now: number): number {
  if (!hold) return 0;
  return Math.min(1, Math.max(0, (now - hold.since) / FACE_HOLD_MS));
}
