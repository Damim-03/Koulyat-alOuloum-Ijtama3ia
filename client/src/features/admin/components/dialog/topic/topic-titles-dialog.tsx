import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarRange, ClipboardList, FileText, Printer, RectangleHorizontal, RectangleVertical, Users, X, type LucideIcon } from "lucide-react";
import type { AcademicYear, TitlesListMode, TitlesListParams, TopicTitlesList } from "../../../../../types/admin";
import { useTopicTitlesList } from "../../../hooks/admin-hook";
import { Select } from "../../../../../components/ui/select";
import { LoadingArea } from "../../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../../components/ui/error-retry";
import { TitlesListSheet } from "./titles-list-sheet";
import { paperWidthPx, type Orientation } from "./titles-list-utils";

/**
 * قائمةُ عناوين المذكرات: معاينةٌ ثمّ طباعة.
 *
 * يختار المسؤول ما يُعرض — **قبل الإسناد** (المواضيع المعتمدة وأساتذتها)
 * أو **بعده** (المذكرات وطلبتها) — والسنةَ واتجاهَ الورقة، والنطاقُ نطاقُ
 * الفلاتر في الصفحة. والعددُ على كلّ خيارٍ قبل اختياره، فيُرى أيّهما فيه شيء.
 *
 * والطباعة طباعةُ الورقة وحدها: يُخفى كلّ ما في الصفحة سواها، كورقة الإشراف.
 */
