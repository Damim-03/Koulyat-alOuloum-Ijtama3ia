import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CalendarRange,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  type LucideIcon,
} from "lucide-react";

import { FormDialog } from "../../form/form-dialog";
import { Select } from "../../../../../components/ui/select";
import { useCloseYear, useYearReadiness } from "../../../hooks/admin-hook";
import type { ArchiveYear, YearSummary } from "../../../../../types/admin";
import { nextYearTitle } from "../../../pages/archive/archive-utils";

/**
 * Closing an academic year — three steps, because it is the one act that
 * turns a working year into a record.
 *
 *   1. What is still open in it, so nothing is left behind unknowingly.
 *   2. Which year carries on, and a note for whoever reads the record later.
 *   3. What will happen, and the title typed back to confirm.
 */
type Next = "keep" | "existing" | "new";
const STEPS = ["review", "next", "confirm"] as const;

const LEVEL: Record<string, { icon: LucideIcon; row: string; icoCls: string }> = {
  warn: {
    icon: AlertTriangle,
    row: "border-amber-300/60 bg-amber-500/10",
    icoCls: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  info: {
    icon: Info,
    row: "border-sky-300/50 bg-sky-500/5",
    icoCls: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  ok: {
    icon: CheckCircle2,
    row: "border-forest/10 bg-cream-2/40",
    icoCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

export function CloseYearDialog({
  open,
  onClose,
  year,
  years,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  year: ArchiveYear;
  years: ArchiveYear[];
  summary?: YearSummary;
}) {
  if (!open) return null;
  return <Wizard onClose={onClose} year={year} years={years} summary={summary} />;
}

function Wizard({
  onClose,
  year,
  years,
  summary,
}: {
  onClose: () => void;
  year: ArchiveYear;
  years: ArchiveYear[];
  summary?: YearSummary;
}) {
  const { t } = useTranslation();
  const readiness = useYearReadiness(year.id);
  const closeYear = useCloseYear();

  const candidates = useMemo(() => years.filter((y) => y.id !== year.id && !y.archivedAt), [years, year.id]);
  const guess = nextYearTitle(year.title);
  const existingGuess = candidates.find((y) => y.title === guess);
  const takenTitles = useMemo(() => new Set(years.map((y) => y.title)), [years]);

  const [step, setStep] = useState(0);
  const [next, setNext] = useState<Next>(existingGuess ? "existing" : guess ? "new" : "keep");
  const [nextId, setNextId] = useState(existingGuess?.id ?? candidates[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState(existingGuess ? "" : guess);
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");

  const titleOk = /^\d{4}\/\d{4}$/.test(newTitle.trim());
  const titleTaken = takenTitles.has(newTitle.trim());
  const nextOk = next === "keep" || (next === "existing" ? !!nextId : titleOk && !titleTaken);
  const confirmed = typed.trim() === year.title;
  const nextName = next === "existing" ? candidates.find((y) => y.id === nextId)?.title : next === "new" ? newTitle.trim() : null;

  function close() {
    if (closeYear.isPending) return;
    onClose();
  }

  function submit() {
    closeYear.mutate(
      {
        id: year.id,
        confirmTitle: typed.trim(),
        note: note.trim() || undefined,
        nextYearId: next === "existing" ? nextId : undefined,
        nextYearTitle: next === "new" ? newTitle.trim() : undefined,
      },
      { onSuccess: () => onClose() },
    );
  }

  const warnings = (readiness.data?.items ?? []).filter((i) => i.level !== "ok").length;

  return (
    <FormDialog
      open
      onClose={close}
      title={t("admin.yearArchive.close.title", { year: year.title })}
      subtitle={t("admin.yearArchive.close.subtitle")}
      icon={Archive}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {step < 2 ? (
            <button
              type="button"
              disabled={step === 1 && !nextOk}
              onClick={() => setStep((s) => s + 1)}
              data-testid="close-year-next"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("admin.yearArchive.close.continue")}
              <ArrowLeft size={16} className="ltr:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!confirmed || closeYear.isPending}
              onClick={submit}
              data-testid="close-year-confirm"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-45"
            >
              {closeYear.isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {t("admin.yearArchive.close.confirm")}
            </button>
          )}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={closeYear.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
            >
              <ArrowRight size={16} className="ltr:rotate-180" />
              {t("admin.yearArchive.close.back")}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="ms-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            {t("admin.cancel")}
          </button>
        </div>
      }
    >
      {/* steps */}
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label={t("admin.yearArchive.close.steps")}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                    ? "bg-gold text-forest-deep shadow-[0_0_0_4px_rgba(193,150,90,0.2)]"
                    : "bg-forest/10 text-clay"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={`truncate text-[12px] font-semibold ${i === step ? "text-forest" : "text-clay"}`}>
              {t(`admin.yearArchive.close.step.${s}`)}
            </span>
            {i < 2 && <span className="hidden h-px flex-1 bg-forest/10 sm:block" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4 animate-scale-in" key="review">
          {summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["students", summary.students],
                ["topics", summary.topics],
                ["projects", summary.projects],
                ["defended", summary.defenses.completed],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-forest/10 bg-cream-2/50 p-3 text-center">
                  <b className="block font-serif text-xl text-forest tabular-nums">{v}</b>
                  <span className="text-[11px] text-clay">{t(`admin.yearArchive.count.${k}`)}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-bold tracking-wide text-gold">
              {t("admin.yearArchive.close.checklist")}
              {readiness.data && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] ${
                    warnings ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {warnings ? t("admin.yearArchive.close.pendingCount", { count: warnings }) : t("admin.yearArchive.close.allSettled")}
                </span>
              )}
            </p>
            {readiness.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-forest/5" />
                ))}
              </div>
            ) : (
              <ul className="space-y-2" data-testid="close-year-checklist">
                {(readiness.data?.items ?? []).map((i) => {
                  const L = LEVEL[i.level] ?? LEVEL.ok;
                  return (
                    <li key={i.key} className={`flex items-start gap-3 rounded-xl border p-3 ${L.row}`}>
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${L.icoCls}`}>
                        <L.icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-forest">
                          {t(`admin.yearArchive.ready.${i.key}.title`, { count: i.count })}
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-clay">
                          {i.level === "ok"
                            ? t(`admin.yearArchive.ready.${i.key}.ok`)
                            : t(`admin.yearArchive.ready.${i.key}.hint`, { upcoming: i.extra?.upcoming ?? 0 })}
                        </p>
                      </div>
                      <b className="font-serif text-lg text-forest tabular-nums">{i.count}</b>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[11.5px] leading-relaxed text-clay">{t("admin.yearArchive.close.checklistNote")}</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-scale-in" key="next">
          <div className="space-y-2" role="radiogroup" aria-label={t("admin.yearArchive.close.nextLabel")}>
            <p className="text-[12px] font-bold tracking-wide text-gold">{t("admin.yearArchive.close.nextLabel")}</p>

            <Choice on={next === "new"} onClick={() => setNext("new")} icon={CalendarPlus} title={t("admin.yearArchive.close.nextNew")} hint={t("admin.yearArchive.close.nextNewHint")} testId="next-new">
              {next === "new" && (
                <div className="mt-3">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="2026/2027"
                    dir="ltr"
                    data-testid="next-new-title"
                    className="h-11 w-full rounded-xl border border-forest/15 bg-cream px-3 text-center font-serif text-lg font-bold tracking-wider text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 sm:w-56"
                  />
                  {newTitle.trim() && !titleOk && <p className="mt-1.5 text-[11.5px] text-red-600 dark:text-red-300">{t("admin.yearArchive.close.titleFormat")}</p>}
                  {titleOk && titleTaken && <p className="mt-1.5 text-[11.5px] text-red-600 dark:text-red-300">{t("admin.yearArchive.close.titleTaken")}</p>}
                </div>
              )}
            </Choice>

            {candidates.length > 0 && (
              <Choice on={next === "existing"} onClick={() => setNext("existing")} icon={CalendarRange} title={t("admin.yearArchive.close.nextExisting")} hint={t("admin.yearArchive.close.nextExistingHint")} testId="next-existing">
                {next === "existing" && (
                  <div className="mt-3 sm:w-64" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={nextId}
                      onChange={setNextId}
                      options={candidates.map((y) => ({ value: y.id, label: `${y.title}${y.isActive ? ` · ${t("admin.yearArchive.current")}` : ""}` }))}
                    />
                  </div>
                )}
              </Choice>
            )}

            <Choice on={next === "keep"} onClick={() => setNext("keep")} icon={Lock} title={t("admin.yearArchive.close.nextKeep")} hint={t("admin.yearArchive.close.nextKeepHint")} testId="next-keep" />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold tracking-wide text-gold">
              {t("admin.yearArchive.close.note")}
              <span className="ms-1 text-[10.5px] font-normal text-clay">({t("admin.yearArchive.close.optional")})</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              data-testid="close-year-note"
              placeholder={t("admin.yearArchive.close.notePlaceholder")}
              className="w-full resize-y rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-scale-in" key="confirm">
          <ul className="space-y-2 rounded-xl border border-forest/10 bg-cream-2/40 p-4 text-[12.5px] text-forest">
            {[
              t("admin.yearArchive.close.effectSnapshot"),
              t("admin.yearArchive.close.effectLock"),
              nextName ? t("admin.yearArchive.close.effectNext", { year: nextName }) : t("admin.yearArchive.close.effectNoCurrent"),
              t("admin.yearArchive.close.effectReopen"),
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                {line}
              </li>
            ))}
          </ul>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-forest">
              {t("admin.yearArchive.close.typeToConfirm")}{" "}
              <b dir="ltr" className="rounded-md bg-gold/15 px-1.5 py-0.5 font-serif text-forest">
                {year.title}
              </b>
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="ltr"
              autoFocus
              data-testid="close-year-typed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed) submit();
              }}
              className={`h-12 w-full rounded-xl border bg-cream px-3 text-center font-serif text-lg font-bold tracking-wider text-forest outline-none transition focus:ring-2 ${
                confirmed ? "border-emerald-400 focus:ring-emerald-400/25" : "border-forest/15 focus:border-gold focus:ring-gold/30"
              }`}
            />
          </label>
        </div>
      )}
    </FormDialog>
  );
}

function Choice({
  on,
  onClick,
  icon: Icon,
  title,
  hint,
  children,
  testId,
}: {
  on: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  hint: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        // Only the card itself: keys typed in a field inside it are the field's.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={testId}
      className={`cursor-pointer rounded-xl border p-3.5 transition outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
        on ? "border-gold/60 bg-gold/10 shadow-[0_0_0_1px_rgba(193,150,90,0.25)]" : "border-forest/12 hover:border-forest/25 hover:bg-forest/[0.03]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${on ? "bg-gold text-forest-deep" : "bg-forest/5 text-clay"}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-forest">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-clay">{hint}</p>
        </div>
        <span className={`mt-1 grid size-4.5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-gold" : "border-forest/25"}`}>
          {on && <span className="size-2 rounded-full bg-gold" />}
        </span>
      </div>
      {children}
    </div>
  );
}
