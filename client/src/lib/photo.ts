import { cardCrop, STRAIGHT, type CardCrop } from "./card-crop";
import { readGrid } from "./qr-grid";
import { senseQr, toGray } from "./qr-sense";
import { sharpness } from "./sharpness";
import { grow, type Point, type Quad } from "./viewfinder";

/**
 * Photos taken in the browser, before they are sent: the sharpest of a few
 * frames, at the camera's full size; for a student card, its QR code read and
 * the card alone kept — cut from that full size, so it keeps every pixel the
 * camera gave it; then scaled down and re-encoded as JPEG, which also drops
 * what a phone writes into its photos (where and when it was taken).
 */

/** Longest side of a photo sent: enough to read a face and a card, light to send from a phone (the server takes up to 3 MB). */
const MAX_SIDE = 1600;
/** Longest side a photo chosen from the device is read at — larger than sent, for a card to be cut from it first. */
export const SOURCE_SIDE = 4096;
/** JPEG quality: fine print stays legible; a photo still weighs a few hundred kB. */
const JPEG_QUALITY = 0.92;

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * Any picture drawn onto a canvas no larger than `maxSide`. Scaled down in
 * halves first, when it is more than twice too big: in one big step, most
 * pixels would be skipped and the fine print left jagged.
 */
export function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide = MAX_SIDE): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  let from: CanvasImageSource = source;
  let [fw, fh] = [width, height];
  while (fw / 2 > w) {
    const half = document.createElement("canvas");
    half.width = Math.round(fw / 2);
    half.height = Math.round(fh / 2);
    context(half).drawImage(from, 0, 0, half.width, half.height);
    [from, fw, fh] = [half, half.width, half.height];
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  context(canvas).drawImage(from, 0, 0, w, h);
  return canvas;
}

export const canvasToJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", JPEG_QUALITY),
  );

/** A photo chosen from the device, drawn again (upright, as the browser shows it). */
export async function fileToCanvas(file: File, maxSide = MAX_SIDE): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height, maxSide);
  } finally {
    bitmap.close();
  }
}

/** The picture's pixels. */
export function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// ─── The sharpest frame ─────────────────────────────────────────

/** Frames looked at for the sharpest, when the photo is taken: about a sixth of a second at 30 frames a second. */
const FRAMES = 5;
/** The patch sharpness is judged on, at most this many pixels across — the same for every frame. */
const PROBE_SIDE = 320;

/** The camera's next frame — or, should none come (the camera closing), soon all the same. */
function nextFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    // Both are called later, never now: each may name the other.
    const id = video.requestVideoFrameCallback?.(() => {
      clearTimeout(timer);
      resolve();
    });
    const timer = setTimeout(() => {
      if (id !== undefined) video.cancelVideoFrameCallback?.(id);
      resolve();
    }, 80);
  });
}

/**
 * The sharpest of the camera's next few frames, at its full size: a hand is
 * never quite still, and a camera's focus hunts — one frame of the few is the
 * clearest. Judged where the detail is: around the card's code when it is
 * known, else in the middle of the picture.
 */
