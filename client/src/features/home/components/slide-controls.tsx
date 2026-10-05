import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";

/**
 * أزرار الصور المتعاقبة — السابقة، ونقطةٌ لكلّ صورة، والتالية، والإيقاف —
 * في كبسولةٍ زجاجيّة. هي نفسها خلف عنوان الرئيسية وخلف رأس «عن المنصة».
 *
 * وألوانها بيضاء لا كريمية: تقع دائماً فوق تعتيمٍ داكن، و`cream` ينقلب داكناً
 * في الوضع الداكن فتختفي النقاط.
 */
export function SlideControls({
  count,
  current,
  stopped,
  onGo,
  onToggle,
}: {
  count: number;
  current: number;
  stopped: boolean;
  onGo: (index: number) => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  // «السابق» يشير إلى بداية السطر: يمينٌ في العربية، يسارٌ في غيرها.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/25 p-1 backdrop-blur-sm">
      <ControlButton
        label={t("hero.slides.previous")}
        onClick={() => onGo(current - 1)}
      >
        <PrevIcon size={15} />
      </ControlButton>

      <div className="flex items-center gap-1 px-1">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGo(i)}
            aria-label={t("hero.slides.goTo", { n: i + 1, total: count })}
            aria-current={i === current ? "true" : undefined}
            className="grid h-6 place-items-center px-0.5"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-5 bg-gold"
                  : "w-1.5 bg-white/45 hover:bg-white/75"
              }`}
            />
          </button>
        ))}
      </div>

      <ControlButton
        label={t("hero.slides.next")}
        onClick={() => onGo(current + 1)}
      >
        <NextIcon size={15} />
      </ControlButton>

      <ControlButton
        label={stopped ? t("hero.slides.play") : t("hero.slides.pause")}
        onClick={onToggle}
      >
        {stopped ? <Play size={13} /> : <Pause size={13} />}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-gold"
    >
      {children}
    </button>
  );
}
