import { useTranslation } from "react-i18next";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";

interface NewsItem {
  date: string;
  text: string;
}

// ألوان النقاط المتنوّعة (مثل CEIL)
const DOTS = ["bg-gold", "bg-sky-400", "bg-fuchsia-400", "bg-soft-sage"];

export function NewsTicker() {
  const { t } = useTranslation();
  const { dir, isRTL } = useLanguage();

  const items = t("news.items", { returnObjects: true });
  const list: NewsItem[] = Array.isArray(items) ? (items as NewsItem[]) : [];
  if (list.length === 0) return null;

  const loop = [...list, ...list];
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div
      dir={dir}
      className="relative z-10 flex items-stretch overflow-hidden border-y border-white/5 bg-forest-deep/80 text-cream backdrop-blur-sm"
    >
      {/* label — نص ذهبي + جرس، بدون صندوق ممتلئ */}
      <div
        className={`flex shrink-0 items-center gap-2 px-4 py-2.5 ${isRTL ? "border-l" : "border-r"} border-white/10`}
      >
        <Bell size={15} className="animate-pulse text-gold" />
        <span className="whitespace-nowrap text-[13px] font-bold text-gold">
          {t("news.label")}
        </span>
      </div>

      {/* marquee */}
      <div className="group relative flex flex-1 items-center overflow-hidden">
        <div
          className="flex shrink-0 items-center gap-10 whitespace-nowrap px-6 animate-[ticker_30s_linear_infinite] group-hover:paused"
          style={{ animationDirection: isRTL ? "normal" : "reverse" }}
        >
          {loop.map((item, i) => (
            <span key={i} className="flex items-center gap-2.5 text-[13px]">
              <span className={`size-1.5 shrink-0 rounded-full ${DOTS[i % DOTS.length]}`} />
              <span className="text-[11px] text-cream/45">{item.date}</span>
              <span className="font-semibold text-cream/90">{item.text}</span>
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-forest-deep/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-forest-deep/80 to-transparent" />
      </div>

      {/* view all */}
      <a
        href="#features"
        className={`flex shrink-0 items-center gap-1 px-4 py-2.5 text-[12px] font-medium text-cream/50 transition hover:text-cream ${isRTL ? "border-r" : "border-l"} border-white/10`}
      >
        <span className="hidden whitespace-nowrap sm:inline">{t("news.viewAll")}</span>
        <Chevron size={14} />
      </a>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}