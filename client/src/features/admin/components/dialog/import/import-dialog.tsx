import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  Fingerprint,
  KeyRound,
  Layers,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { Stepper } from "../../../../../components/ui/stepper";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import {
  datedName,
  downloadBase64,
  downloadBlob,
} from "../../../../../lib/download";
import type {
  ImportColumn,
  ImportColumnKind,
  ImportPreviewResult,
  ImportResult,
} from "../../../../../types/admin";
import { ImportPreview } from "./import-preview";
import type { PreviewProfile } from "./import-preview.utils";
import { KindPill, LetterBadge } from "./import-ui";
import { personName } from "../../../../../lib/person-name";

type Step = "upload" | "preview" | "done";
const STEPS: Step[] = ["upload", "preview", "done"];
const MAX_BYTES = 5 * 1024 * 1024;

type HttpError = {
  response?: { data?: { message?: string; report?: ImportPreviewResult["report"]; annotatedFile?: string } };
};
const serverMessage = (e: unknown) => (e as HttpError)?.response?.data?.message;

const sizeOf = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** ما يخصّ كلّ استيرادٍ في النافذة — والنافذة نفسها واحدةٌ للطلبة والأساتذة. */
export interface ImportDialogConfig {
  /** مفاتيح النصوص الخاصّة (admin.importProf…)؛ ما لم يوجد فيها يُؤخذ من admin.import. */
  ns: string;
  files: { template: string; errors: string; accounts: string };
  fetchTemplate: () => Promise<Blob>;
  /** أعمدة الملف بترتيب النموذج — لدليل الأعمدة قبل الرفع. */
  guide: Omit<ImportColumn, "letter">[];
  /** أعمدة الورقة المصغّرة في بطاقة النموذج. */
  mock: [string, ImportColumnKind][];
  /** أعمدة جدول الحسابات بعد الاستيراد، قبل الاسم وكلمة المرور. */
  accounts: { key: string; labelKey: string }[];
  preview: PreviewProfile;
}

/** ما تحتاجه النافذة من طلبَي المعاينة والاستيراد (TanStack Query). */
export interface ImportMutation<T> {
  isPending: boolean;
  mutate: (file: File, opts: { onSuccess?: (v: T) => void; onError?: (e: unknown) => void }) => void;
}

/**
 * استيراد دفعةٍ من ملفّ Excel — للطلبة والأساتذة، بملمح كلٍّ منهما.
 *
 * ثلاث خطوات، ولا شيء يُكتب قبل الثالثة:
 *
 *   الرفع    — نموذجٌ من المنصّة، يُملأ ويُرفع.
 *   المعاينة — كلّ صفٍّ بحكمه، والخطأ في صفّه وعموده. وملفٌّ فيه خطأٌ واحد
 *              لا يُستورد منه أحد: يُنزَّل مُعلَّماً بأخطائه، يُصحَّح، ويُرفع.
 *   تمّ      — والحسابات بكلمات مرورها المولَّدة تُنزَّل مرّةً واحدة؛ فلا
 *              تُغلق النافذة قبل تنزيلها دون تنبيه.
 *
 * والنافذة بحجمٍ واحدٍ في الخطوات كلّها: جدول المعاينة يحتاج الاتّساع، ونافذةٌ
 * تكبر وتصغر بين خطوةٍ وأخرى تُفقد المسؤول مكانه.
 */
