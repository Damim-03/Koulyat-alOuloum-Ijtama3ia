import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GripVertical,
  ImageOff,
  Images,
  Lightbulb,
  Loader2,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { HomeSlide, SlidePlacement } from "../../../../types/site.types";
import {
  useAdminHomeSlides,
  useDeleteHomeSlide,
  useReorderHomeSlides,
  useUpdateHomeSlide,
} from "../../hooks/home-slides-hook";
import { adminApi } from "../../api/admin.api";
import { HomeSlidesAddDialog } from "../../components/dialog/home-slide/home-slides-add-dialog.form";
import { HomeSlideEditDialog } from "../../components/dialog/home-slide/home-slide-edit-dialog.form";
import { Switch } from "../../components/dialog/home-slide/slide-parts";
import {
  COPY_NS,
  MAX_SLIDES,
  SLIDE_ACCEPT,
  isBackdrop,
  prepareSlideImage,
} from "../../components/dialog/home-slide/slide-kit";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { HeroSlides } from "../../../home/components/hero-slides";
import { PlatformGallery } from "../../../home/components/about/platform-gallery";
import { SavedLoginPreview } from "./login-preview";
import { AboutBgPreview } from "./about-bg-preview";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useLanguage } from "../../../../hooks/use-language";
import { assetUrl } from "../../../../lib/asset-url";
import { serverMessage } from "../../../../lib/api/error";
import { PanelBar, PrimaryAction, StatChip } from "./panel-kit";

/**
 * تبويب «صور الواجهة» في واجهة الموقع.
 *
 * تختار الإدارة الصور التي تتعاقب خلف عنوان الصفحة الرئيسية — واحدةً أو
 * عدّةً دفعةً واحدة — وترتّبها، وتبدّل صورةً بأخرى، وتخفي منها ما شاءت دون
 * حذفه. والمعاينة في رأس الصفحة هي مكوّن الصفحة
 * الرئيسية نفسه بالمفعَّلة وحدها، فما يُرى هنا هو ما يراه الزائر.
 */
/**
 * نصوصٌ تختلف بين المواضع؛ وما سواها مشترك (`admin.slides.*`).
 */
const PLACEMENT_COPY = new Set([
  "title",
  "subtitle",
  "previewTitle",
  "previewHint",
  "previewEmpty",
  "tipSize",
  "tipContrast",
  "tipOrder",
  "emptyTitle",
  "emptyHint",
  "showOnHome",
]);


