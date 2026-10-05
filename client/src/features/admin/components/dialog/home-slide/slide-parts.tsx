import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

const SCRIM = {
  background:
    "linear-gradient(to top, var(--t-brand-deep) 0%, color-mix(in srgb, var(--t-brand-deep) 78%, transparent) 38%, color-mix(in srgb, var(--t-brand-deep) 58%, transparent) 100%)",
};

/** تعتيم الواجهة وعنوانها مصغَّرَين، فوق الصورة المختارة. */
export function SlidePreviewOverlay({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
      style={SCRIM}
    >
      <b
        className={`font-serif font-bold text-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${
          compact ? "text-[11px] leading-tight" : "text-lg sm:text-2xl"
        }`}
      >
        {t("hero.title")}
      </b>
      {!compact && (
        <span className="mt-1 text-[11px] text-cream/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-xs">
          {t("hero.subtitle")}
        </span>
      )}
    </div>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        on ? "bg-gold" : "bg-forest/20"
      }`}
    >
      <span
        className={`absolute size-4 rounded-full bg-white shadow transition-all ${
          on ? "end-0.5" : "start-0.5"
        }`}
      />
    </span>
  );
}

/** «تظهر للزوّار» أم «تبقى هنا» — في نوافذ الصور والأخبار وكلمة رئيس القسم. */
export function VisibilityToggle({
  on,
  onChange,
  many = false,
  labels,
  onHint,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  /** النصّ بصيغة الجمع، لنافذة الإضافة. */
  many?: boolean;
  /** نصوصٌ لغير الصور — «منشور / مخفيّ» للأخبار مثلاً. */
  labels?: { on: string; off: string; onHint: string; offHint: string };
  /** أين تظهر — لموضعٍ غير الصفحة الرئيسية. */
  onHint?: string;
}) {
  const { t } = useTranslation();
  const text = labels ?? {
    on: t(many ? "admin.slides.visibleMany" : "admin.slides.visible"),
    off: t(many ? "admin.slides.hiddenMany" : "admin.slides.hidden"),
    onHint: onHint ?? t("admin.slides.visibleHint"),
    offHint: t("admin.slides.hiddenHint"),
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-start transition ${
        on ? "border-gold/40 bg-gold/8" : "border-forest/15 bg-cream-2"
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          on ? "bg-gold/20 text-gold" : "bg-forest/8 text-clay"
        }`}
      >
        {on ? <Eye size={17} /> : <EyeOff size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm text-forest">{on ? text.on : text.off}</b>
        <span className="block text-[11px] text-clay">{on ? text.onHint : text.offHint}</span>
      </span>
      <Switch on={on} />
    </button>
  );
}
