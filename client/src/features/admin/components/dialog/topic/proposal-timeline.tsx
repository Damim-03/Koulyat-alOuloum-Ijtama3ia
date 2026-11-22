import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarRange, ChevronDown, FileText, Hourglass, Inbox, Pencil, Plus, Users, type LucideIcon } from "lucide-react";
import type { ProposalWindow, ProposalWindowState, SelectionWindow } from "../../../../../types/admin";
import { useProposalWindow, useSelectionWindow } from "../../../hooks/admin-hook";
import {
  daysBetween,
  formatDay,
  periodElapsed,
  periodState,
  proposalsOf,
  selectionOf,
  universityDay,
  type Period,
} from "../../../../../lib/proposal-window";
import { useNow } from "../../../../../hooks/use-now";
import { Countdown } from "../../../../../components/ui/countdown";
import { PeriodWindowDialog, type PeriodKindName } from "./proposal-window-dialog";

const STATE_CHIP: Record<ProposalWindowState, string> = {
  unset: "bg-gray-100 text-gray-600 dark:bg-gray-400/15 dark:text-gray-300",
  upcoming: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  closed: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
};

type Window = ProposalWindow | SelectionWindow;
type Tp = (k: string, o?: Record<string, unknown>) => string;

/** One of the year's two periods: what it is called, how it is read, and what is counted in it. */
interface Kind {
  name: PeriodKindName;
  /** The prefix of its test ids: `proposal-timeline`, `selection-timeline`. */
  id: "proposal" | "selection";
  icon: LucideIcon;
  collapsedKey: string;
  periodOf: (year: Window["year"]) => Period;
  useData: (yearId?: string) => { data?: Window };
  stats: (w: Window, tp: Tp) => { icon: LucideIcon; label: string; value: string }[];
}

const PROPOSALS: Kind = {
  name: "proposals",
  id: "proposal",
  icon: CalendarRange,
  collapsedKey: "admin.proposalTimeline.collapsed",
  periodOf: (y) => proposalsOf(y),
  useData: useProposalWindow,
  stats: (w, tp) => {
    const s = (w as ProposalWindow).stats;
    return [
      { icon: FileText, label: tp("statTopics"), value: String(s.topics) },
      { icon: Users, label: tp("statProfessors"), value: tp("ofTotal", { n: s.professorsProposed, total: s.professorsTotal }) },
    ];
  },
};

const SELECTION: Kind = {
  name: "selection",
  id: "selection",
  icon: Hourglass,
  collapsedKey: "admin.selectionTimeline.collapsed",
  periodOf: (y) => selectionOf(y as SelectionWindow["year"]),
  useData: useSelectionWindow,
  stats: (w, tp) => {
    const s = (w as SelectionWindow).stats;
    return [
      { icon: FileText, label: tp("statTopics"), value: String(s.topics) },
      { icon: Users, label: tp("statStudents"), value: tp("ofTotal", { n: s.studentsRequested, total: s.studentsTotal }) },
      { icon: Inbox, label: tp("statPending"), value: String(s.pendingRequests) },
    ];
  },
};

function readCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * فترة اقتراح المواضيع (الأساتذة) فوق قائمة المواضيع: تواريخها وحالها،
 * وعدٌّ تنازليّ بالثانية إلى نهايتها (أو بدايتها)، وشريطٌ يقول كم مضى منها،
 * وكم موضوعاً لهذه السنة وكم أستاذاً اقترح — فيُعرف من بقي. ومنها تُحدَّد
 * الفترة أو تُمدَّد أو تُلغى.
 */
export function ProposalTimeline({ yearId }: { yearId?: string }) {
  return <PeriodTimeline kind={PROPOSALS} yearId={yearId} />;
}

/**
 * ومهلة اختيار المواضيع (الطلبة) تحتها، بالبناء نفسه: كم موضوعاً متاحاً،
 * وكم طالباً طلب من طلبة السنة، وكم طلباً ينتظر القرار.
 */
export function SelectionTimeline({ yearId }: { yearId?: string }) {
  return <PeriodTimeline kind={SELECTION} yearId={yearId} />;
}

/**
 * والحال تُحسب من الساعة لا من آخر جوابٍ للخادم: فترةٌ تنتهي والصفحة
 * مفتوحة تصير «مغلقة» في لحظتها، بلا إعادة تحميل.
 *
 * وتُطوى فلا يبقى منها إلّا رأسها: والعدّ فيه بلوحاتٍ صغيرة، وخيطٌ ذهبيّ
 * في أسفلها بما مضى من الفترة. والطيّ يُذكر بين الزيارات، لكلّ فترةٍ وحدها.
 *
 * السنة سنةُ فلتر الصفحة إن اختيرت، وإلّا السنة الجارية.
 */
