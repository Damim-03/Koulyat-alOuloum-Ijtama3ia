import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Download, FileText, Loader2, Lock, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { useEscapeToClose } from "../../../hooks/use-escape";
import { isPasswordError, openPdf, type PDFDocumentProxy } from "../../../lib/pdf";
import { messagesApi, type MessageAttachment } from "../api/messages.api";
import { useDownloadAttachment } from "../hooks/use-attachments";
import { fileSize } from "../messages-utils";

/**
 * A PDF sent in a message, read in place: its pages one under the other in a
 * window of its own that fills the screen, with the page you are on, zoom,
 * download and close.
 *
 * Drawn by pdf.js on canvases, so it reads the same on a phone (whose browser
 * shows no PDF inside a page) as on a computer. A page is drawn only while it
 * is near the screen, and let go once far from it: a hundred-page thesis does
 * not hold a hundred full-size pictures in memory.
 */

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
/** Fitting the width of a wide screen would make a page huge: no more than this. */
const MAX_FIT = 1.6;
const GAP = 16;

type Size = { w: number; h: number };
type State =
  | { phase: "loading" }
  | { phase: "ready"; doc: PDFDocumentProxy; sizes: Size[] }
  | { phase: "error"; locked: boolean };

/** The document and the size of each of its pages, opened once per file. */
function usePdf(id: string) {
  const [state, setState] = useState<State>({ phase: "loading" });
  useEffect(() => {
    let gone = false;
    let close: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const blob = await messagesApi.attachmentBlob(id);
        const opened = await openPdf(await blob.arrayBuffer());
        close = opened.close;
        if (gone) return void close();
        const doc = opened.doc;
        const pages = await Promise.all(
          Array.from({ length: doc.numPages }, (_, i) =>
            doc.getPage(i + 1).then((p) => {
              const v = p.getViewport({ scale: 1 });
              return { w: v.width, h: v.height };
            }),
          ),
        );
        if (!gone) setState({ phase: "ready", doc, sizes: pages });
      } catch (e) {
        if (!gone) setState({ phase: "error", locked: isPasswordError(e) });
      }
    })();
    return () => {
      gone = true;
      void close?.();
    };
  }, [id]);
  return state;
}

