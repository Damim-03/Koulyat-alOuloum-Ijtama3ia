import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Link2,
  MonitorPlay,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { NewsItem, SiteLang } from "../../../../types/site.types";
import {
  useAdminNews,
  useDeleteNews,
  useUpdateNews,
} from "../../hooks/site-content-hook";
import { NewsDialog } from "../../components/dialog/news/news-dialog.form";
import { Switch } from "../../components/dialog/home-slide/slide-parts";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { NewsTickerBar } from "../../../home/components/news-ticker";
import { newsDate } from "../../../home/lib/site-content";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useLanguage } from "../../../../hooks/use-language";
import { PanelBar, PrimaryAction, StatChip } from "./panel-kit";

/** يطابق `MAX_NEWS` في الخادم. */
const MAX_NEWS = 30;

/**
 * تبويب «آخر الأخبار»: ما يدور في الشريط تحت صور الواجهة.
 *
 * والمعاينة في الأعلى هي الشريط نفسه بالأخبار المنشورة وحدها — ما يُرى هنا
 * هو ما يراه الزائر، بترتيبه: الأحدث تاريخاً أوّلاً.
 */
export function NewsPanel() {
  const { t } = useTranslation();
  const { currentLang } = useLanguage();
  const lang = currentLang as SiteLang;
  const { data, isLoading, isError, refetch } = useAdminNews();
  const update = useUpdateNews();
  const remove = useDeleteNews();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [removing, setRemoving] = useState<NewsItem | null>(null);

  const news = useMemo(() => data ?? [], [data]);
  const published = useMemo(() => news.filter((n) => n.isActive), [news]);
  const full = news.length >= MAX_NEWS;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(n: NewsItem) {
    setEditing(n);
    setDialogOpen(true);
  }

  return (
    <div>
      <PanelBar
        icon={Newspaper}
        title={t("admin.news.title")}
        hint={t("admin.news.subtitle")}
        stats={
          <>
            <StatChip icon={Eye} label={t("admin.news.statPublished")} value={published.length} tone="good" />
            <StatChip icon={EyeOff} label={t("admin.news.statHidden")} value={news.length - published.length} tone="muted" />
          </>
        }
        actions={
          <PrimaryAction
            icon={Plus}
            label={t("admin.news.add")}
            onClick={openCreate}
            disabled={full}
            title={full ? t("admin.news.full", { max: MAX_NEWS }) : undefined}
          />
        }
      />

      {isLoading ? (
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : (
        <div className="space-y-5">
          {/* ── المعاينة ── */}
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-forest/10 px-4 py-3">
              <MonitorPlay size={16} className="text-gold" />
              <b className="text-sm text-forest">{t("admin.news.previewTitle")}</b>
              <span className="text-[11px] text-clay">— {t("admin.news.previewHint")}</span>
            </div>
            {published.length ? (
              <div className="forest-glow">
                <NewsTickerBar items={published} />
              </div>
            ) : (
              <p className="px-4 py-4 text-[12px] text-clay">{t("admin.news.previewEmpty")}</p>
            )}
          </div>

          {/* ── القائمة ── */}
          {news.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card px-6 py-14 text-center">
              <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-gold/10 text-gold">
                <Newspaper size={28} />
              </span>
              <b className="font-serif text-lg text-forest">{t("admin.news.emptyTitle")}</b>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-clay">{t("admin.news.emptyHint")}</p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft"
              >
                <Plus size={17} />
                {t("admin.news.addFirst")}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-forest/8 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
              {news.map((n) => (
                <li
                  key={n.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition sm:flex-nowrap ${
                    n.isActive ? "" : "bg-forest/[0.025]"
                  }`}
                >
                  <time
                    dateTime={n.date.slice(0, 10)}
                    className={`w-20 shrink-0 rounded-lg px-2 py-1.5 text-center text-[11.5px] font-bold tabular-nums ${
                      n.isActive ? "bg-gold/12 text-gold" : "bg-forest/8 text-clay"
                    }`}
                  >
                    {newsDate(n.date, lang)}
                  </time>

                  <div className={`min-w-0 flex-1 ${n.isActive ? "" : "opacity-60"}`}>
                    <p dir="auto" className="truncate text-sm font-semibold text-forest" title={n.text}>
                      {n.text}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {(
                        [
                          ["FR", n.textFr],
                          ["EN", n.textEn],
                        ] as const
                      ).map(([code, v]) => (
                        <span
                          key={code}
                          title={v ?? t("admin.news.noTranslation")}
                          className={`rounded-md px-1.5 py-0.5 font-bold ${
                            v ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-forest/6 text-clay/70 line-through"
                          }`}
                        >
                          {code}
                        </span>
                      ))}
                      {n.linkUrl && (
                        <span className="inline-flex min-w-0 max-w-64 items-center gap-1 text-clay" title={n.linkUrl}>
                          <Link2 size={11} className="shrink-0" />
                          <span dir="ltr" className="truncate">{n.linkUrl}</span>
                        </span>
                      )}
                      {!n.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-forest/8 px-1.5 py-0.5 font-semibold text-clay">
                          <EyeOff size={10} />
                          {t("admin.news.hidden")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={n.isActive}
                      aria-label={t("admin.news.showInTicker")}
                      title={t("admin.news.showInTicker")}
                      onClick={() => update.mutate({ id: n.id, data: { isActive: !n.isActive } })}
                      className="rounded-full p-1 transition hover:bg-forest/5"
                    >
                      <Switch on={n.isActive} />
                    </button>
                    <RowAction icon={Pencil} label={t("admin.edit")} onClick={() => openEdit(n)} />
                    <RowAction icon={Trash2} label={t("admin.delete")} danger onClick={() => setRemoving(n)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <NewsDialog open={dialogOpen} item={editing} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={!!removing}
        tone="danger"
        title={t("admin.news.deleteTitle")}
        message={t("admin.news.deleteMessage")}
        confirmLabel={t("admin.delete")}
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </div>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
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
