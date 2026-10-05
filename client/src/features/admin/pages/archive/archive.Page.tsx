import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArchiveRestore,
  Award,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FolderKanban,
  GraduationCap,
  Landmark,
  Layers,
  Lock,
  Percent,
  Quote,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ArchiveYear, YearRecord } from "../../../../types/admin";
import { useArchiveYears, useYearRecord } from "../../hooks/admin-hook";
import { Select } from "../../../../components/ui/select";
import { CloseYearDialog } from "../../components/dialog/archive/close-year-dialog";
import { ReopenYearDialog } from "../../components/dialog/archive/reopen-year-dialog";
import i18n from "../../../../i18n/i18n";
import { formatGrade } from "../projects/project-utils";
import {
  DefensesSection,
  OverviewSection,
  ProjectsSection,
  StudentsSection,
  SupervisorsSection,
  TopicsSection,
  type SectionProps,
} from "./archive-sections";
import { localizeRecord, pct } from "./archive-utils";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/**
 * The archive of academic years.
 *
 * Every year with everything it held — students, topics, projects, defences,
 * grades — read tab by tab. While a year is open its record is built live and
 * follows the work; when it ends the administration closes it, and the record
 * is frozen exactly as it stood. Coming back to a closed year shows that
 * record; reopening it makes the year live — and, if asked, current — again.
 */

const TABS = ["overview", "students", "topics", "projects", "defenses", "supervisors"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICON: Record<Tab, LucideIcon> = {
  overview: Sparkles,
  students: Users,
  topics: BookOpen,
  projects: FolderKanban,
  defenses: CalendarDays,
  supervisors: GraduationCap,
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : "";

export function AdminArchivePage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [sp, setSp] = useSearchParams();
  const yearsQ = useArchiveYears();
  const years = useMemo(() => yearsQ.data ?? [], [yearsQ.data]);

  const current = years.find((y) => y.isActive) ?? null;
  const selectedId = (years.some((y) => y.id === sp.get("year")) && sp.get("year")) || current?.id || years[0]?.id || null;
  const selected = years.find((y) => y.id === selectedId) ?? null;
  const tab: Tab = (TABS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as Tab) : "overview";

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSp(next, { replace: true });
  }

  const archived = years.filter((y) => y.archivedAt).length;
  const allStudents = years.reduce((n, y) => n + y.counts.students, 0);

  return (
    <div className="font-body">
      {/* ── hero ─────────────────────────────────────────── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-6 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
                <Landmark size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.yearArchive.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">{t("admin.yearArchive.title")}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.yearArchive.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              <HeroFact icon={CalendarRange} label={t("admin.yearArchive.fact.years")} value={years.length} />
              <HeroFact icon={Lock} label={t("admin.yearArchive.fact.archived")} value={archived} />
              <HeroFact icon={Users} label={t("admin.yearArchive.fact.students")} value={allStudents} />
            </div>
          </div>

          {/* the years */}
          <div className="mt-6">
            {yearsQ.isLoading ? (
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[118px] w-56 shrink-0 animate-pulse rounded-2xl bg-cream/10" />
                ))}
              </div>
            ) : yearsQ.isError ? (
              <ErrorRetry compact onDark className="my-0" title={t("admin.yearArchive.loadFailed")} onRetry={() => yearsQ.refetch()} />
            ) : years.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-cream/5 p-5 text-center text-sm text-cream/75">{t("admin.yearArchive.noYears")}</p>
            ) : (
              <YearRail years={years} selectedId={selectedId} onPick={(id) => update({ year: id, q: "", spec: "" })} />
            )}
          </div>
        </div>
      </section>

      {selected && <YearView key={selected.id} year={selected} years={years} current={current} tab={tab} lang={lang} sp={sp} update={update} />}
    </div>
  );
}

function HeroFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-cream/5 px-3 py-2 backdrop-blur-sm">
      <Icon size={14} className="text-gold-soft" />
      <span className="text-cream/70">{label}</span>
      <b className="font-serif text-[15px] text-cream tabular-nums">{value}</b>
    </span>
  );
}

/* ── the years, side by side ───────────────────────────────── */