export function TopicTitlesDialog({
  scope,
  years,
  onClose,
}: {
  /** The topics page's filters, less the year — the dialog keeps its own. */
  scope: Omit<TitlesListParams, "mode">;
  years: AcademicYear[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<TitlesListMode>("after");
  const [yearId, setYearId] = useState(() => scope.academicYearId || years.find((y) => y.isActive)?.id || "");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const params = { ...scope, academicYearId: yearId || undefined };
  const afterQ = useTopicTitlesList({ ...params, mode: "after" });
  const beforeQ = useTopicTitlesList({ ...params, mode: "before" });
  const q = mode === "after" ? afterQ : beforeQ;
  const count = (d?: TopicTitlesList) => d?.groups.reduce((n, g) => n + g.rows.length, 0);
  const total = count(q.data) ?? 0;
  const scoped = !!(scope.professorId || scope.facultyId || scope.departmentId || scope.filiereId || scope.specializationId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { ref, zoom } = useFitWidth(paperWidthPx(orientation));

  const modes: { key: TitlesListMode; icon: LucideIcon; n: number | undefined }[] = [
    { key: "before", icon: ClipboardList, n: count(beforeQ.data) },
    { key: "after", icon: Users, n: count(afterQ.data) },
  ];

  return createPortal(
    <div className="tl-print-root fixed inset-0 z-[95] grid place-items-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t("admin.titlesList.title")}>
      <style>{shellCss(orientation)}</style>
      <div className="tl-print-hide absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      <div className="tl-print-pass relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-cream-card shadow-[0_24px_70px_rgba(0,0,0,0.4)] ring-1 ring-forest/10">
        {/* ── head ── */}
        <header className="tl-print-hide forest-glow relative flex shrink-0 items-center gap-4 px-5 py-4 text-cream sm:px-6">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft ring-1 ring-gold/30">
            <FileText size={20} />
          </span>
          <div className="relative min-w-0 flex-1">
            <h2 className="font-serif text-[18px] leading-tight font-bold text-cream">{t("admin.titlesList.title")}</h2>
            <p className="mt-0.5 truncate text-[12px] text-cream/70">{scoped ? t("admin.titlesList.scoped") : t("admin.titlesList.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.titlesList.close")}
            className="relative grid size-9 shrink-0 place-items-center rounded-xl text-cream/70 transition hover:bg-white/10 hover:text-cream"
          >
            <X size={18} />
          </button>
        </header>

        {/* ── what to show ── */}
        <div className="tl-print-hide flex shrink-0 flex-wrap items-center gap-3 border-b border-forest/10 bg-cream-card px-5 py-3.5 sm:px-6">
          <div role="tablist" aria-label={t("admin.titlesList.modeLabel")} className="grid min-w-0 flex-1 basis-80 grid-cols-2 gap-1.5 rounded-2xl bg-cream-2 p-1.5 ring-1 ring-forest/10">
            {modes.map((m) => {
              const on = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-testid={`titles-mode-${m.key}`}
                  onClick={() => setMode(m.key)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-start transition ${
                    on ? "bg-cream-card shadow-[0_6px_18px_-10px_rgba(38,66,61,0.4)] ring-1 ring-gold/40" : "hover:bg-cream-card/60"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${on ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d]" : "bg-forest/5 text-forest/70"}`}
                  >
                    <m.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-forest">{t(`admin.titlesList.${m.key}`)}</span>
                    <span className="block truncate text-[11.5px] text-clay">{t(`admin.titlesList.${m.key}Hint`)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-gold/12 px-2 py-0.5 text-[11.5px] font-bold text-gold tabular-nums">{m.n ?? "…"}</span>
                </button>
              );
            })}
          </div>

          <Select
            value={yearId}
            onChange={setYearId}
            icon={CalendarRange}
            aria-label={t("admin.titlesList.year")}
            className="w-48"
            options={[
              { value: "", label: t("admin.titlesList.allYears") },
              ...years.map((y) => ({ value: y.id, label: y.title, hint: y.isActive ? t("admin.titlesList.current") : undefined })),
            ]}
          />

          <div className="flex items-center gap-1 rounded-xl bg-cream-2 p-1 ring-1 ring-forest/10" role="group" aria-label={t("admin.titlesList.orientation")}>
            {(
              [
                ["portrait", RectangleVertical],
                ["landscape", RectangleHorizontal],
              ] as const
            ).map(([o, Icon]) => (
              <button
                key={o}
                type="button"
                aria-pressed={orientation === o}
                title={t(`admin.titlesList.${o}`)}
                onClick={() => setOrientation(o)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  orientation === o ? "bg-cream-card text-forest shadow-sm ring-1 ring-gold/40" : "text-clay hover:text-forest"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t(`admin.titlesList.${o}`)}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={!total}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft px-4 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-12px_rgba(193,150,90,0.9)] transition hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Printer size={16} />
            {t("admin.titlesList.print")}
          </button>
        </div>

        {/* ── the paper ── */}
        <section ref={ref} className="tl-print-pass min-h-0 flex-1 overflow-auto bg-clay/12 p-4 sm:p-6">
          {q.isLoading ? (
            <LoadingArea className="tl-print-hide py-24" />
          ) : q.isError ? (
            <div className="tl-print-hide">
              <ErrorRetry compact title={t("admin.titlesList.failed")} onRetry={() => q.refetch()} />
            </div>
          ) : !total ? (
            <div className="tl-print-hide mx-auto mt-10 grid max-w-md place-items-center gap-2 rounded-3xl border border-dashed border-forest/15 bg-cream-card px-6 py-12 text-center">
              <span className="mb-1 grid size-16 place-items-center rounded-3xl border border-gold/25 bg-gold/10 text-gold">
                <FileText size={26} />
              </span>
              <p className="text-[15px] font-bold text-forest">{t(`admin.titlesList.empty_${mode}`)}</p>
              <p className="text-[12.5px] text-clay">{t("admin.titlesList.emptyHint")}</p>
            </div>
          ) : (
            <div className="tl-print-pass tl-zoom" style={{ zoom }}>
              <TitlesListSheet data={q.data!} orientation={orientation} />
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}

/** Scales the paper down to its column — never up: a bigger preview prints no sharper. */
function useFitWidth(paperPx: number) {
  const ref = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      const w = (el?.clientWidth ?? 0) - 48;
      if (w > 0) setZoom(Math.min(1, w / paperPx));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [paperPx]);
  return { ref, zoom };
}

/**
 * What printing does to everything but the paper: hidden, not merely invisible
 * (an invisible box keeps its room, and blank pages come out before the list),
 * and every box between the root and the paper flattened — no height, scroll,
 * frame or preview zoom. The page takes the margins; the paper none of its own.
 */
const shellCss = (orientation: Orientation) => `
@media print {
  @page { size: A4 ${orientation}; margin: 12mm 14mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; }
  body > *:not(.tl-print-root) { display: none !important; }
  .tl-print-hide { display: none !important; }
  .tl-print-root { position: static !important; inset: auto !important; display: block !important; padding: 0 !important; margin: 0 !important; z-index: auto !important; }
  .tl-print-pass {
    position: static !important;
    display: block !important;
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #fff !important;
    box-shadow: none !important;
    zoom: 1 !important;
  }
}
`;