export async function sharpestFrame(video: HTMLVideoElement, near?: Quad | null): Promise<HTMLCanvasElement> {
  const [w, h] = [video.videoWidth, video.videoHeight];
  const best = document.createElement("canvas");
  best.width = w;
  best.height = h;
  const bctx = context(best);

  const g = near ? grow(near, 0.3) : null;
  const x0 = g ? Math.max(0, Math.floor(Math.min(...g.map((p) => p.x)))) : w * 0.25;
  const y0 = g ? Math.max(0, Math.floor(Math.min(...g.map((p) => p.y)))) : h * 0.25;
  const x1 = g ? Math.min(w, Math.ceil(Math.max(...g.map((p) => p.x)))) : w * 0.75;
  const y1 = g ? Math.min(h, Math.ceil(Math.max(...g.map((p) => p.y)))) : h * 0.75;
  const k = Math.min(1, PROBE_SIDE / Math.max(x1 - x0, y1 - y0, 1));
  const probe = document.createElement("canvas");
  probe.width = Math.max(3, Math.round((x1 - x0) * k));
  probe.height = Math.max(3, Math.round((y1 - y0) * k));
  const pctx = probe.getContext("2d", { willReadFrequently: true });

  let top = -1;
  for (let i = 0; i < FRAMES; i++) {
    if (i) await nextFrame(video);
    if (video.videoWidth !== w || video.videoHeight !== h) break; // the camera closed, or changed
    let score = 0;
    if (pctx) {
      pctx.drawImage(video, x0, y0, x1 - x0, y1 - y0, 0, 0, probe.width, probe.height);
      const patch = pctx.getImageData(0, 0, probe.width, probe.height);
      score = sharpness(toGray(patch.data, patch.width, patch.height));
    }
    if (score > top) {
      top = score;
      bctx.drawImage(video, 0, 0, w, h);
    }
    if (!pctx) break; // nothing to judge by: the first frame it is
  }
  return best;
}

// ─── The card's code ─────────────────────────────────────────

const cornersOf = (l: { topLeftCorner: Point; topRightCorner: Point; bottomRightCorner: Point; bottomLeftCorner: Point }): Quad => [
  l.topLeftCorner,
  l.topRightCorner,
  l.bottomRightCorner,
  l.bottomLeftCorner,
];

/** The width a picture is searched at for its code — as the live camera does. */
const SEARCH_SIDE = 1280;
/** The patch where the code is, enlarged to about this many pixels across before it is read. */
const ZOOM_SIDE = 480;
/** The size a picture is read off its code's grid of modules at, at most: every pixel there is helps. */
const GRID_SIDE = 1920;

/** Where a QR code is in the picture — read, or sensed from its corner squares — or null. */
export async function locateQr(canvas: HTMLCanvasElement): Promise<Quad | null> {
  const { default: jsQR } = await import("jsqr");
  const small = Math.max(canvas.width, canvas.height) > SEARCH_SIDE ? drawScaled(canvas, canvas.width, canvas.height, SEARCH_SIDE) : canvas;
  const k = small.width / canvas.width;
  const frame = pixelsOf(small);
  const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
  const quad = code ? cornersOf(code.location) : (senseQr(toGray(frame.data, frame.width, frame.height))?.quad ?? null);
  return quad && (quad.map((p) => ({ x: p.x / k, y: p.y / k })) as Quad);
}

/** The code read in the patch around `near`, enlarged — a small code reads there when not in the whole picture. */
function readNear(jsQR: typeof import("jsqr").default, canvas: HTMLCanvasElement, near: Quad): string | null {
  const g = grow(near, 0.35);
  const x0 = Math.max(0, Math.floor(Math.min(...g.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...g.map((p) => p.y))));
  const x1 = Math.min(canvas.width, Math.ceil(Math.max(...g.map((p) => p.x))));
  const y1 = Math.min(canvas.height, Math.ceil(Math.max(...g.map((p) => p.y))));
  if (x1 - x0 < 16 || y1 - y0 < 16) return null;
  const k = Math.min(4, Math.max(1, ZOOM_SIDE / Math.max(x1 - x0, y1 - y0)));
  const zoom = document.createElement("canvas");
  zoom.width = Math.round((x1 - x0) * k);
  zoom.height = Math.round((y1 - y0) * k);
  const ctx = zoom.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, zoom.width, zoom.height);
  const patch = ctx.getImageData(0, 0, zoom.width, zoom.height);
  return jsQR(patch.data, patch.width, patch.height, { inversionAttempts: "attemptBoth" })?.data || null;
}

/**
 * The text of a QR code in the picture, if one can be read: around `near`,
 * where it was seen, enlarged; then in the whole picture — smaller first,
 * which is quicker. Last, too blurred for that, off its grid of modules
 * (lib/qr-grid), where it is sensed.
 */
