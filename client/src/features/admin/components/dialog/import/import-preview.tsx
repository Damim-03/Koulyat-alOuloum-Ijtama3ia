import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  EyeOff,
  FileSearch,
  FileWarning,
  Info,
  Loader2,
  PieChart,
  Rows3,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { datedName, downloadBase64 } from "../../../../../lib/download";
import type {
  ImportCell,
  ImportColumn,
  ImportColumnKey,
  ImportColumnKind,
  ImportIssue,
  StudentImportReport,
  StudentImportRow,
} from "../../../../../types/admin";
import {
  columnStats,
  distribution,
  facts,
  filterRows,
  initialFilter,
  type PreviewProfile,
  type RowFilter,
} from "./import-preview.utils";
import { KindPill, LetterBadge } from "./import-ui";

const PAGE = 50;

const GROUP_KEY: Record<ImportColumn["group"], string> = {
  personal: "admin.import.groupPersonal",
  academic: "admin.import.groupAcademic",
  professional: "admin.import.groupProfessional",
};

/** شريطٌ أعلى رأس العمود بلون نوعه — على خلفية الشعار في الوضعين. */
const KIND_STRIPE: Record<ImportColumnKind, string> = {
  req: "shadow-[inset_0_3px_0_var(--t-gold)]",
  opt: "shadow-[inset_0_3px_0_var(--t-soft-sage)]",
  auto: "shadow-[inset_0_3px_0_color-mix(in_oklab,var(--t-gold-soft)_45%,transparent)]",
};
const KIND_DOT: Record<ImportColumnKind, string> = {
  req: "bg-gold",
  opt: "bg-sage",
  auto: "border border-dashed border-gold",
};
const CELL_TONE: Record<ImportCell["state"], string> = {
  error: "bg-brick/10 ring-1 ring-inset ring-brick/40",
  warning: "bg-gold/12 ring-1 ring-inset ring-gold/50",
  auto: "bg-gold/5",
  empty: "",
  ok: "",
};
const COL_WIDTH: Partial<Record<ImportColumnKey, string>> = {
  registrationNumber: "min-w-40",
  email: "min-w-56",
  faculty: "min-w-60",
  department: "min-w-48",
  filiere: "min-w-44",
  specialization: "min-w-60",
  gender: "min-w-28",
  level: "min-w-28",
  password: "min-w-36",
};

/**
 * معاينة ملفّ الاستيراد — الملف كلّه كما فهمته المنصّة.
 *
 * لا قائمة أخطاءٍ وحدها: كلّ صفٍّ بكلّ خاناته، ملوّنةً بما هي عليه — إلزاميٌّ
 * فارغ، واختياريٌّ فارغ، وما تملؤه المنصّة من التخصص، وما فيه خطأ أو تنبيه —
 * وما سيُحفظ من كلّ خانةٍ إن خالف ما كُتب. فيعرف المسؤول قبل أن يستورد ما
 * أدخل بالضبط، وكيف سيُحفظ، وأين يحتاج الملف إلى يده.
 */
