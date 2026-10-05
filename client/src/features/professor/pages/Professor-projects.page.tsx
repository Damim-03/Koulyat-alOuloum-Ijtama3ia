import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Crown,
  FileCheck2,
  FolderKanban,
  Layers,
  ListChecks,
  Paperclip,
  RotateCcw,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMyGroups } from "../hooks/Professor-hook";
import { useDates } from "../../../hooks/use-dates";
import type { ProjectGroupListItem } from "../../../types/professor.types";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import { personName } from "../../../lib/person-name";

/**
 * The projects a professor supervises.
 *
 * Each card answers what he comes here to learn about a project before
 * opening it: how far it has come, whether anything is late, what is due
 * next, when it is defended, who is on it, and what they have handed in.
 * The header counts the projects that need looking at and filters to them.
 */

type Filter = "all" | "late" | "defense" | "empty";

type Derived = {
  g: ProjectGroupListItem;
  total: number;
  completed: number;
  overdue: number;
  percent: number;
  files: number;
  next: { title: string; deadline: string } | null;
  defenseUpcoming: boolean;
};

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

function fullName(u?: { firstName?: string | null; lastName?: string | null } | null) {
  return personName(u);
}

function derive(g: ProjectGroupListItem, now: Date): Derived {
  const ms = g.milestones ?? [];
  const late = (m: { status: string; deadline: string }) =>
    m.status !== "completed" &&
    (m.status === "overdue" || new Date(m.deadline) < now);
  const completed = ms.filter((m) => m.status === "completed").length;
  const next =
    [...ms]
      .filter((m) => m.status !== "completed" && !late(m))
      .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0] ?? null;
  return {
    g,
    total: ms.length,
    completed,
    overdue: ms.filter(late).length,
    percent: ms.length ? Math.round((completed / ms.length) * 100) : 0,
    files: ms.reduce((n, m) => n + (m._count?.submissions ?? 0), 0),
    next: next ? { title: next.title, deadline: next.deadline } : null,
    defenseUpcoming:
      g.defense?.status === "scheduled" && new Date(g.defense.date) >= now,
  };
}

