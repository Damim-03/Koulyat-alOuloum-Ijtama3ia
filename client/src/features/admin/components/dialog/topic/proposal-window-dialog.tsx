import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarPlus,
  CalendarRange,
  Flag,
  Hourglass,
  Loader2,
  PlayCircle,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ProposalWindow, SelectionWindow } from "../../../../../types/admin";
import {
  useClearProposalWindow,
  useClearSelectionWindow,
  useSetProposalWindow,
  useSetSelectionWindow,
} from "../../../hooks/admin-hook";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import {
  addDays,
  formatDay,
  momentOf,
  proposalsOf,
  selectionOf,
  UNIVERSITY_TZ,
  universityDay,
  universityTime,
  withSeconds,
} from "../../../../../lib/proposal-window";
import { Countdown } from "../../../../../components/ui/countdown";

/** The year's two periods: the professors' to propose topics, the students' to choose them. */
export type PeriodKindName = "proposals" | "selection";

const START = "00:00:00";
const END = "23:59:59";

/**
 * تحديد فترةٍ من فترتي السنة — اقتراح المواضيع للأساتذة، أو اختيارها
 * للطلبة: من يومٍ وساعةٍ إلى يومٍ وساعة، بالثانية وبتوقيت الجامعة. وما لم
 * تُغيَّر الساعتان فهي أيّامٌ كاملة، من منتصف ليل الأوّل إلى آخر ثانيةٍ من
 * الأخير.
 *
 * بطاقتان — البداية والنهاية — كلٌّ بيومها وساعتها ويومها مكتوباً كاملاً؛
 * والمدّة بينهما على لوحات العدّ نفسها (أيّام، ساعات، دقائق، ثوانٍ)؛ وما
 * ستكون عليه حين تُحفظ (مفتوحة، أو تنتظر موعدها، أو مضى موعدها). ومددٌ
 * جاهزة، و«أيّامٌ كاملة» يعيد الساعتين، و«إلغاء الفترة» يعيدها بلا قيد. ومن
 * تعنيهم يُبلَّغون بالتواريخ حين تُحفظ. ومهلة الطلبة تُنبّه إن بدأت قبل أن
 * تنتهي فترة الاقتراح.
 */
