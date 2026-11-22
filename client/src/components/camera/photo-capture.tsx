import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  Loader2,
  Move,
  RotateCcw,
  ScanFace,
  ScanLine,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { canvasToJpeg, cardPhoto, drawScaled, fileToCanvas, sharpestFrame, SOURCE_SIDE } from "../../lib/photo";
import type { CardQrVerdict } from "../../lib/read-registration";
import { bracketsPath, dimPath, grow, lerpQuad, restQuad, type Point, type Quad } from "../../lib/viewfinder";
import { senseQr, toGray, type SensedQr } from "../../lib/qr-sense";
import { readGrid } from "../../lib/qr-grid";
import { closeEnough, holdShare, lookAt, type Hold } from "../../lib/auto-shutter";
import { cardInside } from "../../lib/card-crop";
import { loadFaceFinder } from "../../lib/face-detect";
import { faceHeld, faceQuad, judgeFaces, type FaceBox, type FaceVerdict } from "../../lib/face-frame";

/** A photo taken (or chosen), ready to send — and, for a card, the QR code read in it. */
export interface CapturedPhoto {
  blob: Blob;
  url: string;
  qr: string | null;
}

type Kind = "card" | "selfie";

/** Judges a QR code read off the card: this account's, another's, or not a student card's. */
type JudgeQr = (text: string) => CardQrVerdict;

/**
 * Takes one photo: with the camera, live — or chosen from the device, which on
 * a phone opens its own camera app (and works on a plain-HTTP page, where the
 * browser will not open a camera itself).
 *
 * A frame on the live picture shows what to fit in it: the card; or the face
 * with the card held beside it. For the card, the picture is also searched for
 * its QR code all the while: a frame follows the code wherever it is held and
 * says what it carries — and once the frame is on it, the card near enough, all
 * of it in sight (lib/card-crop: where it is, by its code), and held still a
 * moment, the photo is taken by itself (lib/auto-shutter), read or
 * not. Of a card's photo, however taken, only the card is kept, upright
 * (lib/card-crop): the room around it is no one's business.
 *
 * For the face, the picture is searched for faces instead (lib/face-detect):
 * the frame goes around the face, says what to do — come closer, step back,
 * one face only — and once it is right and held still a moment, the photo is
 * taken by itself too (lib/face-frame). Where the detector cannot run, the
 * shutter is pressed by hand.
 *
 * Either way the photo is scaled down and re-encoded before it leaves (lib/photo).
 */
