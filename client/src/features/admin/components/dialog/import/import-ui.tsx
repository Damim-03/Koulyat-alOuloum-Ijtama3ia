import { useTranslation } from "react-i18next";
import { Asterisk, CircleDashed, Sparkles } from "lucide-react";
import type { ImportColumnKind } from "../../../../../types/admin";

/**
 * قطعٌ مشتركة بين خطوات نافذة الاستيراد: شارة نوع العمود وحرفه.
 *
 * نوع العمود يُقرأ في كلّ مكانٍ باللون نفسه — ذهبيٌّ للإلزامي، ومريميّ
 * للاختياري، ومنقّطٌ للتلقائي — في دليل الأعمدة قبل الرفع، وفي رأس جدول
 * المعاينة، وفي تفاصيل الصفّ. ولا يعتمد على لون الخلفية وحده: على الوضع
 * الداكن يختفي ما بُني على أخضر الشعار، فالشارة ترسم نفسها.
 */

const PILL: Record<ImportColumnKind, { card: string; brand: string }> = {
  req: {
    card: "bg-gold text-[var(--t-brand-deep)] shadow-[0_2px_8px_rgba(193,150,90,0.35)]",
    brand: "bg-gold text-[var(--t-brand-deep)] shadow-[0_2px_8px_rgba(193,150,90,0.35)]",
  },
  opt: {
    card: "bg-sage/15 text-sage ring-1 ring-inset ring-sage/40",
    brand: "bg-soft-sage/20 text-soft-sage ring-1 ring-inset ring-soft-sage/45",
  },
  auto: {
    card: "border border-dashed border-gold/60 text-gold",
    brand: "border border-dashed border-gold-soft/70 text-gold-soft",
  },
};
const ICON: Record<ImportColumnKind, typeof Asterisk> = {
  req: Asterisk,
  opt: CircleDashed,
  auto: Sparkles,
};

export function KindPill({
  kind,
  onBrand = false,
  className = "",
}: {
  kind: ImportColumnKind;
  /** على خلفية الشعار الداكنة (رأس الجدول) لا على البطاقة. */
  onBrand?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const Icon = ICON[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-4 ${
        PILL[kind][onBrand ? "brand" : "card"]
      } ${className}`}
    >
      <Icon size={10} strokeWidth={2.6} />
      {t(`admin.import.kind_${kind}`)}
    </span>
  );
}

/** حرف العمود في الملف كما يراه المسؤول في Excel — أو «غائب». */
export function LetterBadge({ letter, onBrand = false }: { letter: string | null; onBrand?: boolean }) {
  const { t } = useTranslation();
  return letter ? (
    <span
      className={`inline-grid min-w-5 place-items-center rounded-md px-1 font-mono text-[10px] font-bold leading-4 ${
        onBrand ? "bg-cream/10 text-cream/80" : "bg-forest/8 text-clay"
      }`}
      dir="ltr"
    >
      {letter}
    </span>
  ) : (
    <span className="rounded-md border border-dashed border-brick/60 px-1 text-[10px] font-semibold leading-4 text-brick">
      {t("admin.import.missing")}
    </span>
  );
}