function PeriodTimeline({ kind, yearId }: { kind: Kind; yearId?: string }) {
  const { t, i18n } = useTranslation();
  const tp: Tp = (k, o) => t(`admin.${kind.name}.${k}`, o);
  const { data } = kind.useData(yearId);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readCollapsed(kind.collapsedKey));
  const bodyId = useId();
  // تدقّ ما دام هناك ما يُعدّ إليه.
  const now = useNow(data?.state === "open" || data?.state === "upcoming", 1000);

  if (!yearId)
    return (
      <p className="mb-6 rounded-2xl border border-dashed border-forest/15 px-5 py-4 text-sm text-clay" data-testid={`${kind.id}-timeline`}>
        {tp("noYear")}
      </p>
    );
  if (!data) return <div className="mb-6 h-[104px] animate-pulse rounded-2xl bg-forest/5" aria-hidden />;

  const { year } = data;
  const period = kind.periodOf(year);
  const state = periodState(period, now);
  const set = state !== "unset";
  const pct = Math.round(periodElapsed(period, now) * 100);
  // ما يُعدّ إليه: نهاية المفتوحة، أو بداية التي لم تبدأ.
  const target = state === "open" ? period.closeAt : state === "upcoming" ? period.openAt : null;
  const label = state === "open" ? tp("endsIn") : tp("opensIn");
  const fold = collapsed && set;
  const Icon = kind.icon;
  const titleId = `${kind.id}-timeline-title`;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(kind.collapsedKey, next ? "1" : "0");
    } catch {
      /* خصوصيّةٌ أو تخزينٌ ممتلئ: يبقى الطيّ لهذه الزيارة وحدها */
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      data-testid={`${kind.id}-timeline`}
      className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
          <Icon size={21} />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="font-serif text-[15px] font-bold text-forest">
              {tp("title")}
            </h2>
            <span className="text-xs text-clay">{year.title}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATE_CHIP[state]}`} data-testid={`${kind.id}-state`}>
              {tp(`state.${state}`)}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-clay">
            {set ? tp("range", { from: formatDay(period.openAt!, i18n.language), to: formatDay(period.closeAt!, i18n.language) }) : tp("unsetHint")}
          </p>
        </div>

        {fold && target && (
          <div className="flex shrink-0 items-center gap-2.5 animate-scale-in" data-testid={`${kind.id}-compact`}>
            <span className="text-[11px] font-bold text-gold">{label}</span>
            <Countdown ms={Date.parse(target) - now} label={label} size="sm" />
          </div>
        )}

        <dl className="flex flex-wrap items-stretch gap-2">
          {kind.stats(data, tp).map((s) => (
            <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} />
          ))}
        </dl>

        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={!!year.archivedAt}
          title={year.archivedAt ? tp("archived") : undefined}
          data-testid={`${kind.id}-edit`}
          className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {set ? <Pencil size={16} /> : <Plus size={16} />}
          {set ? tp("edit") : tp("set")}
        </button>

        {set && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={collapsed ? tp("expand") : tp("collapse")}
            title={collapsed ? tp("expand") : tp("collapse")}
            data-testid={`${kind.id}-toggle`}
            className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-forest/20 text-forest transition hover:border-gold hover:bg-gold/10 active:scale-95"
          >
            <ChevronDown size={18} className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
          </button>
        )}
      </div>

      {/* التفاصيل تُطوى بارتفاعٍ متحرّك؛ ومطويّةً تخرج من ترتيب Tab ومن
          قارئ الشاشة، فلا يُقرأ عدّادان. */}
      {set && (
        <div
          id={bodyId}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}
        >
          <div className="overflow-hidden" inert={collapsed} aria-hidden={collapsed || undefined} data-testid={`${kind.id}-details`}>
            <div className="border-t border-forest/8 px-5 pt-4 pb-4">
              {target && (
                <div className="mb-4 flex flex-col items-center gap-2.5">
                  <p className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.14em] text-gold">
                    <span aria-hidden className="h-px w-8 bg-gold/40" />
                    {label}
                    <span aria-hidden className="h-px w-8 bg-gold/40" />
                  </p>
                  <Countdown ms={Date.parse(target) - now} label={label} />
                </div>
              )}
              <div className="flex items-center justify-between gap-3 text-[11.5px] text-clay">
                <span>{formatDay(period.openAt!, i18n.language)}</span>
                {state === "closed" && (
                  <span className="font-semibold text-forest" data-testid={`${kind.id}-relative`}>
                    {tp("endedAgo", { count: daysBetween(universityDay(period.closeAt!), universityDay(now)) })}
                  </span>
                )}
                <span>{formatDay(period.closeAt!, i18n.language)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={tp("progress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="relative mt-2 h-2 rounded-full bg-forest/8"
              >
                <div
                  className={`absolute inset-y-0 start-0 rounded-full ${state === "closed" ? "bg-forest/25" : "bg-linear-to-l from-gold to-gold-soft"}`}
                  style={{ width: `${pct}%` }}
                />
                {state === "open" && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-cream-card bg-gold shadow"
                    style={{ insetInlineStart: `calc(${pct}% - 7px)` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مطويّة: خيطٌ ذهبيّ على حافّتها السفلى بما مضى منها */}
      {fold && (
        <div aria-hidden className="relative h-[3px] bg-forest/8" data-testid={`${kind.id}-thread`}>
          <div
            className={`absolute inset-y-0 start-0 ${state === "closed" ? "bg-forest/25" : "bg-linear-to-l from-gold to-gold-soft"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {editing && <PeriodWindowDialog kind={kind.name} window={data} onClose={() => setEditing(false)} />}
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-[7.5rem] rounded-xl bg-cream-2/70 px-3 py-2 ring-1 ring-forest/8">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold text-clay">
        <Icon size={12} className="text-gold" />
        {label}
      </dt>
      <dd className="mt-0.5 font-serif text-lg leading-tight font-bold text-forest tabular-nums">{value}</dd>
    </div>
  );
}
