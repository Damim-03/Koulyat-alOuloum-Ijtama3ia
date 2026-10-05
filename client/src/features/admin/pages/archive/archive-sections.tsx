import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Crown,
  DoorOpen,
  FileText,
  FolderKanban,
  Gavel,
  GraduationCap,
  Hourglass,
  Inbox,
  Layers,
  Medal,
  PanelsTopLeft,
  SearchX,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { YearRecord, YearSummary } from "../../../../types/admin";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { statusChip } from "../../utils/status-styles";
import i18n from "../../../../i18n/i18n";
import { formatGrade } from "../projects/project-utils";
import { ProgressRing } from "../projects/project-ui";
import { MENTIONS, TOPIC_STATUS_BAR, TOPIC_STATUS_ORDER, byMonth, matches, mentionChip, pct } from "./archive-utils";
import { pickName, readsLatin } from "../../../../lib/person-name";
import { setPanelCollapsed, setPanelsCollapsed, useAllCollapsed, usePanelCollapsed } from "./archive-panels";

/**
 * What one year holds, tab by tab. The record is the same shape whether it
 * was frozen at closing or built live, so every section reads both. Links
 * lead to the live pages only while the year is open — a closed record may
 * name things that have since changed or gone.
 */

const STEP = 30;

export interface SectionProps {
  record: YearRecord;
  live: boolean;
  lang?: string;
  q: string;
  spec: string;
  /** Opens another tab — the overview's "see all" links. */
  goTab?: (tab: string) => void;
}

const dateOf = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString(i18n.language, o);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

const CARD = "rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]";

/* ════════════════════════════════════════════════════════════
   SHARED PIECES
   ════════════════════════════════════════════════════════════ */

export function Panel({
  id,
  icon: Icon,
  title,
  hint,
  aside,
  summary,
  children,
  className = "",
}: {
  /** Makes the panel foldable; its state is remembered under this key. */
  id?: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  aside?: ReactNode;
  /** What the header shows while the panel is folded. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const collapsed = usePanelCollapsed(id);
  const bodyId = useId();
  const toggle = () => {
    if (id) setPanelCollapsed(id, !collapsed);
  };

  return (
    <section
      data-panel={id}
      data-collapsed={collapsed ? "" : undefined}
      className={`relative overflow-hidden p-5 transition-[border-color,box-shadow] duration-300 data-collapsed:self-start lg:p-6 ${CARD} ${collapsed ? "hover:border-gold/30" : ""} ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-l from-transparent via-gold/40 to-transparent" />
      <header className={`flex items-center justify-between gap-3 ${id ? "cursor-pointer select-none" : ""}`} onClick={id ? toggle : undefined}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl border transition duration-300 ${
              collapsed ? "border-forest/10 bg-cream-2/60 text-clay" : "border-gold/25 bg-linear-to-br from-gold/20 to-gold/5 text-gold"
            }`}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="font-serif text-[16px] leading-tight font-bold text-forest">{title}</h3>
            {/* Folded, the header is one tight line. */}
            {hint && <p className={`mt-1 text-[12px] leading-relaxed text-clay ${collapsed ? "truncate" : ""}`}>{hint}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {collapsed ? (
            <span className="animate-scale-in">{summary}</span>
          ) : (
            aside && <div onClick={(e) => e.stopPropagation()}>{aside}</div>
          )}
          {id && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={collapsed ? t("admin.yearArchive.expand") : t("admin.yearArchive.collapse")}
              title={collapsed ? t("admin.yearArchive.expand") : t("admin.yearArchive.collapse")}
              data-testid={`panel-toggle-${id}`}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-forest/10 bg-cream-2/50 text-clay transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold"
            >
              <ChevronDown size={17} className={`transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] ${collapsed ? "" : "rotate-180"}`} />
            </button>
          )}
        </div>
      </header>

      {/* Rows from 1fr to 0fr: the body folds at its own height, whatever it holds. */}
      <div
        id={bodyId}
        inert={collapsed}
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,.61,.36,1)] ${
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="-mx-3 min-h-0 overflow-hidden px-3">
          <div className="pt-5 pb-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The short line a folded panel keeps in its header. */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[11.5px] font-semibold whitespace-nowrap text-forest">
      {children}
    </span>
  );
}

/** "See all" — from an overview panel to its tab. */
function SeeAll({ onClick, label }: { onClick?: () => void; label: string }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-gold transition hover:bg-gold/10"
    >
      {label}
      <ChevronLeft size={14} className="ltr:rotate-180" />
    </button>
  );
}

function Empty({ filtered, hint }: { filtered: boolean; hint?: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-forest/15 bg-cream-card px-4 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
        {filtered ? <SearchX size={24} /> : <Inbox size={24} />}
      </span>
      <p className="text-sm font-semibold text-forest">{filtered ? t("admin.yearArchive.noMatch") : t("admin.yearArchive.nothing")}</p>
      {hint && <p className="max-w-sm text-[12px] text-clay">{hint}</p>}
    </div>
  );
}

function More({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const { t } = useTranslation();
  if (shown >= total) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button
        type="button"
        onClick={onMore}
        className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-xs font-semibold text-forest transition hover:bg-gold/20"
      >
        <ChevronDown size={14} className="text-gold" />
        {t("admin.yearArchive.showMore", { shown, total })}
      </button>
    </div>
  );
}

function MaybeLink({ to, live, className, children }: { to: string; live: boolean; className?: string; children: ReactNode }) {
  if (!live) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={`${className ?? ""} transition hover:text-gold`}>
      {children}
    </Link>
  );
}