export function ProfessorProjectsPage() {
  const { t } = useTranslation();
  const { data: groups, isLoading, isError, refetch } = useMyGroups();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sheetTopicId, setSheetTopicId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    return (groups ?? []).map((g) => derive(g, now));
  }, [groups]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    late: rows.filter((r) => r.overdue > 0).length,
    defense: rows.filter((r) => r.defenseUpcoming).length,
    empty: rows.filter((r) => r.total === 0).length,
  };
  const students = rows.reduce((n, r) => n + (r.g.members?.length ?? 0), 0);
  const avg = rows.length
    ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length)
    : 0;

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === "late" && r.overdue === 0) return false;
    if (filter === "defense" && !r.defenseUpcoming) return false;
    if (filter === "empty" && r.total > 0) return false;
    if (!q) return true;
    const hay = [
      r.g.topic?.title,
      ...(r.g.members ?? []).flatMap((m) => [
        fullName(m.student?.user),
        m.student?.registrationNumber,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="space-y-6 font-body">
      <Hero
        counts={counts}
        students={students}
        avg={avg}
        filter={filter}
        onFilter={setFilter}
      />

      {rows.length > 0 && (
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-clay"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pro.pj.search")}
            className="w-full rounded-2xl border border-forest/15 bg-cream-card py-3.5 ps-5 pe-12 text-sm text-forest shadow-[0_4px_24px_rgba(38,66,61,0.04)] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
      )}

      {isLoading ? (
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <Empty icon={FolderKanban} text={t("pro.noProjectsYet")} />
      ) : shown.length === 0 ? (
        <div className={`${CARD} grid place-items-center gap-3 px-6 py-14 text-center`}>
          <p className="text-sm text-clay">{t("pro.pj.noMatch")}</p>
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setSearch("");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
          >
            <RotateCcw size={13} />
            {t("pro.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {shown.map((r) => (
            <ProjectCard
              key={r.g.id}
              row={r}
              onSheet={(id) => setSheetTopicId(id)}
            />
          ))}
        </div>
      )}

      {sheetTopicId && (
        <SupervisionDialog
          topicId={sheetTopicId}
          onClose={() => setSheetTopicId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  header
// ─────────────────────────────────────────────────────────────

function Hero({
  counts,
  students,
  avg,
  filter,
  onFilter,
}: {
  counts: Record<Filter, number>;
  students: number;
  avg: number;
  filter: Filter;
  onFilter: (f: Filter) => void;
}) {
  const { t } = useTranslation();

  const tiles: {
    key: Filter;
    label: string;
    icon: LucideIcon;
    tone: string;
    alarm?: boolean;
  }[] = [
    { key: "all", label: t("pro.pj.filterAll"), icon: FolderKanban, tone: "text-cream" },
    {
      key: "late",
      label: t("pro.pj.filterLate"),
      icon: AlertTriangle,
      tone: counts.late > 0 ? "text-[#f0a48f]" : "text-soft-sage",
      alarm: counts.late > 0,
    },
    { key: "defense", label: t("pro.pj.filterDefense"), icon: CalendarCheck, tone: "text-violet-300" },
    { key: "empty", label: t("pro.pj.filterEmpty"), icon: ListChecks, tone: "text-gold-soft" },
  ];

  return (
    <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
      {/* ornament, clipped by a layer of its own so the card never scrolls */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)]">
            <FolderKanban size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-bold text-cream">
              {t("pro.myProjectsTitle")}
            </h1>
            <p className="mt-1 text-sm text-soft-sage">{t("pro.myProjectsSubtitle")}</p>
          </div>
        </div>

        {/* the two numbers that sum the whole page up */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <Ring percent={avg} size={52} />
            <div>
              <p className="text-[11px] text-soft-sage">{t("pro.pj.avgProgress")}</p>
              <p className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">
                {avg}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="grid size-[52px] place-items-center rounded-full bg-white/8 text-gold-soft">
              <Users size={22} />
            </span>
            <div>
              <p className="text-[11px] text-soft-sage">{t("pro.supervisedStudents")}</p>
              <p className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">
                {students}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* the counts — each one is also the filter to it */}
      <div
        role="group"
        aria-label={t("pro.filters")}
        className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {tiles.map(({ key, label, icon: Icon, tone, alarm }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(active && key !== "all" ? "all" : key)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                active
                  ? "border-gold/70 bg-white/12 shadow-[0_0_0_1px_rgba(217,174,114,0.35)]"
                  : alarm
                    ? "border-[#f0a48f]/40 bg-[#f0a48f]/10 hover:bg-[#f0a48f]/15"
                    : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
              }`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-none font-bold text-cream tabular-nums">
                  {counts[key]}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-tight text-soft-sage">
                  {label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  one project
// ─────────────────────────────────────────────────────────────

function ProjectCard({
  row,
  onSheet,
}: {
  row: Derived;
  onSheet: (topicId: string) => void;
}) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();
  const { g, total, completed, overdue, percent, files, next } = row;
  const members = g.members ?? [];
  const defense = g.defense ?? null;

  const state =
    total === 0
      ? { label: t("pro.pj.stateEmpty"), cls: "bg-forest/8 text-clay ring-forest/15" }
      : overdue > 0
        ? { label: t("pro.pj.stateLate"), cls: "bg-brick/10 text-brick ring-brick/25" }
        : completed === total
          ? { label: t("pro.pj.stateDone"), cls: "bg-sage/15 text-sage ring-sage/30" }
          : { label: t("pro.pj.stateActive"), cls: "bg-gold/15 text-gold ring-gold/30" };

  return (
    <article
      // An odd one out takes the whole row rather than half of it.
      className={`relative flex flex-col overflow-hidden xl:[&:last-child:nth-child(odd)]:col-span-2 ${CARD}`}
    >
      {/* a stripe in the state's colour */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 start-0 w-1.5 ${
          total === 0 ? "bg-clay/40" : overdue > 0 ? "bg-brick" : completed === total ? "bg-sage" : "bg-gold"
        }`}
      />

      <div className="flex flex-1 flex-col p-6 ps-8">
        {/* title and state */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`../groups/${g.id}`}
              className="line-clamp-2 font-serif text-lg leading-snug font-bold text-forest transition hover:text-gold"
            >
              {g.topic?.title ?? "—"}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-clay">
              {g.topic?.specialization?.name && (
                <span className="inline-flex items-center gap-1">
                  <Layers size={12} className="text-gold" />
                  {g.topic.specialization.name}
                </span>
              )}
              {g.topic?.academicYear?.title && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={12} className="text-gold" />
                  {g.topic.academicYear.title}
                </span>
              )}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${state.cls}`}>
            {state.label}
          </span>
        </div>

        {/* progress beside the team */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-3 rounded-2xl bg-cream-2/70 p-4 ring-1 ring-forest/5">
            <Ring percent={percent} size={64} light alarm={overdue > 0} />
            <div>
              <p className="text-[11px] text-clay">{t("pro.milestoneProgress")}</p>
              <p className="font-serif text-lg font-bold text-forest tabular-nums" dir="ltr">
                {completed}/{total}
              </p>
              {overdue > 0 && (
                <p className="flex items-center gap-1 text-[11px] font-semibold text-brick">
                  <AlertTriangle size={11} />
                  {t("pro.overdueCount", { count: overdue })}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-cream-2/70 p-4 ring-1 ring-forest/5">
            <p className="mb-2 flex items-center justify-between text-[11px] text-clay">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-gold" />
                {t("pro.membersCount", { count: members.length })}
              </span>
              {g.topic?.maxStudents ? (
                <span className="tabular-nums" dir="ltr">
                  {members.length}/{g.topic.maxStudents}
                </span>
              ) : null}
            </p>
            <ul className="space-y-1.5">
              {members.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <UserAvatar
                    user={m.student?.user}
                    size={26}
                    className={m.isLeader ? "ring-2 ring-gold" : ""}
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-medium text-forest">
                    <span className="truncate">
                      {fullName(m.student?.user) || m.student?.registrationNumber || "—"}
                    </span>
                    {m.isLeader && (
                      <Crown size={12} className="shrink-0 text-gold" aria-label={t("pro.leader")} />
                    )}
                  </span>
                </li>
              ))}
              {members.length > 3 && (
                <li className="ps-8 text-[11px] text-clay">{`+${members.length - 3}`}</li>
              )}
              {members.length === 0 && (
                <li className="text-[12px] text-clay">—</li>
              )}
            </ul>
          </div>
        </div>

        {/* the dates that matter, and what came in */}
        <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Fact
            icon={CalendarClock}
            label={t("pro.pj.next")}
            value={next ? next.title : t("pro.pj.noNext")}
            sub={next ? relative(next.deadline) : null}
          />
          <Fact
            icon={CalendarCheck}
            label={t("pro.pj.defense")}
            value={
              defense && defense.status !== "cancelled"
                ? fmtDate(defense.date)
                : t("pro.pj.notScheduled")
            }
            sub={
              defense?.status === "completed" && defense.grade != null
                ? `${defense.grade}/20`
                : row.defenseUpcoming
                  ? `${relative(defense!.date)}${defense!.room ? ` · ${defense!.room}` : ""}`
                  : null
            }
            tone="violet"
          />
          <Fact
            icon={Paperclip}
            label={t("pro.pj.files")}
            value={String(files)}
          />
        </div>

        {/* what can be done */}
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-forest/10 pt-4">
          <Link
            to={`../groups/${g.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-forest-deep transition hover:bg-gold-soft active:scale-95"
          >
            {t("pro.manageProject")}
            <ArrowLeft size={14} className="ltr:rotate-180" />
          </Link>
          {g.topic?.id && (
            <button
              type="button"
              onClick={() => onSheet(g.topic!.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-3.5 py-2 text-xs font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10"
            >
              <FileCheck2 size={14} />
              {t("supervision.sheet")}
            </button>
          )}
          {total > 0 && completed === total && overdue === 0 && (
            <span className="ms-auto inline-flex items-center gap-1 text-[11px] font-semibold text-sage">
              <CheckCircle2 size={13} />
              {t("pro.allMilestonesDone")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
//  small pieces
// ─────────────────────────────────────────────────────────────

/** A progress arc; `light` for the cream cards, dark ground otherwise. */
function Ring({
  percent,
  size,
  light,
  alarm,
}: {
  percent: number;
  size: number;
  light?: boolean;
  alarm?: boolean;
}) {
  const gid = useId();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={alarm ? "#e07a5f" : "#e6c496"} />
            <stop offset="100%" stopColor={alarm ? "#a8442d" : "#c1965a"} />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          className={light ? "stroke-forest/10" : "stroke-white/10"}
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      {light && (
        <span className="absolute font-serif text-sm font-bold text-forest tabular-nums">
          {percent}%
        </span>
      )}
    </span>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  sub,
  tone = "gold",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string | null;
  tone?: "gold" | "violet";
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-cream-2/70 p-3 ring-1 ring-forest/5">
      <Icon
        size={15}
        className={`mt-0.5 shrink-0 ${tone === "violet" ? "text-violet-500" : "text-gold"}`}
      />
      <div className="min-w-0">
        <p className="text-[11px] text-clay">{label}</p>
        <p className="truncate text-sm font-semibold text-forest">{value}</p>
        {sub && <p className="truncate text-[11px] text-clay">{sub}</p>}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className={`${CARD} grid place-items-center gap-3 px-6 py-20 text-center`}>
      <span className="grid size-16 place-items-center rounded-full bg-gold/10 text-gold ring-8 ring-gold/5">
        <Icon size={26} />
      </span>
      <p className="max-w-sm text-sm text-clay">{text}</p>
    </div>
  );
}