export function ImportPreview({
  report,
  annotatedFile,
  notice,
  importing,
  profile,
  annotatedName = "import-errors",
}: {
  report: StudentImportReport;
  annotatedFile?: string;
  notice?: React.ReactNode;
  importing?: boolean;
  /** ما يخصّ هذا الاستيراد: بمَ يُبحث، وعلامَ يُوزَّع. */
  profile: PreviewProfile;
  /** اسم الملف المُعلَّم عند تنزيله (بلا تاريخه). */
  annotatedName?: string;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<RowFilter>(() => initialFilter(report));
  const [column, setColumn] = useState<ImportColumnKey | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFile, setShowFile] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  const stats = useMemo(() => columnStats(report), [report]);
  const shown = useMemo(
    () => filterRows(report.rows, { filter, column, query, searchKeys: profile.searchKeys }),
    [report.rows, filter, column, query, profile.searchKeys],
  );
  const dist = useMemo(() => distribution(report.rows, profile.distribution), [report.rows, profile.distribution]);
  const fx = useMemo(() => facts(report.rows, profile.extraFacts), [report.rows, profile.extraFacts]);
  const [mainHead, badgeHead, monoHead] = profile.distribution.headers;

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * PAGE, current * PAGE + PAGE);
  const selectedIndex = selected === null ? -1 : shown.findIndex((r) => r.row === selected);
  const selectedRow = selectedIndex >= 0 ? shown[selectedIndex] : undefined;

  const { summary } = report;
  const groups = report.columns.reduce<{ group: ImportColumn["group"]; span: number }[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && last.group === c.group) last.span++;
    else acc.push({ group: c.group, span: 1 });
    return acc;
  }, []);
  const reviewed = stats.filter((s) => s.errors + s.warnings > 0);
  const distTotal = dist.reduce((n, d) => n + d.count, 0);

  function choose(next: RowFilter) {
    setFilter(next);
    setPage(0);
  }
  function go(delta: number) {
    const next = shown[selectedIndex + delta];
    if (!next) return;
    setSelected(next.row);
    setPage(Math.floor((selectedIndex + delta) / PAGE));
  }

  if (report.fileErrors.length > 0)
    return (
      <div className="grid h-full place-items-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-2xl">
          {notice}
          <div data-testid="import-file-errors" className="rounded-3xl border border-brick/30 bg-linear-to-b from-brick/8 to-cream-card p-8 text-center shadow-[0_20px_50px_-30px_rgba(168,68,45,0.7)]">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brick/12 text-brick ring-8 ring-brick/5">
              <FileWarning size={30} />
            </span>
            <p className="mt-4 font-serif text-xl font-bold text-forest">{t("admin.import.fileErrorsTitle")}</p>
            <ul className="mx-auto mt-3 max-w-lg space-y-2 text-start text-sm text-forest/85">
              {report.fileErrors.map((m) => (
                <li key={m} className="flex items-start gap-2 rounded-xl bg-cream-card px-3 py-2 ring-1 ring-brick/20">
                  <XCircle size={15} className="mt-0.5 shrink-0 text-brick" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );

  return (
    <div className="relative h-full">
      <div className="h-full space-y-4 overflow-y-auto px-6 py-5 lg:px-8" data-testid="import-preview-body">
        {notice}

        {/* ── the verdict ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Rows3 size={16} />} label={t("admin.import.statTotal")} value={summary.total} total={summary.total} tone="forest" active={filter === "all"} onClick={() => choose("all")} />
          <Stat icon={<CheckCircle2 size={16} />} label={t("admin.import.statValid")} value={summary.valid} total={summary.total} tone="sage" active={filter === "ready"} onClick={() => choose("ready")} testid="import-valid" />
          <Stat icon={<XCircle size={16} />} label={t("admin.import.statInvalid")} value={summary.invalid} total={summary.total} tone="brick" active={filter === "errors"} onClick={() => choose("errors")} testid="import-invalid" />
          <Stat icon={<AlertTriangle size={16} />} label={t("admin.import.statWarned")} value={summary.warned} total={summary.total} tone="gold" active={filter === "warnings"} onClick={() => choose("warnings")} testid="import-warned" />
        </div>

        {summary.invalid > 0 ? (
          <Banner tone="error" text={t("admin.import.hasErrors")}>
            {annotatedFile && <AnnotatedButton file={annotatedFile} name={annotatedName} label={t("admin.import.downloadAnnotated")} tone="error" />}
          </Banner>
        ) : summary.warned > 0 ? (
          <Banner tone="warning" text={t("admin.import.hasWarnings", { count: summary.warned })}>
            {annotatedFile && <AnnotatedButton file={annotatedFile} name={annotatedName} label={t("admin.import.downloadAnnotatedWarn")} tone="warning" />}
          </Banner>
        ) : (
          <Banner tone="ok" text={t("admin.import.allValid")} />
        )}

        {report.fileWarnings.length > 0 && (
          <div data-testid="import-file-warnings" className="rounded-2xl border border-gold/40 bg-linear-to-l from-gold/10 to-transparent px-5 py-3.5">
            <p className="mb-1.5 flex items-center gap-2 text-sm font-bold text-forest">
              <AlertTriangle size={16} className="text-gold" />
              {t("admin.import.fileWarningsTitle")}
            </p>
            <ul className="space-y-1 text-xs leading-relaxed text-forest/80">
              {report.fileWarnings.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {/* ── how the file was read ── */}
          {report.file && (
            <Section icon={<FileSearch size={16} />} title={t("admin.import.fileInfoTitle")} open={showFile} onToggle={() => setShowFile((v) => !v)} testid="import-file-info">
              <dl className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["sheet", report.file.sheetName],
                    ["headerRow", report.file.headerRow],
                    ["firstRow", report.rows[0]?.row ?? "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-cream-2/60 px-3 py-2 ring-1 ring-forest/6">
                    <dt className="text-[10.5px] text-clay">{t(`admin.import.${k}`)}</dt>
                    <dd className="truncate font-serif text-base font-bold text-forest tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {report.columns.map((c) => (
                  <li
                    key={c.key}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] ${
                      c.letter ? "bg-cream-card text-forest ring-1 ring-forest/10" : "border border-dashed border-brick/40 text-clay"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${KIND_DOT[c.kind]}`} />
                    <span className={c.letter ? "" : "line-through decoration-brick/50"}>{c.header}</span>
                    <LetterBadge letter={c.letter} />
                  </li>
                ))}
                {report.file.ignored.map((c) => (
                  <li key={c.letter} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gold/50 px-2 py-1 text-[11px] text-clay">
                    <EyeOff size={11} />
                    {c.header}
                    <LetterBadge letter={c.letter} />
                    <span className="text-[10px]">· {t("admin.import.ignored")}</span>
                  </li>
                ))}
              </ul>
              {report.file.otherSheets.length > 0 && (
                <p className="mt-2 text-[11px] text-clay">
                  {t("admin.import.otherSheets")}: {report.file.otherSheets.map((s) => `«${s}»`).join("، ")}
                </p>
              )}
            </Section>
          )}

          {/* ── what the batch will add ── */}
          <Section icon={<PieChart size={16} />} title={t("admin.import.summaryTitle")} open={showSummary} onToggle={() => setShowSummary((v) => !v)} testid="import-summary">
            <div className="overflow-hidden rounded-xl ring-1 ring-forest/10">
              <table className="w-full text-start text-xs" data-testid="import-distribution">
                <thead className="bg-forest-deep text-cream">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">{t(`admin.import.${mainHead}`)}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t(`admin.import.${badgeHead}`)}</th>
                    {monoHead && <th className="px-3 py-2 text-start font-semibold">{t(`admin.import.${monoHead}`)}</th>}
                    <th className="px-3 py-2 text-end font-semibold">{t("admin.import.distCount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/8">
                  {dist.length === 0 ? (
                    <tr>
                      <td colSpan={monoHead ? 4 : 3} className="px-3 py-3 text-center text-clay">—</td>
                    </tr>
                  ) : (
                    dist.map((d) => (
                      <tr key={`${d.main}|${d.badge}|${d.mono}`}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-forest">{d.main}</p>
                          {d.path && <p className="text-[10.5px] text-clay">{d.path}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {d.badge ? <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10.5px] font-bold text-forest ring-1 ring-gold/30">{d.badge}</span> : "—"}
                        </td>
                        {monoHead && <td className="px-3 py-2 font-mono text-forest" dir="ltr">{d.mono}</td>}
                        <td className="px-3 py-2 text-end">
                          <span className="font-serif text-base font-bold text-forest tabular-nums">{d.count}</span>
                          <span className="ms-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-forest/8">
                            <span className="block h-full rounded-full bg-gold" style={{ width: `${(d.count / Math.max(1, distTotal)) * 100}%` }} />
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs" data-testid="import-facts">
              {fx.map((x) => (
                <Fact key={x.labelKey} label={t(`admin.import.${x.labelKey}`)} value={x.value} muted={x.muted} />
              ))}
            </dl>
            <p className="mt-2 text-[10.5px] leading-relaxed text-clay">{t("admin.import.summaryNote")}</p>
          </Section>
        </div>

        {/* ── the file, cell by cell ── */}
        <section className="overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_14px_40px_-24px_rgba(26,49,45,0.55)]">
          <div className="space-y-3 border-b border-forest/10 bg-linear-to-b from-cream-2/70 to-cream-card px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-2xl bg-cream-2/80 p-1 ring-1 ring-forest/8" role="group" aria-label={t("admin.import.filterLabel")}>
                {(
                  [
                    ["all", summary.total],
                    ["errors", summary.invalid],
                    ["warnings", summary.warned],
                    ["ready", summary.valid],
                  ] as const
                ).map(([k, n]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filter === k}
                    data-testid={`import-filter-${k}`}
                    onClick={() => choose(k)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      filter === k ? "bg-cream-card text-forest shadow-[0_4px_12px_-6px_rgba(26,49,45,0.45)] ring-1 ring-gold/50" : "text-clay hover:text-forest"
                    }`}
                  >
                    {t(`admin.import.filter_${k}`)}
                    <span className={`rounded-md px-1.5 text-[10.5px] tabular-nums ${filter === k ? "bg-gold/20 text-forest" : "bg-forest/6"}`}>{n}</span>
                  </button>
                ))}
              </div>
              <label className="relative ms-auto min-w-56 flex-1 sm:max-w-80">
                <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gold" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={t(`admin.import.${profile.searchPlaceholderKey}`)}
                  data-testid="import-search"
                  className="w-full rounded-xl border border-forest/12 bg-cream-card py-2 ps-9 pe-3 text-xs text-forest outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                />
              </label>
            </div>

            {reviewed.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" data-testid="import-column-chips">
                <span className="me-1 flex items-center gap-1.5 text-[11px] font-bold text-clay">
                  <Columns3 size={14} className="text-gold" />
                  {t("admin.import.columnsToReview")}
                </span>
                {reviewed.map((s) => (
                  <button
                    key={s.column.key}
                    type="button"
                    aria-pressed={column === s.column.key}
                    data-testid={`import-col-${s.column.key}`}
                    onClick={() => {
                      setColumn((c) => (c === s.column.key ? null : s.column.key));
                      setPage(0);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      column === s.column.key ? "bg-gold/15 text-forest ring-1 ring-gold" : "bg-cream-card text-forest ring-1 ring-forest/12 hover:ring-gold/50"
                    }`}
                  >
                    {s.column.header}
                    {s.errors > 0 && <span className="rounded-full bg-brick/15 px-1.5 text-brick tabular-nums">✗ {s.errors}</span>}
                    {s.warnings > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-forest tabular-nums">⚠ {s.warnings}</span>}
                  </button>
                ))}
                {column && (
                  <button type="button" onClick={() => setColumn(null)} className="text-[11px] font-semibold text-clay underline-offset-2 hover:underline">
                    {t("admin.import.allColumns")}
                  </button>
                )}
              </div>
            )}

            <Legend />
          </div>

          <div className="max-h-[64vh] overflow-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-start text-xs" data-testid="import-table">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky start-0 z-30 border-b border-gold/30 bg-forest" />
                  {groups.map((g, i) => (
                    <th key={i} colSpan={g.span} className="border-b border-gold/30 bg-forest px-3 py-2 text-center text-[11px] font-bold tracking-wide text-gold-soft">
                      {t(GROUP_KEY[g.group])}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky start-0 z-30 border-b-2 border-gold bg-forest-deep px-3 py-2.5 text-start text-[12px] font-bold text-cream">
                    {t("admin.import.colRow")}
                  </th>
                  {stats.map((s) => {
                    const pct = (s.filled / Math.max(1, summary.total)) * 100;
                    return (
                      <th
                        key={s.column.key}
                        scope="col"
                        className={`border-b-2 border-gold bg-forest-deep px-3 py-2.5 text-start align-top font-medium text-cream ${KIND_STRIPE[s.column.kind]} ${COL_WIDTH[s.column.key] ?? "min-w-32"} ${
                          column === s.column.key ? "ring-2 ring-inset ring-gold" : ""
                        }`}
                      >
                        <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                          {s.column.header}
                          <LetterBadge letter={s.column.letter} onBrand />
                        </p>
                        <p className="mt-1">
                          <KindPill kind={s.column.kind} onBrand />
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] tabular-nums text-cream/75">
                          <span className="h-1 w-10 overflow-hidden rounded-full bg-cream/15">
                            <span className="block h-full rounded-full bg-gold-soft" style={{ width: `${pct}%` }} />
                          </span>
                          {s.filled}/{summary.total}
                          {s.errors > 0 && <span className="rounded-full bg-brick px-1.5 font-bold text-white">✗ {s.errors}</span>}
                          {s.warnings > 0 && <span className="rounded-full bg-gold px-1.5 font-bold text-[var(--t-brand-deep)]">⚠ {s.warnings}</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 && (
                  <tr>
                    <td colSpan={report.columns.length + 1} className="px-4 py-12 text-center text-sm text-clay">
                      <Search size={22} className="mx-auto mb-2 text-gold/60" />
                      {t("admin.import.noMatch")}
                    </td>
                  </tr>
                )}
                {slice.map((r) => {
                  const active = selected === r.row;
                  return (
                    <tr
                      key={r.row}
                      data-testid={`import-row-${r.row}`}
                      onClick={() => setSelected(r.row)}
                      className={`group cursor-pointer transition ${active ? "bg-gold/10" : "hover:bg-gold/5"}`}
                    >
                      <th
                        scope="row"
                        className={`sticky start-0 z-10 border-b border-forest/8 px-3 py-2.5 text-start align-top font-normal ${
                          active
                            ? "bg-[color-mix(in_srgb,var(--t-gold-soft)_32%,var(--t-cream-card))] shadow-[inset_3px_0_0_var(--t-gold)] rtl:shadow-[inset_-3px_0_0_var(--t-gold)]"
                            : "bg-cream-card group-hover:bg-[color-mix(in_srgb,var(--t-gold-soft)_10%,var(--t-cream-card))]"
                        }`}
                      >
                        <RowBadge row={r} />
                      </th>
                      {report.columns.map((c) => (
                        <td key={c.key} className={`border-b border-forest/8 px-3 py-2.5 align-top ${CELL_TONE[r.cells[c.key].state]}`}>
                          <CellView cell={r.cells[c.key]} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream-2/50 px-4 py-2.5 text-[11px] text-clay">
            <p className="flex items-center gap-1.5">
              <Info size={13} className="shrink-0 text-gold" />
              {t("admin.import.rowHint")}
            </p>
            {shown.length > PAGE && (
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {t("admin.import.range", { from: current * PAGE + 1, to: Math.min(shown.length, (current + 1) * PAGE), total: shown.length })}
                </span>
                <PagerButton disabled={current === 0} onClick={() => setPage(current - 1)} label={t("admin.import.prev")}>
                  <ChevronRight size={15} className="rtl:rotate-0 ltr:rotate-180" />
                </PagerButton>
                <PagerButton disabled={current >= pages - 1} onClick={() => setPage(current + 1)} label={t("admin.import.next")}>
                  <ChevronLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
                </PagerButton>
              </div>
            )}
          </div>
        </section>

        {importing && (
          <p className="flex items-center gap-2 rounded-2xl bg-gold/8 px-4 py-3 text-sm font-medium text-forest ring-1 ring-gold/30" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-gold" />
            {t("admin.import.importing")}
          </p>
        )}
      </div>

      {selectedRow && (
        <RowPanel
          row={selectedRow}
          columns={report.columns}
          position={`${selectedIndex + 1} / ${shown.length}`}
          onClose={() => setSelected(null)}
          onPrev={selectedIndex > 0 ? () => go(-1) : undefined}
          onNext={selectedIndex < shown.length - 1 ? () => go(1) : undefined}
        />
      )}
    </div>
  );
}

// ── pieces ──

const TONE = {
  forest: { text: "text-forest", chip: "bg-forest/8 text-forest", bar: "bg-forest/45" },
  sage: { text: "text-sage", chip: "bg-sage/15 text-sage", bar: "bg-sage" },
  brick: { text: "text-brick", chip: "bg-brick/12 text-brick", bar: "bg-brick" },
  gold: { text: "text-gold", chip: "bg-gold/15 text-gold", bar: "bg-gold" },
} as const;

function Stat({
  icon,
  label,
  value,
  total,
  tone,
  active,
  onClick,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  tone: keyof typeof TONE;
  active: boolean;
  onClick: () => void;
  testid?: string;
}) {
  // صفرُ أخطاءٍ أو تنبيهاتٍ لا يُلوَّن: لونُ الخطر لما فيه خطرٌ وحده.
  const c = value === 0 && (tone === "brick" || tone === "gold") ? { text: "text-clay", chip: "bg-forest/6 text-clay", bar: "bg-forest/20" } : TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testid}
      className={`relative overflow-hidden rounded-2xl border p-4 text-start transition ${
        active
          ? "border-gold/70 bg-linear-to-br from-gold/12 via-cream-card to-cream-card shadow-[0_16px_34px_-20px_rgba(193,150,90,0.95)]"
          : "border-forest/10 bg-cream-card hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_12px_28px_-20px_rgba(26,49,45,0.6)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-clay">{label}</span>
        <span className={`grid size-8 place-items-center rounded-xl ${c.chip}`}>{icon}</span>
      </div>
      <p className={`mt-1.5 font-serif text-3xl font-bold tabular-nums ${c.text}`}>{value}</p>
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-forest/8">
        <span className={`block h-full rounded-full transition-all ${c.bar}`} style={{ width: `${(value / Math.max(1, total)) * 100}%` }} />
      </span>
    </button>
  );
}

function Banner({
  tone,
  text,
  children,
}: {
  tone: "error" | "warning" | "ok";
  text: string;
  children?: React.ReactNode;
}) {
  const style = {
    error: "border-brick/30 from-brick/10",
    warning: "border-gold/45 from-gold/12",
    ok: "border-sage/40 from-sage/12",
  }[tone];
  const icon = {
    error: <XCircle size={20} className="text-brick" />,
    warning: <AlertTriangle size={20} className="text-gold" />,
    ok: <CheckCircle2 size={20} className="text-sage" />,
  }[tone];
  const ring = { error: "bg-brick/12", warning: "bg-gold/15", ok: "bg-sage/15" }[tone];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-linear-to-l to-cream-card px-4 py-3.5 ${style}`} data-testid={`import-verdict-${tone}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ring}`}>{icon}</span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed font-medium text-forest">{text}</p>
      {children}
    </div>
  );
}

function AnnotatedButton({
  file,
  name,
  label,
  tone,
}: {
  file: string;
  name: string;
  label: string;
  tone: "error" | "warning";
}) {
  return (
    <button
      type="button"
      data-testid="import-download-annotated"
      onClick={() => downloadBase64(file, datedName(name))}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition hover:brightness-110 ${
        tone === "error"
          ? "bg-brick text-white shadow-[0_10px_22px_-10px_rgba(168,68,45,0.9)]"
          : "bg-linear-to-l from-gold to-gold-soft text-[var(--t-brand-deep)] shadow-[0_10px_22px_-10px_rgba(193,150,90,0.9)]"
      }`}
    >
      <Download size={14} />
      {label}
    </button>
  );
}

function Section({
  icon,
  title,
  open,
  onToggle,
  testid,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  testid?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="self-start overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_8px_24px_-18px_rgba(26,49,45,0.5)]" data-testid={testid}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 bg-linear-to-l from-cream-2/80 to-cream-card px-4 py-3 text-sm font-bold text-forest"
      >
        <span className="grid size-8 place-items-center rounded-xl bg-gold/12 text-gold">{icon}</span>
        <span className="font-serif text-[15px]">{title}</span>
        <ChevronDown size={16} className={`ms-auto text-clay transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-forest/8 px-4 py-3.5">{children}</div>}
    </section>
  );
}

function Fact({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-cream-2/50 px-3 py-2 ring-1 ring-forest/8">
      <dt className="text-clay">{label}</dt>
      <dd className={`font-serif text-base font-bold tabular-nums ${muted ? "text-clay" : "text-forest"}`}>{value}</dd>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  const states: [string, string][] = [
    ["error", CELL_TONE.error],
    ["warning", CELL_TONE.warning],
    ["auto", "bg-gold/10 ring-1 ring-inset ring-gold/25"],
    ["empty", "ring-1 ring-inset ring-clay/35"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-clay" data-testid="import-legend">
      <span className="font-bold text-forest/70">{t("admin.import.legendColumns")}</span>
      {(["req", "opt", "auto"] as const).map((k) => (
        <KindPill key={k} kind={k} />
      ))}
      <span className="mx-1 h-4 w-px bg-forest/15" />
      <span className="font-bold text-forest/70">{t("admin.import.legendCells")}</span>
      {states.map(([k, tone]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3.5 w-6 rounded ${tone}`} />
          {t(`admin.import.state_${k}`)}
        </span>
      ))}
    </div>
  );
}

function RowBadge({ row }: { row: StudentImportRow }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5">
      <span className="grid min-w-7 place-items-center rounded-md bg-forest/6 px-1 font-mono text-[11px] font-bold text-forest/70 tabular-nums">{row.row}</span>
      {row.errors > 0 ? (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-brick/12 px-1.5 py-0.5 text-[10.5px] font-bold text-brick tabular-nums">
          <XCircle size={11} /> {row.errors}
        </span>
      ) : (
        <CheckCircle2 size={15} className="text-sage" />
      )}
      {row.warnings > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10.5px] font-bold text-forest tabular-nums">
          <AlertTriangle size={11} className="text-gold" /> {row.warnings}
        </span>
      )}
      {row.hidden && (
        <span title={t("admin.import.hiddenRow")} className="inline-flex">
          <EyeOff size={13} className="text-gold" aria-label={t("admin.import.hiddenRow")} />
        </span>
      )}
    </div>
  );
}

