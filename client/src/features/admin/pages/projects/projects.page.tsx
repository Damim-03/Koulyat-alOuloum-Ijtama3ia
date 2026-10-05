import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowUpLeft,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FilterX,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  MapPin,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import type { AdminProjectStats } from "../../../../types/admin";
import {
  useAcademicYears,
  useAdminProjects,
  useDepartments,
  useFaculties,
  useSpecializations,
} from "../../hooks/admin-hook";
import { ProfessorPicker } from "../../components/ui/professor-picker";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { Select } from "../../../../components/ui/select";
import { None } from "../../../../lib/none";
import { ProgressRing } from "./project-ui";
import {
  cardTone,
  daysUntil,
  fmtDate,
  formatGrade,
  nameOf,
  percent,
  relative,
} from "./project-utils";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 12;
const VIEW_KEY = "admin.projects.view";

/** Every filter lives in the address, so a filtered list can be bookmarked,
 *  sent to a colleague, and returned to from a project's page. */
const FILTER_KEYS = [
  "q",
  "professorId",
  "facultyId",
  "departmentId",
  "specializationId",
  "academicYearId",
  "defense",
  "health",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function readView(): "grid" | "table" {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

export function AdminProjectsPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const location = useLocation();
  const [sp, setSp] = useSearchParams();

  const get = (k: string) => sp.get(k) ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const sort = get("sort") || "newest";

  const [view, setView] = useState<"grid" | "table">(readView);
  const [moreOpen, setMoreOpen] = useState(
    () => !!(sp.get("facultyId") || sp.get("departmentId") || sp.get("specializationId") || sp.get("academicYearId")),
  );

  // The search box is typed into locally and committed after a pause, so the
  // address — and the request — do not change on every keystroke.
  const [search, setSearch] = useState(get("q"));
  useEffect(() => {
    const id = setTimeout(() => {
      const v = search.trim();
      if (v !== (sp.get("q") ?? "")) update({ q: v });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /** Writes filters into the address; any filter change returns to page 1. */
  function update(patch: Partial<Record<FilterKey | "sort" | "page", string>>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setSp(next, { replace: true });
  }

  function chooseView(v: "grid" | "table") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the choice just won't be remembered */
    }
  }

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort,
      search: sp.get("q") || undefined,
      professorId: sp.get("professorId") || undefined,
      specializationId: sp.get("specializationId") || undefined,
      departmentId: sp.get("departmentId") || undefined,
      facultyId: sp.get("facultyId") || undefined,
      academicYearId: sp.get("academicYearId") || undefined,
      defense: sp.get("defense") || undefined,
      health: sp.get("health") || undefined,
    }),
    [sp, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useAdminProjects(params);
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  const projects = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const stats = (data as any)?.stats as AdminProjectStats | undefined;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The academic filters narrow each other, top-down.
  const facultyId = get("facultyId");
  const departmentId = get("departmentId");
  const deptOptions = ((departments ?? []) as any[]).filter(
    (d) => !facultyId || d.facultyId === facultyId,
  );
  const specOptions = ((specs ?? []) as any[]).filter((s) => {
    const dep = s.filiere?.department;
    if (departmentId) return dep?.id === departmentId || s.filiere?.departmentId === departmentId;
    if (facultyId) return dep?.facultyId === facultyId;
    return true;
  });

  const active = FILTER_KEYS.filter((k) => !!sp.get(k));

  function clearFilters() {
    setSearch("");
    const next = new URLSearchParams();
    if (sp.get("sort")) next.set("sort", sp.get("sort")!);
    setSp(next, { replace: true });
  }

  /** Label for one active filter, for its removable chip. */
  function chipLabel(k: FilterKey): string {
    const v = get(k);
    const find = (list: any, key = "name") =>
      ((list ?? []) as any[]).find((x) => x.id === v)?.[key] ?? "—";
    switch (k) {
      case "q":
        return v;
      case "professorId":
        return nameOf(projects.find((p) => p.topic?.professorId === v)?.topic?.professor?.user);
      case "facultyId":
        return find(faculties);
      case "departmentId":
        return find(departments);
      case "specializationId":
        return find(specs);
      case "academicYearId":
        return find(years, "title");
      case "defense":
        return t(`admin.proj.defenseState.${v}`);
      case "health":
        return t(`admin.proj.health.${v}`);
    }
  }

  // A tile filters by what it counts; clicking the active one lifts it.
  const tileFilter = (k: "defense" | "health", v: string) => ({
    active: get(k) === v,
    onClick: () => update(k === "defense" ? { defense: get(k) === v ? "" : v } : { health: get(k) === v ? "" : v }),
  });

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const detailHref = (id: string) => `/${lang}/admin/projects/${id}`;
  const linkState = { from: location.search };

  return (
    <div className="font-body">
      {/* ── hero ─────────────────────────────────────────────── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-6 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft shadow-inner">
                <FolderKanban size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.proj.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">
                  {t("admin.projectsTitle")}
                </h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-cream/70">
                  {t("admin.proj.heroSubtitle")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/${lang}/admin/group-requests`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-cream/10 px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-cream/20"
              >
                <ClipboardList size={14} />
                {t("admin.proj.goRequests")}
              </Link>
              <Link
                to={`/${lang}/admin/defenses`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft"
              >
                <CalendarClock size={14} />
                {t("admin.proj.goDefenses")}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <HeroTile
              icon={FolderKanban}
              label={t("admin.proj.stat.total")}
              value={stats?.total}
              active={!get("defense") && !get("health")}
              onClick={() => update({ defense: "", health: "" })}
            />
            <HeroTile icon={CalendarClock} label={t("admin.proj.stat.scheduled")} value={stats?.defenseScheduled} tone="gold" {...tileFilter("defense", "scheduled")} />
            <HeroTile icon={CheckCircle2} label={t("admin.proj.stat.done")} value={stats?.defenseDone} tone="sage" {...tileFilter("defense", "completed")} />
            <HeroTile icon={CalendarX} label={t("admin.proj.stat.noDefense")} value={stats?.noDefense} {...tileFilter("defense", "none")} />
            <HeroTile icon={AlertTriangle} label={t("admin.proj.stat.late")} value={stats?.withOverdue} tone="danger" {...tileFilter("health", "late")} />
            <HeroTile icon={ListChecks} label={t("admin.proj.stat.noPlan")} value={stats?.noPlan} tone="warn" {...tileFilter("health", "noPlan")} />
          </div>
          <p className="mt-3 text-[11px] text-cream/55">
            {active.length > 0 ? t("admin.statsFollowFilters") : t("admin.proj.statHint")}
          </p>
        </div>
      </section>

      {/* ── toolbar ──────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <div className="relative">
            <Search className="absolute top-1/2 end-3 -translate-y-1/2 text-clay" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.searchProject")}
              data-testid="projects-search"
              className="h-[46px] w-full rounded-xl border border-forest/15 bg-cream pe-10 ps-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <ProfessorPicker value={get("professorId")} onChange={(v) => update({ professorId: v })} />
          <Select
            value={sort}
            onChange={(v) => update({ sort: v === "newest" ? "" : v })}
            aria-label={t("admin.proj.sortLabel")}
            options={[
              { value: "newest", label: t("admin.sortNewest") },
              { value: "oldest", label: t("admin.sortOldest") },
              { value: "defenseSoon", label: t("admin.sortDefenseSoon") },
              { value: "title", label: t("admin.proj.sortTitle") },
            ]}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className={`inline-flex h-[46px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                moreOpen ? "border-gold/50 bg-gold/10 text-forest" : "border-forest/15 text-forest hover:bg-forest/5"
              }`}
            >
              <SlidersHorizontal size={15} />
              {t("admin.proj.moreFilters")}
            </button>
            <div className="flex h-[46px] items-center rounded-xl border border-forest/15 p-1" role="group" aria-label={t("admin.proj.viewLabel")}>
              <ViewButton active={view === "grid"} onClick={() => chooseView("grid")} label={t("admin.proj.viewGrid")} icon={LayoutGrid} />
              <ViewButton active={view === "table"} onClick={() => chooseView("table")} label={t("admin.proj.viewTable")} icon={Rows3} />
            </div>
          </div>
        </div>

        {moreOpen && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-forest/10 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={facultyId}
              onChange={(v) => update({ facultyId: v, departmentId: "", specializationId: "" })}
              options={[
                { value: "", label: t("admin.proj.allFaculties") },
                ...((faculties ?? []) as any[]).map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
            <Select
              value={departmentId}
              onChange={(v) => update({ departmentId: v, specializationId: "" })}
              options={[
                { value: "", label: t("admin.proj.allDepartments") },
                ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <Select
              value={get("specializationId")}
              onChange={(v) => update({ specializationId: v })}
              options={[
                { value: "", label: t("admin.allSpecializations") },
                ...specOptions.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              value={get("academicYearId")}
              onChange={(v) => update({ academicYearId: v })}
              options={[
                { value: "", label: t("admin.allYears") },
                ...((years ?? []) as any[]).map((y) => ({
                  value: y.id,
                  label: y.isActive ? `${y.title} · ${t("admin.proj.activeYear")}` : y.title,
                })),
              ]}
            />
            <Select
              value={get("defense")}
              onChange={(v) => update({ defense: v })}
              options={[
                { value: "", label: t("admin.allDefenseStates") },
                { value: "none", label: t("admin.proj.defenseState.none") },
                { value: "scheduled", label: t("admin.proj.defenseState.scheduled") },
                { value: "completed", label: t("admin.proj.defenseState.completed") },
                { value: "cancelled", label: t("admin.proj.defenseState.cancelled") },
              ]}
            />
          </div>
        )}

        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3" data-testid="projects-active-filters">
            {active.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 py-1 ps-3 pe-1 text-[11px] text-forest"
              >
                <span className="text-clay">{t(`admin.proj.f.${k}`)}:</span>
                <span className="max-w-48 truncate font-semibold">{chipLabel(k)}</span>
                <button
                  type="button"
                  aria-label={t("admin.proj.removeFilter")}
                  onClick={() => {
                    if (k === "q") setSearch("");
                    update({ [k]: "" });
                  }}
                  className="grid size-5 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <FilterX size={13} />
              {t("admin.proj.clearAll")}
            </button>
          </div>
        )}
      </section>

      {/* ── result bar ───────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-clay" data-testid="projects-range">
          {!isLoading && !isError && t("admin.proj.showing", { from, to, total })}
        </p>
        <div className="h-0.5 w-32 overflow-hidden rounded-full">
          {isFetching && !isLoading && (
            <div className="h-full w-1/3 animate-[bulkSweep_1s_ease-in-out_infinite] bg-gold" />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-forest/10 bg-forest/5" />
          ))}
        </div>
      ) : isError ? (
        /* A failed request used to fall through to "no projects", so an
           outage looked like an empty database. */
        <ErrorRetry title={t("admin.projectsLoadFailed")} onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-forest/15 bg-cream-card py-16 text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-forest/5 text-clay">
            <FolderKanban size={24} />
          </span>
          <p className="text-sm font-semibold text-forest">
            {active.length > 0 ? t("admin.noResultsFilters") : t("admin.noProjects")}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-clay">
            {active.length > 0 ? t("admin.proj.emptyFilteredHint") : t("admin.proj.emptyHint")}
          </p>
          {active.length > 0 ? (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
            >
              <FilterX size={14} />
              {t("admin.clearFilters")}
            </button>
          ) : (
            <Link
              to={`/${lang}/admin/group-requests`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
            >
              <ClipboardList size={14} />
              {t("admin.proj.goRequests")}
            </Link>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="projects-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} href={detailHref(p.id)} state={linkState} />
          ))}
        </div>
      ) : (
        <ProjectTable projects={projects} href={detailHref} state={linkState} />
      )}

      {totalPages > 1 && !isError && (
        <Pagination page={page} totalPages={totalPages} onPage={(n) => update({ page: n === 1 ? "" : String(n) })} />
      )}
    </div>
  );
}

// ─── hero tile ───────────────────────────────────────────────────────────────

const TILE_TONE = {
  neutral: "text-cream",
  gold: "text-gold-soft",
  sage: "text-soft-sage",
  danger: "text-red-300",
  warn: "text-amber-200",
} as const;

function HeroTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  active,
  onClick,
}: {
  icon: typeof FolderKanban;
  label: string;
  value?: number;
  tone?: keyof typeof TILE_TONE;
  active?: boolean;
  onClick?: () => void;
}) {
  // Only a count that needs acting on is coloured — painting a zero red
  // would spend the emphasis on nothing.
  const lit = tone === "danger" || tone === "warn" ? (value ?? 0) > 0 : true;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group rounded-2xl border p-3.5 text-start backdrop-blur-sm transition ${
        active
          ? "border-gold/60 bg-cream/15 shadow-[0_0_0_1px_rgba(193,150,90,0.35)]"
          : "border-white/10 bg-cream/5 hover:border-white/20 hover:bg-cream/10"
      }`}
    >
      <span className="mb-2 flex items-center gap-1.5 text-[11px] text-cream/70">
        <Icon size={14} className={lit ? TILE_TONE[tone] : "text-cream/50"} />
        <span className="truncate">{label}</span>
      </span>
      <span className={`block font-serif text-2xl font-bold tabular-nums ${lit ? TILE_TONE[tone] : "text-cream/60"}`}>
        {value ?? "—"}
      </span>
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof LayoutGrid;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`grid h-full w-9 place-items-center rounded-lg transition ${
        active ? "bg-forest text-cream" : "text-clay hover:bg-forest/5 hover:text-forest"
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

// ─── defence badge ───────────────────────────────────────────────────────────

function DefenseBadge({ def }: { def: any }) {
  const { t } = useTranslation();
  if (!def)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-bold text-clay">
        <CalendarX size={11} />
        {t("admin.noDefense")}
      </span>
    );
  if (def.status === "completed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={11} />
        {formatGrade(def.grade) !== null
          ? t("admin.proj.card.defenseDone", { grade: formatGrade(def.grade) })
          : t("admin.proj.defenseState.completed")}
      </span>
    );
  if (def.status === "cancelled")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-400/15 px-2.5 py-1 text-[10px] font-bold text-clay">
        <CalendarX size={11} />
        {t("admin.proj.defenseState.cancelled")}
      </span>
    );

  const days = daysUntil(def.date);
  const stale = days < 0;
  const soon = days >= 0 && days <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
        stale || soon ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-gold/15 text-gold"
      }`}
    >
      <CalendarCheck size={11} />
      {fmtDate(def.date)}
      <span className="font-medium opacity-80">
        ·{" "}
        {stale
          ? t("admin.proj.card.defenseStale")
          : days === 0
            ? t("admin.defenseToday")
            : t("admin.defenseIn", { n: days })}
      </span>
    </span>
  );
}

// ─── card ────────────────────────────────────────────────────────────────────

const ACCENT = {
  danger: "from-red-500 to-red-400",
  gold: "from-gold to-gold-soft",
  good: "from-sage to-soft-sage",
  neutral: "from-forest/30 to-forest/10",
} as const;

function ProjectCard({ p, href, state }: { p: any; href: string; state: object }) {
  const { t } = useTranslation();
  const members = (p.members ?? []) as any[];
  const progress = p.progress ?? { total: 0, completed: 0, overdue: 0, submissions: 0 };
  const pct = percent(progress.completed, progress.total);
  const max = p.topic?.maxStudents ?? 0;
  const tone = cardTone(p);
  const leader = members.find((m) => m.isLeader);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_14px_34px_-14px_rgba(38,66,61,0.35)]">
      <div className={`h-1 bg-linear-to-l ${ACCENT[tone]}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <DefenseBadge def={p.defense} />
          <div className="flex items-center gap-1.5">
            {p.defense?.room && p.defense.status === "scheduled" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest/5 px-2 py-1 text-[10px] text-clay">
                <MapPin size={11} />
                {p.defense.room}
              </span>
            )}
            {progress.overdue > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                <AlertTriangle size={11} />
                {t("admin.proj.card.late", { n: progress.overdue })}
              </span>
            )}
          </div>
        </div>

        <Link to={href} state={state} className="mb-2 block text-start">
          <h3 className="line-clamp-2 font-serif text-[15.5px] leading-snug font-bold text-forest transition group-hover:text-gold">
            {p.topic?.title ?? <None />}
          </h3>
        </Link>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {p.topic?.specialization?.name && (
            <span className="rounded-full bg-soft-sage/30 px-2 py-0.5 text-[10px] text-forest">
              {p.topic.specialization.name}
            </span>
          )}
          {p.topic?.academicYear?.title && (
            <span className="rounded-full bg-forest/5 px-2 py-0.5 text-[10px] text-clay" dir="ltr">
              {p.topic.academicYear.title}
            </span>
          )}
        </div>

        {/* progress */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-2/60 p-3">
          <ProgressRing
            value={pct}
            size={52}
            stroke={5}
            tone={progress.overdue > 0 ? "danger" : pct === 100 ? "sage" : "gold"}
            label={t("admin.proj.col.progress")}
          />
          <div className="min-w-0 flex-1 text-[11px]">
            <p className="flex items-center gap-1 font-semibold text-forest">
              <ListChecks size={12} className="text-clay" />
              {progress.total > 0
                ? t("admin.milestonesDone", { done: progress.completed, total: progress.total })
                : t("admin.noMilestonesYet")}
            </p>
            <p className="mt-1 truncate text-clay">
              {progress.nextDeadline
                ? t("admin.proj.card.next", {
                    title: progress.nextDeadline.title,
                    when: relative(progress.nextDeadline.deadline),
                  })
                : t("admin.proj.card.noUpcoming")}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-clay">
              <FileText size={11} />
              {progress.submissions > 0
                ? t("admin.proj.card.activity", {
                    n: progress.submissions,
                    when: progress.lastActivityAt ? relative(progress.lastActivityAt) : "—",
                  })
                : t("admin.proj.card.noActivity")}
            </p>
          </div>
        </div>

        {/* people */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar user={p.topic?.professor?.user} size={30} />
            <div className="min-w-0">
              <p className="text-[10px] text-clay">{t("admin.supervisor")}</p>
              <p className="truncate text-xs font-semibold text-forest">{nameOf(p.topic?.professor?.user)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {members.slice(0, 4).map((m) => (
                <UserAvatar
                  key={m.id}
                  user={m.student?.user}
                  size={26}
                  className={`border-2 ${m.isLeader ? "border-gold" : "border-cream-card"}`}
                />
              ))}
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                max && members.length < max ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-forest/10 text-forest"
              }`}
              title={leader ? t("admin.leaderName", { name: nameOf(leader.student?.user) }) : undefined}
            >
              <Users size={11} />
              {max ? `${members.length}/${max}` : members.length}
            </span>
          </div>
        </div>

        <Link
          to={href}
          state={state}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-forest-deep"
        >
          {t("admin.proj.card.open")}
          <ArrowUpLeft size={14} className="ltr:-scale-x-100" />
        </Link>
      </div>
    </article>
  );
}

// ─── table ───────────────────────────────────────────────────────────────────

function ProjectTable({
  projects,
  href,
  state,
}: {
  projects: any[];
  href: (id: string) => string;
  state: object;
}) {
  const { t } = useTranslation();
  const th = "px-4 py-3 text-start text-[11px] font-semibold whitespace-nowrap";
  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]" data-testid="projects-table">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-start">
          <thead>
            <tr className="bg-forest text-cream">
              <th className={th}>{t("admin.proj.col.project")}</th>
              <th className={th}>{t("admin.supervisor")}</th>
              <th className={th}>{t("admin.proj.col.team")}</th>
              <th className={th}>{t("admin.proj.col.progress")}</th>
              <th className={th}>{t("admin.proj.col.next")}</th>
              <th className={th}>{t("admin.proj.col.defense")}</th>
              <th className={`${th} w-10`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {projects.map((p) => {
              const members = (p.members ?? []) as any[];
              const prog = p.progress ?? { total: 0, completed: 0, overdue: 0 };
              const pct = percent(prog.completed, prog.total);
              const max = p.topic?.maxStudents ?? 0;
              return (
                <tr key={p.id} className="transition-colors hover:bg-forest/4">
                  <td className="max-w-xs px-4 py-3">
                    <Link to={href(p.id)} state={state} className="line-clamp-1 text-sm font-semibold text-forest hover:text-gold">
                      {p.topic?.title ?? <None />}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-clay">
                      {[p.topic?.specialization?.name, p.topic?.academicYear?.title].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <UserAvatar user={p.topic?.professor?.user} size={26} />
                      <span className="truncate text-xs text-forest">{nameOf(p.topic?.professor?.user)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-2 rtl:space-x-reverse">
                        {members.slice(0, 3).map((m) => (
                          <UserAvatar key={m.id} user={m.student?.user} size={24} className="border-2 border-cream-card" />
                        ))}
                      </span>
                      <span className={`text-[11px] font-bold tabular-nums ${max && members.length < max ? "text-amber-600 dark:text-amber-400" : "text-forest"}`}>
                        {max ? `${members.length}/${max}` : members.length}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex w-40 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest/10">
                        <div
                          className={`h-full rounded-full ${prog.overdue > 0 ? "bg-red-500" : "bg-sage"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-9 text-end text-[11px] font-bold text-forest tabular-nums">{pct}%</span>
                    </div>
                    <p className="mt-1 text-[10.5px] text-clay">
                      {prog.total > 0 ? t("admin.milestonesDone", { done: prog.completed, total: prog.total }) : t("admin.noMilestonesYet")}
                      {prog.overdue > 0 && (
                        <span className="ms-1.5 font-semibold text-red-600 dark:text-red-400">
                          · {t("admin.proj.card.late", { n: prog.overdue })}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-clay">
                    {prog.nextDeadline ? (
                      <>
                        <p className="line-clamp-1 font-medium text-forest">{prog.nextDeadline.title}</p>
                        <p>{relative(prog.nextDeadline.deadline)}</p>
                      </>
                    ) : (
                      <None />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DefenseBadge def={p.defense} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={href(p.id)}
                      state={state}
                      aria-label={t("admin.proj.card.open")}
                      className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
                    >
                      <ChevronLeft size={16} className="ltr:rotate-180" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── pagination ──────────────────────────────────────────────────────────────

/** 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - page) <= 1) out.push(n);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (n: number) => void;
}) {
  const { t } = useTranslation();
  const btn = "grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-sm transition disabled:opacity-40";
  const go = (n: number) => {
    onPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const items: ReactNode[] = pageList(page, totalPages).map((n, i) =>
    n === "…" ? (
      <span key={`gap-${i}`} className="px-1 text-clay">
        …
      </span>
    ) : (
      <button
        key={n}
        type="button"
        onClick={() => go(n)}
        aria-current={n === page ? "page" : undefined}
        className={`${btn} ${
          n === page ? "border-forest bg-forest font-bold text-cream" : "border-forest/15 text-forest hover:bg-forest/5"
        } tabular-nums`}
      >
        {n}
      </button>
    ),
  );
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label={t("admin.proj.pagination")}>
      <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className={`${btn} border-forest/15 text-forest hover:bg-forest/5`} aria-label={t("admin.proj.prev")}>
        <ChevronRight size={16} className="ltr:rotate-180" />
      </button>
      {items}
      <button type="button" disabled={page >= totalPages} onClick={() => go(page + 1)} className={`${btn} border-forest/15 text-forest hover:bg-forest/5`} aria-label={t("admin.proj.next")}>
        <ChevronLeft size={16} className="ltr:rotate-180" />
      </button>
    </nav>
  );
}
