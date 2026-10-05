import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useSiteNews } from "../hooks/site-hook";
import { newsDate, newsText } from "../lib/site-content";
import type { PublicNewsItem, SiteLang } from "../../../types/site.types";
import { NewsLink } from "./news-link";
import { NewsListDialog } from "./news-list-dialog";

// ألوان النقاط المتنوّعة (مثل CEIL)
const DOTS = ["bg-gold", "bg-sky-400", "bg-fuchsia-400", "bg-soft-sage"];

/** الشريط في الصفحة الرئيسية: أخبار الإدارة المنشورة، الأحدث أوّلاً. */
export function NewsTicker() {
  const { data, isLoading } = useSiteNews();
  const [open, setOpen] = useState(false);

  // أثناء التحميل يُحجز مكانه، فلا يقفز ما تحته حين يصل.
  if (isLoading) return <NewsTickerBar items={[]} />;
  // ولا أخبار منشورة (أو تعذّر جلبها) ⇒ لا شريط: إعلانٌ قديم أسوأ من لا شيء.
  if (!data?.length) return null;

  return (
    <>
      <NewsTickerBar items={data} onViewAll={() => setOpen(true)} />
      <NewsListDialog open={open} onClose={() => setOpen(false)} items={data} />
    </>
  );
}

/**
 * الشريط نفسه، بلا جلب — تعرضه الصفحة الرئيسية، وتعرضه الإدارة معاينةً لما
 * سينشر.
 */
export function NewsTickerBar({
  items,
  onViewAll,
}: {
  items: PublicNewsItem[];
  onViewAll?: () => void;
}) {
  const { t } = useTranslation();
  const { dir, isRTL, currentLang } = useLanguage();
  const lang = currentLang as SiteLang;

  const loop = [...items, ...items];
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  // سرعةٌ ثابتة للقارئ: كلّ خبرٍ يزيد الدورة طولاً لا سرعة.
  const duration = `${Math.max(24, items.length * 10)}s`;

  return (
    <div
      dir={dir}
      className="relative z-10 flex min-h-11 items-stretch overflow-hidden border-y border-white/5 bg-forest-deep/80 text-cream backdrop-blur-sm"
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
        {items.length > 0 && (
          <div
            className="flex shrink-0 items-center gap-10 whitespace-nowrap px-6 animate-[ticker_30s_linear_infinite] group-hover:paused"
            style={{
              animationDirection: isRTL ? "normal" : "reverse",
              animationDuration: duration,
            }}
          >
            {loop.map((item, i) => (
              <NewsLink
                key={`${item.id}-${i}`}
                href={item.linkUrl}
                // النسخة الثانية للدوران وحده: لا تُقرأ مرّتين ولا تُبلَغ بالتنقّل.
                duplicate={i >= items.length}
                className="group/news flex items-center gap-2.5 text-[13px]"
              >
                <span className={`size-1.5 shrink-0 rounded-full ${DOTS[i % DOTS.length]}`} />
                <span className="text-[11px] text-cream/45">{newsDate(item.date, lang)}</span>
                <span
                  dir="auto"
                  className={`font-semibold text-cream/90 ${item.linkUrl ? "underline-offset-4 group-hover/news:underline" : ""}`}
                >
                  {newsText(item, lang)}
                </span>
              </NewsLink>
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-forest-deep/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-forest-deep/80 to-transparent" />
      </div>

      {/* view all */}
      <button
        type="button"
        onClick={onViewAll}
        disabled={!onViewAll}
        className={`flex shrink-0 items-center gap-1 px-4 py-2.5 text-[12px] font-medium text-cream/50 transition hover:text-cream disabled:cursor-default disabled:hover:text-cream/50 ${isRTL ? "border-r" : "border-l"} border-white/10`}
      >
        <span className="hidden whitespace-nowrap sm:inline">{t("news.viewAll")}</span>
        <Chevron size={14} />
      </button>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
