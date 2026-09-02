import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useUploadImage } from "../../hooks/admin-hook";

/** Mirrors the server's own limits (upload.middleware.ts). */
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * Optional cover image for a faculty / department / domain / filiere /
 * specialization.
 *
 * Always skippable: the field opens empty, says so, and a saved cover can be
 * removed again. The file is uploaded as soon as it is picked and the form
 * only ever carries the resulting URL, so submitting stays a plain JSON call.
 */
export function CoverImageField({
  value,
  onChange,
  label,
  hint,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(file?: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("admin.coverTooLarge"));
      return;
    }
    upload.mutate(file, { onSuccess: (url) => onChange(url) });
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        <ImagePlus size={14} className="text-clay" />
        {label ?? t("admin.coverImage")}
        <span className="rounded-full bg-forest/8 px-1.5 py-px text-[10px] font-normal text-clay">
          {t("admin.optional")}
        </span>
      </label>

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-forest/15">
          <img
            src={value}
            alt=""
            className="h-32 w-full object-cover"
            onError={() => setError(t("admin.coverBroken"))}
          />
          {/* A dark wash so the actions stay readable over any image. */}
          <div className="absolute inset-0 bg-linear-to-t from-forest-deep/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-cream/90 px-2.5 py-1 text-[11px] font-semibold text-forest transition hover:bg-cream"
            >
              {t("admin.replaceCover")}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange("");
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-500"
            >
              <Trash2 size={12} />
              {t("admin.removeCover")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition ${
            dragging
              ? "border-gold bg-gold/10"
              : "border-forest/25 bg-cream-2 hover:border-gold hover:bg-gold/5"
          }`}
        >
          {upload.isPending ? (
            <Loader2 size={22} className="animate-spin text-gold" />
          ) : (
            <UploadCloud size={22} className="text-clay" />
          )}
          <span className="text-xs font-semibold text-forest">
            {upload.isPending ? t("admin.uploading") : t("admin.coverPrompt")}
          </span>
          <span className="text-[10px] text-clay">
            {hint ?? t("admin.coverHint")}
          </span>
        </button>
      )}

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          // Let the same file be picked again after a removal.
          e.target.value = "";
        }}
      />
    </div>
  );
}
