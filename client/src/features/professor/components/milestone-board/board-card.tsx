import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Crown,
  Layers,
  Paperclip,
  Search,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "../status-badge";
import { Ring } from "../progress-ring";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { Highlight } from "../../../../components/ui/highlight";
import { personName } from "../../../../lib/person-name";
import { useDates } from "../../../../hooks/use-dates";
import { isLate, type FieldWords, type Hit, type Row } from "../../lib/milestone-board";

type Tone = "late" | "soon" | "done" | "empty" | "active";

const TONE: Record<Tone, { stripe: string; pill: string }> = {
  late: { stripe: "bg-brick", pill: "bg-brick/10 text-brick ring-brick/25" },
  soon: { stripe: "bg-amber-400", pill: "bg-amber-400/15 text-amber-700 ring-amber-400/35 dark:text-amber-300" },
  done: { stripe: "bg-sage", pill: "bg-sage/15 text-sage ring-sage/30" },
  empty: { stripe: "bg-clay/40", pill: "bg-forest/8 text-clay ring-forest/15" },
  active: { stripe: "bg-gold", pill: "bg-gold/15 text-gold ring-gold/30" },
};

/** لون كلّ مرحلةٍ في شريط المراحل. */
const SEGMENT: Record<string, string> = {
  completed: "bg-sage",
  in_progress: "bg-sky-400",
  pending: "bg-forest/15",
  late: "bg-brick",
};

const toneOf = (r: Row): Tone =>
  r.total === 0 ? "empty" : r.late > 0 ? "late" : r.completed === r.total ? "done" : r.soon > 0 ? "soon" : "active";

/**
 * مذكرةٌ في لوحة المراحل: حالها بلونٍ في طرفها، وإنجازها، ومراحلها شريطاً
 * بالترتيب، وما يأتي بعدُ، ومناقشتها، وطلبتها — وإن جاءت ببحثٍ قيل أين وقع.
 */
