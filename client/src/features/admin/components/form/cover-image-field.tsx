import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useUploadImage } from "../../hooks/admin-hook";

/** Mirrors the server's own limits (upload.middleware.ts). */
const MAX_BYTES = 2 * 1024 * 1024;
/**
 * الأنواع الثلاثة التي يقبلها الخادم، لا أكثر.
 *
 * كان `image/svg+xml` معروضاً في المنتقي، وقد أسقطه الخادم عمداً: SVG وثيقة
 * XML تحمل `<script>`، وتقديمها من أصل الواجهة تنفيذُ سكربتٍ مخزَّن. فكان
 * المنتقي يعرض على الإدارية ملفّاتٍ تُردّ عند الرفع برسالة «نوع غير مدعوم»
 * — وهي تظنّ العطب في النظام لا في اختيارها.
 */
const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Optional cover image for a faculty / department / domain / filiere /
 * specialization.
 *
 * Always skippable: the field opens empty, says so, and a saved cover can be
 * removed again. The file is uploaded as soon as it is picked and the form
 * only ever carries the resulting URL, so submitting stays a plain JSON call.
 *
 * و`variant` شكلُ المعاينة لا غير: الغلاف شريطٌ عريض يُقرأ خلف البطاقة،
 * والشعار مربّعٌ يُقرأ في أربعين بكسلاً. ومعاينةٌ عريضة لشعارٍ مربّع تكذب
 * على العين: تُريه ممدوداً ثمّ يظهر في البطاقة غير ما رأى. والرفع والحدود
 * والمسح واحدةٌ في الحالين.
 *
 * **والإجراءان أيقونتان لا لافتتان.** كانا زرَّين بنصٍّ كامل يطفوان على
 * الصورة — «تغيير الصورة» و«إزالة» — فيحجبان ثلثها ويزاحمان الشعار الصغير.
 * وصارا أيقونتين في شريطٍ خافت: على الغلاف يظهران بالمرور (وعلى الشاشات
 * الضيّقة يبقيان ظاهرين، فلا مرورَ باللمس)، وتحت الشعار في صفٍّ مستقلّ فلا
 * يغطّيان علامةً لا تتجاوز مئة بكسل.
 */
export function CoverImageField({
  value,
  onChange,
  label,
  hint,
  variant = "cover",
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  variant?: "cover" | "icon";
}) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIcon = variant === "icon";
  const frame = isIcon ? "size-28" : "h-32 w-full";
  const replaceLabel = isIcon ? t("admin.replaceIcon") : t("admin.replaceCover");
  const removeLabel = isIcon ? t("admin.removeIcon") : t("admin.removeCover");

  function pick(file?: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("admin.coverTooLarge"));
      return;
    }
    upload.mutate(file, { onSuccess: (url) => onChange(url) });
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function clearImage() {
    setError(null);
    onChange("");
  }

  /** زرّ إجراءٍ مربّع — نفسه على الغلاف وتحت الشعار. */
  const action = (kind: "replace" | "remove", solid: boolean) => {
    const isRemove = kind === "remove";
    return (
      <button
        type="button"
        onClick={isRemove ? clearImage : openPicker}
        aria-label={isRemove ? removeLabel : replaceLabel}
        title={isRemove ? removeLabel : replaceLabel}
        className={`grid size-8 place-items-center rounded-lg transition ${
          solid
            ? isRemove
              ? "bg-cream/90 text-brick hover:bg-brick hover:text-cream"
              : "bg-cream/90 text-forest hover:bg-cream"
            : isRemove
              ? "border border-forest/15 bg-cream-2 text-brick hover:border-brick/40 hover:bg-brick/10"
              : "border border-forest/15 bg-cream-2 text-forest hover:border-gold hover:text-gold"
        }`}
      >
        {isRemove ? <Trash2 size={14} /> : <RefreshCw size={14} />}
      </button>
    );
  };

  const preview = (
    <div
      className={`group relative overflow-hidden rounded-xl border border-forest/15 ${frame}`}
    >
      <img
        src={value ?? ""}
        alt=""
        className={`size-full ${isIcon ? "object-contain p-1" : "object-cover"}`}
        onError={() => setError(t("admin.coverBroken"))}
      />

      {/* على الغلاف وحده: شريطٌ يظهر بالمرور، ويبقى ظاهراً على الضيّقة. */}
      {!isIcon && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-linear-to-t from-forest-deep/75 to-transparent p-2 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {action("replace", true)}
          {action("remove", true)}
        </div>
      )}
    </div>
  );

  const dropzone = (
    <button
      type="button"
      onClick={openPicker}
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
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition ${frame} ${
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
      <span
        className={`font-semibold text-forest ${isIcon ? "text-[11px]" : "text-xs"}`}
      >
        {upload.isPending
          ? t("admin.uploading")
          : isIcon
            ? t("admin.iconPrompt")
            : t("admin.coverPrompt")}
      </span>
      {!isIcon && (
        <span className="text-[10px] text-clay">
          {hint ?? t("admin.coverHint")}
        </span>
      )}
    </button>
  );

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        <ImagePlus size={14} className="text-clay" />
        {label ?? t("admin.coverImage")}
        <span className="rounded-full bg-forest/8 px-1.5 py-px text-[10px] font-normal text-clay">
          {t("admin.optional")}
        </span>
      </label>

      {value ? preview : dropzone}

      {/* الشعار صغير، فإجراءاته تحته لا فوقه. */}
      {value && isIcon && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {action("replace", false)}
          {action("remove", false)}
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-brick">{error}</p>}

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
