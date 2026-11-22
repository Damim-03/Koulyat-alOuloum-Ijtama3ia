import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Check,
  CloudUpload as UploadCloud,
  Download,
  Eye,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Paperclip,
  Presentation,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import type { MessageAttachment } from "../api/messages.api";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { useEscapeToClose } from "../../../hooks/use-escape";
import { FILE_EXTENSIONS, MAX_FILE_MB, MAX_FILES, fileKind, fileSize, type FileKind } from "../messages-utils";
import { useAttachmentUrl, useDownloadAttachment, type AttachmentDrafts, type Draft } from "../hooks/use-attachments";
import { PdfViewer } from "./pdf-viewer";

/**
 * Files in messages: the button that picks them, the tray that shows them on
 * their way up, and how a message shows the files it carries — pictures in
 * place, documents as cards to download.
 */

const ACCEPT = FILE_EXTENSIONS.join(",");

const KIND: Record<FileKind, { icon: LucideIcon; tone: string }> = {
  pdf: { icon: FileText, tone: "bg-red-500/12 text-red-600 dark:text-red-300" },
  word: { icon: FileText, tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  excel: { icon: FileSpreadsheet, tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  slides: { icon: Presentation, tone: "bg-orange-500/12 text-orange-600 dark:text-orange-300" },
  text: { icon: FileText, tone: "bg-forest/10 text-forest" },
  image: { icon: FileImage, tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  file: { icon: FileIcon, tone: "bg-forest/10 text-forest" },
};

/** The extension in capitals, under the icon: PDF, DOCX… */
const extLabel = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "");

function FileGlyph({ kind, name, size = 40 }: { kind: FileKind; name: string; size?: number }) {
  const K = KIND[kind];
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-xl ${K.tone}`} style={{ width: size, height: size }} aria-hidden>
      <K.icon size={Math.round(size * 0.48)} />
      <span className="absolute -bottom-1 rounded bg-cream-card px-1 text-[8.5px] leading-3.5 font-extrabold tracking-wide shadow-sm">
        {extLabel(name)}
      </span>
    </span>
  );
}

/** The paperclip: opens the window where files are dropped or picked. */
export function AttachButton({ drafts, disabled, className = "" }: { drafts: AttachmentDrafts; disabled?: boolean; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={t("msg.files.attach")}
        title={t("msg.files.attach")}
        aria-haspopup="dialog"
        data-testid="attach-button"
        className={`grid shrink-0 place-items-center rounded-full text-clay transition hover:bg-gold/15 hover:text-gold disabled:opacity-40 ${className}`}
      >
        <Paperclip size={19} className="-rotate-45" />
      </button>
      {open && <AttachDialog drafts={drafts} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The kinds accepted, shown on the drop zone: what to bring is said before it is refused. */
const ACCEPTED_KINDS: { kind: FileKind; label: string }[] = [
  { kind: "pdf", label: "PDF" },
  { kind: "word", label: "Word" },
  { kind: "excel", label: "Excel" },
  { kind: "slides", label: "PowerPoint" },
  { kind: "image", label: "PNG · JPG · WebP" },
  { kind: "text", label: "TXT" },
];

/**
 * Files are brought here: dropped on the zone, picked from the device, or
 * pasted. Each starts uploading at once and shows its progress below.
 *
 * «Done» keeps them: they wait in the message being written. Closing the
 * window any other way — ✕, Escape, a click outside, «Cancel» — takes back
 * what was added this time, and the server lets go of it; what was already
 * in the message before the window opened stays.
 */
function AttachDialog({ drafts, onClose }: { drafts: AttachmentDrafts; onClose: () => void }) {
  const { t } = useTranslation();
  const [before] = useState(() => new Set(drafts.drafts.map((d) => d.key)));
  const { remove } = drafts;
  const cancel = () => {
    for (const d of drafts.drafts) if (!before.has(d.key)) remove(d.key);
    onClose();
  };
  useBodyScrollLock(true);
  useEscapeToClose(cancel);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // The kinds of the files being dragged over the window, when the browser
  // tells (it gives their types, not yet their names).
  const [incoming, setIncoming] = useState<ReadonlySet<FileKind>>(() => new Set());
  const { add } = drafts;
  const count = drafts.drafts.length;
  const full = count >= MAX_FILES;
  // How many of each kind are in the message: their chips are marked.
  const chosen = new Map<FileKind, number>();
  for (const d of drafts.drafts) if (d.status !== "failed") chosen.set(d.kind, (chosen.get(d.kind) ?? 0) + 1);
  const leave = () => {
    setOver(false);
    setIncoming(new Set());
  };

  // A picture copied elsewhere and pasted while the window is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length) return;
      e.preventDefault();
      add(e.clipboardData.files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [add]);

  const carriesFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const kindsOf = (e: React.DragEvent) =>
    new Set(
      Array.from(e.dataTransfer.items ?? [])
        .map((i) => fileKind(i.type))
        .filter((k) => k !== "file"),
    );

  // The whole window takes the drop, not only the zone — and keeps it: React
  // sends a portal's events up to the chat or the compose window behind,
  // which take dropped files too, and would attach them a second time.
  return createPortal(
    <div
      className="fixed inset-0 z-110 flex items-end justify-center sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attach-title"
      data-testid="attach-dialog"
      onDragEnter={(e) => {
        e.stopPropagation();
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setOver(true);
        setIncoming(kindsOf(e));
      }}
      onDragOver={(e) => {
        e.stopPropagation();
        if (!carriesFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = full ? "none" : "copy";
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        e.preventDefault();
        leave();
        if (e.dataTransfer.files.length) add(e.dataTransfer.files);
      }}
    >
      <div className="absolute inset-0 bg-forest-deep/60 backdrop-blur-sm" onMouseDown={cancel} />
      <div className="animate-scale-in relative z-10 flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-cream-card shadow-2xl sm:rounded-3xl">
        {/* header */}
        <div className="forest-glow relative shrink-0 overflow-hidden px-5 py-4 text-cream">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
              <Paperclip size={20} className="-rotate-45" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="attach-title" className="font-serif text-lg font-bold text-cream">
                {t("msg.files.attach")}
              </h2>
              <p className="text-[12px] text-cream/70 tabular-nums">{t("msg.files.attachTitle", { count, max: MAX_FILES })}</p>
            </div>
            <button
              type="button"
              onClick={cancel}
              aria-label={t("admin.cancel")}
              data-testid="attach-cancel-x"
              className="grid size-9 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/15"
            >
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* the zone */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div
            data-testid="attach-dropzone"
            data-over={over || undefined}
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed px-5 py-9 text-center transition duration-200 ${
              over ? "scale-[1.015] border-gold bg-gold/10 shadow-[0_0_0_6px_rgba(193,150,90,0.12)]" : "border-forest/20 bg-cream/60"
            }`}
          >
            <span
              className={`mx-auto mb-4 grid size-16 place-items-center rounded-2xl transition duration-300 ${
                over ? "-translate-y-1 bg-gold text-forest-deep" : "bg-gold/15 text-gold"
              }`}
            >
              <UploadCloud size={30} />
            </span>
            <p className="text-[16px] font-bold text-forest">{full ? t("msg.files.full", { max: MAX_FILES }) : over ? t("msg.files.release") : t("msg.files.dragHere")}</p>
            {!full && (
              <>
                <p className="my-3 flex items-center justify-center gap-3 text-[11.5px] text-clay">
                  <span className="h-px w-10 bg-forest/15" />
                  {t("msg.files.or")}
                  <span className="h-px w-10 bg-forest/15" />
                </p>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  autoFocus
                  data-testid="attach-browse"
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-md transition hover:bg-gold-soft active:scale-95"
                >
                  <FolderOpen size={17} />
                  {t("msg.files.browse")}
                </button>
              </>
            )}
            <ul className="mt-5 flex flex-wrap justify-center gap-1.5" aria-label={t("msg.files.accepted")}>
              {ACCEPTED_KINDS.map((k) => {
                const K = KIND[k.kind];
                const n = chosen.get(k.kind) ?? 0;
                const coming = incoming.has(k.kind);
                return (
                  <li
                    key={k.kind}
                    data-testid="kind-chip"
                    data-kind={k.kind}
                    data-selected={n > 0 || undefined}
                    aria-current={n > 0 || undefined}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition duration-200 ${K.tone} ${
                      n > 0
                        ? "scale-110 shadow-md ring-2 ring-current"
                        : coming
                          ? "animate-pulse ring-2 ring-gold"
                          : chosen.size > 0
                            ? "opacity-50"
                            : ""
                    }`}
                  >
                    {n > 0 ? <Check size={12} strokeWidth={3} /> : <K.icon size={12} />}
                    {k.label}
                    {n > 1 && <span className="rounded-full bg-current/15 px-1 tabular-nums">×{n}</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-clay">{t("msg.files.limits", { max: MAX_FILES, mb: MAX_FILE_MB })}</p>
          </div>

          {count > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11.5px] font-bold tracking-wide text-gold">{t("msg.files.chosen")}</p>
              <DraftTray drafts={drafts.drafts} onRemove={drafts.remove} onRetry={drafts.retry} />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex shrink-0 items-center gap-3 border-t border-forest/10 bg-cream-2 px-5 py-3">
          <p className="min-w-0 flex-1 text-[12px] text-clay" data-testid="attach-status">
            {drafts.uploading
              ? t("msg.files.stillUploading")
              : drafts.failed
                ? t("msg.files.fixFailed")
                : count > 0
                  ? t("msg.files.readyCount", { count: drafts.ready })
                  : t("msg.files.pasteHint")}
          </p>
          <button
            type="button"
            onClick={cancel}
            data-testid="attach-cancel"
            className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="attach-done"
            // The gold edge keeps it seen on the dark theme, where its green meets the footer's.
            className="inline-flex items-center gap-2 rounded-xl border border-gold/50 bg-forest px-5 py-2.5 text-sm font-bold text-cream shadow-md transition hover:bg-forest-deep active:scale-95"
          >
            <Check size={16} />
            {t("msg.files.done")}
          </button>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        data-testid="attach-input"
        onChange={(e) => {
          if (e.target.files?.length) add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>,
    document.body,
  );
}

/** The files chosen for the message being written, each with its progress. */
export function DraftTray({ drafts, onRemove, onRetry }: { drafts: Draft[]; onRemove: (key: string) => void; onRetry: (key: string) => void }) {
  const { t } = useTranslation();
  if (drafts.length === 0) return null;
  return (
    // A row that scrolls sideways on a phone, rather than a column that pushes the chat away.
    <ul className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" data-testid="draft-tray">
      {drafts.map((d) => (
        <li
          key={d.key}
          data-testid="draft"
          data-status={d.status}
          className={`relative flex w-56 shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl border bg-cream py-2 ps-2 pe-9 shadow-sm sm:w-60 ${
            d.status === "failed" ? "border-red-400/60" : "border-forest/12"
          }`}
        >
          {d.preview ? (
            <img src={d.preview} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
          ) : (
            <FileGlyph kind={d.kind} name={d.name} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-forest" dir="auto" title={d.name}>
              {d.name}
            </span>
            {d.status === "failed" ? (
              // The reason in full: it is what tells the writer what to fix.
              <span className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-red-600 dark:text-red-400" data-testid="draft-error">
                <AlertCircle size={11} className="mt-0.5 shrink-0" />
                <span className="line-clamp-2">{d.error}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-clay">
                <span className={`shrink-0 rounded-md px-1.5 py-px text-[10px] font-bold ${KIND[d.kind].tone}`} data-testid="draft-kind">
                  {t(`msg.files.kind.${d.kind}`)}
                </span>
                {d.status === "uploading" ? (
                  <>
                    <Loader2 size={11} className="animate-spin text-gold" />
                    <span className="truncate tabular-nums">{t("msg.files.uploading", { pct: Math.round(d.progress * 100) })}</span>
                  </>
                ) : (
                  <span className="tabular-nums">{fileSize(d.size, t)}</span>
                )}
              </span>
            )}
          </span>
          <span className="absolute end-1.5 top-1.5 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onRemove(d.key)}
              aria-label={t("msg.files.remove", { name: d.name })}
              data-testid="draft-remove"
              className="grid size-6 place-items-center rounded-full text-clay transition hover:bg-red-500/10 hover:text-red-600"
            >
              <X size={13} />
            </button>
            {d.status === "failed" && (
              <button
                type="button"
                onClick={() => onRetry(d.key)}
                aria-label={t("msg.retry")}
                title={t("msg.retry")}
                data-testid="draft-retry"
                className="grid size-6 place-items-center rounded-full text-forest transition hover:bg-gold/20"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </span>
          {d.status === "uploading" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-forest/10">
              <span className="block h-full bg-gold transition-[width] duration-200" style={{ width: `${Math.max(4, d.progress * 100)}%` }} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The files a message carries. `mine`: inside my own (gold) bubble, whose
 * ink is fixed in both themes.
 */
export function AttachmentList({ items, mine = false }: { items: MessageAttachment[]; mine?: boolean }) {
  const [viewing, setViewing] = useState<MessageAttachment | null>(null);
  const images = items.filter((a) => fileKind(a.mimeType) === "image");
  const files = items.filter((a) => fileKind(a.mimeType) !== "image");
  return (
    <div className="flex flex-col gap-1.5" data-testid="attachments">
      {images.length > 0 && (
        // A fixed width: a bubble sizes to its content, and two pictures with no
        // width of their own would squeeze into each other on a phone.
        <div className={`grid w-60 max-w-full gap-1 sm:w-72 ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((a) => (
            <Thumb key={a.id} a={a} mine={mine} several={images.length > 1} onOpen={() => setViewing(a)} />
          ))}
        </div>
      )}
      {files.map((a) => (
        <FileCard key={a.id} a={a} mine={mine} />
      ))}
      {viewing && <ImageViewer a={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Thumb({ a, mine, several, onOpen }: { a: MessageAttachment; mine: boolean; several: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const url = useAttachmentUrl(a.id);
  if (url.isError) return <FileCard a={a} mine={mine} />;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("msg.files.view", { name: a.fileName })}
      data-testid="attachment-image"
      className={`group relative block w-full overflow-hidden rounded-xl bg-forest/10 ${several ? "aspect-square" : "min-h-24"}`}
    >
      {url.data ? (
        <img
          src={url.data}
          alt={a.fileName}
          className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${several ? "h-full" : "max-h-72"}`}
        />
      ) : (
        <span className={`grid place-items-center ${several ? "h-full" : "h-32"}`}>
          <Loader2 size={18} className="animate-spin text-clay" />
        </span>
      )}
    </button>
  );
}

function FileCard({ a, mine }: { a: MessageAttachment; mine: boolean }) {
  const { t } = useTranslation();
  const { download, busy } = useDownloadAttachment();
  const [reading, setReading] = useState(false);
  const kind = fileKind(a.mimeType);
  // A PDF is read here, in a window of its own; the other kinds are downloaded.
  const readable = kind === "pdf";
  const roundBtn = `grid size-9 shrink-0 place-items-center rounded-full transition disabled:opacity-60 ${
    mine ? "bg-[rgba(22,36,31,0.12)] hover:bg-[rgba(22,36,31,0.2)]" : "bg-gold/15 text-gold hover:bg-gold/25"
  }`;
  const info = (
    <>
      <FileGlyph kind={kind} name={a.fileName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold" dir="auto" title={a.fileName}>
          {a.fileName}
        </span>
        <span className={`text-[11px] tabular-nums ${mine ? "text-[rgba(22,36,31,0.62)]" : "text-clay"}`}>
          {fileSize(a.size, t)} · {t(`msg.files.kind.${kind}`)}
        </span>
      </span>
    </>
  );
  return (
    <div
      data-testid="attachment-file"
      className={`flex w-full min-w-56 items-center gap-2 rounded-xl p-2.5 ${
        mine ? "bg-[rgba(22,36,31,0.08)]" : "border border-forest/10 bg-cream-2/70"
      }`}
    >
      {readable ? (
        <button
          type="button"
          onClick={() => setReading(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start transition hover:opacity-80"
          data-testid="attachment-open-name"
        >
          {info}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{info}</span>
      )}
      {readable && (
        <button
          type="button"
          onClick={() => setReading(true)}
          aria-label={t("msg.pdf.open", { name: a.fileName })}
          title={t("msg.pdf.openShort")}
          data-testid="attachment-open"
          className={roundBtn}
        >
          <Eye size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => download(a)}
        disabled={busy === a.id}
        aria-label={t("msg.files.download", { name: a.fileName })}
        data-testid="attachment-download"
        className={roundBtn}
      >
        {busy === a.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
      {reading && <PdfViewer a={a} onClose={() => setReading(false)} />}
    </div>
  );
}

/** A picture full size, over the page; Escape or a click outside closes it. */
function ImageViewer({ a, onClose }: { a: MessageAttachment; onClose: () => void }) {
  const { t } = useTranslation();
  const url = useAttachmentUrl(a.id);
  const { download, busy } = useDownloadAttachment();
  useBodyScrollLock(true);
  useEscapeToClose(onClose);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={a.fileName}
      data-testid="image-viewer"
      className="fixed inset-0 z-120 flex flex-col bg-black/85 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" dir="auto">
          {a.fileName}
          <span className="ms-2 text-[11.5px] font-normal text-white/60 tabular-nums">{fileSize(a.size, t)}</span>
        </span>
        <button
          type="button"
          onClick={() => download(a)}
          disabled={busy === a.id}
          aria-label={t("msg.files.download", { name: a.fileName })}
          className="grid size-10 place-items-center rounded-full text-white/85 transition hover:bg-white/15"
        >
          {busy === a.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        </button>
        <button type="button" onClick={onClose} aria-label={t("msg.close")} className="grid size-10 place-items-center rounded-full text-white/85 transition hover:bg-white/15">
          <X size={20} />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {url.data ? (
          <img src={url.data} alt={a.fileName} className="animate-scale-in max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        ) : (
          <Loader2 size={28} className="animate-spin text-white/70" />
        )}
      </div>
    </div>,
    document.body,
  );
}
