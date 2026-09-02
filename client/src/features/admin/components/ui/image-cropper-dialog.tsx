import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../../../hooks/use-body-scroll-lock";
import { useTranslation } from "react-i18next";
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Loader2,
  ImageIcon,
} from "lucide-react";

/**
 * Passport-photo proportions (35 × 45 mm → 7:9), the shape used on official
 * university cards. The preview and the export share the ratio, so what the
 * admin frames is exactly what gets saved.
 */
const RATIO_W = 7;
const RATIO_H = 9;
const VIEW_W = 280;
const VIEW_H = (VIEW_W * RATIO_H) / RATIO_W; // 360
const OUT_W = 560;
const OUT_H = (OUT_W * RATIO_H) / RATIO_W; // 720

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  /** Receives the cropped square image, ready to upload. */
  onDone: (cropped: File) => void;
}

/**
 * Passport-photo cropper. The picture is drawn into an upright rectangular
 * viewport; the admin pans and zooms until it sits right, and confirming
 * renders exactly what is visible into a 7:9 canvas.
 */
export function ImageCropperDialog({ open, file, onCancel, onDone }: Props) {
  if (!open || !file) return null;
  // Keyed so a different picture always starts from a clean zoom/offset.
  return (
    <Cropper
      key={`${file.name}-${file.size}-${file.lastModified}`}
      file={file}
      onCancel={onCancel}
      onDone={onDone}
    />
  );
}

function Cropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const { t } = useTranslation();
  useBodyScrollLock(true);

  // An object URL is an external resource: created on mount, released on
  // unmount. It has to be produced *inside* the effect — StrictMode mounts
  // twice and the first cleanup revokes the URL, so one kept in a state
  // initializer would already be dead by the second mount and the picture
  // would never load.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Scale that makes the image just cover the viewport at zoom 1.
  const baseScale = natural.w
    ? Math.max(VIEW_W / natural.w, VIEW_H / natural.h)
    : 1;
  const scale = baseScale * zoom;
  const drawW = natural.w * scale;
  const drawH = natural.h * scale;

  /** Keeps the image covering the viewport — no empty corners. */
  function clamp(next: { x: number; y: number }) {
    const maxX = Math.max(0, (drawW - VIEW_W) / 2);
    const maxY = Math.max(0, (drawH - VIEW_H) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setOffset(
      clamp({
        x: e.clientX - dragRef.current.x,
        y: e.clientY - dragRef.current.y,
      }),
    );
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function changeZoom(next: number) {
    const z = Math.min(3, Math.max(1, next));
    setZoom(z);
    // Re-clamp with the new size so the image never uncovers the viewport.
    const s = baseScale * z;
    const maxX = Math.max(0, (natural.w * s - VIEW_W) / 2);
    const maxY = Math.max(0, (natural.h * s - VIEW_H) / 2);
    setOffset((o) => ({
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    }));
  }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }

    // Same geometry as the preview, scaled from viewport px to output px.
    const r = OUT_W / VIEW_W; // identical for height — same ratio
    const left = (VIEW_W - drawW) / 2 + offset.x;
    const top = (VIEW_H - drawH) / 2 + offset.y;

    ctx.fillStyle = "#fffaf2"; // cream-card, in case the source has alpha
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, left * r, top * r, drawW * r, drawH * r);

    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return;
        onDone(
          new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
      },
      "image/jpeg",
      0.92,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-70 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onCancel()}
        className="absolute inset-0 bg-forest-deep/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* header */}
        <div className="relative flex items-center gap-3 bg-linear-to-l from-forest to-forest-deep px-5 py-4 text-cream">
          <span className="grid size-9 place-items-center rounded-xl bg-cream/15">
            <ImageIcon size={17} />
          </span>
          <div className="flex-1">
            <h3 className="font-serif text-base font-bold">{t("admin.adjustImage")}</h3>
            <p className="text-[11px] text-cream/70">{t("admin.adjustImageHint")}</p>
          </div>
          <button
            onClick={() => !busy && onCancel()}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/15"
          >
            <X size={16} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* stage */}
        <div className="flex flex-col items-center gap-4 px-5 py-5">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ width: VIEW_W, height: VIEW_H }}
            className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-forest-deep/90 active:cursor-grabbing"
          >
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) =>
                  setNatural({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                style={{
                  width: drawW || undefined,
                  height: drawH || undefined,
                  left: (VIEW_W - drawW) / 2 + offset.x,
                  top: (VIEW_H - drawH) / 2 + offset.y,
                }}
                className="absolute max-w-none select-none"
              />
            )}

            {/* the frame: everything outside the photo rectangle is dimmed */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow: "0 0 0 9999px rgba(26,49,45,0.5)",
                borderRadius: 8,
                margin: 6,
              }}
            />
            <div
              className="pointer-events-none absolute inset-1.5 rounded-lg border-2 border-cream/70"
              aria-hidden
            />
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-clay">
            <Move size={12} />{t("admin.dragToMove")}</p>

          {/* zoom */}
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => changeZoom(zoom - 0.2)}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-forest/15 text-clay transition hover:border-gold hover:text-forest"
            >
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-forest/15 accent-gold"
            />
            <button
              type="button"
              onClick={() => changeZoom(zoom + 0.2)}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-forest/15 text-clay transition hover:border-gold hover:text-forest"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              title={t("admin.resetCrop")}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-forest/15 text-clay transition hover:border-gold hover:text-forest"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-forest/10 bg-cream-2/60 px-5 py-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
          >{t("pro.cancel")}</button>
          <button
            onClick={confirm}
            disabled={busy || !natural.w}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {t("admin.confirmImage")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