export function PdfViewer({ a, onClose }: { a: MessageAttachment; onClose: () => void }) {
  const { t } = useTranslation();
  useBodyScrollLock(true);
  useEscapeToClose(onClose);
  const { download, busy } = useDownloadAttachment();
  const state = usePdf(a.id);

  // How wide the reading area is — the fit-to-width zoom follows it.
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sizes = state.phase === "ready" ? state.sizes : [];
  const fit = sizes[0] && width ? Math.min(MAX_FIT, Math.max(0.3, (width - 2 * GAP) / sizes[0].w)) : 1;
  /** null: fit the width. */
  const [zoom, setZoom] = useState<number | null>(null);
  const scale = zoom ?? fit;
  const zoomIn = () => setZoom(ZOOMS.find((z) => z > scale + 0.01) ?? ZOOMS.at(-1)!);
  const zoomOut = () => setZoom([...ZOOMS].reverse().find((z) => z < scale - 0.01) ?? ZOOMS[0]!);

  // + and − zoom, as in any reader.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The page you are on: the one across the upper third of the screen.
  const pages = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(1);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const line = el.scrollTop + el.clientHeight / 3;
    let at = 1;
    pages.current.forEach((p, i) => {
      if (p && p.offsetTop <= line) at = i + 1;
    });
    setCurrent(at);
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={a.fileName}
      data-testid="pdf-viewer"
      className="fixed inset-0 z-130 flex bg-black/75 p-0 backdrop-blur-sm sm:p-4 lg:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-scale-in mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-cream-card shadow-2xl sm:rounded-3xl">
        {/* header */}
        <header className="flex items-center gap-3 border-b border-forest/10 px-3 py-2.5 sm:px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-500/12 text-red-600 dark:text-red-300" aria-hidden>
            <FileText size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-forest" dir="auto" title={a.fileName}>
              {a.fileName}
            </p>
            <p className="text-[11.5px] text-clay tabular-nums">
              {fileSize(a.size, t)}
              {state.phase === "ready" && ` · ${t("msg.pdf.pages", { count: state.sizes.length })}`}
            </p>
          </div>

          {state.phase === "ready" && (
            <div className="flex items-center gap-1">
              <span
                className="me-1 hidden rounded-full bg-forest/8 px-3 py-1 text-[12px] font-semibold text-forest tabular-nums sm:inline"
                data-testid="pdf-page"
              >
                {t("msg.pdf.pageOf", { page: current, total: state.sizes.length })}
              </span>
              <ToolBtn onClick={zoomOut} label={t("msg.pdf.zoomOut")} disabled={scale <= ZOOMS[0]!}>
                <ZoomOut size={17} />
              </ToolBtn>
              <button
                type="button"
                onClick={() => setZoom(null)}
                title={t("msg.pdf.fit")}
                data-testid="pdf-zoom"
                className="hidden min-w-14 rounded-lg px-1.5 py-1 text-[12px] font-bold text-forest tabular-nums transition hover:bg-forest/8 sm:block"
              >
                {Math.round(scale * 100)}%
              </button>
              <ToolBtn onClick={zoomIn} label={t("msg.pdf.zoomIn")} disabled={scale >= ZOOMS.at(-1)!}>
                <ZoomIn size={17} />
              </ToolBtn>
              <ToolBtn onClick={() => setZoom(null)} label={t("msg.pdf.fit")} className="hidden md:grid">
                <Maximize2 size={16} />
              </ToolBtn>
            </div>
          )}
          <span className="mx-1 hidden h-6 w-px bg-forest/12 sm:block" aria-hidden />
          <ToolBtn onClick={() => download(a)} label={t("msg.files.download", { name: a.fileName })} disabled={busy === a.id} testId="pdf-download">
            {busy === a.id ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          </ToolBtn>
          <ToolBtn onClick={onClose} label={t("msg.close")} testId="pdf-close">
            <X size={19} />
          </ToolBtn>
        </header>

        {/* pages */}
        <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-forest-deep/90" data-testid="pdf-scroll">
          {state.phase === "loading" && (
            <div className="grid h-full place-items-center text-center text-cream/80">
              <div>
                <Loader2 size={30} className="mx-auto mb-3 animate-spin text-gold-soft" />
                <p className="text-[13px]">{t("msg.pdf.loading")}</p>
              </div>
            </div>
          )}
          {state.phase === "error" && (
            <div className="grid h-full place-items-center p-6 text-center" data-testid="pdf-error">
              <div className="max-w-sm rounded-3xl bg-cream-card px-6 py-7 shadow-xl">
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  {state.locked ? <Lock size={22} /> : <AlertTriangle size={22} />}
                </span>
                <p className="text-[14px] font-bold text-forest">{state.locked ? t("msg.pdf.locked") : t("msg.pdf.failed")}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-clay">{t("msg.pdf.downloadInstead")}</p>
                <button
                  type="button"
                  onClick={() => download(a)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft"
                >
                  <Download size={16} />
                  {t("msg.pdf.download")}
                </button>
              </div>
            </div>
          )}
          {state.phase === "ready" && (
            <div className="flex w-max min-w-full flex-col items-center" style={{ gap: GAP, padding: GAP }}>
              {state.sizes.map((s, i) => (
                <PdfPage
                  key={i}
                  ref={(el) => {
                    pages.current[i] = el;
                  }}
                  doc={state.doc}
                  index={i}
                  size={s}
                  scale={scale}
                  root={scroller}
                  label={t("msg.pdf.pageOf", { page: i + 1, total: state.sizes.length })}
                />
              ))}
            </div>
          )}
          {state.phase === "ready" && (
            <span
              dir="ltr"
              className="pointer-events-none sticky bottom-3 mx-auto block w-fit rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold text-white tabular-nums sm:hidden"
            >
              {current} / {state.sizes.length}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One page: its place is kept at its size, its picture drawn only near the screen. */
function PdfPage({
  ref,
  doc,
  index,
  size,
  scale,
  root,
  label,
}: {
  ref: (el: HTMLDivElement | null) => void;
  doc: PDFDocumentProxy;
  index: number;
  size: Size;
  scale: number;
  root: React.RefObject<HTMLDivElement | null>;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(index < 2);
  // The zoom the canvas was last drawn at: drawn now only if it is this one.
  const [drawnAt, setDrawnAt] = useState<number | null>(null);
  const drawn = near && drawnAt === scale;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), {
      root: root.current,
      rootMargin: "1200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    if (!near) {
      // Far from the screen: give its memory back.
      c.width = 0;
      c.height = 0;
      return;
    }
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    void doc
      .getPage(index + 1)
      .then((page) => {
        if (cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * ratio });
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        task = page.render({ canvas: c, viewport });
        return task.promise;
      })
      .then(() => !cancelled && setDrawnAt(scale))
      .catch(() => undefined); // cancelled by a newer zoom, or closed
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, scale, doc, index]);

  return (
    <div
      ref={(el) => {
        box.current = el;
        ref(el);
      }}
      role="img"
      aria-label={label}
      // A canvas draws text in its own direction: inheriting the page's
      // right-to-left, pdf.js would place every run of text from the wrong
      // end, and Arabic and Latin alike would come apart.
      dir="ltr"
      data-testid="pdf-page-box"
      className="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.55)]"
      style={{ width: Math.floor(size.w * scale), height: Math.floor(size.h * scale) }}
    >
      <canvas ref={canvas} className="block size-full" />
      {!drawn && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 size={20} className="animate-spin text-forest/30" />
        </span>
      )}
    </div>
  );
}

function ToolBtn({
  onClick,
  label,
  disabled,
  className = "grid",
  testId,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`${className} size-9 shrink-0 place-items-center rounded-xl text-forest transition hover:bg-forest/8 disabled:opacity-35`}
    >
      {children}
    </button>
  );
}