export function ImportDialog({
  open,
  onClose,
  config,
  previewM,
  importM,
}: {
  open: boolean;
  onClose: () => void;
  config: ImportDialogConfig;
  previewM: ImportMutation<ImportPreviewResult>;
  importM: ImportMutation<ImportResult>;
}) {
  const { t, i18n } = useTranslation();
  /** النصّ الخاصّ بهذا الاستيراد إن وُجد، وإلّا المشترك. */
  const tt = (key: string, opts?: Record<string, unknown>) =>
    i18n?.exists?.(`${config.ns}.${key}`) ? t(`${config.ns}.${key}`, opts) : t(`admin.import.${key}`, opts);
  useBodyScrollLock(open);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  // يتغيّر مع كلّ تقريرٍ جديد، فتبدأ المعاينة من أوّلها (تصفيتها وصفّها المختار).
  const [reportVersion, setReportVersion] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = previewM.isPending || importM.isPending;
  const generated = result?.accounts.filter((a) => a.password).length ?? 0;

  if (!open) return null;

  function reset() {
    setStep("upload");
    setFile(null);
    setProblem(null);
    setPreview(null);
    setResult(null);
    setDownloaded(false);
    setCloseArmed(false);
  }

  function close() {
    if (busy) return;
    // كلمات المرور المولَّدة لا تُرى بعد هذه النافذة: إغلاقٌ قبل تنزيلها
    // يُنبَّه عليه مرّة، والضغطة الثانية تُغلق.
    if (step === "done" && generated > 0 && !downloaded && !closeArmed) {
      setCloseArmed(true);
      return;
    }
    reset();
    onClose();
  }

  function pick(f?: File | null) {
    setProblem(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return setProblem(tt("onlyXlsx"));
    if (f.size > MAX_BYTES) return setProblem(tt("tooBig"));
    setFile(f);
  }

  async function downloadTemplate() {
    setTemplateBusy(true);
    try {
      downloadBlob(await config.fetchTemplate(), config.files.template);
    } catch {
      setProblem(tt("templateFailed"));
    } finally {
      setTemplateBusy(false);
    }
  }

  function runPreview() {
    if (!file) return;
    setProblem(null);
    previewM.mutate(file, {
      onSuccess: (p) => {
        setPreview(p);
        setReportVersion((v) => v + 1);
        setStep("preview");
      },
      onError: (e) => setProblem(serverMessage(e) ?? tt("previewFailed")),
    });
  }

  function runImport() {
    if (!file) return;
    setProblem(null);
    importM.mutate(file, {
      onSuccess: (r) => {
        setResult(r);
        setStep("done");
      },
      onError: (e) => {
        // تغيّرت المنصّة بين المعاينة والاستيراد (سبق أحدٌ إلى رقمٍ مثلاً):
        // التقرير الجديد يحلّ محلّ القديم، ولم يُنشأ أحد.
        const data = (e as HttpError)?.response?.data;
        if (data?.report) {
          setPreview({ report: data.report, annotatedFile: data.annotatedFile });
          setReportVersion((v) => v + 1);
        }
        setProblem(serverMessage(e) ?? tt("importFailed"));
      },
    });
  }

  function backToUpload(clearFile: boolean) {
    setStep("upload");
    setPreview(null);
    setProblem(null);
    if (clearFile) setFile(null);
  }

  const report = preview?.report;
  const canImport =
    !!report && report.fileErrors.length === 0 && report.summary.invalid === 0 && report.summary.total > 0;
  const index = STEPS.indexOf(step);
  const notice = problem && (
    <p role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-brick/30 bg-brick/8 px-4 py-3 text-sm font-medium text-brick shadow-[0_6px_18px_-10px_rgba(168,68,45,0.5)]">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      {problem}
    </p>
  );

  return createPortal(
    <div className="fixed inset-0 z-60 grid place-items-center p-3 font-body sm:p-5" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div onClick={close} className="absolute inset-0 bg-forest-deep/60 backdrop-blur-md" />

      <div className="animate-scale-in relative flex h-[min(94vh,980px)] w-full max-w-[min(96vw,1560px)] flex-col overflow-hidden rounded-[28px] border border-gold/20 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.75)] ring-1 ring-black/5">
        {/* ── header ── */}
        <header className="forest-glow relative shrink-0 overflow-hidden px-7 py-5 text-cream">
          <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
          <div aria-hidden className="pointer-events-none absolute -top-24 start-1/3 size-64 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_10px_28px_rgba(193,150,90,0.45)] ring-1 ring-white/30">
              <FileSpreadsheet size={27} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold-soft/90 uppercase">
                {tt("kicker")}
              </p>
              <h3 id="import-title" className="truncate font-serif text-2xl font-bold">
                {tt("title")}
              </h3>
              <p className="text-xs text-cream/70">{tt("subtitle")}</p>
            </div>
            {file && step !== "done" && (
              <span className="hidden max-w-72 items-center gap-2 rounded-xl bg-cream/10 px-3 py-2 text-xs text-cream ring-1 ring-cream/15 md:inline-flex" data-testid="import-header-file">
                <FileSpreadsheet size={15} className="shrink-0 text-gold-soft" />
                <span className="truncate font-semibold" dir="ltr">{file.name}</span>
                <span className="shrink-0 text-cream/60">{sizeOf(file.size)}</span>
              </span>
            )}
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label={tt("close")}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-cream/80 ring-1 ring-cream/15 transition hover:bg-cream/15 hover:text-cream disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
        </header>

        <div className="shrink-0 border-b border-forest/10 bg-linear-to-b from-cream-2/80 to-cream-card px-8 py-3.5">
          <div className="mx-auto max-w-3xl">
            <Stepper
              steps={STEPS.map((s) => ({
                key: s,
                label: tt(`step_${s}`),
              }))}
              current={index}
              // الرجوع من المعاينة إلى الرفع وحده: بعد الاستيراد لا رجوع.
              onGo={step === "preview" && !busy ? () => backToUpload(false) : undefined}
              ariaLabel={tt("title")}
            />
          </div>
        </div>

        {/* ── body ── */}
        <div className="relative min-h-0 flex-1 bg-cream-card">
          {step === "preview" && report && (
            <ImportPreview
              key={reportVersion}
              report={report}
              annotatedFile={preview?.annotatedFile}
              notice={notice}
              importing={importM.isPending}
              profile={config.preview}
              annotatedName={config.files.errors}
            />
          )}

          {step === "upload" && (
            <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
              {notice}
              <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col gap-4">
                  {/* ١ — النموذج */}
                  <section className="relative shrink-0 overflow-hidden rounded-3xl border border-forest/10 bg-linear-to-bl from-gold/10 via-cream-card to-cream-card p-5 shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <StepNumber n={1} />
                        <h4 className="mt-2.5 font-serif text-xl font-bold text-forest">{tt("templateTitle")}</h4>
                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-clay">{tt("templateBody")}</p>
                        <button
                          type="button"
                          onClick={downloadTemplate}
                          disabled={templateBusy}
                          data-testid="import-template"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft px-5 py-2.5 text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_10px_24px_-8px_rgba(193,150,90,0.7)] transition hover:brightness-105 disabled:opacity-60"
                        >
                          {templateBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          {tt("templateButton")}
                        </button>
                      </div>
                      <SheetMock cols={config.mock} />
                    </div>
                  </section>

                  {/* ٢ — الرفع */}
                  <section className="flex min-h-56 flex-1 flex-col rounded-3xl border border-forest/10 bg-cream-card p-5 shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
                    <div className="mb-3 flex items-center gap-3">
                      <StepNumber n={2} />
                      <h4 className="font-serif text-xl font-bold text-forest">{tt("uploadTitle")}</h4>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      data-testid="import-dropzone"
                      onClick={() => inputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          inputRef.current?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        pick(e.dataTransfer.files?.[0]);
                      }}
                      className={`group relative flex min-h-36 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-6 transition outline-none focus-visible:ring-4 focus-visible:ring-gold/30 ${
                        dragging
                          ? "scale-[1.01] border-gold bg-gold/10"
                          : file
                            ? "border-sage/50 bg-sage/6"
                            : "border-forest/20 bg-cream-2/50 hover:border-gold/60 hover:bg-gold/5"
                      }`}
                    >
                      <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
                      {file ? (
                        <div className="relative flex w-full max-w-xl items-center gap-4 rounded-2xl bg-cream-card/90 p-4 text-start shadow-[0_10px_26px_-18px_rgba(26,49,45,0.7)] ring-1 ring-sage/35">
                          <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-sage/15 text-sage ring-4 ring-sage/8">
                            <FileSpreadsheet size={30} />
                            <CheckCircle2 size={18} className="absolute -end-1.5 -bottom-1.5 rounded-full bg-cream-card text-sage" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold text-forest" data-testid="import-file-name">
                              <bdi>{file.name}</bdi>
                            </p>
                            <p className="mt-0.5 text-xs text-clay">
                              {sizeOf(file.size)} · {tt("change")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFile(null);
                            }}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-brick ring-1 ring-brick/25 transition hover:bg-brick/10"
                          >
                            <Trash2 size={13} />
                            {tt("removeFile")}
                          </button>
                        </div>
                      ) : (
                        <div className="relative flex items-center gap-5 text-start">
                          <span className="animate-float grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold/25 to-gold/5 text-gold ring-8 ring-gold/8 transition group-hover:ring-gold/15">
                            <Upload size={28} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-base font-bold text-forest">{tt("dropHint")}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-clay">
                              {(["limitFormat", "limitSize", "limitRows"] as const).map((k) => (
                                <span key={k} className="rounded-full bg-cream-card px-3 py-1 ring-1 ring-forest/10">
                                  {tt(`${k}`)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      data-testid="import-file-input"
                      onChange={(e) => {
                        pick(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </section>

                  <ul className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {(
                      [
                        ["ruleAll", Layers],
                        ["rulePreview", Eye],
                        ["rulePasswords", KeyRound],
                        ["ruleExisting", Fingerprint],
                      ] as const
                    ).map(([k, Icon]) => (
                      <li key={k} className="flex items-start gap-3 rounded-2xl border border-forest/8 bg-cream-2/50 px-4 py-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
                          <Icon size={16} />
                        </span>
                        <p className="text-[11.5px] leading-relaxed text-forest/80">{tt(`${k}`)}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <ColumnGuide guide={config.guide} tt={tt} />
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="h-full overflow-y-auto px-6 py-6 lg:px-8" data-testid="import-done">
              {notice}
              <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="flex min-h-0 flex-col overflow-y-auto rounded-3xl border border-forest/10 bg-linear-to-b from-sage/10 via-cream-card to-cream-card px-6 py-6 text-center">
                  <div className="m-auto flex w-full flex-col items-center gap-4">
                    <div className="animate-scale-in relative grid size-24 place-items-center rounded-full bg-linear-to-br from-sage/35 to-sage/5 ring-[10px] ring-gold/15">
                      <div aria-hidden className="absolute inset-0 rounded-full shadow-[0_0_60px_rgba(143,179,168,0.45)]" />
                      <CheckCircle2 size={48} className="relative text-sage" />
                    </div>
                    <div>
                      <h4 className="font-serif text-3xl font-bold text-forest">{tt("doneTitle")}</h4>
                      <p className="mt-2 text-sm text-clay">
                        <b className="font-serif text-4xl text-forest tabular-nums">{result.created}</b>{" "}
                        {tt("doneCount")}
                      </p>
                      <p className="mt-1 text-xs text-clay">{tt("doneBody")}</p>
                    </div>

                    <div className="grid w-full max-w-md grid-cols-2 gap-3">
                      <MiniStat icon={<KeyRound size={15} />} label={tt("statGenerated")} value={generated} />
                      <MiniStat icon={<UserCheck size={15} />} label={tt("statFromFile")} value={result.accounts.length - generated} />
                    </div>

                    <div className={`w-full max-w-md rounded-2xl border p-5 text-start ${generated ? "border-gold/50 bg-gold/8 shadow-[0_14px_30px_-18px_rgba(193,150,90,0.8)]" : "border-forest/10 bg-cream-2/60"}`}>
                      {generated > 0 && (
                        <p className="mb-1 flex items-center gap-2 text-sm font-bold text-forest">
                          <KeyRound size={16} className="text-gold" />
                          {tt("passwordsTitle", { count: generated })}
                        </p>
                      )}
                      <p className="mb-4 text-xs leading-relaxed text-clay">
                        {generated > 0 ? tt("passwordsBody") : tt("accountsBody")}
                      </p>
                      <button
                        type="button"
                        data-testid="import-download-accounts"
                        onClick={() => {
                          downloadBase64(result.accountsFile, datedName(config.files.accounts));
                          setDownloaded(true);
                          setCloseArmed(false);
                        }}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                          downloaded
                            ? "bg-sage/15 text-sage ring-1 ring-sage/40"
                            : "bg-linear-to-l from-gold to-gold-soft text-[var(--t-brand-deep)] shadow-[0_10px_24px_-8px_rgba(193,150,90,0.7)] hover:brightness-105"
                        }`}
                      >
                        {downloaded ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        {downloaded ? tt("downloadedOk") : tt("downloadAccounts")}
                      </button>
                    </div>

                    {closeArmed && (
                      <div role="alert" className="flex w-full max-w-md flex-wrap items-center gap-3 rounded-2xl border border-brick/30 bg-brick/5 px-4 py-3 text-start">
                        <AlertTriangle size={17} className="shrink-0 text-brick" />
                        <p className="min-w-0 flex-1 text-sm font-medium text-brick">{tt("closeWarning")}</p>
                        <button
                          type="button"
                          data-testid="import-close-anyway"
                          onClick={() => {
                            reset();
                            onClose();
                          }}
                          className="rounded-xl border border-brick/40 px-3 py-1.5 text-xs font-semibold text-brick transition hover:bg-brick/10"
                        >
                          {tt("closeAnyway")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <section className="flex min-h-80 flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
                  <header className="flex items-center gap-3 border-b border-forest/10 bg-cream-2/50 px-5 py-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-gold/12 text-gold">
                      <UserCheck size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-serif text-base font-bold text-forest">{tt("accountsTitle")}</h5>
                      <p className="text-[11px] text-clay">{tt("accountsHint")}</p>
                    </div>
                    <span className="rounded-full bg-forest/6 px-3 py-1 font-serif text-sm font-bold text-forest tabular-nums">
                      {result.accounts.length}
                    </span>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <table className="w-full text-start text-sm" data-testid="import-accounts">
                      <thead className="sticky top-0 bg-forest-deep text-cream">
                        <tr>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold">#</th>
                          {config.accounts.map((c) => (
                            <th key={c.key} className="px-4 py-2.5 text-start text-[11px] font-semibold">
                              {t(`admin.import.${c.labelKey}`)}
                            </th>
                          ))}
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold">{t("admin.import.accName")}</th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold">{t("admin.import.accPassword")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-forest/8">
                        {result.accounts.map((a, i) => (
                          <tr key={String(a[config.accounts[0]!.key])} className="transition hover:bg-gold/5">
                            <td className="px-4 py-2.5 font-mono text-[11px] text-clay tabular-nums">{i + 1}</td>
                            {config.accounts.map((c) => (
                              <td key={c.key} className="px-4 py-2.5 font-mono text-xs font-semibold text-forest" dir="ltr">
                                {a[c.key]}
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-forest">{personName(a) || "—"}</td>
                            <td className="px-4 py-2.5">
                              {a.password ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-forest ring-1 ring-gold/40">
                                  <KeyRound size={11} className="text-gold" />
                                  {tt("pwGenerated")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sage/12 px-2.5 py-0.5 text-[11px] font-bold text-sage ring-1 ring-sage/35">
                                  {tt("pwFromFile")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* ── footer ── */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-forest/10 bg-linear-to-t from-cream-2/80 to-cream-card px-7 py-3.5">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-clay">
            <span className="flex gap-1" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-gold" : i < index ? "w-3 bg-sage/60" : "w-3 bg-forest/12"}`} />
              ))}
            </span>
            {tt("stepOf", { n: index + 1, total: STEPS.length })}
          </span>
          <div className="flex items-center gap-2">
            {step === "upload" && (
              <>
                <button type="button" onClick={close} className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5">
                  {t("admin.cancel")}
                </button>
                <PrimaryButton onClick={runPreview} disabled={!file || busy} testid="import-preview" busy={previewM.isPending}>
                  <Eye size={16} />
                  {tt("previewButton")}
                </PrimaryButton>
              </>
            )}
            {step === "preview" && (
              <>
                <button
                  type="button"
                  onClick={() => backToUpload(true)}
                  disabled={busy}
                  data-testid="import-upload-fixed"
                  className="inline-flex items-center gap-2 rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
                >
                  <RotateCcw size={15} />
                  {tt("uploadFixed")}
                </button>
                <PrimaryButton onClick={runImport} disabled={!canImport || busy} testid="import-submit" busy={importM.isPending}>
                  <UserCheck size={16} />
                  {tt("importButton", { count: report?.summary.valid ?? 0 })}
                </PrimaryButton>
              </>
            )}
            {step === "done" && (
              <button
                type="button"
                onClick={close}
                data-testid="import-finish"
                className="rounded-xl bg-forest px-6 py-2.5 text-sm font-bold text-cream shadow-[0_10px_24px_-10px_rgba(26,49,45,0.8)] transition hover:bg-forest-deep"
              >
                {tt("close")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-gold-soft to-gold font-serif text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_6px_16px_-6px_rgba(193,150,90,0.8)]">
      {n}
    </span>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  testid,
  busy,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  testid: string;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className="inline-flex items-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_10px_24px_-8px_rgba(193,150,90,0.7)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-forest/10 bg-cream-card px-4 py-3 text-start">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-clay">
        <span className="text-gold">{icon}</span>
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-bold text-forest tabular-nums">{value}</p>
    </div>
  );
}

/** ورقةٌ مصغّرة للنموذج — تُري قبل التنزيل ألوان أعمدته الثلاثة. */
function SheetMock({ cols }: { cols: [string, ImportColumnKind][] }) {
  const tone: Record<ImportColumnKind, string> = {
    req: "bg-forest text-cream",
    opt: "bg-sage/80 text-white",
    auto: "bg-gold/20 text-gold",
  };
  return (
    <div aria-hidden className="relative hidden w-72 shrink-0 sm:block">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-gold/15 blur-[2px]" />
      <div className="relative -rotate-2 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_18px_40px_-18px_rgba(26,49,45,0.55)]">
        <div className="flex items-center gap-1.5 border-b border-forest/8 bg-cream-2/70 px-3 py-2">
          <span className="size-2 rounded-full bg-brick/60" />
          <span className="size-2 rounded-full bg-gold/70" />
          <span className="size-2 rounded-full bg-sage/70" />
          <span className="ms-2 font-mono text-[9px] text-clay" dir="ltr">students-import.xlsx</span>
        </div>
        <div className="grid grid-cols-4 gap-px bg-forest/8 text-[9px] font-bold">
          {cols.map(([h, k]) => (
            <span key={h} className={`truncate px-1.5 py-1.5 text-center ${tone[k]}`}>
              {h}
            </span>
          ))}
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={`h-5 px-1.5 py-1.5 ${i % 4 === 3 ? "bg-gold/8" : "bg-cream-card"}`}>
              <span className={`block h-1.5 rounded-full ${i % 4 === 3 ? "w-3/4 bg-gold/30" : i % 3 ? "w-2/3 bg-forest/12" : "w-1/2 bg-forest/15"}`} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const GROUP_KEY: Record<ImportColumn["group"], string> = {
  personal: "admin.import.groupPersonal",
  academic: "admin.import.groupAcademic",
  professional: "admin.import.groupProfessional",
};

/** أعمدة الملف قبل الرفع: ترتيبها ونوعها وما يُكتب فيها. */
function ColumnGuide({
  guide,
  tt,
}: {
  guide: Omit<ImportColumn, "letter">[];
  tt: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { t } = useTranslation();
  const count = (k: ImportColumnKind) => guide.filter((c) => c.kind === k).length;
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]" data-testid="import-column-guide">
      <header className="forest-glow relative overflow-hidden px-5 py-4 text-cream">
        <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-cream/10 text-gold-soft ring-1 ring-cream/15">
            <Columns3 size={19} />
          </span>
          <div className="min-w-0">
            <h4 className="font-serif text-lg font-bold">{tt("guideTitle")}</h4>
            <p className="text-[11px] text-cream/70">{tt("guideBody")}</p>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {(["req", "opt", "auto"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-cream/80">
              <KindPill kind={k} onBrand />
              <b className="tabular-nums">{count(k)}</b>
            </span>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {[...new Set(guide.map((c) => c.group))].map((g) => (
          <section key={g} className="mb-4 last:mb-0">
            <h5 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gold">
              <span className="h-px flex-1 bg-gold/25" />
              {t(GROUP_KEY[g])}
              <span className="h-px flex-1 bg-gold/25" />
            </h5>
            <ol className="space-y-1.5">
              {guide.map((c, i) => ({ c, letter: String.fromCharCode(65 + i) }))
                .filter(({ c }) => c.group === g)
                .map(({ c, letter }) => (
                  <li key={c.key} className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition hover:bg-cream-2/60">
                    <LetterBadge letter={letter} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-forest">
                        {c.header}
                        <KindPill kind={c.kind} />
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-clay">{tt(`colNote_${c.key}`)}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}
