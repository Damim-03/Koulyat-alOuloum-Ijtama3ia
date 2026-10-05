import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Images,
  Loader2,
  Plus,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { adminApi } from "../../../api/admin.api";
import type { SlidePlacement } from "../../../../../types/site.types";
import { useCreateHomeSlides } from "../../../hooks/home-slides-hook";
import { serverMessage } from "../../../../../lib/api/error";
import { FormDialog } from "../../form/form-dialog";
import {
  CAPTION_MAX,
  COPY_NS,
  filesOf,
  isBackdrop,
  prepareSlideImage,
  SLIDE_ACCEPT,
} from "./slide-kit";
import { SlidePreviewOverlay, VisibilityToggle } from "./slide-parts";

type Status = "waiting" | "uploading" | "done" | "error";

interface Item {
  key: string;
  name: string;
  /** رابطٌ محلّيّ للملفّ الأصليّ — يُعرض فوراً قبل أن يكتمل الرفع. */
  preview: string;
  status: Status;
  url?: string;
  error?: string;
  /** فشلُ شبكةٍ أو خادمٍ يُعاد؛ وملفٌّ غير صالح لا تُصلحه الإعادة. */
  retryable?: boolean;
  caption: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** ما بقي من السعة: الحدّ ناقصاً ما هو موجود. */
  room: number;
  /** خلف عنوان الرئيسية (فتُعاين تحته) أو معرض «عن المنصة» (فتُعاين كما هي). */
  placement?: SlidePlacement;
}

/**
 * إضافة صورٍ للصفحة الرئيسية — واحدةً أو عدّةً دفعةً واحدة.
 *
 * تختار الإدارة ما تشاء من الملفّات (أو تسحبها معاً)، فتظهر كلّها فوراً
 * ويبدأ رفعها واحدةً تلو الأخرى في الخلفية، ولكلٍّ سطرها. وما فشل يُعاد أو
 * يُزال وحده دون أن يمسّ الباقي. والحفظ طلبٌ واحد: تُضاف كلّها أو لا شيء.
 *
 * والرفع متتابعٌ لا متوازٍ عمداً: كلّ صورةٍ تُفكّ في الذاكرة لتُصغَّر، وصورةُ
 * هاتفٍ مفكوكةً قرابة خمسين ميغابايتاً — واثنتا عشرة معاً تُثقل المتصفّح.
 */
