import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Bell, ExternalLink, X } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { isInternalLink, newsDate, newsText } from "../lib/site-content";
import type { PublicNewsItem, SiteLang } from "../../../types/site.types";
import { NewsLink } from "./news-link";

/**
 * «عرض جميع الأخبار»: القائمة كاملةً ثابتةً، لمن لا يريد أن ينتظر الشريط.
 * كان الزرّ يقفز إلى قسم المزايا — ولا أخبار هناك.
 */
export function NewsListDialog({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: PublicNewsItem[];
}) {
  const { t } = useTranslation();
  const { dir, currentLang } = useLanguage();
  const lang = currentLang as SiteLang;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-list-title"
      className="fixed inset-0 z-100 grid place-items-center p-4 font-body"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-cream-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between gap-3 bg-forest px-5 py-4">
          <h2 id="news-list-title" className="flex items-center gap-2 font-serif text-lg font-bold text-cream">
            <Bell size={18} className="text-gold" />
            {t("news.allTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("news.close")}
            className="grid size-8 place-items-center rounded-full text-cream/80 transition hover:bg-cream/15 hover:text-cream"
          >
            <X size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        <ol className="min-h-0 flex-1 divide-y divide-forest/10 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <NewsLink
                href={item.linkUrl}
                className={`flex items-start gap-4 px-5 py-4 ${item.linkUrl ? "transition hover:bg-forest/5" : ""}`}
              >
                <time
                  dateTime={item.date.slice(0, 10)}
                  className="mt-0.5 shrink-0 rounded-lg bg-gold/12 px-2.5 py-1 text-[11.5px] font-bold text-gold tabular-nums"
                >
                  {newsDate(item.date, lang)}
                </time>
                <span dir="auto" className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-forest">
                  {newsText(item, lang)}
                </span>
                {item.linkUrl && !isInternalLink(item.linkUrl) && (
                  <ExternalLink size={14} className="mt-1 shrink-0 text-clay" />
                )}
              </NewsLink>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
