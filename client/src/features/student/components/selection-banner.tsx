import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck2, CalendarClock, CalendarX2, ChevronDown, Hourglass } from "lucide-react";
import { periodState, selectionOf, UNIVERSITY_TZ } from "../../../lib/proposal-window";
import { useNow } from "../../../hooks/use-now";
import { Countdown } from "../../../components/ui/countdown";
import { useStudentSelectionWindow } from "../hooks/Student-hook";

const TONE = {
  open: {
    icon: CalendarCheck2,
    box: "border-emerald-500/25 from-emerald-500/[0.09] via-cream-card to-cream-card",
    glow: "bg-emerald-400/20",
    ink: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pill: "border-emerald-500/30 bg-emerald-500/10",
  },
  upcoming: {
    icon: CalendarClock,
    box: "border-amber-500/25 from-amber-500/[0.09] via-cream-card to-cream-card",
    glow: "bg-amber-400/20",
    ink: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    pill: "border-amber-500/30 bg-amber-500/10",
  },
  closed: {
    icon: CalendarX2,
    box: "border-red-500/25 from-red-500/[0.08] via-cream-card to-cream-card",
    glow: "bg-red-400/15",
    ink: "text-red-700 dark:text-red-300",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300",
    pill: "border-red-500/30 bg-red-500/10",
  },
} as const;

const COLLAPSED_KEY = "stu.selectionBanner.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * مهلة اختيار المواضيع لسنة الطالب، كما يراها فوق المواضيع وفي لوحته وفوق
 * طلباته — والوقت في وسطها، كبيراً: عدٌّ تنازليّ إلى نهايتها (أو بدايتها)
 * بلوحات الأيام والساعات والدقائق والثواني، وتحته الأجل مكتوباً بيومه
 * وساعته. وانتهت: الأجل وحده، بلا عدّ. وبلا مهلةٍ لا يظهر شيء: الاختيار
 * بلا قيد.
 *
 * وتُطوى فلا يبقى منها إلّا رأسها، والعدّ فيه صغيراً؛ والطيّ يُذكر بين
 * الزيارات. والحال من الساعة: مهلةٌ تبدأ أو تنتهي والصفحة مفتوحة تتغيّر في
 * لحظتها.
 */
export function SelectionBanner({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const ts = (k: string, o?: Record<string, unknown>) => t(`stu.selection.${k}`, o);
  // Read once there is a deadline to write: a test that stubs the translations has no i18n.
  const lang = i18n?.language || "ar";
  const { data: year } = useStudentSelectionWindow();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const bodyId = useId();
  const period = selectionOf(year ?? {});
  const pending = ["open", "upcoming"].includes(periodState(period));
  const now = useNow(pending, 1000);
  if (!year) return null;
  const state = periodState(period, now);
  if (state === "unset") return null;

  const tone = TONE[state];
  const Icon = tone.icon;
  const edge = state === "upcoming" ? period.openAt! : period.closeAt!;
  const target = state === "closed" ? null : edge;
  const label = state === "open" ? ts("endsIn") : ts("opensIn");
  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UNIVERSITY_TZ,
  }).format(new Date(edge));
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: UNIVERSITY_TZ }).format(new Date(edge));

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* خصوصيّةٌ أو تخزينٌ ممتلئ: يبقى الطيّ لهذه الزيارة وحدها */
    }
  };

  return (
    <section
      role="status"
      data-testid="selection-banner"
      className={`relative overflow-hidden rounded-3xl border bg-linear-to-b shadow-[0_10px_30px_-18px_rgba(22,36,31,0.45)] ${tone.box} ${className}`}
    >
      <div aria-hidden className={`pointer-events-none absolute -top-20 left-1/2 size-64 -translate-x-1/2 rounded-full blur-3xl ${tone.glow}`} />

      {/* What it is — and, folded, the time in small beside it */}
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 sm:px-6">
        <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 ${collapsed ? "" : "justify-center sm:ps-11"}`}>
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone.chip}`}>
            <Hourglass size={16} />
          </span>
          <h2 className="font-serif text-[16px] font-bold text-forest">{ts("title")}</h2>
          <span className="rounded-full bg-forest/6 px-2.5 py-0.5 text-[11.5px] font-semibold text-forest/80">{year.title}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone.chip}`} data-testid="selection-state">
            {ts(`state.${state}`)}
          </span>
        </div>

        {collapsed && (
          <div className="flex shrink-0 items-center gap-2.5 animate-scale-in" data-testid="selection-compact">
            {target ? (
              <>
                <span className={`text-[11px] font-bold ${tone.ink}`}>{label}</span>
                <Countdown ms={Date.parse(target) - now} label={label} size="sm" />
              </>
            ) : (
              <span className="text-[12px] font-semibold text-forest/80">
                {ts("endedOn")} {when}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? ts("expand") : ts("collapse")}
          title={collapsed ? ts("expand") : ts("collapse")}
          data-testid="selection-toggle"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-forest/15 text-forest transition hover:border-gold hover:bg-gold/10 active:scale-95"
        >
          <ChevronDown size={17} className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      {/* The time, in the middle and large — folded away with an animated height,
          out of the Tab order and the screen reader, so one countdown is read. */}
      <div id={bodyId} className={`grid transition-[grid-template-rows] duration-300 ease-out ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
        <div className="overflow-hidden" inert={collapsed} aria-hidden={collapsed || undefined} data-testid="selection-details">
          <div className="relative flex flex-col items-center gap-4 px-5 pt-1 pb-6 text-center sm:px-8">
            {target && (
              <div className="flex flex-col items-center gap-2.5">
                <p className={`flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.14em] ${tone.ink}`}>
                  <span aria-hidden className="h-px w-10 bg-current opacity-40" />
                  {label}
                  <span aria-hidden className="h-px w-10 bg-current opacity-40" />
                </p>
                <Countdown ms={Date.parse(target) - now} label={label} />
              </div>
            )}

            <p className={`inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border px-4 py-2.5 ${tone.pill}`} data-testid="selection-deadline">
              <Icon size={18} className={`shrink-0 ${tone.ink}`} />
              <span className="text-[12px] font-semibold text-clay">{ts(state === "upcoming" ? "startsOn" : state === "open" ? "deadline" : "endedOn")}</span>
              <span className="font-serif text-[16px] font-bold text-forest">{when}</span>
              <span dir="ltr" className={`rounded-lg px-2 py-0.5 font-serif text-[15px] font-bold tabular-nums ${tone.chip}`}>
                {hour}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