export async function readQr(canvas: HTMLCanvasElement, near?: Quad | null): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const there = near ? readNear(jsQR, canvas, near) : null;
  if (there) return there;
  for (const side of [1000, MAX_SIDE]) {
    const whole = side >= Math.max(canvas.width, canvas.height);
    const c = whole ? canvas : drawScaled(canvas, canvas.width, canvas.height, side);
    const frame = pixelsOf(c);
    const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
    if (whole) break;
  }
  const c = Math.max(canvas.width, canvas.height) > GRID_SIDE ? drawScaled(canvas, canvas.width, canvas.height, GRID_SIDE) : canvas;
  const frame = pixelsOf(c);
  const gray = toGray(frame.data, frame.width, frame.height);
  const sensed = senseQr(gray);
  return sensed ? readGrid(jsQR, gray, sensed, true) : null;
}

// ─── The card alone ─────────────────────────────────────────

/**
 * Only the card, upright: the photo cut around it (lib/card-crop) — and turned,
 * when the card was held turned. What is off the photo, a turned card's corner
 * held out of sight, is left dark.
 */
export function cutCard(canvas: HTMLCanvasElement, crop: CardCrop): HTMLCanvasElement {
  const out = document.createElement("canvas");
  if (Math.abs(crop.angle) < STRAIGHT) {
    const { x, y, w, h } = crop.box;
    out.width = w;
    out.height = h;
    context(out).drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return out;
  }
  // The card's own axes made the photo's.
  const q = crop.corners;
  const c = { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 };
  const [cos, sin] = [Math.cos(crop.angle), Math.sin(crop.angle)];
  const xs = q.map((p) => (p.x - c.x) * cos + (p.y - c.y) * sin);
  const ys = q.map((p) => -(p.x - c.x) * sin + (p.y - c.y) * cos);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  out.width = Math.max(1, Math.round(Math.max(...xs) - minX));
  out.height = Math.max(1, Math.round(Math.max(...ys) - minY));
  const ctx = context(out);
  ctx.fillStyle = "#1b2420";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(-minX, -minY);
  ctx.rotate(-crop.angle);
  ctx.translate(-c.x, -c.y);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/** A crop found on a smaller copy of the photo, for the photo itself (`f` times larger). */
function scaleCrop(crop: CardCrop, f: number, width: number, height: number): CardCrop {
  const x = Math.max(0, Math.floor(crop.box.x * f));
  const y = Math.max(0, Math.floor(crop.box.y * f));
  return {
    corners: crop.corners.map((p) => ({ x: p.x * f, y: p.y * f })) as Quad,
    angle: crop.angle,
    box: { x, y, w: Math.min(width - x, Math.ceil(crop.box.w * f)), h: Math.min(height - y, Math.ceil(crop.box.h * f)) },
  };
}

/**
 * A photo of a student card made ready to send: its QR code read (unless it
 * was already, live), only the card kept, upright — cut from the photo at its
 * full size, then scaled down. `near` is where the code was seen, when known;
 * else it is looked for.
 */
export async function cardPhoto(
  canvas: HTMLCanvasElement,
  near?: Quad | null,
  qrSeen?: string | null,
): Promise<{ canvas: HTMLCanvasElement; qr: string | null }> {
  const where = near ?? (await locateQr(canvas).catch(() => null));
  const qr = qrSeen ?? (await readQr(canvas, where).catch(() => null));
  let kept = canvas;
  try {
    if (where) {
      // Where the card's edges are is judged on a smaller copy — plenty to find
      // them by — and the card cut from the full photo.
      const small = Math.max(canvas.width, canvas.height) > MAX_SIDE ? drawScaled(canvas, canvas.width, canvas.height) : canvas;
      const k = small.width / canvas.width;
      const crop = cardCrop(pixelsOf(small), where.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad);
      if (crop) kept = cutCard(canvas, scaleCrop(crop, 1 / k, canvas.width, canvas.height));
    }
  } catch {
    // Cut or not, the photo is sent: the whole of it, then.
  }
  return { canvas: drawScaled(kept, kept.width, kept.height), qr };
}