/** A grade the way a transcript shows it: the figure, out of 20, and its mention. */
function Grade({ grade, mention, size = "md" }: { grade: number | null; mention: string | null; size?: "md" | "lg" }) {
  const { t } = useTranslation();
  if (grade === null) return <span className="text-[11.5px] text-clay">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {/* "17.25 /20" reads left to right whatever the page direction. */}
      <span dir="ltr" className="inline-flex items-baseline gap-0.5">
        <b className={`font-serif leading-none text-forest tabular-nums ${size === "lg" ? "text-[26px]" : "text-[16px]"}`}>{formatGrade(grade)}</b>
        <span className="text-[10.5px] text-clay">/20</span>
      </span>
      {mention && (
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${mentionChip(mention as never)}`}>
          {t(`admin.proj.mention.${mention}`)}
        </span>
      )}
    </span>
  );
}

/** The outcome of a defence, whatever state it is in. */
function Outcome({ d }: { d: { status: string; grade: number | null; mention: string | null } | null | undefined }) {
  const { t } = useTranslation();
  if (d?.status === "completed" && d.grade !== null) return <Grade grade={d.grade} mention={d.mention} />;
  const state = d?.status ?? "none";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${statusChip(d?.status ?? "")}`}>
      {t(`admin.proj.defenseState.${state}`)}
      {state === "completed" && ` · ${t("admin.yearArchive.noGrade")}`}
    </span>
  );
}

type Chip = { value: string; label: string; count: number; dot?: string };

/** Quick filters with their counts — the first thing to reach for in a long list. */
function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Chip[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="group">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            disabled={!on && o.count === 0}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              on
                ? "border-gold/60 bg-gold/15 text-forest shadow-[0_0_0_1px_rgba(193,150,90,0.2)]"
                : "border-forest/12 bg-cream-card text-clay hover:border-forest/25 hover:text-forest"
            }`}
          >
            {o.dot && <span className={`size-2 rounded-full ${o.dot}`} />}
            {o.label}
            <span className={`rounded-full px-1.5 py-px text-[10.5px] tabular-nums ${on ? "bg-gold/25 text-forest" : "bg-forest/6 text-forest/70"}`}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-start text-[11px] font-bold tracking-wide whitespace-nowrap text-clay ${className}`}>{children}</th>;
}

function useLimit() {
  const [limit, setLimit] = useState(STEP);
  return [limit, () => setLimit((l) => l + STEP)] as const;
}

/** Photo, department and the rest of a supervisor, gathered from the record. */
function useSupervisorInfo(record: YearRecord) {
  return useMemo(() => {
    const m = new Map<string, { avatarUrl: string | null; gender: "male" | "female" | null; department: string | null }>();
    for (const t of record.topics) m.set(t.supervisor.id, { avatarUrl: null, gender: null, department: t.department });
    for (const p of record.projects) {
      const cur = m.get(p.supervisor.id);
      m.set(p.supervisor.id, { department: cur?.department ?? null, avatarUrl: p.supervisor.avatarUrl, gender: p.supervisor.gender });
    }
    return m;
  }, [record]);
}

/* ════════════════════════════════════════════════════════════
   OVERVIEW
   ════════════════════════════════════════════════════════════ */

const PANELS = ["ov.mentions", "ov.pulse", "ov.honor", "ov.spec", "ov.topics", "ov.supervisors"] as const;

/** One decimal at most, in the same digits as the rest of the page. */
const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

