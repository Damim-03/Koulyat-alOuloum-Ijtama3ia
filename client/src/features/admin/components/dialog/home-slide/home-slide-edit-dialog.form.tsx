import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Pencil, RefreshCw, Save, Type } from "lucide-react";
import type {
  HomeSlide,
  SlidePlacement,
} from "../../../../../types/site.types";
import { useUploadImage } from "../../../hooks/admin-hook";
import { useUpdateHomeSlide } from "../../../hooks/home-slides-hook";
import { assetUrl } from "../../../../../lib/asset-url";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import {
  CAPTION_MAX,
  COPY_NS,
  isBackdrop,
  prepareSlideImage,
  SLIDE_ACCEPT,
} from "./slide-kit";
import { SlidePreviewOverlay, VisibilityToggle } from "./slide-parts";

interface Props {
  slide: HomeSlide | null;
  onClose: () => void;
  placement?: SlidePlacement;
}

/**
 * تعديل صورةٍ واحدة: تبديلُ الصورة نفسها، وسطرها، وظهورها.
 *
 * والمعاينة هنا ليست الصورة عاريةً بل كما ستُرى: تحت التعتيم الأخضر وخلف
 * العنوان. صورةٌ مشرقة تبدو جميلة وحدها قد يغيب فيها العنوان — والأفضل أن
 * يُرى ذلك هنا لا على الصفحة الرئيسية.
 */
export function HomeSlideEditDialog({
  slide,
  onClose,
  placement = "home",
}: Props) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const update = useUpdateHomeSlide(placement);
  const backdrop = isBackdrop(placement);
  const ns = COPY_NS[placement];
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = preparing || upload.isPending;

  useEffect(() => {
    if (!slide) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setImageUrl(slide.imageUrl);
    setCaption(slide.caption ?? "");
    setIsActive(slide.isActive);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slide]);

  async function pick(file?: File | null) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const ready = await prepareSlideImage(file);
      upload.mutate(ready, { onSuccess: (url) => setImageUrl(url) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slide || !imageUrl || busy || update.isPending) return;
    try {
      await update.mutateAsync({
        id: slide.id,
        data: { imageUrl, caption: caption.trim() || null, isActive },
      });
      toast.success(t("admin.slides.toastSaved"));
      onClose();
    } catch {
      // الخطأ يظهر عبر toast داخل الـhook
    }
  }

  return (
    <FormDialog
      open={!!slide}
      onClose={onClose}
      size="lg"
      title={t("admin.slides.editTitle")}
      subtitle={t(
        backdrop ? `${ns}.dialogSubtitle` : "admin.slides.dialogSubtitle",
      )}
      icon={Pencil}
      footer={
        <>
          <button
            type="submit"
            form="home-slide-edit-form"
            disabled={!imageUrl || busy || update.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {update.isPending
              ? t("admin.saving")
              : t("admin.slides.saveChanges")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <form
        id="home-slide-edit-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* ── الصورة ── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-forest">
              {t("admin.slides.image")}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest/15 px-2.5 py-1.5 text-[11.5px] font-semibold text-forest transition hover:border-gold hover:text-gold disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {busy ? t("admin.uploading") : t("admin.slides.replace")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files?.[0]);
            }}
            title={t("admin.slides.replace")}
            className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-forest/15 bg-forest-deep"
          >
            {imageUrl && (
              <img
                src={assetUrl(imageUrl)}
                alt=""
                className="absolute inset-0 size-full object-cover"
                onError={() => setError(t("admin.coverBroken"))}
              />
            )}
            {placement === "home" && <SlidePreviewOverlay />}
            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 size={28} className="animate-spin text-white" />
              </span>
            )}
          </button>
          <p className="mt-1.5 text-[11px] text-clay">
            {t("admin.slides.replaceHint")}
          </p>

          {error && <p className="mt-1.5 text-[11px] text-brick">{error}</p>}

          <input
            ref={inputRef}
            type="file"
            accept={SLIDE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {/* ── السطر — ولا سطر للخلفيّات: لا يُقرأ فوقها ── */}
        {!backdrop && (
          <Field
            label={t("admin.slides.caption")}
            icon={Type}
            note={t("admin.optional")}
            hint={t("admin.slides.captionHint")}
          >
            <div className="relative">
              <input
                value={caption}
                maxLength={CAPTION_MAX}
                onChange={(e) => setCaption(e.target.value)}
                className={`${inputClass} pe-14`}
                placeholder={t("admin.slides.captionPlaceholder")}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[10px] tabular-nums text-clay">
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
          </Field>
        )}

        <VisibilityToggle
          on={isActive}
          onChange={setIsActive}
          onHint={backdrop ? t(`${ns}.visibleHint`) : undefined}
        />
      </form>
    </FormDialog>
  );
}