function Issues({ issues, compact }: { issues?: ImportIssue[]; compact?: boolean }) {
  if (!issues?.length) return null;
  return (
    <ul className={`space-y-0.5 ${compact ? "mt-1 max-w-72 text-[10.5px]" : "mt-1.5 text-xs"} leading-snug`}>
      {issues.map((i, n) => (
        <li
          key={n}
          className={`flex items-start gap-1 ${
            i.level === "error" ? "font-semibold text-brick" : i.level === "warning" ? "text-forest" : "text-clay"
          }`}
        >
          {i.level === "error" ? (
            <XCircle size={11} className="mt-0.5 shrink-0" />
          ) : i.level === "warning" ? (
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-gold" />
          ) : (
            <Info size={11} className="mt-0.5 shrink-0" />
          )}
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** الخانة: ما كُتب، وما سيُحفظ إن خالفه، وما قيل فيها. */
function CellView({ cell }: { cell: ImportCell }) {
  const { t } = useTranslation();
  const auto = cell.state === "auto";
  const text = auto ? (cell.saved ?? cell.value) : cell.value;
  return (
    <div className="min-w-0">
      {auto ? (
        <span className="inline-flex items-center gap-1 text-clay italic" dir="auto">
          <Sparkles size={10} className="shrink-0 text-gold" />
          {text || "—"}
        </span>
      ) : text ? (
        <span className="font-medium break-words text-forest" dir="auto">{text}</span>
      ) : cell.state === "error" ? (
        <span className="inline-flex items-center rounded-md border border-dashed border-brick/50 px-1.5 font-semibold text-brick italic">
          {t("admin.import.cellEmpty")}
        </span>
      ) : (
        <span className="text-clay/45">—</span>
      )}
      {!auto && cell.saved !== undefined && (
        <span className="mt-0.5 block text-[10.5px] font-semibold text-sage" dir="auto">
          ← {cell.saved}
        </span>
      )}
      <Issues issues={cell.issues} compact />
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg border border-forest/15 bg-cream-card text-forest transition hover:border-gold/50 hover:bg-gold/8 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** كلّ خانات الصفّ، واحدةً تحت الأخرى: ما في الملف، وما سيُحفظ، وحالها. */
function RowPanel({
  row,
  columns,
  position,
  onClose,
  onPrev,
  onNext,
}: {
  row: StudentImportRow;
  columns: ImportColumn[];
  position: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { t } = useTranslation();
  const name = [row.cells.firstName.value, row.cells.lastName.value].filter(Boolean).join(" ");
  return (
    <aside
      className="animate-[fadeIn_0.15s_ease-out] absolute inset-y-0 end-0 z-40 flex w-full max-w-md flex-col border-s border-gold/25 bg-cream-card shadow-[-24px_0_60px_-20px_rgba(10,20,17,0.55)]"
      data-testid="import-row-panel"
      aria-label={t("admin.import.rowTitle", { n: row.row })}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="forest-glow relative shrink-0 overflow-hidden px-4 py-4 text-cream">
        <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-bold">{t("admin.import.rowTitle", { n: row.row })}</p>
            <p className="truncate text-[11px] text-cream/70">
              {name || "—"} · <span className="tabular-nums">{position}</span>
            </p>
          </div>
          <PanelButton disabled={!onPrev} onClick={() => onPrev?.()} label={t("admin.import.prev")}>
            <ChevronRight size={15} className="rtl:rotate-0 ltr:rotate-180" />
          </PanelButton>
          <PanelButton disabled={!onNext} onClick={() => onNext?.()} label={t("admin.import.next")}>
            <ChevronLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
          </PanelButton>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.import.close")}
            data-testid="import-row-close"
            autoFocus
            className="grid size-8 place-items-center rounded-lg text-cream/80 ring-1 ring-cream/15 transition hover:bg-cream/15 hover:text-cream"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative mt-2.5">
          <RowBadge row={row} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-l from-gold via-gold-soft to-gold" />
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {row.issues && (
          <div className="rounded-xl border border-gold/40 bg-gold/8 px-3 py-2">
            <Issues issues={row.issues} />
          </div>
        )}
        {[...new Set(columns.map((c) => c.group))].map((g) => (
          <section key={g}>
            <h5 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gold">
              <span className="h-px flex-1 bg-gold/25" />
              {t(GROUP_KEY[g])}
              <span className="h-px flex-1 bg-gold/25" />
            </h5>
            <dl className="space-y-2">
              {columns
                .filter((c) => c.group === g)
                .map((c) => {
                  const cell = row.cells[c.key];
                  return (
                    <div key={c.key} className={`rounded-xl px-3 py-2.5 ring-1 ring-forest/8 ${CELL_TONE[cell.state]}`} data-testid={`import-field-${c.key}`}>
                      <dt className="flex flex-wrap items-center gap-1.5 text-[11px] text-clay">
                        <b className="text-[12px] text-forest">{c.header}</b>
                        <KindPill kind={c.kind} />
                        <LetterBadge letter={c.letter} />
                        <span className="ms-auto font-semibold">{t(`admin.import.state_${cell.state}`)}</span>
                      </dt>
                      <dd className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
                        <span className="text-clay">{t("admin.import.inFile")}:</span>
                        <span className="break-words text-forest" dir="auto">
                          {cell.value || <i className="text-clay">{c.letter ? t("admin.import.cellEmpty") : t("admin.import.notInFile")}</i>}
                        </span>
                        {cell.saved !== undefined && (
                          <>
                            <span className="text-clay">{t("admin.import.willSave")}:</span>
                            <span className="break-words font-semibold text-sage" dir="auto">{cell.saved}</span>
                          </>
                        )}
                      </dd>
                      <Issues issues={cell.issues} />
                    </div>
                  );
                })}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

function PanelButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-cream/85 ring-1 ring-cream/15 transition hover:bg-cream/15 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