export function SlidesPanel({ placement = "home" }: { placement?: SlidePlacement }) {
  const { t } = useTranslation();
  const isAbout = placement === "about";
  const isLogin = placement === "login";
  const backdrop = isBackdrop(placement);
  /** نصّ هذا الموضع: كلٌّ يقول ما يخصّه، والباقي مشترك. */
  const tx = (k: string, o?: Record<string, unknown>) => {
    const ns = COPY_NS[placement];
    return t(ns && PLACEMENT_COPY.has(k) ? `${ns}.${k}` : `admin.slides.${k}`, o);
  };
  const { isRTL } = useLanguage();
  // الشبكة تجري مع اتّجاه القراءة، فـ«أبكر» نحو بداية السطر.
  const EarlierIcon = isRTL ? ArrowRight : ArrowLeft;
  const LaterIcon = isRTL ? ArrowLeft : ArrowRight;
  const { data, isLoading, isError, refetch } = useAdminHomeSlides(placement);
  const update = useUpdateHomeSlide(placement);
  const reorder = useReorderHomeSlides(placement);
  const remove = useDeleteHomeSlide();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<HomeSlide | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const [removing, setRemoving] = useState<HomeSlide | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const slides = useMemo(() => data ?? [], [data]);
  const active = useMemo(() => slides.filter((s) => s.isActive), [slides]);
  const full = slides.length >= MAX_SLIDES;

  function openCreate() {
    setAddOpen(true);
  }

  /** «تغيير الصورة» من البطاقة مباشرةً: يختار ملفّاً ويبدّله دون نافذة. */
  function startReplace(id: string) {
    replaceTarget.current = id;
    replaceInput.current?.click();
  }

  async function replaceWith(file?: File) {
    const id = replaceTarget.current;
    replaceTarget.current = null;
    if (!file || !id) return;

    setReplacingId(id);
    let url: string;
    try {
      url = await adminApi.uploadImage(await prepareSlideImage(file));
    } catch (e) {
      toast.error(
        axios.isAxiosError(e)
          ? serverMessage(e, t("toast.imageUploadFailed"))
          : (e as Error).message,
      );
      setReplacingId(null);
      return;
    }
    // فشلُ الحفظ يُعلَن من الـhook نفسه.
    update.mutate(
      { id, data: { imageUrl: url } },
      {
        onSuccess: () => toast.success(t("admin.slides.toastReplaced")),
        onSettled: () => setReplacingId(null),
      },
    );
  }

  /** ينقل صورةً إلى موضعٍ جديد ويرسل الترتيب كاملاً. */
  function moveTo(id: string, target: number) {
    const ids = slides.map((s) => s.id);
    const from = ids.indexOf(id);
    if (from < 0 || target < 0 || target >= ids.length || from === target) return;
    ids.splice(target, 0, ...ids.splice(from, 1));
    reorder.mutate(ids);
  }

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    setOverId(null);
    if (!id || id === targetId) return;
    moveTo(id, slides.findIndex((s) => s.id === targetId));
  }

  return (
    <div>
      <PanelBar
        icon={Images}
        title={tx("title")}
        hint={tx("subtitle")}
        stats={
          <>
            <StatChip icon={Eye} label={t("admin.slides.statVisible")} value={active.length} tone="good" />
            <StatChip icon={EyeOff} label={t("admin.slides.statHidden")} value={slides.length - active.length} tone="muted" />
            <StatChip icon={Images} label={t("admin.slides.statCapacity")} value={`${slides.length}/${MAX_SLIDES}`} />
          </>
        }
        actions={
          <PrimaryAction
            icon={Plus}
            label={t("admin.slides.add")}
            onClick={openCreate}
            disabled={full}
            title={full ? t("admin.slides.full", { max: MAX_SLIDES }) : undefined}
          />
        }
      />

      {isLoading ? (
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── القائمة ── */}
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg font-bold text-forest">{t("admin.slides.listTitle")}</h2>
                <p className="text-xs text-clay">{t("admin.slides.listHint")}</p>
              </div>
              {full && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {t("admin.slides.full", { max: MAX_SLIDES })}
                </span>
              )}
            </div>

            {slides.length === 0 ? (
              <EmptySlides onAdd={openCreate} title={tx("emptyTitle")} hint={tx("emptyHint")} />
            ) : (
              <ol className="grid gap-4 sm:grid-cols-2">
                {slides.map((s, i) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(s.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", s.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (overId !== s.id) setOverId(s.id);
                    }}
                    onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                    onDrop={(e) => onDrop(e, s.id)}
                    className={`group overflow-hidden rounded-2xl border bg-cream-card shadow-sm transition ${
                      overId === s.id && dragId !== s.id
                        ? "border-gold ring-2 ring-gold/30"
                        : "border-forest/10 hover:border-forest/20 hover:shadow-md"
                    } ${dragId === s.id ? "opacity-50" : ""}`}
                  >
                    {/* الصورة */}
                    <div className="relative aspect-video overflow-hidden bg-forest-deep">
                      <img
                        src={assetUrl(s.imageUrl)}
                        alt={s.caption ?? ""}
                        loading="lazy"
                        draggable={false}
                        className={`absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03] ${
                          s.isActive ? "" : "opacity-60 grayscale"
                        }`}
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-linear-to-b from-black/50 to-transparent p-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                          <GripVertical size={12} className="cursor-grab opacity-80" />#{i + 1}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold backdrop-blur-sm ${
                            s.isActive ? "bg-emerald-500/85 text-white" : "bg-black/50 text-white/85"
                          }`}
                        >
                          {s.isActive ? <Eye size={11} /> : <EyeOff size={11} />}
                          {s.isActive ? t("admin.slides.visible") : t("admin.slides.hidden")}
                        </span>
                      </div>

                      {/* تبديل الصورة من مكانها — يظهر بالمرور، وعلى الشاشات
                          الضيّقة دائماً فلا مرورَ باللمس. */}
                      {replacingId === s.id ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/45">
                          <Loader2 size={26} className="animate-spin text-white" />
                        </span>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-black/55 to-transparent p-2.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => startReplace(s.id)}
                            disabled={!!replacingId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[11.5px] font-bold text-[#1a312d] shadow-sm transition hover:bg-white disabled:opacity-60"
                          >
                            <RefreshCw size={13} />
                            {t("admin.slides.replace")}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* السطر ومفتاح الظهور — المفتاح بلا نصّ: البطاقة ضيّقة،
                        والشارة فوق الصورة تقول حالتها. */}
                    <div className="flex items-center gap-3 px-4 pt-3">
                      {/* الخلفيّات بلا سطر: لا يُقرأ فوقها شيءٌ منها. */}
                      {backdrop ? (
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-forest">
                          {t("admin.slides.backdropLabel", { n: i + 1 })}
                        </p>
                      ) : (
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${s.caption ? "font-semibold text-forest" : "italic text-clay"}`}
                          title={s.caption ?? undefined}
                        >
                          {s.caption || t("admin.slides.noCaption")}
                        </p>
                      )}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={s.isActive}
                        aria-label={tx("showOnHome")}
                        title={tx("showOnHome")}
                        onClick={() => update.mutate({ id: s.id, data: { isActive: !s.isActive } })}
                        className="shrink-0 rounded-full p-1 transition hover:bg-forest/5"
                      >
                        <Switch on={s.isActive} />
                      </button>
                    </div>

                    {/* الإجراءات: الترتيب في البداية، والتعديل والحذف في النهاية. */}
                    <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
                      <div className="flex items-center gap-1">
                        <IconAction
                          label={t("admin.slides.moveEarlier")}
                          disabled={i === 0 || reorder.isPending}
                          onClick={() => moveTo(s.id, i - 1)}
                        >
                          <EarlierIcon size={14} />
                        </IconAction>
                        <IconAction
                          label={t("admin.slides.moveLater")}
                          disabled={i === slides.length - 1 || reorder.isPending}
                          onClick={() => moveTo(s.id, i + 1)}
                        >
                          <LaterIcon size={14} />
                        </IconAction>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TextAction icon={Pencil} label={t("admin.edit")} onClick={() => setEditing(s)} />
                        <TextAction icon={Trash2} label={t("admin.delete")} danger onClick={() => setRemoving(s)} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ── المعاينة والنصائح ── */}
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-forest/10 px-4 py-3">
                <MonitorPlay size={16} className="text-gold" />
                <b className="text-sm text-forest">{tx("previewTitle")}</b>
              </div>
              {isAbout ? (
                active.length > 0 && (
                  <div className="p-3">
                    <PlatformGallery slides={active} variant="hero" />
                  </div>
                )
              ) : isLogin ? (
                <SavedLoginPreview slides={active} />
              ) : placement === "aboutHero" ? (
                <AboutBgPreview slides={active} />
              ) : (
                <div className="forest-glow relative aspect-[16/10] overflow-hidden">
                  <HeroSlides slides={active} />
                  <div className="pointer-events-none relative flex h-full flex-col items-center justify-center px-6 pb-8 text-center">
                    <b
                      className={`font-serif text-xl font-bold text-cream ${
                        active.length ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
                      }`}
                    >
                      {t("hero.title")}
                    </b>
                    <span className="mt-1 text-[11px] text-cream/80">{t("hero.subtitle")}</span>
                  </div>
                </div>
              )}
              <p className="px-4 py-3 text-[11.5px] leading-relaxed text-clay">
                {active.length ? tx("previewHint") : tx("previewEmpty")}
              </p>
            </div>

            <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-forest">
                <Lightbulb size={15} className="text-gold" />
                {t("admin.slides.tipsTitle")}
              </p>
              <ul className="list-disc space-y-1.5 ps-5 text-[12px] leading-relaxed text-forest/80">
                <li>{tx("tipSize")}</li>
                <li>{tx("tipContrast")}</li>
                <li>{tx("tipOrder")}</li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      <HomeSlidesAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        room={MAX_SLIDES - slides.length}
        placement={placement}
      />
      <HomeSlideEditDialog slide={editing} onClose={() => setEditing(null)} placement={placement} />

      <input
        ref={replaceInput}
        type="file"
        accept={SLIDE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void replaceWith(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <ConfirmDialog
        open={!!removing}
        tone="danger"
        title={t("admin.slides.deleteTitle")}
        message={t("admin.slides.deleteMessage")}
        confirmLabel={t("admin.delete")}
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-forest/10 text-brick hover:border-brick/40 hover:bg-brick/10"
          : "border-forest/10 text-forest hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

/** زرٌّ بأيقونةٍ ونصّ — للتعديل والحذف، فلا يُحتاج إلى تخمين ما تفعله الأيقونة. */
function TextAction({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold transition ${
        danger
          ? "border-brick/25 text-brick hover:border-brick/50 hover:bg-brick/10"
          : "border-forest/12 text-forest hover:border-gold hover:text-gold"
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function EmptySlides({ onAdd, title, hint }: { onAdd: () => void; title: string; hint: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card px-6 py-14 text-center">
      <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-gold/10 text-gold">
        <ImageOff size={28} />
      </span>
      <b className="font-serif text-lg text-forest">{title}</b>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-clay">{hint}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft"
      >
        <Plus size={17} />
        {t("admin.slides.addFirst")}
      </button>
    </div>
  );
}