function YearRail({ years, selectedId, onPick }: { years: ArchiveYear[]; selectedId: string | null; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  // Keep the chosen year in view when the rail is wider than the screen.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-year="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div ref={ref} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-2" role="tablist" aria-label={t("admin.yearArchive.years")}>
      {years.map((y) => {
        const on = y.id === selectedId;
        const state = y.isActive ? "current" : y.archivedAt ? "archived" : "open";
        return (
          <button
            key={y.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-year={y.id}
            data-testid="archive-year"
            onClick={() => onPick(y.id)}
            className={`group relative w-56 shrink-0 snap-start overflow-hidden rounded-2xl border p-4 text-start backdrop-blur-sm transition duration-300 ${
              on
                ? "border-gold/70 bg-cream/15 shadow-[0_0_0_1px_rgba(193,150,90,0.4),0_14px_30px_-14px_rgba(0,0,0,0.5)]"
                : "border-white/10 bg-cream/5 hover:-translate-y-0.5 hover:border-white/25 hover:bg-cream/10"
            }`}
          >
            {on && <span className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-l from-transparent via-gold to-transparent" />}
            <div className="mb-3 flex items-center justify-between gap-2">
              <span dir="ltr" className="font-serif text-[21px] leading-none font-bold text-cream">
                {y.title}
              </span>
              <StateBadge state={state} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <Mini label={t("admin.yearArchive.count.students")} value={y.counts.students} />
              <Mini label={t("admin.yearArchive.count.projects")} value={y.counts.projects} />
              <Mini label={t("admin.yearArchive.count.defended")} value={y.counts.defended} />
            </div>
            <p className="mt-2.5 truncate text-[10.5px] text-cream/55">
              {y.archivedAt ? t("admin.yearArchive.archivedOn", { date: fmtDate(y.archivedAt) }) : t("admin.yearArchive.liveNote")}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function StateBadge({ state }: { state: "current" | "open" | "archived" }) {
  const { t } = useTranslation();
  if (state === "current")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-forest-deep">
        <span className="size-1.5 animate-pulse rounded-full bg-forest-deep" />
        {t("admin.yearArchive.current")}
      </span>
    );
  if (state === "archived")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-cream/10 px-2 py-0.5 text-[10px] font-semibold text-cream/85">
        <Lock size={10} />
        {t("admin.yearArchive.archived")}
      </span>
    );
  return <span className="rounded-full border border-soft-sage/40 bg-soft-sage/15 px-2 py-0.5 text-[10px] font-semibold text-soft-sage">{t("admin.yearArchive.open")}</span>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg bg-cream/5 px-1 py-1.5">
      <b className="block font-serif text-[15px] leading-tight text-cream tabular-nums">{value}</b>
      <span className="block truncate text-[9.5px] text-cream/55">{label}</span>
    </span>
  );
}

/* ── one year ──────────────────────────────────────────────── */

function YearView({
  year,
  years,
  current,
  tab,
  lang,
  sp,
  update,
}: {
  year: ArchiveYear;
  years: ArchiveYear[];
  current: ArchiveYear | null;
  tab: Tab;
  lang?: string;
  sp: URLSearchParams;
  update: (patch: Record<string, string>) => void;
}) {
  const { t, i18n } = useTranslation();
  const q = useYearRecord(year.id);
  const data = q.data;
  // Names in the interface's script, re-read when the language changes.
  const record = useMemo(() => data?.record && localizeRecord(data.record, i18n.language), [data, i18n.language]);
  const live = data?.source === "live";
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null);
  const tabsRef = useRef<HTMLElement>(null);
  function goTab(k: string) {
    update({ tab: k === "overview" ? "" : k });
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const [search, setSearch] = useState(sp.get("q") ?? "");
  useEffect(() => {
    const id = setTimeout(() => {
      if (search.trim() !== (sp.get("q") ?? "")) update({ q: search.trim() });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const spec = sp.get("spec") ?? "";
  const counts: Record<Tab, number | null> = {
    overview: null,
    students: record?.students.length ?? null,
    topics: record?.topics.length ?? null,
    projects: record?.projects.length ?? null,
    defenses: record?.defenses.length ?? null,
    supervisors: record?.supervisors.length ?? null,
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <section className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] lg:p-6">
        <span className={`absolute inset-y-0 start-0 w-1 ${year.archivedAt ? "bg-clay/40" : year.isActive ? "bg-gold" : "bg-sage"}`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-gold">{t("admin.yearArchive.yearLabel")}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 dir="ltr" className="font-serif text-3xl leading-none font-bold text-forest">
                {year.title}
              </h2>
              {year.isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
                  <Star size={12} />
                  {t("admin.yearArchive.currentYear")}
                </span>
              )}
              {data &&
                (live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" data-testid="record-source">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    {t("admin.yearArchive.sourceLive")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/8 px-2.5 py-1 text-[11px] font-semibold text-forest" data-testid="record-source">
                    <Lock size={12} className="text-gold" />
                    {t("admin.yearArchive.sourceArchive")}
                  </span>
                ))}
            </div>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-clay">
              {data && !live
                ? t("admin.yearArchive.archivedBy", {
                    date: fmtDate(data.archivedAt),
                    name: data.archivedByName ?? t("admin.yearArchive.anAdmin"),
                  })
                : t("admin.yearArchive.liveHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {year.archivedAt ? (
              <button
                type="button"
                onClick={() => setDialog("reopen")}
                data-testid="year-reopen"
                className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-cream px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10"
              >
                <ArchiveRestore size={16} className="text-gold" />
                {t("admin.yearArchive.reopenAction")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDialog("close")}
                data-testid="year-close"
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-forest-deep dark:bg-gold dark:font-bold dark:text-forest-deep dark:hover:bg-gold-soft"
              >
                <Archive size={16} className="text-gold-soft dark:text-forest-deep" />
                {t("admin.yearArchive.closeAction")}
              </button>
            )}
          </div>
        </div>
        {data?.note && (
          <blockquote className="mt-4 flex items-start gap-2.5 rounded-2xl border border-gold/25 bg-gold/5 p-3.5 text-[12.5px] leading-relaxed whitespace-pre-line text-forest">
            <Quote size={15} className="mt-0.5 shrink-0 text-gold" />
            {data.note}
          </blockquote>
        )}
      </section>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-forest/10 bg-forest/5" />
          ))}
        </div>
      ) : q.isError || !record ? (
        <ErrorRetry title={t("admin.yearArchive.recordFailed")} onRetry={() => q.refetch()} />
      ) : (
        <>
          <Kpis record={record} />

          {/* tabs + tools */}
          <section ref={tabsRef} className="scroll-mt-20 rounded-2xl border border-forest/10 bg-cream-card p-2 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="flex gap-1 overflow-x-auto" role="tablist">
              {TABS.map((k) => {
                const Icon = TAB_ICON[k];
                const on = tab === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-testid={`archive-tab-${k}`}
                    onClick={() => update({ tab: k === "overview" ? "" : k })}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition ${
                      on
                        ? "bg-forest text-cream shadow-sm dark:bg-gold/15 dark:text-gold dark:shadow-[inset_0_0_0_1px_rgba(193,150,90,0.4)]"
                        : "text-clay hover:bg-forest/5 hover:text-forest"
                    }`}
                  >
                    <Icon size={15} className={on ? "text-gold-soft" : ""} />
                    {t(`admin.yearArchive.tab.${k}`)}
                    {counts[k] !== null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${on ? "bg-cream/15 text-cream dark:bg-gold/20 dark:text-gold" : "bg-forest/8 text-forest"}`}>{counts[k]}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {tab !== "overview" && (
              <div className="mt-2 grid grid-cols-1 gap-2 border-t border-forest/10 px-1 pt-3 pb-1 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="relative">
                  <Search className="absolute top-1/2 start-3 -translate-y-1/2 text-clay" size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t(`admin.yearArchive.search.${tab}`)}
                    data-testid="archive-search"
                    className="h-11 w-full rounded-xl border border-forest/15 bg-cream ps-10 pe-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                  />
                </div>
                {tab !== "supervisors" && record.bySpecialization.length > 1 && (
                  <Select
                    value={spec}
                    icon={Layers}
                    filter
                    onChange={(v) => update({ spec: v })}
                    options={[
                      { value: "", label: t("admin.yearArchive.allSpecs") },
                      ...record.bySpecialization.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                )}
              </div>
            )}
          </section>

          <div className="animate-scale-in" key={tab}>
            <Section tab={tab} record={record} live={live} lang={lang} q={sp.get("q") ?? ""} spec={tab === "supervisors" ? "" : spec} goTab={goTab} />
          </div>
        </>
      )}

      {/* Pinned in the address, so closing a year keeps it on screen rather than
          following the "current" year to the one that replaced it. */}
      <CloseYearDialog
        open={dialog === "close"}
        onClose={() => {
          setDialog(null);
          update({ year: year.id });
        }}
        year={year}
        years={years}
        summary={record?.summary}
      />
      <ReopenYearDialog open={dialog === "reopen"} onClose={() => setDialog(null)} year={year} currentTitle={current && current.id !== year.id ? current.title : null} />
    </div>
  );
}

function Section({ tab, ...p }: SectionProps & { tab: Tab }) {
  const key = `${p.q}|${p.spec}`;
  switch (tab) {
    case "students":
      return <StudentsSection key={key} {...p} />;
    case "topics":
      return <TopicsSection key={key} {...p} />;
    case "projects":
      return <ProjectsSection key={key} {...p} />;
    case "defenses":
      return <DefensesSection key={key} {...p} />;
    case "supervisors":
      return <SupervisorsSection key={key} {...p} />;
    default:
      return <OverviewSection {...p} />;
  }
}

/* ── the figures of the year ───────────────────────────────── */

function Kpis({ record }: { record: YearRecord }) {
  const { t } = useTranslation();
  const s = record.summary;
  const tiles: { icon: LucideIcon; tone: string; label: string; value: string | number; sub?: string }[] = [
    { icon: Users, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", label: t("admin.yearArchive.count.students"), value: s.students, sub: t("admin.yearArchive.kpi.withProject", { n: s.studentsWithProject, p: pct(s.studentsWithProject, s.students) }) },
    { icon: BookOpen, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300", label: t("admin.yearArchive.count.topics"), value: s.topics, sub: t("admin.yearArchive.kpi.supervisors", { count: s.supervisors }) },
    { icon: FolderKanban, tone: "bg-gold/15 text-gold", label: t("admin.yearArchive.count.projects"), value: s.projects },
    { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", label: t("admin.yearArchive.count.defended"), value: s.defenses.completed, sub: t("admin.yearArchive.kpi.defenses", { scheduled: s.defenses.scheduled, cancelled: s.defenses.cancelled }) },
    { icon: Award, tone: "bg-gold/15 text-gold", label: t("admin.yearArchive.kpi.average"), value: s.averageGrade != null ? `${formatGrade(s.averageGrade)}/20` : "—", sub: t("admin.yearArchive.kpi.graded", { count: s.graded }) },
    { icon: Percent, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", label: t("admin.yearArchive.kpi.passRate"), value: s.passRate != null ? `${Math.round(s.passRate)}%` : "—" },
    { icon: TrendingUp, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300", label: t("admin.yearArchive.kpi.best"), value: s.bestGrade != null ? `${formatGrade(s.bestGrade)}/20` : "—" },
    { icon: GraduationCap, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300", label: t("admin.yearArchive.kpi.excellent"), value: s.mentions.excellent ?? 0, sub: t("admin.yearArchive.kpi.excellentHint") },
  ];
  return (
    <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="archive-kpis">
      {tiles.map((x) => (
        <div key={x.label} className="min-w-0 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.04)] transition hover:border-gold/30">
          <div className="mb-2 flex items-center gap-2">
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${x.tone}`}>
              <x.icon size={15} />
            </span>
            <span className="text-[11.5px] leading-tight font-medium text-clay">{x.label}</span>
          </div>
          <b className="block font-serif text-[22px] leading-tight text-forest tabular-nums">{x.value}</b>
          {x.sub && <span className="mt-0.5 block truncate text-[11px] text-clay">{x.sub}</span>}
        </div>
      ))}
    </div>
  );
}
