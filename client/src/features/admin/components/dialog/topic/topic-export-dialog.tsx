import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  CircleCheckBig,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Hash,
  Landmark,
  Languages,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  ScrollText,
  Shapes,
  Tag,
  Type,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { TOPIC_EXPORT_COLUMNS, type TopicExportColumn, type TopicExportParams } from "../../../../../types/admin";
import { adminApi } from "../../../api/admin.api";
import { ChoiceCard } from "../../../../../components/ui/choice-card";
import { Stepper } from "../../../../../components/ui/stepper";
import { LoadingArea } from "../../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../../components/ui/error-retry";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { blobErrorMessage, downloadBlob } from "../../../../../lib/download";
import { SheetPreviewView } from "./sheet-preview";

type Students = TopicExportParams["students"];
type FileLang = NonNullable<TopicExportParams["lang"]>;

/** The administrator's last choice of language and columns, kept in this browser. */
const PREFS = "admin.topicExport.prefs";
function readPrefs(): { lang?: FileLang; columns?: TopicExportColumn[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return {
      lang: ["ar", "en", "fr"].includes(raw.lang) ? raw.lang : undefined,
      columns: Array.isArray(raw.columns) ? raw.columns.filter((c: string) => (TOPIC_EXPORT_COLUMNS as readonly string[]).includes(c)) : undefined,
    };
  } catch {
    return {};
  }
}
function writePrefs(prefs: { lang: FileLang; columns: TopicExportColumn[] }) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    /* a private window: the choice is simply not remembered */
  }
}

/** Each optional column: its label key (admin.topicExport) and its icon. */
const COLUMN: Record<TopicExportColumn, { label: string; icon: LucideIcon }> = {
  supervisor: { label: "colSupervisor", icon: UserRound },
  coSupervisor: { label: "colCoSupervisor", icon: UserPlus },
  summary: { label: "colSummary", icon: ScrollText },
  type: { label: "colType", icon: Tag },
  capacity: { label: "colCapacity", icon: Gauge },
  status: { label: "colStatus", icon: CircleCheckBig },
  faculty: { label: "colFaculty", icon: Building2 },
  department: { label: "colDepartment", icon: Landmark },
  filiere: { label: "colFiliere", icon: Shapes },
  level: { label: "colLevel", icon: GraduationCap },
  specialization: { label: "colSpecialization", icon: Layers },
  year: { label: "colYear", icon: CalendarRange },
};

/** The columns, by what they tell of a topic. */
const GROUPS: { key: string; columns: TopicExportColumn[] }[] = [
  { key: "groupPeople", columns: ["supervisor", "coSupervisor"] },
  { key: "groupContent", columns: ["summary", "type"] },
  { key: "groupState", columns: ["capacity", "status"] },
  { key: "groupPlace", columns: ["faculty", "department", "filiere", "level", "specialization", "year"] },
];

const LANGS: { key: FileLang; glyph: string }[] = [
  { key: "ar", glyph: "ع" },
  { key: "en", glyph: "En" },
  { key: "fr", glyph: "Fr" },
];

interface Props {
  /** فلاتر الصفحة لحظة الفتح — ما يراه المسؤول في الجدول هو ما يُنزَّل. */
  scope: Omit<TopicExportParams, "students">;
  /** أسماء تلك الفلاتر، شاراتٍ: الحالة، والأستاذ، والهرم، والبحث. */
  chips: string[];
  /** عدد مواضيع الجدول بفلاتره — والتصدير يقرأ الشرط نفسه. */
  count: number | undefined;
  /** سنة الصفحة؛ بلا سنة ⇒ كلّ السنوات، ولكلّ موضوعٍ سنته في عمود. */
  yearTitle?: string;
  onClose: () => void;
}

/**
 * تنزيل المواضيع في ملفّ Excel — في ثلاث مراحل.
 *
 * ١. **الإعداد**: أيحمل الملف طلبة كلّ موضوع، وبأيّ لغة يُكتب (العربية أو
 *    الإنجليزية أو الفرنسية)، وأيّ أعمدته تظهر — مجموعةً بما تقوله عن الموضوع،
 *    و«#» والعنوان ثابتان. ويُذكر الاختياران الأخيران لمرّةٍ قادمة.
 * ٢. **المعاينة**: الملف كما سيُفتح في Excel — يصفه الخادم بقواعد الملف نفسها،
 *    فلا تختلف المعاينة عنه — لأوّل صفوفه.
 * ٣. **التنزيل**: ملخّصه، ثمّ الملف.
 *
 * ولا فلاتر هنا: النطاق نطاق الجدول، يُرى قبل التنزيل (عدده وشاراته)
 * ويُغيَّر من الصفحة.
 */