export function PeriodWindowDialog({
  kind,
  window: w,
  onClose,
}: {
  kind: PeriodKindName;
  window: ProposalWindow | SelectionWindow;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const tp = (k: string, o?: Record<string, unknown>) => t(`admin.${kind}.${k}`, o);
  const tc = (k: string, o?: Record<string, unknown>) => t(`admin.period.${k}`, o);
  const lang = i18n.language || "ar";
  useBodyScrollLock(true);

  const period = kind === "selection" ? selectionOf(w.year as SelectionWindow["year"]) : proposalsOf(w.year);
  const [now] = useState(() => Date.now());
  const today = universityDay(now);
  const set = w.state !== "unset";
  const [opensOn, setOpensOn] = useState(set ? universityDay(period.openAt!) : today);
  const [opensTime, setOpensTime] = useState(set ? universityTime(period.openAt!) : START);
  const [closesOn, setClosesOn] = useState(set ? universityDay(period.closeAt!) : addDays(today, kind === "selection" ? 13 : 29));
  const [closesTime, setClosesTime] = useState(set ? universityTime(period.closeAt!) : END);
  const saveProposals = useSetProposalWindow();
  const clearProposals = useClearProposalWindow();
  const saveSelection = useSetSelectionWindow();
  const clearSelection = useClearSelectionWindow();
  const save = kind === "selection" ? saveSelection : saveProposals;
  const clear = kind === "selection" ? clearSelection : clearProposals;
  const busy = save.isPending || clear.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const complete = !!opensOn && !!closesOn && !!opensTime && !!closesTime;
  const openMs = complete ? momentOf(opensOn, opensTime) : NaN;
  const closeMs = complete ? momentOf(closesOn, closesTime, true) : NaN;
  const inOrder = complete && closeMs > openMs;
  // The last second counts whole: 00:00:00 to 23:59:59 of the same day is one day.
  const length = inOrder ? closeMs + 1 - openMs : 0;
  const preview = !inOrder ? null : now < openMs ? "upcoming" : now > closeMs ? "closed" : "open";
  const wholeDays = withSeconds(opensTime) === START && withSeconds(closesTime) === END;
  // The students choose among what the professors proposed: before proposing ends, the list is still growing.
  const tooEarly = kind === "selection" && !!w.year.proposalsCloseAt && complete && openMs <= Date.parse(w.year.proposalsCloseAt);

  const submit = () =>
    save.mutate(
      { yearId: w.year.id, opensOn, closesOn, opensTime: withSeconds(opensTime), closesTime: withSeconds(closesTime) },
      { onSuccess: onClose },
    );
  const remove = () => clear.mutate(w.year.id, { onSuccess: onClose });

  const full = new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: UNIVERSITY_TZ,
  });
  const caption = (ms: number) => (Number.isFinite(ms) ? full.format(ms) : "—");

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-forest/15 bg-cream-card px-3 py-1.5 text-[12px] font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:opacity-40";
  const id = kind === "selection" ? "selection" : "proposal";
  const Icon = kind === "selection" ? Hourglass : CalendarRange;
  const PREVIEW = {
    open: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    upcoming: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    closed: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  } as const;

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center overflow-y-auto p-3 font-body sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-window-title`}
    >
      <div onClick={() => !busy && onClose()} className="fixed inset-0 bg-forest-deep/60 backdrop-blur-md" />

      <div className="animate-scale-in relative my-auto w-full max-w-[min(96vw,640px)] overflow-hidden rounded-[26px] border border-gold/20 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.75)]">
        <header className="forest-glow relative flex items-center gap-4 px-6 py-5 text-cream">
          <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft ring-1 ring-gold/30">
            <Icon size={21} />
          </span>
          <div className="relative min-w-0 flex-1">
            <h3 id={`${id}-window-title`} className="font-serif text-[19px] font-bold">
              {tp("dialogTitle", { year: w.year.title })}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-cream/70">{tp("dialogHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={tp("close")}
            className="relative grid size-9 shrink-0 place-items-center self-start rounded-xl text-cream/75 transition hover:bg-white/10 hover:text-cream disabled:opacity-40"
          >
            <X size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
        </header>

        <div className="space-y-5 px-6 py-5">
          {/* What it will be once saved, and the way back to whole days. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {preview ? (
              <span data-testid="period-preview" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ${PREVIEW[preview]}`}>
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {tc(`preview.${preview}`)}
              </span>
            ) : (
              <span />
            )}
            {!wholeDays && (
              <button
                type="button"
                className={chip}
                onClick={() => {
                  setOpensTime(START);
                  setClosesTime(END);
                }}
              >
                <Sun size={13} className="text-gold" />
                {tc("wholeDays")}
              </button>
            )}
          </div>

          {/* The two ends. */}
          <div className="relative grid gap-3 sm:grid-cols-2">
            <Endpoint
              tone="start"
              icon={PlayCircle}
              title={tc("starts")}
              day={opensOn}
              time={opensTime}
              onDay={setOpensOn}
              onTime={setOpensTime}
              dayLabel={tp("from")}
              timeLabel={tc("startTime")}
              caption={caption(openMs)}
            />
            <Endpoint
              tone="end"
              icon={Flag}
              title={tc("ends")}
              day={closesOn}
              time={closesTime}
              onDay={setClosesOn}
              onTime={setClosesTime}
              min={opensOn || undefined}
              invalid={complete && !inOrder}
              dayLabel={tp("to")}
              timeLabel={tc("endTime")}
              caption={caption(closeMs)}
            />
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 hidden size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/30 bg-cream-card text-gold shadow-sm sm:grid"
            >
              <ArrowLeft size={15} className="ltr:rotate-180" />
            </span>
          </div>

          {/* How long, to the second. */}
          <section
            aria-label={tc("length")}
            className="rounded-2xl border border-gold/20 bg-linear-to-b from-gold/[0.07] to-transparent px-4 py-4"
          >
            <p className="mb-3 flex items-center justify-center gap-2.5 text-[11px] font-bold tracking-[0.14em] text-gold">
              <span aria-hidden className="h-px w-8 bg-gold/40" />
              {tc("length")}
              <span aria-hidden className="h-px w-8 bg-gold/40" />
            </p>
            {inOrder ? (
              <div className="flex justify-center" data-testid="period-length">
                <Countdown ms={length} label={tc("length")} as="duration" />
              </div>
            ) : (
              <p className={`text-center text-[12.5px] ${complete ? "font-semibold text-red-600 dark:text-red-300" : "text-clay"}`} aria-live="polite">
                {complete ? tp("orderError") : tp("pickBoth")}
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-2" role="group" aria-label={tp("quick")}>
            <button type="button" className={chip} disabled={!opensOn} onClick={() => setClosesOn(addDays(opensOn, 13))}>
              <CalendarPlus size={13} className="text-gold" />
              {tp("twoWeeks")}
            </button>
            <button type="button" className={chip} disabled={!opensOn} onClick={() => setClosesOn(addDays(opensOn, 29))}>
              <CalendarPlus size={13} className="text-gold" />
              {tp("month")}
            </button>
            {set && (
              <button type="button" className={chip} disabled={!closesOn} onClick={() => setClosesOn(addDays(closesOn, 7))}>
                <CalendarPlus size={13} className="text-gold" />
                {tp("extendWeek")}
              </button>
            )}
            {w.state === "open" && (
              <button
                type="button"
                className={chip}
                onClick={() => {
                  setClosesOn(today);
                  setClosesTime(END);
                }}
              >
                <Flag size={13} className="text-rose-500" />
                {tp("closeToday")}
              </button>
            )}
          </div>

          {tooEarly && (
            <p role="note" data-testid="selection-too-early" className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {tp("beforeProposalsEnd", { date: formatDay(w.year.proposalsCloseAt!, lang) })}
            </p>
          )}

          <p className="flex items-start gap-2 rounded-xl bg-gold/8 px-3 py-2.5 text-[12px] leading-relaxed text-forest/85">
            <BellRing size={15} className="mt-0.5 shrink-0 text-gold" />
            {tp("notifyHint")}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-4">
          {set ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              data-testid={`${id}-clear`}
              className="text-sm font-semibold text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-300"
            >
              {tp("clear")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
            >
              {tp("cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !inOrder}
              data-testid={`${id}-save`}
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {save.isPending && <Loader2 size={16} className="animate-spin" />}
              {tp("save")}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

const TONE = {
  start: { box: "border-emerald-500/25 bg-emerald-500/[0.05]", icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  end: { box: "border-rose-500/25 bg-rose-500/[0.05]", icon: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
} as const;

/** One end of the period: its day and its time, and the day written out whole. */
function Endpoint({
  tone,
  icon: Icon,
  title,
  day,
  time,
  onDay,
  onTime,
  min,
  invalid,
  dayLabel,
  timeLabel,
  caption,
}: {
  tone: keyof typeof TONE;
  icon: LucideIcon;
  title: string;
  day: string;
  time: string;
  onDay: (v: string) => void;
  onTime: (v: string) => void;
  min?: string;
  invalid?: boolean;
  dayLabel: string;
  timeLabel: string;
  caption: string;
}) {
  const field =
    "h-11 w-full min-w-0 rounded-xl border border-forest/15 bg-cream-card px-3 text-[13px] text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 aria-[invalid=true]:border-red-400";
  return (
    <div className={`min-w-0 rounded-2xl border p-3.5 ${TONE[tone].box}`}>
      <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold text-forest">
        <span className={`grid size-7 place-items-center rounded-lg ${TONE[tone].icon}`}>
          <Icon size={14} />
        </span>
        {title}
      </p>
      {/* One above the other: a time field shows AM/PM in some browsers' languages, and needs the width. */}
      <div className="grid grid-cols-1 gap-2">
        <input type="date" dir="ltr" value={day} min={min} onChange={(e) => onDay(e.target.value)} aria-label={dayLabel} aria-invalid={invalid} className={field} />
        <input type="time" step={1} dir="ltr" value={time} onChange={(e) => onTime(e.target.value)} aria-label={timeLabel} aria-invalid={invalid} className={field} />
      </div>
      <p className="mt-2 truncate text-[11.5px] text-clay" title={caption}>
        {caption}
      </p>
    </div>
  );
}