export function PhotoCapture({
  kind,
  photo,
  onPhoto,
  judgeQr,
}: {
  kind: Kind;
  photo: CapturedPhoto | null;
  onPhoto: (photo: CapturedPhoto | null) => void;
  /** For the card: whose number its QR code carries. */
  judgeQr?: JudgeQr;
}) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const canUseCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // The photo's address lives as long as the photo shown.
  useEffect(() => {
    const url = photo?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo?.url]);

  /**
   * The picture taken, at its full size. For the card: its QR code — already
   * read live, or read now — and the card alone kept, upright, the room around
   * it left out. Then scaled down to be sent.
   */
  const finish = async (canvas: HTMLCanvasElement, qrSeen?: string | null, near?: Quad | null) => {
    setWorking(true);
    setFailed(null);
    try {
      const card = kind === "card" ? await cardPhoto(canvas, near, qrSeen) : null;
      const blob = await canvasToJpeg(card?.canvas ?? drawScaled(canvas, canvas.width, canvas.height));
      onPhoto({ blob, url: URL.createObjectURL(blob), qr: card?.qr ?? null });
    } catch {
      setFailed(t("activation.photo.failed"));
    } finally {
      setWorking(false);
      setLive(false);
    }
  };

  if (photo) {
    return (
      <div className="overflow-hidden rounded-2xl border border-forest/12 bg-forest-deep" data-testid={`photo-${kind}`}>
        <img src={photo.url} alt={t(`activation.photo.${kind}.title`)} className="mx-auto max-h-72 w-full object-contain" />
        <div className="flex justify-center border-t border-white/10 bg-black/30 p-2">
          <button
            type="button"
            onClick={() => onPhoto(null)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-cream transition hover:bg-white/10"
          >
            <RotateCcw size={14} />
            {t("activation.photo.retake")}
          </button>
        </div>
      </div>
    );
  }

  if (live) {
    return (
      <LiveCamera
        kind={kind}
        judgeQr={kind === "card" ? judgeQr : undefined}
        onShot={(canvas, qr, near) => void finish(canvas, qr, near)}
        onCancel={() => setLive(false)}
        onError={(message) => {
          setLive(false);
          setFailed(message);
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-forest/15 bg-cream-2/50 p-4 text-center" data-testid={`photo-${kind}-empty`}>
      <Guide kind={kind} />
      <p className="mx-auto mt-3 max-w-sm text-[12px] leading-relaxed text-clay">{t(`activation.photo.${kind}.tip`)}</p>
      {failed && (
        <p role="alert" className="mx-auto mt-2 max-w-sm text-[12px] text-brick">
          {failed}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {canUseCamera && (
          <button
            type="button"
            onClick={() => setLive(true)}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-[13px] font-bold text-cream transition hover:bg-forest-soft disabled:opacity-60"
          >
            <Camera size={16} />
            {t("activation.photo.openCamera")}
          </button>
        )}
        <button
          type="button"
          onClick={() => file.current?.click()}
          disabled={working}
          className="inline-flex items-center gap-2 rounded-xl border border-forest/15 bg-cream-card px-4 py-2.5 text-[13px] font-bold text-forest transition hover:border-gold/45 disabled:opacity-60"
        >
          {working ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} className="text-gold" />}
          {t("activation.photo.choose")}
        </button>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={kind === "card" ? "environment" : "user"}
          className="hidden"
          data-testid={`photo-${kind}-file`}
          onChange={async (e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (!chosen) return;
            try {
              // A card's photo read larger than it is sent: the card is cut from it first.
              await finish(await fileToCanvas(chosen, kind === "card" ? SOURCE_SIDE : undefined));
            } catch {
              setFailed(t("activation.photo.failed"));
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── The live picture ─────────────────────────────────────────

/** The pause between two searches of the picture for the card's QR code (each takes a little while itself). */
const SCAN_EVERY_MS = 90;
/** The width it is searched at: the small code on a card needs every pixel a laptop camera has. */
const SCAN_WIDTH = 1280;
/** The patch where the code is, enlarged to about this many pixels across before it is read. */
const ZOOM_SIDE = 480;
/** The code out of sight this long: the frame lets go of it. */
const LOST_AFTER_MS = 650;

/** What the viewfinder knows of the code: sensed (not read yet), or read — and whose it is. */
type Seen = CardQrVerdict | "sensed";
/** What it says: that — or that the card is partly out of the picture, or too far, to be photographed yet. */
type Status = Seen | "edge" | "closer";

const TONE: Record<Status, { stroke: string; chip: string }> = {
  sensed: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  edge: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  closer: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  match: { stroke: "#34d399", chip: "bg-emerald-600/90 text-white" },
  other: { stroke: "#f87171", chip: "bg-red-600/90 text-white" },
  foreign: { stroke: "#fbbf24", chip: "bg-amber-500/95 text-forest-deep" },
};

/** The pause between two searches of the picture for a face. */
const FACE_EVERY_MS = 100;
/** The width a face is searched for at: a face is big — and the search quicker. */
const DETECT_WIDTH = 640;

/** What the frame knows of the face: the detector still loading, no face yet — or what the face found says. */
type FaceStatus = "loading" | "searching" | FaceVerdict;

const FACE_TONE: Record<FaceStatus, { stroke: string; chip: string }> = {
  loading: { stroke: "#ffffff", chip: "bg-black/55 text-cream" },
  searching: { stroke: "#ffffff", chip: "bg-black/55 text-cream" },
  closer: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  farther: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  edge: { stroke: "#ffffff", chip: "bg-forest/85 text-cream" },
  ready: { stroke: "#34d399", chip: "bg-emerald-600/90 text-white" },
  many: { stroke: "#fbbf24", chip: "bg-amber-500/95 text-forest-deep" },
};

const FACE_ICON: Record<FaceStatus, ReactNode> = {
  loading: <Loader2 size={14} className="shrink-0 animate-spin" />,
  searching: <ScanFace size={14} className="shrink-0 animate-pulse" />,
  closer: <ZoomIn size={14} className="shrink-0 animate-pulse" />,
  farther: <ZoomOut size={14} className="shrink-0 animate-pulse" />,
  edge: <AlertTriangle size={14} className="shrink-0" />,
  ready: <CheckCircle2 size={14} className="shrink-0" />,
  many: <Users size={14} className="shrink-0" />,
};

/** The live picture, the frame to fit in it, the card's code followed — and the shutter. */
function LiveCamera({
  kind,
  judgeQr,
  onShot,
  onCancel,
  onError,
}: {
  kind: Kind;
  judgeQr?: JudgeQr;
  /** The picture — and for the card, its code's text if read live, and where the code was in the picture. */
  onShot: (canvas: HTMLCanvasElement, qr?: string | null, near?: Quad | null) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  // The viewfinder (lib/viewfinder): moved every frame, outside React's renders.
  const brackets = useRef<SVGPathElement>(null);
  const dim = useRef<SVGPathElement>(null);
  const [ready, setReady] = useState(false);
  // A camera facing the person is shown as a mirror — the card then moves on
  // screen the way the hand moves. The photo itself is never mirrored.
  const [mirror, setMirror] = useState(kind === "selfie");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);
  const [far, setFar] = useState(false);
  const [cut, setCut] = useState(false);
  const [hold, setHold] = useState(0);
  const tracking = kind === "card" && !!judgeQr;
  const faceTracking = kind === "selfie";
  // Null once the detector is known not to run here: then nothing is said.
  const [face, setFace] = useState<FaceStatus | null>(faceTracking ? "loading" : null);

  // Started once per opening: new callbacks from the parent do not restart anything.
  const failed = useEffectEvent((error: DOMException) =>
    onError(t(error?.name === "NotAllowedError" ? "activation.photo.denied" : "activation.photo.noCamera")),
  );
  const judge = useEffectEvent((text: string) => judgeQr?.(text) ?? "foreign");
  // Taking the photo: a few frames are looked at for the sharpest — the shutter waits.
  const [taking, setTaking] = useState(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  /**
   * The photo — by the shutter, or by itself once the card was held on its
   * code, or the face still (then where the code or the face is comes along,
   * and the frames are judged there): the sharpest of the next few frames, at
   * the camera's full size.
   */
  const capture = async (qr?: string | null, codeAt?: Quad) => {
    const el = video.current;
    if (!el?.videoWidth || taking) return;
    setTaking(true);
    try {
      const canvas = await sharpestFrame(el, codeAt);
      if (open.current) onShot(canvas, qr, codeAt);
    } catch {
      if (open.current) onError(t("activation.photo.failed"));
    }
  };
  const shootHeld = useEffectEvent((qr: string | undefined, codeAt: Quad) => void capture(qr, codeAt));

  // ── The camera ──
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    // The face detector loads while the camera starts, not after.
    if (kind === "selfie") void loadFaceFinder();
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: kind === "card" ? "environment" : "user" },
          // As large as the camera gives: the card is cut out of the picture, and
          // keeps only its share of the pixels. The face fills its own photo.
          width: { ideal: kind === "card" ? 3840 : 1920 },
          height: { ideal: kind === "card" ? 2160 : 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      .then(async (media) => {
        stream = media;
        if (!alive) return media.getTracks().forEach((track) => track.stop());
        keepFocusing(media.getVideoTracks()[0]);
        const el = video.current;
        if (!el) return;
        el.srcObject = media;
        await el.play().catch(() => undefined);
        if (!alive) return;
        const facing = media.getVideoTracks()[0]?.getSettings().facingMode;
        setMirror(kind === "selfie" || facing !== "environment");
        setSize({ w: el.videoWidth || 1280, h: el.videoHeight || 720 });
        setReady(true);
      })
      .catch((error: DOMException) => {
        if (alive) failed(error);
      });
    return () => {
      alive = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [kind]);

  // ── The card's code, searched for and followed ──
  useEffect(() => {
    if (!ready || !tracking || !size) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let target: Quad | null = null;
    const rest = restQuad(size.w, size.h);
    let shown: Quad = rest;
    let lastSeen = 0;
    /** The card held still on the code (lib/auto-shutter): when it is long enough, the photo. */
    let hold: Hold | null = null;
    let verdict: CardQrVerdict | null = null;
    let lastRead: string | null = null;
    /** Where the code was last read or sensed, in the scanned picture's pixels: the patch to zoom into. */
    let focus: Quad | null = null;
    let sensedTwice = 0;
    let turn = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const zoom = document.createElement("canvas");
    const zctx = zoom.getContext("2d", { willReadFrequently: true });

    // The corners fly to the code's corners — quickly — and drift back to the
    // middle — gently — instead of jumping there.
    const glide = () => {
      shown = lerpQuad(shown, target ? grow(target, 0.18) : rest, target ? 0.3 : 0.14);
      brackets.current?.setAttribute("d", bracketsPath(shown));
      dim.current?.setAttribute("d", dimPath(shown, size.w, size.h));
      raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);

    const scan = async () => {
      const { default: jsQR } = await import("jsqr");
      const corners = (l: { topLeftCorner: Point; topRightCorner: Point; bottomRightCorner: Point; bottomLeftCorner: Point }) =>
        [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner] as Quad;

      /**
       * The patch where the code is, enlarged — a small code reads there when it
       * does not in the whole picture. Taken from the camera's own picture, which
       * has more pixels than the one scaled down to be searched.
       */
      const readPatch = (el: HTMLVideoElement, scale: number, q: Quad): { quad: Quad; data: string } | null => {
        if (!zctx) return null;
        const g = grow(q, 0.35);
        const x0 = Math.max(0, Math.floor(Math.min(...g.map((p) => p.x))));
        const y0 = Math.max(0, Math.floor(Math.min(...g.map((p) => p.y))));
        const x1 = Math.min(canvas.width, Math.ceil(Math.max(...g.map((p) => p.x))));
        const y1 = Math.min(canvas.height, Math.ceil(Math.max(...g.map((p) => p.y))));
        if (x1 - x0 < 16 || y1 - y0 < 16) return null;
        const [sx, sy, sw, sh] = [x0 / scale, y0 / scale, (x1 - x0) / scale, (y1 - y0) / scale];
        const k = Math.min(4, Math.max(1, ZOOM_SIDE / Math.max(sw, sh)));
        zoom.width = Math.round(sw * k);
        zoom.height = Math.round(sh * k);
        zctx.imageSmoothingEnabled = true;
        zctx.drawImage(el, sx, sy, sw, sh, 0, 0, zoom.width, zoom.height);
        const patch = zctx.getImageData(0, 0, zoom.width, zoom.height);
        const code = jsQR(patch.data, patch.width, patch.height, { inversionAttempts: "attemptBoth" });
        if (!code?.data) return null;
        // Back to the searched picture's pixels, where `focus` is kept.
        const quad = corners(code.location).map((p) => ({ x: (sx + p.x / k) * scale, y: (sy + p.y / k) * scale })) as Quad;
        return { quad, data: code.data };
      };

      const tick = () => {
        if (!alive) return;
        const el = video.current;
        const now = performance.now();
        if (el && ctx && el.readyState >= el.HAVE_ENOUGH_DATA && el.videoWidth) {
          const scale = Math.min(1, SCAN_WIDTH / el.videoWidth);
          canvas.width = Math.round(el.videoWidth * scale);
          canvas.height = Math.round(el.videoHeight * scale);
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const toVideo = (q: Quad) => q.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad;

          // Read it: where it was (enlarged), and now and then in the whole picture —
          // still now and then while a patch is followed, in case it is not the code.
          let read = focus ? readPatch(el, scale, focus) : null;
          if (!read && turn % (focus ? 4 : 3) === 0) {
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (code?.data) read = { quad: corners(code.location), data: code.data };
          }
          turn++;

          // Not read so: sensed from its corner squares — and, too blurred for the
          // decoder, perhaps read off its grid of modules all the same (lib/qr-grid).
          let sensed: SensedQr | null = null;
          if (!read) {
            const gray = toGray(image.data, image.width, image.height);
            sensed = senseQr(gray);
            const text = sensed ? readGrid(jsQR, gray, sensed) : null;
            if (sensed && text) read = { quad: sensed.quad, data: text };
          }

          // The frame on the code this time — read, or sensed — and the card held there.
          let onCode = false;
          if (read) {
            // Another code than the one held (another card): its hold starts over.
            if (lastRead !== null && read.data !== lastRead) hold = null;
            lastRead = read.data;
            focus = read.quad;
            target = toVideo(read.quad);
            lastSeen = now;
            onCode = true;
            const next = judge(read.data);
            if (next !== verdict) {
              verdict = next;
              setSeen(next);
            }
          } else {
            // Not readable yet: sensed, the frame goes there all the same.
            sensedTwice = sensed ? sensedTwice + 1 : 0;
            // Twice in a row, so a passing pattern in the room does not pull the frame away.
            if (sensed && sensedTwice >= 2) {
              focus = sensed.quad;
              target = toVideo(sensed.quad);
              lastSeen = now;
              onCode = true;
              if (!verdict) setSeen("sensed");
            } else if (target && now - lastSeen > LOST_AFTER_MS) {
              target = null;
              focus = null;
              verdict = null;
              lastRead = null;
              hold = null;
              setSeen(null);
            }
          }

          // Too far, the card would come out too small to read in the photo; partly
          // out of the picture, cut: closer, or all of it in, first — no hold till then.
          const far = onCode && !!target && !closeEnough(target, el.videoWidth, el.videoHeight);
          const cut = onCode && !!target && !cardInside(target, el.videoWidth, el.videoHeight);
          setFar(far);
          setCut(cut);
          // Held still on it long enough: the photo takes itself — with the code's
          // text if it was read; if not, it is read from the photo (finish, above).
          if (onCode && target) hold = far || cut ? null : lookAt(hold, target, now);
          const held = holdShare(hold, verdict, now);
          setHold(held);
          if (onCode && target && held >= 1) {
            alive = false;
            shootHeld(lastRead ?? undefined, target);
            return;
          }
        }
        timer = setTimeout(tick, SCAN_EVERY_MS);
      };
      tick();
    };
    void scan();

    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [ready, tracking, size]);

  // ── The face, searched for and followed ──
  useEffect(() => {
    if (!ready || !faceTracking || !size) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    /** Around the face while one is in sight — and where the frame is drawn now, flying there. */
    let target: Quad | null = null;
    let shown: Quad | null = null;
    let lastSeen = 0;
    /** The face held still, ready (lib/auto-shutter): when it is long enough, the photo. */
    let hold: Hold | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // The frame appears around the face, follows it — and is gone with it.
    const glide = () => {
      shown = target ? (shown ? lerpQuad(shown, target, 0.35) : target) : null;
      brackets.current?.setAttribute("d", shown ? bracketsPath(shown, 0.22) : "");
      raf = requestAnimationFrame(glide);
    };

    void loadFaceFinder().then((find) => {
      if (!alive) return;
      // No detector here: the shutter is pressed by hand.
      if (!find) return setFace(null);
      setFace("searching");
      raf = requestAnimationFrame(glide);

      const tick = () => {
        if (!alive) return;
        const el = video.current;
        const now = performance.now();
        if (el && ctx && el.readyState >= el.HAVE_ENOUGH_DATA && el.videoWidth) {
          const scale = Math.min(1, DETECT_WIDTH / el.videoWidth);
          canvas.width = Math.round(el.videoWidth * scale);
          canvas.height = Math.round(el.videoHeight * scale);
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          let faces: FaceBox[] = [];
          try {
            faces = find(canvas, now).map((b) => ({ x: b.x / scale, y: b.y / scale, width: b.width / scale, height: b.height / scale }));
          } catch {
            // A frame it could not look at: the next one.
          }
          const seen = judgeFaces(faces, el.videoWidth, el.videoHeight);
          if (seen) {
            target = faceQuad(seen.face);
            lastSeen = now;
            setFace(seen.verdict);
            // Still and ready, the hold goes on; anything else to do first, it starts over.
            hold = seen.verdict === "ready" ? lookAt(hold, target, now) : null;
          } else if (target && now - lastSeen > LOST_AFTER_MS) {
            // Missed in a frame or two, the face is still there; longer, it is gone.
            target = null;
            hold = null;
            setFace("searching");
          }
          const held = faceHeld(hold, now);
          setHold(held);
          if (seen?.verdict === "ready" && held >= 1) {
            alive = false;
            // The sharpest frame is judged on the face (lib/photo).
            shootHeld(undefined, faceQuad(seen.face));
            return;
          }
        }
        timer = setTimeout(tick, FACE_EVERY_MS);
      };
      tick();
    });

    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [ready, faceTracking, size]);

  // Whose code it is says more than where the card is; that it is cut, more than
  // how far it is (coming closer would cut it more); how far, more than that it is seen.
  const status: Status | null = seen === "other" || seen === "foreign" ? seen : cut ? "edge" : far ? "closer" : seen;
  const tone = tracking ? (status ? TONE[status] : null) : face ? FACE_TONE[face] : null;
  // A face in sight: its frame, not the outline of where it goes.
  const faceInSight = !!face && face !== "loading" && face !== "searching";

  return (
    <div className="overflow-hidden rounded-2xl border border-forest/12 bg-forest-deep" data-testid={`photo-${kind}-live`}>
      <div className="relative">
        {/* Mirrored together, so the frame stays on the code it follows. */}
        <div className={mirror ? "-scale-x-100" : undefined}>
          <video ref={video} muted playsInline className="block aspect-video w-full object-cover" />
          {ready && size && (tracking || faceTracking) && (
            <svg
              aria-hidden
              data-testid="live-viewfinder"
              viewBox={`0 0 ${size.w} ${size.h}`}
              preserveAspectRatio="xMidYMid slice"
              className="pointer-events-none absolute inset-0 size-full"
            >
              {/* Where these are is set by the glide above, every frame — not by React. */}
              {tracking && (
                <path ref={dim} d={dimPath(restQuad(size.w, size.h), size.w, size.h)} fill="#000" fillRule="evenodd" opacity={0.4} />
              )}
              {/* Around the face, nothing is dimmed: the card is held beside it. */}
              <path
                ref={brackets}
                d={tracking ? bracketsPath(restQuad(size.w, size.h)) : ""}
                fill="none"
                stroke={tone?.stroke ?? "#ffffff"}
                strokeWidth={Math.max(5, size.h / 70)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: "stroke 220ms", filter: `drop-shadow(0 0 ${size.h / 90}px ${tone?.stroke ?? "rgba(255,255,255,0.6)"})` }}
              />
            </svg>
          )}
        </div>

        {ready ? (
          // The card's frame is the viewfinder above, when the code is followed;
          // the face's, once a face is in sight.
          !tracking &&
          !faceInSight && (
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <LiveFrame kind={kind} />
            </div>
          )
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 size={22} className="animate-spin text-cream/80" />
          </div>
        )}

        {ready && tracking && (
          <StatusChip
            testId="live-qr-status"
            tone={tone?.chip}
            text={t(`activation.scan.${status ?? "searching"}`)}
            icon={
              status === "match" ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : status === "closer" ? (
                <ZoomIn size={14} className="shrink-0 animate-pulse" />
              ) : status === "edge" ? (
                <Move size={14} className="shrink-0 animate-pulse" />
              ) : status === "sensed" ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : status ? (
                <AlertTriangle size={14} className="shrink-0" />
              ) : (
                <ScanLine size={14} className="shrink-0 animate-pulse" />
              )
            }
          />
        )}

        {ready && faceTracking && face && (
          <StatusChip testId="live-face-status" tone={tone?.chip} text={t(`activation.face.${face}`)} icon={FACE_ICON[face]} />
        )}

        {hold > 0 && (
          // The card held still on its code, or the face still: full, the photo is taken by itself.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-black/30" data-testid="live-hold">
            <div
              className="h-full transition-[width] duration-150 ease-linear"
              style={{ width: `${Math.round(hold * 100)}%`, backgroundColor: tone?.stroke ?? "#ffffff" }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-black/30 p-2.5">
        <button
          type="button"
          onClick={() => void capture()}
          disabled={!ready || taking}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-[13px] font-bold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
        >
          {taking ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {t("activation.photo.shoot")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-cream/85 transition hover:bg-white/10"
        >
          <CameraOff size={15} />
          {t("activation.photo.cancel")}
        </button>
      </div>
    </div>
  );
}

/** Over the top of the live picture: what the frame sees, and what to do. */
function StatusChip({ testId, tone, text, icon }: { testId: string; tone?: string; text: string; icon: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2.5" aria-live="polite">
      <span
        data-testid={testId}
        className={`inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[12px] font-bold shadow-lg backdrop-blur ${
          tone ?? "bg-black/55 text-cream"
        }`}
      >
        {icon}
        <span className="truncate">{text}</span>
      </span>
    </div>
  );
}

/**
 * A phone's camera focusing all the while, on what is in front of it now —
 * the card brought close — where it can be asked to (Chrome on Android). Most
 * do by themselves; a laptop's camera has a fixed focus and is left as it is.
 */
function keepFocusing(track: MediaStreamTrack | undefined) {
  const can = track?.getCapabilities?.() as { focusMode?: string[] } | undefined;
  if (!track || !can?.focusMode?.includes("continuous")) return;
  track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
}

/** Over the live picture: where the card goes — and the face beside it. */
function LiveFrame({ kind }: { kind: Kind }) {
  const card = <div className="aspect-[1.586] rounded-xl border-[3px] border-dashed border-gold-soft/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />;
  if (kind === "card") return <div className="w-[62%]">{card}</div>;
  return (
    <div className="flex w-[78%] items-center justify-center gap-[6%]">
      <div className="aspect-[3/4] w-[38%] rounded-[50%] border-[3px] border-dashed border-gold-soft/90" />
      <div className="w-[40%]">
        <div className="aspect-[1.586] rounded-lg border-[3px] border-dashed border-gold-soft/90" />
      </div>
    </div>
  );
}

/** What the photo should show — before the camera opens. */
function Guide({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 160 90" aria-hidden className="mx-auto h-20 w-auto text-forest/35">
      {kind === "card" ? (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <rect x="35" y="15" width="90" height="57" rx="7" />
          <rect x="45" y="27" width="20" height="26" rx="3" />
          <path d="M74 32h40M74 42h32M74 52h36" strokeLinecap="round" />
          <rect x="100" y="56" width="14" height="10" rx="1.5" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <ellipse cx="55" cy="38" rx="20" ry="25" />
          <path d="M28 88c4-14 14-21 27-21s23 7 27 21" strokeLinecap="round" />
          <rect x="92" y="34" width="50" height="32" rx="5" />
          <rect x="98" y="41" width="11" height="15" rx="2" />
        </g>
      )}
    </svg>
  );
}
