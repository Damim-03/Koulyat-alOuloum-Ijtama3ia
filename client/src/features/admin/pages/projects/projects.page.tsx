import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  ListChecks,
  CalendarCheck,
  ChevronLeft,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  FilterX,
  MapPin,
  FolderKanban,
  CalendarClock,
  CalendarX,
  CheckCircle2,
} from "lucide-react";

import type { AdminProject } from "../../../../types/admin";
import {
  useAdminProjects,
  useSpecializations,
  useAcademicYears,
} from "../../hooks/admin-hook";
import { ProfessorPicker } from "../../components/ui/professor-picker";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import i18n from "../../../../i18n/i18n";
import { UserAvatar } from "../../../../components/ui/user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 9;

const selectCls =
  "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

/** Whole days from today to `date`; negative once it has passed. */
function daysUntil(date: string | Date) {
  const d = new Date(date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86400000);
}

export function AdminProjectsPage() {
  const { t } = useTranslation();

  const navigate = useLangNavigate();
  const [page, setPage] = useState(1);

  // filters
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [defense, setDefense] = useState("");
  const [sort, setSort] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const activeFilters =
    (debounced ? 1 : 0) +
    (professorId ? 1 : 0) +
    (specializationId ? 1 : 0) +
    (academicYearId ? 1 : 0) +
    (defense ? 1 : 0);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debounced || undefined,
      professorId: professorId || undefined,
      specializationId: specializationId || undefined,
      academicYearId: academicYearId || undefined,
      defense: defense || undefined,
      sort,
    }),
    [page, debounced, professorId, specializationId, academicYearId, defense, sort],
  );

  // A changed filter must start from the first page, or a narrow result set
  // lands the user on a page that no longer exists.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debounced, professorId, specializationId, academicYearId, defense, sort]);

  const { data, isLoading, isError, isFetching, refetch } =
    useAdminProjects(params);
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  const projects = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const stats = (data as any)?.stats;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setProfessorId("");
    setSpecializationId("");
    setAcademicYearId("");
    setDefense("");
  }

  function profName(p: AdminProject) {
    const u = p.topic?.professor?.user;
    return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "—";
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">
          {t("admin.projectsTitle")}
        </h1>
        <p className="mt-1 text-sm text-clay">{t("admin.projectsSubtitle")}</p>
      </div>

      {/* Summary. Computed server-side over the *filtered* set, so the tiles
          always describe the grid below rather than the whole table. */}
      {stats && !isError && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              icon={<FolderKanban size={16} />}
              label={t("admin.statTotalProjects")}
              value={stats.total}
              tone="neutral"
            />
            <StatTile
              icon={<CalendarClock size={16} />}
              label={t("admin.statDefenseScheduled")}
              value={stats.defenseScheduled}
              tone="gold"
            />
            <StatTile
              icon={<CheckCircle2 size={16} />}
              label={t("admin.statDefenseDone")}
              value={stats.defenseDone}
              tone="good"
            />
            <StatTile
              icon={<CalendarX size={16} />}
              label={t("admin.statNoDefense")}
              value={stats.noDefense}
              tone="neutral"
            />
            <StatTile
              icon={<AlertTriangle size={16} />}
              label={t("admin.statWithOverdue")}
              value={stats.withOverdue}
              tone="danger"
            />
          </div>
          {activeFilters > 0 && (
            <p className="mt-2 text-[11px] text-clay">
              {t("admin.statsFollowFilters")}
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-forest" />
            <span className="font-semibold text-forest">
              {t("admin.filters")}
            </span>
            {activeFilters > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                {activeFilters}
              </span>
            )}
          </div>
          {filtersOpen ? (
            <ChevronUp size={20} className="text-clay" />
          ) : (
            <ChevronDown size={20} className="text-clay" />
          )}
        </button>

        <div
          className={`overflow-visible transition-all duration-300 ${
            filtersOpen ? "border-t border-forest/10 p-4" : "max-h-0 p-0"
          }`}
        >
          {filtersOpen && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <Search
                    className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
                    size={18}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("admin.searchProject")}
                    className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pe-10 ps-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                  />
                </div>

                <ProfessorPicker
                  value={professorId}
                  onChange={setProfessorId}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <select
                  value={specializationId}
                  onChange={(e) => setSpecializationId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t("admin.allSpecializations")}</option>
                  {(specs ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t("admin.allYears")}</option>
                  {(years ?? []).map((y: any) => (
                    <option key={y.id} value={y.id}>
                      {y.title}
                    </option>
                  ))}
                </select>

                <select
                  value={defense}
                  onChange={(e) => setDefense(e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t("admin.allDefenseStates")}</option>
                  <option value="none">{t("admin.defenseNone")}</option>
                  <option value="scheduled">
                    {t("admin.defenseScheduledFilter")}
                  </option>
                  <option value="completed">
                    {t("admin.defenseCompleted")}
                  </option>
                  <option value="cancelled">
                    {t("admin.defenseCancelled")}
                  </option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className={selectCls}
                >
                  <option value="newest">{t("admin.sortNewest")}</option>
                  <option value="oldest">{t("admin.sortOldest")}</option>
                  <option value="defenseSoon">
                    {t("admin.sortDefenseSoon")}
                  </option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* A filter change refetches while the old cards stay put; this hairline
          says the grid is catching up. */}
      <div className="mb-3 h-0.5 overflow-hidden">
        {isFetching && !isLoading && (
          <div className="h-full w-1/3 animate-[bulkSweep_1s_ease-in-out_infinite] bg-gold" />
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-forest/10 bg-forest/5"
            />
          ))}
        </div>
      ) : isError ? (
        /* A failed request used to fall through to "no projects", so an
           outage looked like an empty database. */
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-500" />
          <p className="text-sm font-semibold text-forest">
            {t("admin.projectsLoadFailed")}
          </p>
          <p className="mt-1 text-xs text-clay">{t("admin.loadFailedHint")}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
          >
            <RotateCcw size={14} />
            {t("admin.retry")}
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center">
          <p className="text-sm text-clay">
            {activeFilters > 0
              ? t("admin.noResultsFilters")
              : t("admin.noProjects")}
          </p>
          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
            >
              <FilterX size={14} />
              {t("admin.clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const members = p.members ?? [];
            const def = p.defense;
            const progress = p.progress ?? {
              total: 0,
              completed: 0,
              overdue: 0,
            };
            const pct =
              progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : 0;
            const days = def ? daysUntil(def.date) : null;
            // "Soon" is what an administrator needs to notice at a glance.
            const soon =
              def?.status === "scheduled" &&
              days !== null &&
              days >= 0 &&
              days <= 7;

            return (
              <div
                key={p.id}
                className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
              >
                {/* Defence */}
                <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                  {def ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        soon
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : "bg-gold/15 text-gold"
                      }`}
                    >
                      <CalendarCheck size={12} />
                      {new Date(def.date).toLocaleDateString(i18n.language, {
                        dateStyle: "medium",
                      })}
                      {days !== null && (
                        <span className="font-medium opacity-80">
                          ·{" "}
                          {days === 0
                            ? t("admin.defenseToday")
                            : days > 0
                              ? t("admin.defenseIn", { n: days })
                              : t("admin.defensePast")}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[10px] font-bold text-clay">
                      {t("admin.noDefense")}
                    </span>
                  )}
                  {def?.room && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest/5 px-2 py-0.5 text-[10px] text-clay">
                      <MapPin size={11} />
                      {def.room}
                    </span>
                  )}
                </div>

                <h3 className="mb-1.5 text-start font-serif text-base font-bold text-forest">
                  {p.topic?.title ?? "—"}
                </h3>

                {/* Where it sits — neither of these was available before. */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {p.topic?.specialization?.name && (
                    <span className="rounded-full bg-soft-sage/30 px-2 py-0.5 text-[10px] text-forest">
                      {p.topic.specialization.name}
                    </span>
                  )}
                  {p.topic?.academicYear?.title && (
                    <span
                      className="rounded-full bg-forest/5 px-2 py-0.5 text-[10px] text-clay"
                      dir="ltr"
                    >
                      {p.topic.academicYear.title}
                    </span>
                  )}
                </div>

                {/* Supervisor */}
                <div className="mb-3 flex items-center justify-end gap-2">
                  <div className="min-w-0 text-start">
                    <p className="text-[10px] text-clay">
                      {t("admin.supervisor")}
                    </p>
                    <p className="truncate text-xs font-medium text-forest">
                      {profName(p)}
                    </p>
                  </div>
                  <UserAvatar user={p.topic?.professor?.user} size={28} />
                </div>

                {/* Progress — the question this page exists to answer. */}
                <div className="mb-3 border-t border-forest/10 pt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-clay">
                      <ListChecks size={13} />
                      {progress.total > 0
                        ? t("admin.milestonesDone", {
                            done: progress.completed,
                            total: progress.total,
                          })
                        : t("admin.noMilestonesYet")}
                    </span>
                    {progress.total > 0 && (
                      <span className="font-bold text-forest tabular-nums">
                        {pct}%
                      </span>
                    )}
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-forest/10"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-sage transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {progress.overdue > 0 && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle size={11} />
                      {t("admin.overdueN", { n: progress.overdue })}
                    </p>
                  )}
                </div>

                {/* Members */}
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-clay">
                    <Users size={14} />
                    {members.length}
                  </span>
                  <div className="flex flex-row-reverse -space-x-2 space-x-reverse">
                    {members.slice(0, 4).map((m: any) => (
                      <UserAvatar
                        key={m.id}
                        user={m.student?.user}
                        size={26}
                        className="border-2 border-cream-card"
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/admin/projects/${p.id}`)}
                  className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
                >
                  {t("admin.viewDetails")}
                  <ChevronLeft size={14} className="ltr:rotate-180" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"‹"}
          </button>
          <span className="px-3 text-sm text-forest">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"›"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One figure of the summary.
 *
 * Only the count that needs acting on is coloured — overdue in red, a booked
 * defence in gold. Painting all five would spend the emphasis on nothing.
 */
function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "gold" | "good" | "danger";
}) {
  const toneCls =
    tone === "danger" && value > 0
      ? "text-red-600 dark:text-red-400"
      : tone === "gold"
        ? "text-gold"
        : tone === "good"
          ? "text-sage"
          : "text-forest";

  return (
    <div className="rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="mb-1.5 flex items-center gap-1.5 text-clay">
        <span className={toneCls}>{icon}</span>
        <span className="truncate text-[11px]">{label}</span>
      </div>
      <p className={`font-serif text-2xl font-bold tabular-nums ${toneCls}`}>
        {value}
      </p>
    </div>
  );
}
