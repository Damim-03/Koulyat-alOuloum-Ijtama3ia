import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  Ban,
  BookText,
  CalendarDays,
  FileCheck2,
  FilePen,
  GraduationCap,
  Loader2,
  Lock,
  Printer,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  useIssueSupervisionDocument,
  usePrintSupervisionDocument,
  useSupervisionPreview,
} from "../hooks/supervision-hook";
import type { SupervisionDocument } from "../api/supervision.api";
import { SupervisionSheet } from "./supervision-sheet";
import { SheetPreviewFrame } from "./sheet-preview-frame";
import { LoadingArea } from "../../../components/ui/loading-area";
import { serverMessage as messageOf } from "../../../lib/api/error";

/**
 * نافذةُ «طلب الموافقة على الإشراف».
 *
 * واحدةٌ لثلاثة مداخل — إجراءات الإدارة، وتفاصيل المشروع، وطلبات الطالب —
 * فلا تُكتب الورقة ثلاث مرّات ولا تفترق ثلاثتُها بتعديلٍ في واحدة.
 *
 * وهي عمودان: البياناتُ في جهة البدء والورقةُ في جهة النهاية — بالخصائص
 * المنطقية لا اليمين واليسار، فتنقلب مع لغة الشاشة من تلقائها. والعينُ
 * تقرأ البيانات أوّلاً ثمّ تنظر إلى ما صارت إليه في الورقة، وهما معاً في
 * نظرة واحدة لا في تمريرَين.
 *
 * والأسماء والأرقام تُقرأ ولا تُكتب: مصدرها أعضاء المجموعة في القاعدة،
 * و`registrationNumber` كما هو مسجَّل. ولا حقل إدخالٍ واحد في هذه الشاشة
 * — وثيقةٌ رسمية يكتب المستعمل بياناتها بيده ليست وثيقة.
 */