export function HomeSlidesAddDialog({
  open,
  onClose,
  room,
  placement = "home",
}: Props) {
  const { t } = useTranslation();
  const create = useCreateHomeSlides(placement);
  // الخلفيّات بلا سطر: لا يُقرأ فوقها شيءٌ منها.
  const withCaption = !isBackdrop(placement);
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // طابور الرفع خارج الحالة: يُقرأ ويُكتب من حلقةٍ غير متزامنة.
  const files = useRef(new Map<string, File>());
  const queue = useRef<string[]>([]);
  const pumping = useRef(false);
  /** يتقدّم عند كلّ تفريغ، فتُهمَل نتائجُ رفعٍ بدأ قبله. */
  const generation = useRef(0);
  const nextKey = useRef(0);

  const done = items.filter((i) => i.status === "done");
  const inFlight = items.some(
    (i) => i.status === "waiting" || i.status === "uploading",
  );
  const failed = items.filter((i) => i.status === "error").length;
  const free = room - items.length;

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    const gen = generation.current;
    try {
      while (queue.current.length && gen === generation.current) {
        const key = queue.current.shift()!;
        const file = files.current.get(key);
        if (!file) continue; // أُزيلت وهي تنتظر
        patch(key, { status: "uploading", error: undefined });
        try {
          const url = await adminApi.uploadImage(await prepareSlideImage(file));
          if (gen === generation.current) patch(key, { status: "done", url });
        } catch (e) {
          if (gen === generation.current)
            patch(key, {
              status: "error",
              retryable: axios.isAxiosError(e),
              error: axios.isAxiosError(e)
                ? serverMessage(e, t("toast.imageUploadFailed"))
                : (e as Error).message,
            });
        }
      }
    } finally {
      pumping.current = false;
      // دفعةٌ أُضيفت بعد تفريغٍ والحلقة القديمة تنتظر رفعها الأخير.
      if (queue.current.length) void pump();
    }
  }

  function add(list: File[]) {
    setNotice(null);
    if (list.length === 0) return;
    if (free <= 0) {
      setNotice(t("admin.slides.noRoom"));
      return;
    }
    const taken = list.slice(0, free);
    if (list.length > free)
      setNotice(t("admin.slides.tooMany", { count: free }));

    const fresh: Item[] = taken.map((file) => {
      const key = `s${nextKey.current++}`;
      files.current.set(key, file);
      queue.current.push(key);
      return {
        key,
        name: file.name,
        preview: URL.createObjectURL(file),
        status: "waiting",
        caption: "",
      };
    });
    setItems((prev) => [...prev, ...fresh]);
    void pump();
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    files.current.delete(key);
    queue.current = queue.current.filter((k) => k !== key);
    setItems((list) => list.filter((i) => i.key !== key));
    setNotice(null);
  }

  function retry(key: string) {
    patch(key, { status: "waiting", error: undefined });
    queue.current.push(key);
    void pump();
  }

  /** يفرّغ النافذة: الملفّات والطابور والمعاينات. */
  function reset() {
    generation.current++;
    for (const i of items) URL.revokeObjectURL(i.preview);
    files.current.clear();
    queue.current = [];
    setItems([]);
    setIsActive(true);
    setNotice(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (done.length === 0 || inFlight || create.isPending) return;
    try {
      await create.mutateAsync({
        slides: done.map((i) => ({
          imageUrl: i.url!,
          caption: i.caption.trim() || null,
        })),
        isActive,
      });
      close();
    } catch {
      // الخطأ يظهر عبر toast داخل الـhook
    }
  }

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      add(filesOf(e.dataTransfer.files));
    },
  };

  return (
    <FormDialog
      open={open}
      onClose={close}
      size="xl"
      title={t("admin.slides.addTitle")}
      subtitle={t("admin.slides.addSubtitle", { count: room })}
      icon={ImagePlus}
      footer={
        <>
          <button
            type="submit"
            form="home-slides-add-form"
            disabled={done.length === 0 || inFlight || create.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {create.isPending || inFlight ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Images size={16} />
            )}
            {create.isPending
              ? t("admin.saving")
              : inFlight
                ? t("admin.uploading")
                : t("admin.slides.addCount", { count: done.length })}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
          {failed > 0 && !inFlight && (
            <span className="ms-auto text-[11.5px] text-brick">
              {t("admin.slides.failedSkipped", { count: failed })}
            </span>
          )}
        </>
      }
    >
      <form
        id="home-slides-add-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {items.length === 0 ? (
          /* ── لا شيء بعد: منطقة إفلاتٍ كبيرة ── */
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            {...dropProps}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 transition ${
              dragging
                ? "border-gold bg-gold/10"
                : "border-forest/25 bg-cream-2 hover:border-gold hover:bg-gold/5"
            }`}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold">
              <UploadCloud size={28} />
            </span>
            <span className="text-sm font-bold text-forest">
              {t("admin.slides.dropPromptMany")}
            </span>
            <span className="max-w-md text-center text-[11.5px] leading-relaxed text-clay">
              {t("admin.slides.dropHintMany", { count: room })}
            </span>
          </button>
        ) : (
          /* ── المختارة: شبكةٌ بمعاينةٍ وسطرٍ لكلّ صورة ── */
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-forest">
                {t("admin.slides.selectedCount", { count: items.length })}
                <span className="ms-1.5 text-clay">
                  · {t("admin.slides.roomLeft", { count: Math.max(free, 0) })}
                </span>
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-[11.5px] font-semibold text-clay transition hover:text-brick"
              >
                {t("admin.slides.clearAll")}
              </button>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item, i) => (
                <li
                  key={item.key}
                  className={`overflow-hidden rounded-xl border bg-cream-card ${
                    item.status === "error"
                      ? "border-brick/40"
                      : "border-forest/12"
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden bg-forest-deep">
                    <img
                      src={item.preview}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                    {placement === "home" && <SlidePreviewOverlay compact />}

                    <span className="absolute start-1.5 top-1.5 z-10 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      aria-label={t("admin.slides.removeFromBatch")}
                      title={t("admin.slides.removeFromBatch")}
                      className="absolute end-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full bg-black/50 text-white transition hover:bg-brick"
                    >
                      <X size={13} />
                    </button>

                    {/* الحالة — تحت زرّ الإزالة (`z-10` عليه): ما ينتظر أو فشل
                        يجب أن يبقى قابلاً للإزالة. */}
                    {item.status !== "done" && (
                      <span className="absolute inset-0 grid place-items-center bg-black/45">
                        {item.status === "error" && !item.retryable ? (
                          <AlertCircle size={22} className="text-white/90" />
                        ) : item.status === "error" ? (
                          <button
                            type="button"
                            onClick={() => retry(item.key)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10.5px] font-bold text-brick"
                          >
                            <RotateCcw size={12} />
                            {t("admin.slides.retry")}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-white">
                            <Loader2
                              size={14}
                              className={
                                item.status === "uploading"
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            {item.status === "uploading"
                              ? t("admin.uploading")
                              : t("admin.slides.waiting")}
                          </span>
                        )}
                      </span>
                    )}
                    {item.status === "done" && (
                      <CheckCircle2
                        size={16}
                        className="absolute bottom-1.5 end-1.5 rounded-full bg-white text-emerald-600"
                      />
                    )}
                  </div>

                  {(item.status === "error" || withCaption) && (
                    <div className="p-2">
                      {item.status === "error" ? (
                        <p
                          className="flex items-start gap-1 text-[10.5px] leading-snug text-brick"
                          title={item.name}
                        >
                          <AlertCircle size={12} className="mt-px shrink-0" />
                          <span className="line-clamp-2">{item.error}</span>
                        </p>
                      ) : (
                        <input
                          value={item.caption}
                          maxLength={CAPTION_MAX}
                          onChange={(e) =>
                            patch(item.key, { caption: e.target.value })
                          }
                          placeholder={t("admin.slides.captionShort")}
                          aria-label={t("admin.slides.caption")}
                          className="w-full rounded-lg border border-forest/12 bg-cream-2 px-2 py-1.5 text-[11.5px] text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:ring-2 focus:ring-gold/25"
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}

              {free > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    {...dropProps}
                    className={`flex size-full min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition ${
                      dragging
                        ? "border-gold bg-gold/10"
                        : "border-forest/20 hover:border-gold hover:bg-gold/5"
                    }`}
                  >
                    <Plus size={20} className="text-clay" />
                    <span className="text-[11.5px] font-semibold text-forest">
                      {t("admin.slides.addMore")}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {notice && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
            <AlertCircle size={13} className="shrink-0" />
            {notice}
          </p>
        )}

        <VisibilityToggle
          on={isActive}
          onChange={setIsActive}
          many
          onHint={
            withCaption ? undefined : t(`${COPY_NS[placement]}.visibleHint`)
          }
        />

        <input
          ref={inputRef}
          type="file"
          accept={SLIDE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            add(filesOf(e.target.files));
            e.target.value = "";
          }}
        />
      </form>
    </FormDialog>
  );
}