export function TopicExportDialog({ scope, chips, count, yearTitle, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`admin.topicExport.${k}`, o);
  useBodyScrollLock(true);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [students, setStudents] = useState<Students>("without");
  // The file's language: the last one chosen, else the screen's.
  const [lang, setLang] = useState<FileLang>(() => readPrefs().lang ?? ((["ar", "en", "fr"].includes(i18n.language) ? i18n.language : "ar") as FileLang));
  const [picked, setPicked] = useState<Set<TopicExportColumn>>(() => new Set(readPrefs().columns ?? TOPIC_EXPORT_COLUMNS));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // The previewed sheet: one per level in the file.
  const [sheet, setSheet] = useState(0);
  const withStudents = students === "with";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // The year has a column only when the page spans all years.
  const optional = TOPIC_EXPORT_COLUMNS.filter((c) => c !== "year" || !yearTitle);
  const columnsParam = optional.filter((c) => picked.has(c)).join(",");
  // The preview's key is hashed by value: a new object each render asks for nothing new.
  const params: TopicExportParams = { ...scope, students, lang, columns: columnsParam };
  const fileName = tt(withStudents ? "fileNameWith" : "fileName", { date: new Date().toISOString().slice(0, 10) });

  // Stage two: the file as it will open, built by the server from these very choices.
  const preview = useQuery({
    queryKey: ["admin", "topic-export-preview", params],
    queryFn: () => adminApi.previewTopicsExport(params),
    enabled: step >= 1,
    staleTime: 30_000,
  });

  // A sheet for each level; the one shown, kept within them when their number changes.
  const sheets = preview.data?.sheets ?? [];
  const shown = sheets[Math.min(sheet, sheets.length - 1)];

  const toggle = (c: TopicExportColumn) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const setAll = (on: boolean) => setPicked(on ? new Set(TOPIC_EXPORT_COLUMNS) : new Set());

  async function download() {
    setBusy(true);
    try {
      // Remembered as chosen; sent as shown (no year column for a page of one year).
      writePrefs({ lang, columns: TOPIC_EXPORT_COLUMNS.filter((c) => picked.has(c)) });
      const blob = await adminApi.exportTopics(params);
      downloadBlob(blob, fileName);
      toast.success(tt("done"));
      setDone(true);
    } catch (e) {
      toast.error(await blobErrorMessage(e, tt("failed")));
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { key: "setup", label: tt("stepSetup") },
    { key: "preview", label: tt("stepPreview") },
    { key: "download", label: tt("stepDownload") },
  ];
  // «#» and the title, and those chosen; the students' columns are counted apart.
  const columnsCount = 2 + (columnsParam ? columnsParam.split(",").length : 0);

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-3 font-body sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-export-title"
    >
      <div onClick={() => !busy && onClose()} className="absolute inset-0 bg-forest-deep/65 backdrop-blur-md" />

      <div className="animate-scale-in relative flex h-[min(94dvh,880px)] w-full max-w-[min(96vw,1180px)] flex-col overflow-hidden rounded-[30px] border border-gold/25 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.8)] ring-1 ring-black/5">
        {/* ── الرأس ── */}
        <header className="forest-glow relative shrink-0 overflow-hidden px-7 pt-5 pb-4 text-cream">
          <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
          <div aria-hidden className="pointer-events-none absolute -top-24 start-1/3 size-72 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_10px_28px_rgba(193,150,90,0.45)] ring-1 ring-white/30">
              <FileDown size={27} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold-soft/90 uppercase">{tt("kicker")}</p>
              <h3 id="topic-export-title" className="truncate font-serif text-2xl font-bold">
                {tt("title")}
              </h3>
              <p className="truncate text-xs text-cream/70">{tt("subtitle")}</p>
            </div>
            {/* What is in the file, whichever the stage. */}
            <div className="shrink-0 text-end" aria-live="polite">
              <p className="flex items-center justify-end gap-2 font-serif text-2xl font-bold" data-testid="topic-export-count">
                {count === undefined ? <Loader2 size={20} className="animate-spin text-gold-soft" /> : tt("count", { count })}
              </p>
              <p className="text-[11px] text-cream/65">{yearTitle ? tt("ofYear", { year: yearTitle }) : tt("allYears")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={tt("close")}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-cream/80 ring-1 ring-cream/15 transition hover:bg-cream/15 hover:text-cream disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5" data-testid="topic-export-scope">
            {(chips.length ? chips : [tt("scopeAll")]).map((s, i) => (
              <span key={i} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white/85 ring-1 ring-white/10">
                {s}
              </span>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
        </header>

        {/* ── المراحل ── */}
        <div className="shrink-0 border-b border-forest/10 bg-cream px-7 py-3.5">
          <Stepper steps={steps} current={step} onGo={(i) => !busy && setStep(i as 0 | 1 | 2)} ariaLabel={tt("title")} />
        </div>

        {/* ── الجسم ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-7">
          {step === 0 && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" data-testid="topic-export-setup">
              <div className="space-y-5">
                <Panel icon={ListChecks} title={tt("whatTitle")}>
                  <div role="radiogroup" aria-label={tt("whatTitle")} className="grid gap-2.5">
                    <ChoiceCard icon={ListChecks} title={tt("without")} hint={tt("withoutHint")} on={!withStudents} onPick={() => setStudents("without")} testId="topic-export-without" />
                    <ChoiceCard icon={Users} title={tt("with")} hint={tt("withHint")} on={withStudents} onPick={() => setStudents("with")} testId="topic-export-with" />
                  </div>
                </Panel>

                <Panel icon={Languages} title={tt("langTitle")} hint={tt("langHint")}>
                  <div role="radiogroup" aria-label={tt("langTitle")} className="grid grid-cols-3 gap-2.5">
                    {LANGS.map(({ key, glyph }) => {
                      const on = lang === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-testid={`topic-export-lang-${key}`}
                          onClick={() => setLang(key)}
                          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 text-center transition ${
                            on
                              ? "border-gold bg-linear-to-b from-gold/15 to-gold/5 shadow-[0_10px_24px_-14px_rgba(193,150,90,0.9)] ring-2 ring-gold/25"
                              : "border-forest/12 bg-cream hover:-translate-y-0.5 hover:border-gold/40"
                          }`}
                        >
                          {on && (
                            <span className="absolute end-2 top-2 grid size-[18px] place-items-center rounded-full bg-gold text-forest-deep">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                          <span className={`grid size-11 place-items-center rounded-xl font-serif text-lg font-bold ${on ? "bg-gold text-forest-deep" : "bg-forest/6 text-forest/70"}`}>
                            {glyph}
                          </span>
                          <span className="text-[13px] font-bold text-forest">{tt(`lang_${key}`)}</span>
                          <span className="text-[10.5px] text-clay">{tt(key === "ar" ? "dirRtl" : "dirLtr")}</span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>
              </div>

              <Panel
                icon={FileSpreadsheet}
                title={tt("columnsTitle")}
                hint={tt("columnsHint")}
                aside={
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-gold/12 px-2.5 py-1 text-[11px] font-bold text-gold tabular-nums" data-testid="topic-export-columns-count">
                      {tt("columnsCount", { count: columnsCount })}
                    </span>
                    <button type="button" onClick={() => setAll(true)} className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-forest/75 transition hover:bg-forest/6 hover:text-forest">
                      {tt("all")}
                    </button>
                    <button type="button" onClick={() => setAll(false)} className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-forest/75 transition hover:bg-forest/6 hover:text-forest">
                      {tt("none")}
                    </button>
                  </div>
                }
              >
                {/* Always there: what a topic is known by — and its students, when asked for. */}
                <ColumnGroup title={tt("groupFixed")}>
                  <ColumnTile icon={Hash} label={tt("colCode")} locked />
                  <ColumnTile icon={Type} label={tt("colTitle")} locked />
                  {withStudents && <ColumnTile icon={Users} label={tt("colStudentsAll")} locked />}
                </ColumnGroup>
                {GROUPS.map((g) => {
                  const cols = g.columns.filter((c) => optional.includes(c));
                  if (!cols.length) return null;
                  return (
                    <ColumnGroup key={g.key} title={tt(g.key)}>
                      {cols.map((c) => (
                        <ColumnTile key={c} icon={COLUMN[c].icon} label={tt(COLUMN[c].label)} on={picked.has(c)} onToggle={() => toggle(c)} testId={`topic-export-col-${c}`} />
                      ))}
                    </ColumnGroup>
                  );
                })}
              </Panel>
            </div>
          )}

          {step === 1 && (
            <div className="flex h-full min-h-[420px] flex-col gap-3" data-testid="topic-export-preview">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13px] font-bold text-forest">
                  <Eye size={16} className="text-gold" />
                  {tt("previewTitle")}
                </p>
                {shown && (
                  <p className="text-[12px] text-clay" data-testid="topic-export-preview-meta">
                    {tt("previewMeta", { shown: shown.rows.length, total: shown.total, columns: shown.columns.length })}
                  </p>
                )}
              </div>
              <div className="min-h-0 flex-1">
                {preview.isLoading ? (
                  <LoadingArea className="py-24" label={tt("previewLoading")} />
                ) : preview.isError ? (
                  <ErrorRetry compact title={tt("previewFailed")} onRetry={() => preview.refetch()} />
                ) : shown ? (
                  <SheetPreviewView
                    preview={shown}
                    fileName={fileName}
                    moreLabel={shown.total > shown.rows.length ? tt("previewMore", { count: shown.total - shown.rows.length }) : undefined}
                    sheets={preview.data!.sheets.map((s) => s.name)}
                    onSheet={setSheet}
                  />
                ) : null}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto grid max-w-2xl gap-5 py-2" data-testid="topic-export-final">
              <div className="relative overflow-hidden rounded-3xl p-6 text-cream shadow-[0_24px_60px_-28px_rgba(10,20,17,0.9)]" style={{ backgroundColor: "var(--t-brand-deep)" }}>
                <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
                <div aria-hidden className="pointer-events-none absolute -start-10 -bottom-20 size-64 rounded-full bg-gold/15 blur-3xl" />
                <div className="relative flex items-center gap-4">
                  <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ring-1 ring-white/15 ${done ? "bg-emerald-400/20 text-emerald-300" : "bg-gold/20 text-gold-soft"}`}>
                    {done ? <CircleCheckBig size={30} /> : <FileSpreadsheet size={30} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-gold-soft">{tt(done ? "doneKicker" : "readyKicker")}</p>
                    <p className="mt-0.5 truncate font-serif text-xl font-bold" dir="auto" data-testid="topic-export-filename">
                      {fileName}
                    </p>
                  </div>
                </div>
                <dl className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Fact label={tt("factTopics")} value={count ?? "…"} />
                  <Fact label={tt("factLang")} value={tt(`lang_${lang}`)} />
                  <Fact label={tt("factColumns")} value={columnsCount} />
                  <Fact label={tt("factStudents")} value={tt(withStudents ? "yes" : "no")} />
                </dl>
              </div>

              <button
                type="button"
                onClick={download}
                disabled={busy || !count}
                data-testid="topic-export-download"
                className="group mx-auto inline-flex items-center gap-3 rounded-2xl bg-linear-to-br from-gold to-gold-soft px-10 py-4 text-base font-bold text-[#1a312d] shadow-[0_18px_40px_-14px_rgba(193,150,90,0.95)] transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} className="transition group-hover:translate-y-0.5" />}
                {busy ? tt("downloading") : done ? tt("downloadAgain") : tt("download")}
              </button>
              <p className="text-center text-[12px] text-clay">{tt("footerHint")}</p>
            </div>
          )}
        </div>

        {/* ── التذييل ── */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-7 py-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => (s - 1) as 0 | 1 | 2))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
          >
            {step === 0 ? (
              tt("cancel")
            ) : (
              <>
                <ArrowRight size={16} className="ltr:rotate-180" />
                {tt("back")}
              </>
            )}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
              disabled={!count || (step === 1 && !preview.data)}
              data-testid="topic-export-next"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 0 ? tt("toPreview") : tt("toDownload")}
              <ArrowLeft size={16} className="ltr:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl bg-forest px-6 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest/90 disabled:opacity-50"
            >
              {tt("close")}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Panel({ icon: Icon, title, hint, aside, children }: { icon: LucideIcon; title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-forest/10 bg-linear-to-bl from-gold/8 via-cream-card to-cream-card p-5 shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
            <Icon size={18} className="text-gold" />
            {title}
          </h4>
          {hint && <p className="mt-0.5 text-[11.5px] text-clay">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ColumnGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3.5 last:mb-0">
      <p className="mb-2 text-[11px] font-bold tracking-wide text-clay">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

/** A column: on (gold, ticked), off (pale, dashed), or always there (locked). */
function ColumnTile({
  icon: Icon,
  label,
  on = true,
  locked,
  onToggle,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  on?: boolean;
  locked?: boolean;
  onToggle?: () => void;
  testId?: string;
}) {
  const base = "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition";
  const inner = (
    <>
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${locked ? "bg-forest/8 text-forest/60" : on ? "bg-gold text-forest-deep" : "bg-forest/5 text-clay/70"}`}>
        <Icon size={15} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[12.5px] font-semibold ${on || locked ? "text-forest" : "text-clay"}`}>{label}</span>
      {locked ? (
        <Lock size={13} className="shrink-0 text-forest/35" />
      ) : (
        <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-gold bg-gold text-forest-deep" : "border-forest/20"}`}>
          {on && <Check size={11} strokeWidth={3} />}
        </span>
      )}
    </>
  );
  if (locked)
    return (
      <span className={`${base} border-forest/10 bg-forest/[0.03]`} title={label}>
        {inner}
      </span>
    );
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      data-testid={testId}
      className={`${base} ${on ? "border-gold/60 bg-gold/8 shadow-[0_6px_16px_-12px_rgba(193,150,90,0.9)]" : "border-dashed border-forest/20 bg-cream hover:border-gold/40"}`}
    >
      {inner}
    </button>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10">
      <dt className="text-[10.5px] text-white/60">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-bold text-cream">{value}</dd>
    </div>
  );
}