export function OverviewSection({ record, live, lang, goTab }: SectionProps) {
  const { t } = useTranslation();
  const s = record.summary;
  const allFolded = useAllCollapsed(PANELS);
  // The status most topics are in — what a folded topics panel still says.
  const topStatus = Object.entries(s.topicsByStatus).sort((a, b) => b[1] - a[1])[0];
  const best = useMemo(
    () => record.defenses.filter((d) => d.status === "completed" && d.grade !== null).sort((a, b) => (b.grade as number) - (a.grade as number))[0],
    [record],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-cream-card/70 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[12px] text-clay">
          <PanelsTopLeft size={15} className="text-gold" />
          {t("admin.yearArchive.panelsHint")}
        </p>
        <button
          type="button"
          onClick={() => setPanelsCollapsed(PANELS, !allFolded)}
          data-testid="panels-toggle-all"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-[12px] font-semibold text-forest transition hover:bg-gold/20"
        >
          {allFolded ? <ChevronsUpDown size={14} className="text-gold" /> : <ChevronsDownUp size={14} className="text-gold" />}
          {allFolded ? t("admin.yearArchive.expandAll") : t("admin.yearArchive.collapseAll")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel
          id="ov.mentions"
          icon={Award}
          title={t("admin.yearArchive.ov.mentions")}
          hint={t("admin.yearArchive.ov.mentionsHint", { count: s.graded })}
          summary={
            <Pill>
              {t("admin.yearArchive.kpi.average")}
              <b dir="ltr" className="font-serif tabular-nums">
                {s.averageGrade != null ? `${formatGrade(s.averageGrade)} /20` : "—"}
              </b>
            </Pill>
          }
        >
          <MentionsBoard s={s} />
        </Panel>
        <Panel
          id="ov.pulse"
          icon={Activity}
          title={t("admin.yearArchive.ov.pulse")}
          hint={t("admin.yearArchive.ov.pulseHint")}
          summary={
            <Pill>
              {t("admin.yearArchive.ov.ring.inProjects")}
              <b className="font-serif tabular-nums">{s.students ? `${pct(s.studentsWithProject, s.students)}%` : "—"}</b>
            </Pill>
          }
        >
          <Pulse s={s} />
        </Panel>
      </div>

      <Panel
        id="ov.honor"
        icon={Trophy}
        title={t("admin.yearArchive.ov.honor")}
        hint={t("admin.yearArchive.ov.honorHint")}
        aside={<SeeAll onClick={goTab && (() => goTab("defenses"))} label={t("admin.yearArchive.seeAll.defenses")} />}
        summary={
          <Pill>
            <Trophy size={13} className="text-gold" />
            {best ? (
              <b dir="ltr" className="font-serif tabular-nums">
                {formatGrade(best.grade)} /20
              </b>
            ) : (
              t("admin.yearArchive.ov.noGradesShort")
            )}
          </Pill>
        }
      >
        <HonorBoard record={record} live={live} lang={lang} />
      </Panel>

      <Panel
        id="ov.spec"
        icon={Layers}
        title={t("admin.yearArchive.ov.bySpec")}
        hint={t("admin.yearArchive.ov.bySpecHint")}
        summary={<Pill>{t("admin.yearArchive.ov.specCount", { count: record.bySpecialization.length })}</Pill>}
      >
        <Specializations record={record} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          id="ov.topics"
          icon={BookOpen}
          title={t("admin.yearArchive.ov.topics")}
          hint={t("admin.yearArchive.ov.topicsHint", { count: s.topics })}
          aside={<SeeAll onClick={goTab && (() => goTab("topics"))} label={t("admin.yearArchive.seeAll.topics")} />}
          summary={
            topStatus ? (
              <Pill>
                <span className={`size-2 rounded-full ${TOPIC_STATUS_BAR[topStatus[0]] ?? "bg-gray-400"}`} />
                {t(`status.${topStatus[0]}`)}
                <b className="tabular-nums">{topStatus[1]}</b>
              </Pill>
            ) : (
              <Pill>{t("admin.yearArchive.nothing")}</Pill>
            )
          }
        >
          <TopicsBoard s={s} />
        </Panel>
        <Panel
          id="ov.supervisors"
          icon={GraduationCap}
          title={t("admin.yearArchive.ov.topSupervisors")}
          hint={t("admin.yearArchive.ov.topSupervisorsHint", { count: record.supervisors.length })}
          aside={<SeeAll onClick={goTab && (() => goTab("supervisors"))} label={t("admin.yearArchive.seeAll.supervisors")} />}
          summary={
            <Pill>
              {record.supervisors[0] ? (
                <>
                  <Crown size={12} className="text-gold" />
                  {record.supervisors[0].name}
                </>
              ) : (
                t("admin.yearArchive.nothing")
              )}
            </Pill>
          }
        >
          <TopSupervisors record={record} live={live} lang={lang} />
        </Panel>
      </div>
    </div>
  );
}

/** A donut of mentions with the year's average in its middle, and the legend beside it. */
function MentionsBoard({ s }: { s: YearSummary }) {
  const { t } = useTranslation();
  const graded = MENTIONS.reduce((n, m) => n + (s.mentions[m.key] ?? 0), 0);
  const size = 184;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const present = MENTIONS.filter((m) => (s.mentions[m.key] ?? 0) > 0);
  const gap = present.length > 1 ? 4 : 0;
  // Each segment starts where the ones before it end.
  const segs = present.map((m, i) => ({
    m,
    len: (c * s.mentions[m.key]) / graded,
    start: present.slice(0, i).reduce((n, x) => n + (c * s.mentions[x.key]) / graded, 0),
  }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={t("admin.yearArchive.ov.mentions")}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={graded ? undefined : "6 7"}
            className={graded ? "stroke-forest/8" : "stroke-forest/12"}
          />
          {segs.map(({ m, len, start }) => (
            <circle
              key={m.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
              strokeDashoffset={-start}
              className={`${m.stroke} transition-all duration-700`}
            >
              <title>{`${t(`admin.proj.mention.${m.key}`)}: ${s.mentions[m.key]}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="block text-[10.5px] font-semibold tracking-wide text-clay">{t("admin.yearArchive.kpi.average")}</span>
            <b className="block font-serif text-[34px] leading-tight text-forest tabular-nums">{s.averageGrade != null ? formatGrade(s.averageGrade) : "—"}</b>
            <span className="block text-[11px] text-clay">
              {s.averageGrade != null ? t("admin.yearArchive.outOf20") : t("admin.yearArchive.ov.noGradesShort")}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full flex-1">
        <ul className={graded ? "space-y-2" : "grid grid-cols-1 gap-1.5 sm:grid-cols-2"}>
          {MENTIONS.map((m) => {
            const n = s.mentions[m.key] ?? 0;
            return (
              <li key={m.key} className={`rounded-xl border border-forest/8 bg-cream-2/40 px-3 ${graded ? "py-2" : "py-1.5 opacity-60"}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`size-2.5 shrink-0 rounded-full ${m.dot}`} />
                  <span className="flex-1 text-[12.5px] font-medium text-forest">{t(`admin.proj.mention.${m.key}`)}</span>
                  {graded > 0 && (
                    <>
                      <b className="font-serif text-[15px] text-forest tabular-nums">{n}</b>
                      <span className="w-10 text-end text-[11px] text-clay tabular-nums">{pct(n, graded)}%</span>
                    </>
                  )}
                </div>
                {graded > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-forest/6">
                    <div className={`h-full rounded-full ${m.bar} transition-[width] duration-700`} style={{ width: `${pct(n, graded)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!graded && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-gold/30 bg-gold/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-clay">
            <Award size={14} className="mt-0.5 shrink-0 text-gold" />
            {t("admin.yearArchive.ov.mentionsEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Three rings — how far the year went — and the figures around them. */
function Pulse({ s }: { s: YearSummary }) {
  const { t } = useTranslation();
  const passed = s.passRate != null ? Math.round((s.passRate / 100) * s.graded) : 0;
  // A ring with nothing to measure says so, instead of reading "0%".
  const rings: { label: string; value: number | null; tone: "sage" | "gold" | "danger"; of: string }[] = [
    {
      label: t("admin.yearArchive.ov.ring.inProjects"),
      value: s.students ? pct(s.studentsWithProject, s.students) : null,
      tone: "sage",
      of: t("admin.yearArchive.ov.ofTotal", { n: s.studentsWithProject, total: s.students }),
    },
    {
      label: t("admin.yearArchive.ov.ring.defended"),
      value: s.projects ? pct(s.defenses.completed, s.projects) : null,
      tone: "gold",
      of: t("admin.yearArchive.ov.ofTotal", { n: s.defenses.completed, total: s.projects }),
    },
    {
      label: t("admin.yearArchive.ov.ring.pass"),
      value: s.passRate != null ? Math.round(s.passRate) : null,
      tone: s.passRate != null && s.passRate < 50 ? "danger" : "sage",
      of: s.graded ? t("admin.yearArchive.ov.ofTotal", { n: passed, total: s.graded }) : t("admin.yearArchive.ov.noGradesShort"),
    },
  ];
  const facts: { icon: LucideIcon; label: string; value: string | number }[] = [
    { icon: Users, label: t("admin.yearArchive.ov.fact.teamSize"), value: s.projects ? oneDecimal(s.studentsWithProject / s.projects) : "—" },
    { icon: BookOpen, label: t("admin.yearArchive.ov.fact.topicsPerSup"), value: s.supervisors ? oneDecimal(s.topics / s.supervisors) : "—" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rings.map((r) => (
          <div key={r.label} className="flex flex-col items-center gap-2.5 rounded-2xl border border-forest/8 bg-cream-2/40 px-3 py-4 text-center">
            {r.value === null ? (
              <span className="grid size-[88px] place-items-center rounded-full border-[7px] border-dashed border-forest/12 font-serif text-[22px] font-bold text-clay">—</span>
            ) : (
              <ProgressRing value={r.value} size={88} stroke={7} tone={r.tone} label={r.label} />
            )}
            <div>
              <p className="text-[12.5px] font-semibold text-forest">{r.label}</p>
              <p className="mt-0.5 text-[11px] text-clay tabular-nums">{r.of}</p>
            </div>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {facts.map((f) => (
          <div key={f.label} className="flex items-center gap-2.5 rounded-xl border border-forest/8 bg-cream-2/40 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/12 text-gold">
              <f.icon size={15} />
            </span>
            <dt className="flex-1 text-[11.5px] leading-tight text-clay">{f.label}</dt>
            <dd className="font-serif text-[17px] font-bold text-forest tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const MEDAL = [
  { ring: "from-gold to-gold-soft text-forest-deep", glow: "shadow-[0_10px_30px_-12px_rgba(193,150,90,0.7)]", border: "border-gold/40" },
  { ring: "from-slate-200 to-slate-400 text-slate-800", glow: "", border: "border-slate-300/50" },
  { ring: "from-amber-600 to-amber-800 text-amber-50", glow: "", border: "border-amber-600/30" },
];

/** The year's best three results. */
function HonorBoard({ record, live, lang }: { record: YearRecord; live: boolean; lang?: string }) {
  const { t } = useTranslation();
  const top = useMemo(
    () =>
      record.defenses
        .filter((d) => d.status === "completed" && d.grade !== null)
        .sort((a, b) => (b.grade as number) - (a.grade as number))
        .slice(0, 3),
    [record],
  );
  if (top.length === 0)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gold/30 bg-gold/5 px-4 py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <Medal size={20} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-clay">{t("admin.yearArchive.ov.honorEmpty")}</p>
      </div>
    );
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {top.map((d, i) => (
        <li key={d.id} className={`relative overflow-hidden rounded-2xl border bg-cream-2/40 p-4 ${MEDAL[i].border} ${MEDAL[i].glow}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className={`grid size-10 place-items-center rounded-full bg-linear-to-br font-serif text-[16px] font-bold ${MEDAL[i].ring}`}>{i + 1}</span>
            <Grade grade={d.grade} mention={d.mention} size="lg" />
          </div>
          <MaybeLink live={live} to={`/${lang}/admin/defenses/${d.id}`} className="line-clamp-2 font-serif text-[14.5px] leading-snug font-bold text-forest">
            {d.title}
          </MaybeLink>
          <p className="mt-1.5 line-clamp-1 text-[11.5px] text-clay">
            <Users size={12} className="me-1 inline text-gold" />
            {d.students.join("، ")}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-clay">
            <GraduationCap size={12} className="me-1 inline text-gold" />
            {d.supervisor}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The year as each specialization lived it. */
function Specializations({ record }: { record: YearRecord }) {
  const { t } = useTranslation();
  const placed = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of record.students) if (s.project) m.set(s.specialization.id, (m.get(s.specialization.id) ?? 0) + 1);
    return m;
  }, [record]);

  if (record.bySpecialization.length === 0)
    return <p className="rounded-xl bg-forest/5 px-3 py-6 text-center text-[12px] text-clay">{t("admin.yearArchive.nothing")}</p>;

  return (
    // auto-fit: two specializations share the whole row instead of leaving a third of it empty.
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
      {record.bySpecialization.map((r) => {
        const inProj = placed.get(r.id) ?? 0;
        const share = pct(inProj, r.students);
        return (
          <li key={r.id} className="group rounded-2xl border border-forest/10 bg-cream-2/40 p-4 transition hover:border-gold/35 hover:bg-cream-2/70">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-[15px] leading-snug font-bold text-forest">{r.name}</p>
                <span className="mt-1 inline-flex rounded-full border border-forest/10 bg-cream-card px-2 py-0.5 text-[10.5px] font-semibold text-clay">
                  {t(`admin.proj.level.${r.level}`)}
                </span>
              </div>
              <div className="shrink-0 rounded-xl border border-gold/25 bg-gold/10 px-3 py-1.5 text-center">
                <span className="block text-[9.5px] font-semibold text-clay">{t("admin.yearArchive.col.average")}</span>
                <b className="block font-serif text-[15px] leading-tight text-forest tabular-nums">{r.averageGrade != null ? formatGrade(r.averageGrade) : "—"}</b>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              {(
                [
                  ["students", r.students, Users],
                  ["topics", r.topics, BookOpen],
                  ["projects", r.projects, FolderKanban],
                  ["defended", r.defended, Gavel],
                ] as const
              ).map(([k, v, Icon]) => (
                <div key={k} className="rounded-xl bg-cream-card px-1 py-2">
                  <Icon size={13} className="mx-auto mb-1 text-gold" />
                  <b className="block font-serif text-[16px] leading-none text-forest tabular-nums">{v}</b>
                  <span className="mt-1 block truncate text-[10px] text-clay">{t(`admin.yearArchive.count.${k}`)}</span>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-clay">{t("admin.yearArchive.ov.ring.inProjects")}</span>
                <span className="font-semibold text-forest tabular-nums">
                  {t("admin.yearArchive.ov.ofTotal", { n: inProj, total: r.students })} · {share}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
                <div className="h-full rounded-full bg-linear-to-l from-sage to-soft-sage transition-[width] duration-700" style={{ width: `${share}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopicsBoard({ s }: { s: YearSummary }) {
  const { t } = useTranslation();
  const total = Object.values(s.topicsByStatus).reduce((a, b) => a + b, 0);
  const req = s.requests ?? {};
  const REQ = [
    ["accepted", "border-emerald-400/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"],
    ["pending", "border-amber-400/30 bg-amber-500/8 text-amber-700 dark:text-amber-300"],
    ["rejected", "border-rose-400/30 bg-rose-500/8 text-rose-700 dark:text-rose-300"],
  ] as const;
  return (
    <>
      {total === 0 ? (
        <p className="rounded-xl bg-forest/5 px-3 py-6 text-center text-[12px] text-clay">{t("admin.yearArchive.nothing")}</p>
      ) : (
        <ul className="space-y-3">
          {TOPIC_STATUS_ORDER.filter((k) => s.topicsByStatus[k]).map((k) => (
            <li key={k}>
              <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                <span className={`size-2 rounded-full ${TOPIC_STATUS_BAR[k]}`} />
                <span className="flex-1 font-medium text-forest">{t(`status.${k}`)}</span>
                <b className="text-forest tabular-nums">{s.topicsByStatus[k]}</b>
                <span className="w-10 text-end text-[11px] text-clay tabular-nums">{pct(s.topicsByStatus[k], total)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-forest/6">
                <div className={`h-full rounded-full ${TOPIC_STATUS_BAR[k]} transition-[width] duration-700`} style={{ width: `${pct(s.topicsByStatus[k], total)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 mb-2 text-[11px] font-bold tracking-wide text-gold">{t("admin.yearArchive.ov.requestsTitle")}</p>
      <div className="grid grid-cols-3 gap-2">
        {REQ.map(([k, cls]) => (
          <div key={k} className={`rounded-xl border p-3 text-center ${cls}`}>
            <b className="block font-serif text-[20px] leading-none tabular-nums">{req[k] ?? 0}</b>
            <span className="mt-1 block text-[10.5px] font-semibold">{t(`admin.yearArchive.ov.req.${k}`)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TopSupervisors({ record, live, lang }: { record: YearRecord; live: boolean; lang?: string }) {
  const { t } = useTranslation();
  const info = useSupervisorInfo(record);
  if (record.supervisors.length === 0)
    return <p className="rounded-xl bg-forest/5 px-3 py-6 text-center text-[12px] text-clay">{t("admin.yearArchive.nothing")}</p>;
  return (
    <ol className="space-y-2">
      {record.supervisors.slice(0, 5).map((p, i) => {
        const meta = info.get(p.id);
        return (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-2/40 px-3 py-2.5">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                i === 0 ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep" : "bg-forest/8 text-forest"
              }`}
            >
              {i + 1}
            </span>
            <UserAvatar user={meta} size={38} tone="gold" className="ring-2 ring-gold/20" />
            <div className="min-w-0 flex-1">
              <MaybeLink live={live} to={`/${lang}/admin/professors/${p.id}`} className="block truncate text-[13px] font-semibold text-forest">
                {p.name}
              </MaybeLink>
              {meta?.department && (
                <p className="flex items-center gap-1 truncate text-[10.5px] text-clay">
                  <Building2 size={10} className="shrink-0" />
                  {meta.department}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-forest/8">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${pct(p.projects, record.summary.projects)}%` }} />
                </div>
                <span className="shrink-0 text-[10.5px] text-clay tabular-nums">{t("admin.yearArchive.ov.supLine", { projects: p.projects, defended: p.defended })}</span>
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-gold/25 bg-gold/10 px-2.5 py-1.5 text-center">
              <b className="block font-serif text-[15px] leading-none text-forest tabular-nums">{p.averageGrade != null ? formatGrade(p.averageGrade) : "—"}</b>
              <span className="text-[9.5px] text-clay">{t("admin.yearArchive.col.average")}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ════════════════════════════════════════════════════════════
   STUDENTS
   ════════════════════════════════════════════════════════════ */

export function StudentsSection({ record, live, lang, q, spec }: SectionProps) {
  const { t } = useTranslation();
  const [limit, more] = useLimit();
  const [f, setF] = useState("all");
  const base = record.students.filter(
    (s) => (!spec || s.specialization.id === spec) && matches(q, s.name, s.latinName, s.registrationNumber, s.project?.title),
  );
  const test: Record<string, (s: (typeof base)[number]) => boolean> = {
    all: () => true,
    withProject: (s) => !!s.project,
    noProject: (s) => !s.project,
    defended: (s) => s.defense?.status === "completed",
  };
  const rows = base.filter(test[f]);
  const chips: Chip[] = (["all", "withProject", "noProject", "defended"] as const).map((k) => ({
    value: k,
    label: t(`admin.yearArchive.f.${k}`),
    count: base.filter(test[k]).length,
  }));

  return (
    <>
      <Chips value={f} onChange={setF} options={chips} />
      {!rows.length ? (
        <Empty filtered={!!(q || spec || f !== "all")} />
      ) : (
        <div className={`overflow-hidden ${CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-[12.5px]" data-testid="archive-students">
              <colgroup>
                <col className="w-12" />
                <col className="w-[27%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="border-b border-forest/10 bg-cream-2/60">
                <tr>
                  <Th className="text-center">#</Th>
                  <Th>{t("admin.yearArchive.col.student")}</Th>
                  <Th>{t("admin.yearArchive.col.reg")}</Th>
                  <Th>{t("admin.yearArchive.col.specialization")}</Th>
                  <Th>{t("admin.yearArchive.col.project")}</Th>
                  <Th>{t("admin.yearArchive.col.result")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/6">
                {rows.slice(0, limit).map((s, i) => (
                  <tr key={s.id} className="transition hover:bg-gold/[0.04]">
                    <td className="px-4 py-3 text-center text-[11px] text-clay tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={s} size={38} className="ring-2 ring-gold/20" />
                        <div className="min-w-0">
                          <MaybeLink live={live} to={`/${lang}/admin/students/${s.id}`} className="block truncate text-[13px] font-semibold text-forest">
                            <bdi>{pickName(s.name, s.latinName) || "—"}</bdi>
                          </MaybeLink>
                          {s.latinName && s.name && (
                            <span className="block truncate text-[11px] text-clay">
                              <bdi>{readsLatin() ? s.name : s.latinName}</bdi>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span dir="ltr" className="inline-flex rounded-lg border border-forest/10 bg-cream-2/60 px-2 py-1 font-mono text-[11.5px] text-forest tabular-nums">
                        {s.registrationNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block truncate text-forest">{s.specialization.name}</span>
                      <span className="text-[10.5px] text-clay">{t(`admin.proj.level.${s.specialization.level}`)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.project ? (
                        <div className="min-w-0">
                          <MaybeLink live={live} to={`/${lang}/admin/projects/${s.project.id}`} className="flex items-center gap-1.5 text-forest">
                            <FolderKanban size={13} className="shrink-0 text-gold" />
                            <span className="truncate font-medium">{s.project.title}</span>
                          </MaybeLink>
                          {s.project.leader && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-semibold text-gold">
                              <Crown size={10} />
                              {t("admin.yearArchive.leader")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-forest/20 px-2.5 py-0.5 text-[11px] text-clay">{t("admin.yearArchive.noProject")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{s.project ? <Outcome d={s.defense} /> : <span className="text-clay">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <More shown={Math.min(limit, rows.length)} total={rows.length} onMore={more} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   TOPICS
   ════════════════════════════════════════════════════════════ */

export function TopicsSection({ record, live, lang, q, spec }: SectionProps) {
  const { t } = useTranslation();
  const [limit, more] = useLimit();
  const [f, setF] = useState("all");
  const info = useSupervisorInfo(record);
  const base = record.topics.filter(
    (x) => (!spec || x.specialization.id === spec) && matches(q, x.title, x.supervisor.name, x.department),
  );
  const rows = base.filter((x) => f === "all" || x.status === f);
  const chips: Chip[] = [
    { value: "all", label: t("admin.yearArchive.f.all"), count: base.length },
    ...TOPIC_STATUS_ORDER.filter((k) => base.some((x) => x.status === k)).map((k) => ({
      value: k,
      label: t(`status.${k}`),
      count: base.filter((x) => x.status === k).length,
      dot: TOPIC_STATUS_BAR[k],
    })),
  ];

  return (
    <>
      <Chips value={f} onChange={setF} options={chips} />
      {!rows.length ? (
        <Empty filtered={!!(q || spec || f !== "all")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="archive-topics">
          {rows.slice(0, limit).map((x) => {
            const fill = pct(x.members, x.maxStudents);
            return (
              <li key={x.id} className={`relative flex flex-col overflow-hidden p-5 transition hover:border-gold/35 ${CARD}`}>
                <span className={`absolute inset-y-0 start-0 w-1 ${TOPIC_STATUS_BAR[x.status] ?? "bg-gray-400"}`} />
                <div className="mb-3 flex items-start justify-between gap-3">
                  <MaybeLink live={live} to={`/${lang}/admin/topics/${x.id}`} className="line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest">
                    {x.title}
                  </MaybeLink>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${statusChip(x.status)}`}>{t(`status.${x.status}`)}</span>
                </div>

                <div className="mb-4 flex items-center gap-2.5">
                  <UserAvatar user={info.get(x.supervisor.id)} size={30} tone="gold" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-forest">{x.supervisor.name}</p>
                    {x.department && (
                      <p className="flex items-center gap-1 truncate text-[11px] text-clay">
                        <Building2 size={11} className="shrink-0" />
                        {x.department}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-auto space-y-3 border-t border-forest/8 pt-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-clay">
                        <Users size={12} className="text-gold" />
                        {t("admin.yearArchive.seats")}
                      </span>
                      <span className="font-semibold text-forest tabular-nums">
                        {x.members}/{x.maxStudents}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
                      <div className={`h-full rounded-full ${fill >= 100 ? "bg-violet-500" : "bg-sky-500"} transition-[width] duration-700`} style={{ width: `${fill}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-forest/10 bg-cream-2/50 px-2.5 py-1 text-forest">
                      {x.specialization.name} · {t(`admin.proj.level.${x.specialization.level}`)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-forest/10 bg-cream-2/50 px-2.5 py-1 text-forest">
                      <Inbox size={12} className="text-gold" />
                      {t("admin.yearArchive.requests", { count: x.requests })}
                    </span>
                    <span className="ms-auto inline-flex items-center gap-1 text-clay">
                      <CalendarDays size={12} />
                      {dateOf(x.createdAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <More shown={Math.min(limit, rows.length)} total={rows.length} onMore={more} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   PROJECTS
   ════════════════════════════════════════════════════════════ */

export function ProjectsSection({ record, live, lang, q, spec }: SectionProps) {
  const { t } = useTranslation();
  const [limit, more] = useLimit();
  const [f, setF] = useState("all");
  const base = record.projects.filter(
    (p) =>
      (!spec || p.specialization.id === spec) &&
      matches(q, p.title, p.supervisor.name, ...p.members.flatMap((m) => [m.name, m.registrationNumber])),
  );
  const state = (p: (typeof base)[number]) => p.defense?.status ?? "none";
  const rows = base.filter((p) => f === "all" || state(p) === f);
  const chips: Chip[] = [
    { value: "all", label: t("admin.yearArchive.f.all"), count: base.length },
    { value: "completed", label: t("admin.yearArchive.f.defended"), count: base.filter((p) => state(p) === "completed").length, dot: "bg-emerald-500" },
    { value: "scheduled", label: t("admin.yearArchive.f.scheduled"), count: base.filter((p) => state(p) === "scheduled").length, dot: "bg-amber-500" },
    { value: "none", label: t("admin.yearArchive.f.noDefense"), count: base.filter((p) => state(p) === "none").length, dot: "bg-gray-400" },
  ];

  return (
    <>
      <Chips value={f} onChange={setF} options={chips} />
      {!rows.length ? (
        <Empty filtered={!!(q || spec || f !== "all")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="archive-projects">
          {rows.slice(0, limit).map((p) => {
            const done = pct(p.milestones.completed, p.milestones.total);
            const graded = p.defense?.status === "completed" && p.defense.grade !== null;
            return (
              <li key={p.id} className={`flex flex-col overflow-hidden transition hover:border-gold/35 ${CARD}`}>
                <div className="flex items-start gap-3 p-5 pb-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-linear-to-br from-gold/20 to-gold/5 text-gold">
                    <FolderKanban size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <MaybeLink live={live} to={`/${lang}/admin/projects/${p.id}`} className="line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest">
                      {p.title}
                    </MaybeLink>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-clay">
                      <span className="inline-flex items-center gap-1.5">
                        <UserAvatar user={p.supervisor} size={20} tone="gold" />
                        <span className="font-medium text-forest">{p.supervisor.name}</span>
                      </span>
                      <span className="text-forest/25">•</span>
                      <span>{p.specialization.name}</span>
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-xl px-3 py-2 text-center ${graded ? "border border-gold/30 bg-gold/10" : ""}`}>
                    {graded ? (
                      <>
                        <b className="block font-serif text-[22px] leading-none text-forest tabular-nums">{formatGrade(p.defense!.grade)}</b>
                        <span className="mt-1 block text-[10px] text-clay">{t("admin.yearArchive.outOf20")}</span>
                      </>
                    ) : (
                      <Outcome d={p.defense} />
                    )}
                  </div>
                </div>

                <ul className="grid grid-cols-1 gap-1.5 px-5 sm:grid-cols-2">
                  {p.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-xl border border-forest/8 bg-cream-2/40 px-2 py-1.5">
                      <UserAvatar user={m} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-forest">{m.name}</p>
                        <p dir="ltr" className="truncate text-start font-mono text-[10px] text-clay">
                          {m.registrationNumber}
                        </p>
                      </div>
                      {m.leader && <Crown size={13} className="shrink-0 text-gold" aria-label={t("admin.yearArchive.leader")} />}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-forest/8 bg-cream-2/30 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {p.milestones.total === 0 ? (
                      <span className="grid size-[42px] place-items-center rounded-full border-4 border-dashed border-forest/10 text-[12px] font-bold text-clay">—</span>
                    ) : (
                      <ProgressRing value={done} size={42} stroke={4} tone={p.milestones.late ? "danger" : "sage"} label={t("admin.yearArchive.milestones")} />
                    )}
                    <div>
                      <p className="text-[11.5px] font-semibold text-forest">{t("admin.yearArchive.milestones")}</p>
                      <p className="text-[10.5px] text-clay tabular-nums">
                        {p.milestones.completed}/{p.milestones.total}
                        {p.milestones.late > 0 && <span className="ms-1.5 text-red-600 dark:text-red-300">· {t("admin.yearArchive.late", { count: p.milestones.late })}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-clay">
                    <FileText size={12} className="text-gold" />
                    {t("admin.yearArchive.submissions", { count: p.milestones.submissions })}
                  </span>
                  <span className="ms-auto text-[11px] text-clay">
                    {graded && p.defense?.mention ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${mentionChip(p.defense.mention)}`}>{t(`admin.proj.mention.${p.defense.mention}`)}</span>
                    ) : p.defense ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} className="text-gold" />
                        {dateOf(p.defense.date)}
                      </span>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <More shown={Math.min(limit, rows.length)} total={rows.length} onMore={more} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   DEFENCES
   ════════════════════════════════════════════════════════════ */

const ROLE_ORDER = ["president", "supervisor", "examiner"];
const DEF_ACCENT: Record<string, string> = { completed: "bg-emerald-500", scheduled: "bg-amber-500", cancelled: "bg-gray-400" };

export function DefensesSection({ record, live, lang, q, spec }: SectionProps) {
  const { t } = useTranslation();
  const [limit, more] = useLimit();
  const [f, setF] = useState("all");
  const specOf = useMemo(() => new Map(record.projects.map((p) => [p.id, p.specialization.id])), [record]);
  const base = record.defenses.filter(
    (d) =>
      (!spec || specOf.get(d.projectId) === spec) &&
      matches(q, d.title, d.room, d.supervisor, ...d.students, ...d.committee.map((c) => c.name)),
  );
  const rows = base.filter((d) => f === "all" || d.status === f);
  const chips: Chip[] = [
    { value: "all", label: t("admin.yearArchive.f.all"), count: base.length },
    ...(["completed", "scheduled", "cancelled"] as const).map((k) => ({
      value: k,
      label: t(`admin.yearArchive.f.${k}`),
      count: base.filter((d) => d.status === k).length,
      dot: DEF_ACCENT[k],
    })),
  ];
  const months = byMonth(rows.slice(0, limit));

  return (
    <>
      <Chips value={f} onChange={setF} options={chips} />
      {!rows.length ? (
        <Empty filtered={!!(q || spec || f !== "all")} />
      ) : (
        <div className="space-y-6" data-testid="archive-defenses">
          {months.map((m) => (
            <section key={m.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-[12.5px] font-bold text-forest">
                  <CalendarDays size={14} className="text-gold" />
                  {dateOf(m.date, { month: "long", year: "numeric" })}
                </span>
                <span className="text-[11.5px] text-clay">{t("admin.defensesPage.sessions", { count: m.items.length })}</span>
                <span className="h-px flex-1 bg-linear-to-l from-transparent to-forest/10" />
              </div>
              <ul className="space-y-3">
                {m.items.map((d) => (
                  <li key={d.id} className={`relative flex overflow-hidden transition hover:border-gold/35 ${CARD}`}>
                    <span className={`absolute inset-y-0 start-0 w-1 ${DEF_ACCENT[d.status] ?? "bg-gray-400"}`} />
                    <div className="ms-1 flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-e border-forest/8 bg-cream-2/50 px-2 py-4">
                      <span className="text-[10.5px] font-semibold text-clay">{dateOf(d.date, { weekday: "long" })}</span>
                      <span className="font-serif text-[30px] leading-none font-bold text-forest">{new Date(d.date).getDate()}</span>
                      <span className="text-[10.5px] text-clay">{dateOf(d.date, { month: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                        <MaybeLink live={live} to={`/${lang}/admin/defenses/${d.id}`} className="line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest">
                          {d.title}
                        </MaybeLink>
                        <Outcome d={d} />
                      </div>
                      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {(
                          [
                            [Clock, timeOf(d.date)],
                            [Timer, t("admin.yearArchive.minutes", { count: d.durationMinutes })],
                            [DoorOpen, d.room],
                          ] as const
                        ).map(([Icon, label]) => (
                          <span key={String(label)} className="inline-flex items-center gap-1 rounded-full border border-forest/10 bg-cream-2/50 px-2.5 py-1 text-forest">
                            <Icon size={12} className="text-gold" />
                            {label}
                          </span>
                        ))}
                      </div>
                      <p className="mb-2.5 flex items-start gap-1.5 text-[12px] text-forest">
                        <Users size={13} className="mt-0.5 shrink-0 text-gold" />
                        <span>{d.students.join("، ")}</span>
                      </p>
                      {d.committee.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {[...d.committee]
                            .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                            .map((c) => (
                              <span
                                key={c.id + c.role}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] ${
                                  c.role === "president" ? "border border-gold/30 bg-gold/10 text-forest" : "bg-forest/5 text-forest"
                                }`}
                              >
                                {c.role === "president" ? <Crown size={11} className="text-gold" /> : <Gavel size={11} className="text-clay" />}
                                <span className="text-clay">{t(`committeeRole.${c.role}`)}:</span>
                                <span className="font-semibold">{c.name}</span>
                              </span>
                            ))}
                        </div>
                      )}
                      {d.notes && <p className="mt-2.5 line-clamp-2 border-s-2 border-gold/40 ps-2.5 text-[11.5px] leading-relaxed text-clay italic">{d.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <More shown={Math.min(limit, rows.length)} total={rows.length} onMore={more} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SUPERVISORS
   ════════════════════════════════════════════════════════════ */

export function SupervisorsSection({ record, live, lang, q }: SectionProps) {
  const { t } = useTranslation();
  const info = useSupervisorInfo(record);
  const rank = new Map(record.supervisors.map((p, i) => [p.id, i]));
  const rows = record.supervisors.filter((p) => matches(q, p.name, info.get(p.id)?.department));
  if (!rows.length) return <Empty filtered={!!q} />;
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" data-testid="archive-supervisors">
      {rows.map((p) => {
        const meta = info.get(p.id);
        const i = rank.get(p.id) ?? 0;
        return (
          <li key={p.id} className={`relative overflow-hidden p-5 transition hover:border-gold/35 ${CARD}`}>
            {i < 3 && (
              <span
                className={`absolute top-4 end-4 grid size-7 place-items-center rounded-full bg-linear-to-br text-[11px] font-bold ${MEDAL[i].ring}`}
                title={`#${i + 1}`}
              >
                {i + 1}
              </span>
            )}
            <div className="mb-4 flex items-center gap-3 pe-9">
              <UserAvatar user={meta} size={48} tone="gold" className="ring-2 ring-gold/25" />
              <div className="min-w-0">
                <MaybeLink live={live} to={`/${lang}/admin/professors/${p.id}`} className="block truncate font-serif text-[15px] font-bold text-forest">
                  {p.name}
                </MaybeLink>
                {meta?.department && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-clay">
                    <Building2 size={11} className="shrink-0" />
                    {meta.department}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {(
                [
                  ["topics", p.topics],
                  ["projects", p.projects],
                  ["defended", p.defended],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-cream-2/50 px-1 py-2">
                  <b className="block font-serif text-[17px] leading-none text-forest tabular-nums">{v}</b>
                  <span className="mt-1 block truncate text-[10px] text-clay">{t(`admin.yearArchive.count.${k}`)}</span>
                </div>
              ))}
              <div className="rounded-xl border border-gold/25 bg-gold/10 px-1 py-2">
                <b className="block font-serif text-[17px] leading-none text-forest tabular-nums">{p.averageGrade != null ? formatGrade(p.averageGrade) : "—"}</b>
                <span className="mt-1 block truncate text-[10px] text-clay">{t("admin.yearArchive.col.average")}</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] text-clay">
                <span className="inline-flex items-center gap-1">
                  <Hourglass size={11} className="text-gold" />
                  {t("admin.yearArchive.ov.share")}
                </span>
                <span className="tabular-nums">{pct(p.projects, record.summary.projects)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
                <div className="h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-[width] duration-700" style={{ width: `${pct(p.projects, record.summary.projects)}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