export function BoardCard({
  row,
  words,
  by = {},
  hits,
  now,
  onOpen,
}: {
  row: Row;
  /** كلمات البحث العامّ: تُعلَّم أينما وقعت. */
  words: string[];
  /** كلمات البحث المفصّل: كلٌّ في نوعه وحده. */
  by?: FieldWords;
  hits: Hit[];
  /** لحظة اشتقاق الصفوف: المتأخّر في الشريط هو المتأخّر في الحال. */
  now: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const tm = (k: string, o?: Record<string, unknown>) => t(`pro.ms.${k}`, o);
  const { fmtDate, relative } = useDates();
  const { g, total, completed, late, percent, files, next, defense } = row;
  const members = g.members ?? [];
  const tone = toneOf(row);
  const title = g.topic?.title ?? "—";
  const marks = (kind: Hit["kind"] | "title") => [...words, ...(by[kind as keyof FieldWords] ?? [])];

  return (
    <article
      data-testid={`board-card-${g.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_14px_36px_-12px_rgba(193,150,90,0.35)]"
    >
      <span aria-hidden className={`absolute inset-y-0 start-0 w-1.5 ${TONE[tone].stripe}`} />

      <div className="flex flex-1 flex-col p-5 ps-7">
        {/* الحال والعنوان */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${TONE[tone].pill}`} data-testid="board-card-state">
            {tm(`state.${tone}`)}
          </span>
          {g.topic?.status && <StatusBadge status={g.topic.status} />}
        </div>
        <h3 className="font-serif text-lg leading-snug font-bold text-forest">
          <button type="button" onClick={onOpen} className="line-clamp-2 text-start transition hover:text-gold focus-visible:text-gold focus-visible:outline-none">
            <Highlight text={title} words={marks("title")} />
          </button>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-clay">
          {g.topic?.specialization?.name && (
            <span className="inline-flex items-center gap-1">
              <Layers size={12} className="text-gold" />
              <Highlight text={g.topic.specialization.name} words={words} />
            </span>
          )}
          {g.topic?.academicYear?.title && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} className="text-gold" />
              {g.topic.academicYear.title}
            </span>
          )}
        </p>

        {/* الإنجاز، وشريط المراحل بالترتيب */}
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-cream-2/70 p-3.5 ring-1 ring-forest/5">
          <Ring percent={percent} size={58} light alarm={late > 0} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] text-clay">{t("pro.milestoneProgress")}</p>
              <p className="font-serif text-base font-bold text-forest tabular-nums" dir="ltr">
                {completed}/{total}
              </p>
            </div>
            {total > 0 ? (
              <ol aria-label={tm("track")} className="mt-2 flex gap-1">
                {[...(g.milestones ?? [])]
                  .sort((a, b) => a.order - b.order)
                  .map((m) => {
                    const key = isLate(m, now) ? "late" : m.status;
                    const state = t(`status.${key === "late" ? "overdue" : m.status}`, { defaultValue: m.status });
                    return (
                      <li key={m.id} title={`${m.order}. ${m.title} — ${state}`} className={`h-2 flex-1 rounded-full ${SEGMENT[key] ?? SEGMENT.pending}`}>
                        <span className="sr-only">{`${m.title}: ${state}`}</span>
                      </li>
                    );
                  })}
              </ol>
            ) : (
              <p className="mt-1.5 text-[12px] text-clay">{t("pro.noMilestonesYet")}</p>
            )}
            {late > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-brick">
                <AlertTriangle size={11} />
                {t("pro.overdueCount", { count: late })}
              </p>
            )}
          </div>
        </div>

        {/* ما يأتي، والمناقشة، والملفات */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Fact icon={CalendarClock} label={tm("next")} value={next ? next.title : tm("noNext")} sub={next ? relative(next.deadline) : null} muted={!next} />
          <Fact
            icon={CalendarCheck}
            label={tm("defense")}
            value={defense === "none" ? tm("notScheduled") : fmtDate(g.defense!.date)}
            sub={defense === "completed" && g.defense!.grade != null ? `${g.defense!.grade}/20` : defense === "scheduled" ? g.defense!.room || null : null}
            muted={defense === "none"}
            tone="violet"
          />
          <Fact icon={Paperclip} label={tm("filesCount")} value={String(files)} muted={files === 0} />
        </div>

        {/* أين وقع البحث، غير العنوان */}
        {hits.length > 0 && (
          <p data-testid="board-card-hits" className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-clay">
            <Search size={12} className="text-gold" />
            {tm("matched")}
            {hits.map((h) => (
              <span key={`${h.kind}-${h.text}`} className="rounded-full bg-gold/10 px-2 py-0.5 text-forest ring-1 ring-gold/25">
                <span className="text-clay">{tm(`hit.${h.kind}`)}: </span>
                <Highlight text={h.text} words={marks(h.kind)} />
              </span>
            ))}
          </p>
        )}

        {/* الطلبة، والدخول إلى المراحل */}
        <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-forest/10 pt-4">
          <div className="flex items-center gap-2">
            <ul className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <li key={m.id} title={personName(m.student?.user) || m.student?.registrationNumber} className="relative">
                  <UserAvatar user={m.student?.user} size={30} className={`ring-2 ${m.isLeader ? "ring-gold" : "ring-cream-card"}`} />
                  {m.isLeader && <Crown size={12} className="absolute -top-2 -end-1 rounded-full bg-cream-card p-px text-gold" aria-label={t("pro.leader")} />}
                </li>
              ))}
            </ul>
            <span className="text-[11px] text-clay tabular-nums" dir="ltr">
              {members.length > 4 ? `+${members.length - 4} · ` : ""}
              {members.length}
              {g.topic?.maxStudents ? `/${g.topic.maxStudents}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-forest-deep shadow-[0_6px_16px_-6px_rgba(193,150,90,0.6)] transition hover:bg-gold-soft active:scale-95"
          >
            {t("pro.manageMilestones")}
            <ArrowLeft size={14} className="ltr:rotate-180" />
          </button>
        </div>
        </div>
      </div>
    </article>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  sub,
  muted,
  tone = "gold",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string | null;
  muted?: boolean;
  tone?: "gold" | "violet";
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl bg-cream-2/70 p-3 ring-1 ring-forest/5">
      <Icon size={14} className={`mt-0.5 shrink-0 ${tone === "violet" ? "text-violet-500" : "text-gold"}`} />
      <div className="min-w-0">
        <p className="text-[10.5px] text-clay">{label}</p>
        <p className={`truncate text-[13px] font-semibold ${muted ? "text-clay" : "text-forest"}`} title={value}>
          {value}
        </p>
        {sub && <p className="truncate text-[10.5px] text-clay">{sub}</p>}
      </div>
    </div>
  );
}