export function SupervisionDialog({
  topicId,
  onClose,
}: {
  topicId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const preview = useSupervisionPreview(topicId);
  const issue = useIssueSupervisionDocument();
  const print = usePrintSupervisionDocument();

  // The document as the last answer gave it: issued here, or printed here.
  const [issued, setIssued] = useState<SupervisionDocument | null>(null);
  // Set while the button's own print runs: its `beforeprint` is not a second print.
  const printing = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = issued ?? preview.data?.active ?? null;
  const snapshot = active?.snapshot ?? preview.data?.snapshot ?? null;
  const serverMessage = (
    preview.error as { response?: { data?: { message?: string } } } | null
  )?.response?.data?.message;

  const printable = Boolean(snapshot && active && active.status === "active");

  function onIssue() {
    issue.mutate(topicId, {
      onSuccess: ({ document }) => setIssued(document),
    });
  }

  /**
   * A print refused. 409: the sheet changed since it was shown (the topic, or
   * the sheet's text) — the new one is fetched and shown, to be printed then.
   */
  async function onPrintRefused(e: unknown) {
    if ((e as { response?: { status?: number } }).response?.status === 409) {
      setIssued(null);
      await preview.refetch();
      toast.warning(messageOf(e, t("supervision.changedBeforePrint")));
    } else {
      toast.error(messageOf(e, t("supervision.printFailed")));
    }
  }

  /**
   * The print is recorded first, then the print window opens: the first one
   * fixes the sheet as it is shown here. Not recorded — nothing printed, for
   * a sheet that might be on paper must be one that no longer changes.
   */
  async function onPrint() {
    if (!active) return;
    printing.current = true;
    try {
      setIssued(await print.mutateAsync({ id: active.id, version: active.version }));
      window.print();
    } catch (e) {
      await onPrintRefused(e);
    } finally {
      printing.current = false;
    }
  }

  // Ctrl+P while the sheet is shown prints it too: recorded as it opens.
  useEffect(() => {
    if (!printable || !active) return;
    const onBeforePrint = () => {
      if (printing.current) return;
      print.mutate({ id: active.id, version: active.version }, { onSuccess: setIssued, onError: onPrintRefused });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  });

  const body = (
    <div
      className="sup-print-root fixed inset-0 z-100 grid place-items-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={t("supervision.title")}
    >
      <style>{PRINT_SHELL_CSS}</style>

      <div
        onClick={onClose}
        className="sup-print-hide absolute inset-0 bg-forest-deep/55 backdrop-blur-sm"
      />

      <div className="sup-print-pass relative z-10 flex max-h-[94dvh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-cream-card ring-1 ring-forest/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        {/* ── الرأس ── */}
        <div className="sup-print-hide flex shrink-0 items-center gap-3.5 bg-linear-to-l from-forest to-forest-deep px-5 py-4 text-cream sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream/10 ring-1 ring-cream/15">
            <FileCheck2 size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold sm:text-xl">
              {t("supervision.title")}
            </h2>
            <p className="truncate text-[13px] text-cream/70">
              {t("supervision.subtitle")}
            </p>
          </div>

          {/* رقمُ الوثيقة وحالتُها — أوّل ما تبحث عنه العين في الرأس. */}
          {active && (
            <span
              className={`hidden shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold sm:inline-flex ${
                active.status === "active"
                  ? "bg-sage/25 text-cream ring-1 ring-sage/40"
                  : "bg-brick/25 text-cream ring-1 ring-brick/40"
              }`}
            >
              {active.status === "active" ? (
                <ShieldCheck size={15} />
              ) : (
                <Ban size={15} />
              )}
              <span dir="ltr" className="font-mono">
                {active.documentNumber}
              </span>
              {active.printedAt && (
                <Printer size={14} aria-label={t("supervision.printed")} data-testid="printed-badge" />
              )}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.cancel")}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/10"
          >
            <X size={19} />
          </button>
        </div>

        {/* ── الجسد: بياناتٌ ثمّ ورقة ── */}
        <div className="sup-print-pass grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:overflow-hidden">
          {/* ═══ البيانات ═══ */}
          <aside className="sup-print-hide border-b border-forest/10 p-5 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-e">
            {preview.isLoading && (
              <LoadingArea size={64} label={t("admin.searching")} />
            )}

            {/* لا مجموعة بعد، أو رقم تسجيلٍ ناقص، أو لست من أهل الورقة. */}
            {preview.isError && (
              <p className="flex items-start gap-2.5 rounded-2xl border border-brick/30 bg-brick/8 p-4 text-sm font-medium text-brick">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                {serverMessage ?? t("supervision.cannotIssue")}
              </p>
            )}

            {snapshot && (
              <div className="space-y-5">
                {active?.status === "revoked" && (
                  <p className="flex items-start gap-2.5 rounded-2xl border border-brick/30 bg-brick/8 p-3.5 text-[13px] font-medium text-brick">
                    <Ban size={16} className="mt-0.5 shrink-0" />
                    {t("supervision.revokedNotice")}
                  </p>
                )}

                {active?.status === "active" && <PrintStatus doc={active} />}

                {/* ── ما ستحمله الورقة، للقراءة لا للتعديل ── */}
                <dl className="divide-y divide-forest/8 overflow-hidden rounded-2xl bg-cream-2 ring-1 ring-forest/10">
                  <Row
                    icon={<BookText size={15} />}
                    label={t("supervision.topic")}
                    value={snapshot.topicTitle}
                  />
                  <Row
                    icon={<GraduationCap size={15} />}
                    label={t("supervision.supervisor")}
                    value={snapshot.supervisorName}
                  />
                  <Row
                    icon={<Award size={15} />}
                    label={t("supervision.degree")}
                    value={t(`admin.level_${snapshot.level}`)}
                  />
                  <Row
                    icon={<CalendarDays size={15} />}
                    label={t("pro.academicYear")}
                    value={snapshot.academicYear}
                  />
                </dl>

                {/* ── الطلبة ── */}
                <div>
                  <p className="mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wide text-clay">
                    <Users size={14} />
                    {t("supervision.students")}
                    <span className="rounded-full bg-forest/8 px-2 py-0.5 font-mono text-[11px] text-forest">
                      {snapshot.students.length}
                    </span>
                  </p>
                  <ul className="space-y-1.5">
                    {snapshot.students.map((s, i) => (
                      <li
                        key={s.registrationNumber}
                        className="flex items-center gap-3 rounded-xl bg-cream-2 px-3 py-2.5 ring-1 ring-forest/10"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-gold/20 font-mono text-[12px] font-bold text-gold">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-forest">
                          {s.fullName}
                        </span>
                        <span
                          dir="ltr"
                          className="shrink-0 font-mono text-[13px] text-clay"
                        >
                          {s.registrationNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-forest/5 p-3 text-xs leading-relaxed text-clay">
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  {t("supervision.readOnlyHint")}
                </p>
              </div>
            )}
          </aside>

          {/* ═══ الورقة ═══ */}
          <section className="sup-print-pass bg-clay/12 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
            {snapshot ? (
              <SheetPreviewFrame>
                <SupervisionSheet
                  snapshot={snapshot}
                  documentNumber={
                    active?.documentNumber ?? t("supervision.draftNumber")
                  }
                  barcode={active?.barcode ?? null}
                  revoked={active?.status === "revoked"}
                />
              </SheetPreviewFrame>
            ) : (
              <div className="sup-print-hide grid h-full min-h-60 place-items-center text-sm text-clay">
                {preview.isLoading ? (
                  <LoadingArea size={72} className="py-0" />
                ) : (
                  t("supervision.preview")
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── الذيل ── */}
        <div className="sup-print-hide flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-forest/10 bg-cream-2/50 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>

          {printable ? (
            <button
              type="button"
              onClick={onPrint}
              disabled={print.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              {print.isPending ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              {t("supervision.print")}
            </button>
          ) : (
            snapshot && (
              <button
                type="button"
                onClick={onIssue}
                disabled={issue.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {issue.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileCheck2 size={16} />
                )}
                {t("supervision.issue")}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

/**
 * أنماطُ الطباعة الخاصّة بغلاف النافذة لا بالورقة.
 *
 * الورقة تعرف كيف تُطبع نفسها؛ وهذه تُخلي لها الصفحة. والطريق: إخفاءُ كلّ
 * أبناء body إلّا جذر النافذة — و display:none لا visibility:hidden، لأنّ
 * المخفيّ بالرؤية يحتفظ بمساحته فتخرج من الطابعة صفحاتٌ بيضٌ قبل الورقة —
 * ثمّ تحييدُ ما بين الجذر والورقة من صناديق: لا ارتفاع محجوز ولا تمرير ولا
 * إطار ولا تصغيرَ معاينة.
 */
const PRINT_SHELL_CSS = `
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    height: auto !important;
  }
  body > *:not(.sup-print-root) { display: none !important; }
  .sup-print-hide { display: none !important; }
  .sup-print-root {
    position: static !important;
    inset: auto !important;
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    z-index: auto !important;
  }
  .sup-print-pass {
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
    transform: none !important;
  }
}
`;

/**
 * Printed or not, and by whom.
 *
 * Not yet: the sheet follows its topic and the sheet's text, under the same
 * number and barcode. Printed: who printed it first and when, how many times
 * since — and that nothing in it changes any more. An employee of the
 * administration is named to the administration alone (the server leaves
 * the name out for the others).
 */
function PrintStatus({ doc }: { doc: SupervisionDocument }) {
  const { t, i18n } = useTranslation();
  const lang = i18n?.language ?? "ar";
  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  if (!doc.printedAt)
    return (
      <div data-testid="print-status" data-printed="false" className="rounded-2xl border border-sage/35 bg-sage/8 p-3.5 text-[12.5px]">
        <p className="flex items-center gap-2 font-bold text-forest">
          <FilePen size={15} className="text-sage" />
          {t("supervision.notPrinted")}
        </p>
        <p className="mt-1 leading-relaxed text-clay">{t("supervision.notPrintedHint")}</p>
      </div>
    );

  const who = doc.printedByRole
    ? [t(`supervision.printedByRole.${doc.printedByRole}`), doc.printedByName].filter(Boolean).join(" — ")
    : null;
  return (
    <div data-testid="print-status" data-printed="true" className="rounded-2xl border border-gold/35 bg-gold/8 p-3.5 text-[12.5px]">
      <p className="flex items-center gap-2 font-bold text-forest">
        <Printer size={15} className="text-gold" />
        {t("supervision.printed")}
      </p>
      <p className="mt-1 text-forest/85">
        {who ? t("supervision.printedFirst", { who, when: when(doc.printedAt) }) : t("supervision.printedBefore")}
      </p>
      {doc.printCount > 1 && doc.lastPrintedAt && (
        <p className="mt-0.5 text-clay">{t("supervision.printedTimes", { n: doc.printCount, when: when(doc.lastPrintedAt) })}</p>
      )}
      <p className="mt-1.5 flex items-start gap-1.5 leading-relaxed text-clay">
        <Lock size={12} className="mt-0.5 shrink-0" />
        {t("supervision.printedLocked")}
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-forest/8 text-sage">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-clay/90">{label}</dt>
        <dd className="text-[15px] leading-snug font-semibold text-forest">
          {value || "—"}
        </dd>
      </div>
    </div>
  );
}
