import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CameraOff, Loader2, ScanLine } from "lucide-react";

type Phase = "starting" | "scanning" | "denied" | "unavailable" | "failed";

/** Frames looked at per second: enough to catch a card held still, light on the CPU. */
const EVERY_MS = 150;
/** Frames are read at this width: a card's QR code is large enough at it, and it is quick. */
const READ_WIDTH = 640;

/**
 * The computer's camera, reading the QR code on a student card.
 *
 * Browsers open a camera only on a secure page — HTTPS, or the machine
 * itself (localhost) — so on a plain-HTTP intranet this says so, and the
 * field beside it (typed, or a USB scanner) still works. Chrome on Windows
 * has no QR reader of its own: jsQR does the reading, loaded with this panel
 * only.
 *
 * A laptop camera has a fixed focus: the card is held about 15–20 cm away, not
 * against the lens. Mounted while it should read; unmounting stops the camera.
 */
export function QrCamera({ onRead }: { onRead: (text: string) => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  // No camera API at all: a plain-HTTP page, or a browser without one.
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [phase, setPhase] = useState<Phase>(supported ? "starting" : "unavailable");
  const read = useEffectEvent((text: string) => onRead(text));

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const start = async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
        ]);
        stream = media;
        if (!alive) return stream.getTracks().forEach((track) => track.stop());
        const el = video.current;
        if (!el || !ctx) return;
        el.srcObject = stream;
        await el.play().catch(() => undefined);
        if (!alive) return;
        setPhase("scanning");

        const tick = () => {
          if (!alive) return;
          if (el.readyState >= el.HAVE_ENOUGH_DATA && el.videoWidth) {
            const scale = Math.min(1, READ_WIDTH / el.videoWidth);
            canvas.width = Math.round(el.videoWidth * scale);
            canvas.height = Math.round(el.videoHeight * scale);
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
            if (code?.data) return read(code.data);
          }
          timer = setTimeout(tick, EVERY_MS);
        };
        tick();
      } catch (error) {
        if (!alive) return;
        const name = (error as DOMException)?.name;
        setPhase(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "unavailable" : "failed");
      }
    };
    void start();

    return () => {
      alive = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [supported]);

  const problem = phase === "denied" || phase === "unavailable" || phase === "failed";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-forest/12 bg-forest-deep" data-testid="desk-camera">
      <video
        ref={video}
        muted
        playsInline
        aria-label={t("admin.activation.camera.label")}
        className={`aspect-video w-full -scale-x-100 object-cover transition-opacity duration-300 ${phase === "scanning" ? "opacity-100" : "opacity-0"}`}
      />

      {phase === "scanning" && (
        // The square to fill with the card's code.
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative aspect-square w-[38%] max-w-56">
            {["top-0 start-0 border-t-4 border-s-4 rounded-ss-2xl", "top-0 end-0 border-t-4 border-e-4 rounded-se-2xl", "bottom-0 start-0 border-b-4 border-s-4 rounded-es-2xl", "bottom-0 end-0 border-b-4 border-e-4 rounded-ee-2xl"].map((c) => (
              <span key={c} className={`absolute size-8 border-gold-soft ${c}`} />
            ))}
            <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse rounded-full bg-gold-soft/80 shadow-[0_0_12px_rgba(230,200,140,0.9)]" />
          </div>
        </div>
      )}

      {phase !== "scanning" && (
        <div className="absolute inset-0 grid place-items-center p-5 text-center">
          {problem ? (
            <div className="max-w-sm text-cream" role="alert">
              <CameraOff size={26} className="mx-auto mb-2 text-gold-soft" />
              <p className="text-[13px] font-bold">{t(`admin.activation.camera.${phase}`)}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-cream/75">{t("admin.activation.camera.fallback")}</p>
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[12.5px] text-cream/85">
              <Loader2 size={16} className="animate-spin" />
              {t("admin.activation.camera.starting")}
            </span>
          )}
        </div>
      )}

      {phase === "scanning" && (
        <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-linear-to-t from-black/70 to-transparent px-3 pb-2.5 pt-6 text-[11.5px] text-cream">
          <ScanLine size={14} className="text-gold-soft" />
          {t("admin.activation.camera.hint")}
        </p>
      )}
    </div>
  );
}
