import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  DoorOpen,
  Eye,
  FilterX,
  FolderKanban,
  Gavel,
  GraduationCap,
  LayoutList,
  Loader2,
  MapPin,
  Pencil,
  RotateCcw,
  Rows3,
  Search,
  Sparkles,
  Timer,
  Trash2,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AdminDefense } from "../../../../types/admin";
import { useAdminDefenses, useAdminProjects, useDeleteDefense, useUpdateDefense } from "../../hooks/admin-hook";
import { ProjectDefenseDialog } from "../../components/dialog/projects/project-defense-dialog";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { ProfessorPicker } from "../../components/ui/professor-picker";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { Select } from "../../../../components/ui/select";
import i18n from "../../../../i18n/i18n";
import { formatGrade, gradeMention, nameOf, relative } from "../projects/project-utils";
import { PHASE, byRole, clock, phaseOf } from "./defense-utils";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The defence schedule.
 *
 * What it was: a list whose edit button did nothing, a search the server
 * ignored, figures counted from the page on screen, a "booked rooms" tile that
 * always read "—", and a delete behind the browser's own confirm box.
 *
 * What it is: the schedule by day, each session with its time and length,
 * room, team and jury; the figures of the whole schedule, each one a filter;
 * clashes of room or juror marked where they happen; every action in place —
 * schedule, edit, record the result, cancel, delete; the projects still
 * waiting for a date beside it.
 */

type Status = "scheduled" | "completed" | "cancelled";
const PAGE = 20;

const FILTER_KEYS = ["q", "status", "when", "issue", "professorId"] as const;

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const isToday = (iso: string) => dayKey(iso) === dayKey(new Date().toISOString());

export function AdminDefensesPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const view = sp.get("view") === "table" ? "table" : "agenda";

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setSp(next, { replace: true });
  }

  const [search, setSearch] = useState(get("q"));
  useEffect(() => {
    const id = setTimeout(() => {
      if (search.trim() !== (sp.get("q") ?? "")) update({ q: search.trim() });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filters = useMemo(
    () => ({
      search: sp.get("q") || undefined,
      status: sp.get("status") || undefined,
      when: sp.get("when") || undefined,
      issue: sp.get("issue") || undefined,
      professorId: sp.get("professorId") || undefined,
      sort: sp.get("sort") || undefined,
    }),
    [sp],
  );
  const { data, isLoading, isError, isFetching, refetch } = useAdminDefenses({ ...filters, page, limit: PAGE });
  const items = useMemo(() => (data?.items ?? []) as AdminDefense[], [data]);
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const active = FILTER_KEYS.filter((k) => !!sp.get(k));

  const ready = useAdminProjects({ defense: "none", limit: 6, sort: "oldest" });
  const readyItems = (ready.data?.items ?? []) as any[];

  const [dialog, setDialog] = useState<
    { defense?: AdminDefense; groupId?: string; supervisorId?: string | null; initialStatus?: Status } | null
  >(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "cancel"; d: AdminDefense } | null>(null);
  const updateDefense = useUpdateDefense();
  const deleteDefense = useDeleteDefense();

  function clearAll() {
    setSearch("");
    const next = new URLSearchParams();
    if (sp.get("view")) next.set("view", sp.get("view")!);
    setSp(next, { replace: true });
  }

  // The agenda: one block per day, in the order the server gave.
  const days = useMemo(() => {
    const out: { key: string; date: string; items: AdminDefense[] }[] = [];
    for (const d of items) {
      const k = dayKey(d.date);
      const last = out[out.length - 1];
      if (last?.key === k) last.items.push(d);
      else out.push({ key: k, date: d.date, items: [d] });
    }
    return out;
  }, [items]);

  const tile = (key: "when" | "status" | "issue", value: string) => ({
    active: get(key) === value,
    onClick: () => update({ when: "", status: "", issue: "", [key]: get(key) === value ? "" : value }),
  });

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
                <Gavel size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.defensesPage.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">{t("admin.defensesTitle")}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.defensesPage.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDialog({})}
                data-testid="defenses-schedule"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
              >
                <CalendarPlus size={16} />
                {t("admin.defensesPage.schedule")}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <HeroTile icon={CalendarDays} label={t("admin.defensesPage.stat.total")} value={stats?.total} active={!get("when") && !get("status") && !get("issue")} onClick={() => update({ when: "", status: "", issue: "" })} />
            <HeroTile icon={CalendarClock} label={t("admin.defensesPage.stat.upcoming")} value={stats?.upcoming} tone="gold" {...tile("when", "upcoming")} />
            <HeroTile icon={Sparkles} label={t("admin.defensesPage.stat.today")} value={stats?.today} tone="gold" {...tile("when", "today")} />
            <HeroTile icon={CalendarCheck} label={t("admin.defensesPage.stat.week")} value={stats?.week} {...tile("when", "week")} />
            <HeroTile icon={AlertOctagon} label={t("admin.defensesPage.stat.stale")} value={stats?.stale} tone="danger" {...tile("when", "stale")} testId="tile-stale" />
            <HeroTile icon={Users} label={t("admin.defensesPage.stat.noCommittee")} value={stats?.noCommittee} tone="warn" {...tile("issue", "noCommittee")} />
            <HeroTile icon={CheckCircle2} label={t("admin.defensesPage.stat.completed")} value={stats?.completed} tone="sage" {...tile("status", "completed")} />
            <HeroTile icon={Ban} label={t("admin.defensesPage.stat.cancelled")} value={stats?.cancelled} tone="muted" {...tile("status", "cancelled")} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-cream/65">
            <span className="inline-flex items-center gap-1.5">
              <Award size={13} className="text-gold-soft" />
              {t("admin.defensesPage.avgGrade")}:{" "}
              <b className="text-cream tabular-nums">{stats?.averageGrade != null ? `${formatGrade(stats.averageGrade)}/20` : "—"}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DoorOpen size={13} className="text-gold-soft" />
              {t("admin.defensesPage.rooms")}: <b className="text-cream tabular-nums">{stats?.rooms ?? "—"}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban size={13} className="text-gold-soft" />
              {t("admin.defensesPage.ready")}: <b className="text-cream tabular-nums">{stats?.readyToSchedule ?? "—"}</b>
            </span>
          </div>
        </div>
      </section>

      {/* ── toolbar ──────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]">
          <div className="relative">
            <Search className="absolute top-1/2 start-3 -translate-y-1/2 text-clay" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.defensesPage.searchPlaceholder")}
              data-testid="defenses-search"
              className="h-[46px] w-full rounded-xl border border-forest/15 bg-cream ps-10 pe-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <ProfessorPicker value={get("professorId")} onChange={(v) => update({ professorId: v })} />
          <Select
            value={get("status")}
            onChange={(v) => update({ status: v })}
            options={[
              { value: "", label: t("admin.allDefenseStates") },
              { value: "scheduled", label: t("admin.proj.defenseState.scheduled") },
              { value: "completed", label: t("admin.proj.defenseState.completed") },
              { value: "cancelled", label: t("admin.proj.defenseState.cancelled") },
            ]}
          />
          <Select
            value={get("sort") || "dateAsc"}
            onChange={(v) => update({ sort: v === "dateAsc" ? "" : v })}
            options={[
              { value: "dateAsc", label: t("admin.defensesPage.sortAsc") },
              { value: "dateDesc", label: t("admin.defensesPage.sortDesc") },
            ]}
          />
          <div className="flex h-[46px] items-center rounded-xl border border-forest/15 p-1" role="group">
            <ViewBtn on={view === "agenda"} onClick={() => update({ view: "", page: String(page) })} icon={LayoutList} label={t("admin.defensesPage.viewAgenda")} />
            <ViewBtn on={view === "table"} onClick={() => update({ view: "table", page: String(page) })} icon={Rows3} label={t("admin.defensesPage.viewTable")} />
          </div>
        </div>
        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3 text-[11.5px]">
            <span className="text-clay">{t("admin.defensesPage.filtered", { count: total })}</span>
            <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-gold transition hover:bg-gold/10">
              <FilterX size={13} />
              {t("admin.proj.clearAll")}
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── schedule ── */}
        <div className="min-w-0">
          <div className="mb-2 h-0.5 overflow-hidden rounded-full">
            {isFetching && !isLoading && <div className="h-full w-1/3 animate-[bulkSweep_1s_ease-in-out_infinite] bg-gold" />}
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-forest/10 bg-forest/5" />
              ))}
            </div>
          ) : isError ? (
            <ErrorRetry title={t("admin.defensesPage.loadFailed")} onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-forest/15 bg-cream-card px-6 py-16 text-center">
              <span className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl border border-gold/30 bg-gold/10 text-gold">
                <CalendarDays size={26} />
              </span>
              <p className="text-[15px] font-bold text-forest">{active.length ? t("admin.noResultsFilters") : t("admin.noDefenses")}</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-clay">
                {active.length ? t("admin.proj.emptyFilteredHint") : t("admin.defensesPage.emptyHint")}
              </p>
              <button
                type="button"
                onClick={() => (active.length ? clearAll() : setDialog({}))}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
              >
                {active.length ? <FilterX size={14} /> : <CalendarPlus size={14} />}
                {active.length ? t("admin.clearFilters") : t("admin.defensesPage.schedule")}
              </button>
            </div>
          ) : view === "agenda" ? (
            <div className="space-y-6" data-testid="defenses-agenda">
              {days.map((day) => (
                <section key={day.key}>
                  <div className="sticky top-16 z-10 mb-3 flex items-center gap-3 bg-cream/80 py-1.5 backdrop-blur-sm">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                        isToday(day.date) ? "border-gold/50 bg-gold/15 text-forest" : "border-forest/10 bg-cream-card text-forest"
                      }`}
                    >
                      <CalendarDays size={14} className="text-gold" />
                      {new Date(day.date).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {isToday(day.date) && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] text-forest-deep">{t("admin.defenseToday")}</span>}
                    </span>
                    <span className="text-[11.5px] text-clay">{t("admin.defensesPage.sessions", { count: day.items.length })}</span>
                    <span className="h-px flex-1 bg-linear-to-l from-transparent to-forest/10" />
                  </div>
                  <div className="space-y-3">
                    {day.items.map((d) => (
                      <DefenseCard
                        key={d.id}
                        d={d}
                        lang={lang}
                        onEdit={() => setDialog({ defense: d, groupId: d.group?.id, supervisorId: d.group?.topic?.professorId })}
                        onResult={() => setDialog({ defense: d, groupId: d.group?.id, supervisorId: d.group?.topic?.professorId, initialStatus: "completed" })}
                        onCancel={() => setConfirm({ kind: "cancel", d })}
                        onDelete={() => setConfirm({ kind: "delete", d })}
                        onRestore={() => updateDefense.mutate({ id: d.id, data: { status: "scheduled" } })}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <DefenseTable
              items={items}
              lang={lang}
              onEdit={(d) => setDialog({ defense: d, groupId: d.group?.id, supervisorId: d.group?.topic?.professorId })}
              onDelete={(d) => setConfirm({ kind: "delete", d })}
            />
          )}

          {pages > 1 && !isError && (
            <nav className="mt-6 flex items-center justify-center gap-1.5">
              <PagerBtn disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} icon={ChevronRight} />
              <span className="px-3 text-sm text-forest tabular-nums">
                {page} / {pages}
              </span>
              <PagerBtn disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} icon={ChevronLeft} />
            </nav>
          )}
        </div>

        {/* ── waiting for a date ── */}
        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]" data-testid="ready-panel">
            <header className="flex items-center gap-2.5 border-b border-forest/10 bg-linear-to-l from-gold/[0.08] to-transparent px-4 py-3.5">
              <span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold">
                <FolderKanban size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[15px] font-bold text-forest">{t("admin.defensesPage.readyTitle")}</h2>
                <p className="text-[11px] text-clay">{t("admin.defensesPage.readyHint", { count: stats?.readyToSchedule ?? 0 })}</p>
              </div>
            </header>
            <ul className="divide-y divide-forest/8">
              {ready.isLoading ? (
                <li className="grid place-items-center py-8">
                  <Loader2 size={18} className="animate-spin text-gold" />
                </li>
              ) : readyItems.length === 0 ? (
                <li className="px-4 py-8 text-center text-[12px] text-clay">{t("admin.defensesPage.readyNone")}</li>
              ) : (
                readyItems.map((p) => {
                  const prog = p.progress ?? { total: 0, completed: 0 };
                  const done = prog.total > 0 && prog.completed === prog.total;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <UserAvatar user={p.topic?.professor?.user} size={32} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/${lang}/admin/projects/${p.id}`} className="line-clamp-1 text-[12.5px] font-semibold text-forest hover:text-gold">
                          {p.topic?.title}
                        </Link>
                        <p className={`text-[10.5px] ${done ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-clay"}`}>
                          {prog.total ? t("admin.milestonesDone", { done: prog.completed, total: prog.total }) : t("admin.noMilestonesYet")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDialog({ groupId: p.id, supervisorId: p.topic?.professorId })}
                        className="shrink-0 rounded-lg bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-forest-deep"
                      >
                        {t("admin.defensesPage.scheduleShort")}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {(stats?.readyToSchedule ?? 0) > readyItems.length && (
              <Link
                to={`/${lang}/admin/projects?defense=none`}
                className="flex items-center justify-center gap-1 border-t border-forest/10 py-2.5 text-[11.5px] font-semibold text-gold hover:bg-gold/5"
              >
                {t("admin.defensesPage.readyAll", { count: stats?.readyToSchedule ?? 0 })}
                <ChevronLeft size={13} className="ltr:rotate-180" />
              </Link>
            )}
          </section>
        </aside>
      </div>

      {/* ── dialogs ── */}
      <ProjectDefenseDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        groupId={dialog?.groupId}
        supervisorId={dialog?.supervisorId}
        defense={dialog?.defense ?? null}
        initialStatus={dialog?.initialStatus}
      />
      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.kind === "cancel" ? t("admin.defensesPage.cancelTitle") : t("admin.proj.deleteDefense")}
        message={confirm?.kind === "cancel" ? t("admin.defensesPage.cancelConfirm") : t("admin.proj.deleteDefenseConfirm")}
        confirmLabel={confirm?.kind === "cancel" ? t("admin.defensesPage.cancelAction") : t("admin.confirmDelete")}
        cancelLabel={t("admin.cancel")}
        loading={updateDefense.isPending || deleteDefense.isPending}
        onConfirm={() => {
          if (!confirm) return;
          const close = { onSettled: () => setConfirm(null) };
          if (confirm.kind === "cancel") updateDefense.mutate({ id: confirm.d.id, data: { status: "cancelled" } }, close);
          else deleteDefense.mutate(confirm.d.id, close);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────── */

const TILE = {
  neutral: "text-cream",
  gold: "text-gold-soft",
  sage: "text-soft-sage",
  danger: "text-red-300",
  warn: "text-amber-200",
  muted: "text-cream/70",
} as const;

function HeroTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  active,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  tone?: keyof typeof TILE;
  active?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const lit = tone === "danger" || tone === "warn" ? (value ?? 0) > 0 : true;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`rounded-2xl border p-3.5 text-start backdrop-blur-sm transition ${
        active ? "border-gold/60 bg-cream/15 shadow-[0_0_0_1px_rgba(193,150,90,0.35)]" : "border-white/10 bg-cream/5 hover:border-white/20 hover:bg-cream/10"
      }`}
    >
      <span className="mb-2 flex items-center gap-1.5 text-[11px] text-cream/70">
        <Icon size={14} className={lit ? TILE[tone] : "text-cream/50"} />
        <span className="truncate">{label}</span>
      </span>
      <span className={`block font-serif text-2xl font-bold tabular-nums ${lit ? TILE[tone] : "text-cream/60"}`}>{value ?? "—"}</span>
    </button>
  );
}

function ViewBtn({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`grid h-full w-9 place-items-center rounded-lg transition ${on ? "bg-forest text-cream" : "text-clay hover:bg-forest/5 hover:text-forest"}`}
    >
      <Icon size={16} />
    </button>
  );
}

function PagerBtn({ disabled, onClick, icon: Icon }: { disabled: boolean; onClick: () => void; icon: LucideIcon }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onClick();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="grid size-9 place-items-center rounded-xl border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
    >
      <Icon size={16} className="ltr:rotate-180" />
    </button>
  );
}

function DefenseCard({
  d,
  lang,
  onEdit,
  onResult,
  onCancel,
  onDelete,
  onRestore,
}: {
  d: AdminDefense;
  lang?: string;
  onEdit: () => void;
  onResult: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const phase = phaseOf(d);
  const look = PHASE[phase];
  const topic = d.group?.topic as any;
  const members = (d.group?.members ?? []) as any[];
  const committee = byRole((d.committee ?? []) as any[]);
  const clashRoom = d.clashes?.room.length ?? 0;
  const clashProf = d.clashes?.professors.length ?? 0;
  const g = formatGrade(d.grade);
  const mention = gradeMention(d.grade);
  const duration = d.durationMinutes ?? 60;

  return (
    <article
      className={`group flex overflow-hidden rounded-2xl border bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:shadow-[0_14px_34px_-16px_rgba(38,66,61,0.4)] ${look.ring}`}
      data-testid="defense-card"
      data-phase={phase}
    >
      {/* time */}
      <div className={`flex w-28 shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-4 text-center ${look.rail}`}>
        <span className="font-serif text-xl leading-none font-bold tabular-nums">{clock(d.date)}</span>
        <span className="text-[11px] tabular-nums opacity-80">→ {clock(d.endsAt ?? new Date(new Date(d.date).getTime() + duration * 60_000))}</span>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">
          <Timer size={10} />
          {t("admin.defensesPage.form.minutes", { n: duration })}
        </span>
      </div>

      {/* body */}
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <Link
            to={`/${lang}/admin/defenses/${d.id}`}
            className="min-w-0 flex-1 font-serif text-[15.5px] leading-snug font-bold text-forest transition hover:text-gold"
            data-testid="defense-open"
          >
            {topic?.title ?? "—"}
          </Link>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${look.chip}`}>
            {phase === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
            {t(`admin.defensesPage.phase.${phase}`)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <Chip icon={MapPin}>{d.room || "—"}</Chip>
          {topic?.specialization?.name && <Chip icon={GraduationCap}>{topic.specialization.name}</Chip>}
          {phase === "scheduled" && <Chip icon={Clock}>{relative(d.date)}</Chip>}
          {clashRoom > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 font-bold text-red-700 dark:text-red-300"
              title={d.clashes!.room.map((c) => `${c.title} · ${clock(c.date)}`).join("\n")}
              data-testid="clash-room"
            >
              <AlertTriangle size={11} />
              {t("admin.defensesPage.clashRoomBadge", { n: clashRoom })}
            </span>
          )}
          {clashProf > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 font-bold text-red-700 dark:text-red-300"
              title={d.clashes!.professors.map((c) => `${c.name}: ${c.title} · ${clock(c.date)}`).join("\n")}
            >
              <AlertTriangle size={11} />
              {t("admin.defensesPage.clashProfBadge", { n: clashProf })}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-forest/10 pt-3 lg:grid-cols-2">
          {/* team */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-clay">{t("admin.defensesPage.team")}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {members.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-cream-2/70 py-0.5 ps-0.5 pe-2 text-[11.5px] text-forest">
                  <UserAvatar user={m.student?.user} size={20} />
                  {nameOf(m.student?.user)}
                  {m.isLeader && <Crown size={10} className="text-gold" />}
                </span>
              ))}
              {members.length === 0 && <span className="text-[11.5px] text-clay">—</span>}
            </div>
            {topic?.professor?.user && (
              <p className="mt-1.5 text-[11px] text-clay">
                {t("admin.supervisor")}: <span className="font-semibold text-forest">{nameOf(topic.professor.user)}</span>
              </p>
            )}
          </div>

          {/* jury */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-clay">{t("admin.committee")}</p>
            {committee.length === 0 ? (
              <p className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle size={11} />
                {t("admin.noCommittee")}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {committee.map((c) => (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-2 text-[11.5px] ${
                      c.role === "president" ? "bg-gold/15 text-forest ring-1 ring-gold/30" : "bg-cream-2/70 text-forest"
                    }`}
                    title={t(`committeeRole.${c.role}`)}
                  >
                    <UserAvatar user={c.professor?.user} size={20} />
                    {nameOf(c.professor?.user)}
                    {c.role === "president" ? <Crown size={10} className="text-gold" /> : c.role === "supervisor" ? <UserCheck size={10} className="text-clay" /> : null}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {(g !== null || d.notes) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {g !== null && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3 py-1.5">
                <Award size={14} className="text-gold" />
                <span className="font-serif text-[16px] font-bold text-forest tabular-nums">{g}</span>
                <span className="text-[11px] text-clay">/ 20</span>
                {mention && <span className="text-[11px] font-bold text-gold">{t(`admin.proj.mention.${mention}`)}</span>}
              </span>
            )}
            {d.notes && <p className="line-clamp-1 min-w-0 flex-1 text-[11.5px] text-clay">{d.notes}</p>}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-s border-forest/10 px-2 py-3">
        <Link
          to={`/${lang}/admin/defenses/${d.id}`}
          title={t("admin.defenseDetail.open")}
          aria-label={t("admin.defenseDetail.open")}
          className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold transition hover:bg-gold/25"
        >
          <Eye size={16} />
        </Link>
        {(phase === "stale" || phase === "live" || phase === "scheduled") && (
          <ActBtn icon={CheckCircle2} label={t("admin.defensesPage.recordResult")} onClick={onResult} tone="good" testId="defense-result" />
        )}
        <ActBtn icon={Pencil} label={t("admin.proj.editDefense")} onClick={onEdit} testId="defense-edit" />
        {phase === "cancelled" ? (
          <ActBtn icon={RotateCcw} label={t("admin.defensesPage.restore")} onClick={onRestore} />
        ) : phase !== "completed" ? (
          <ActBtn icon={Ban} label={t("admin.defensesPage.cancelAction")} onClick={onCancel} tone="warn" />
        ) : null}
        <ActBtn icon={Trash2} label={t("admin.proj.deleteDefense")} onClick={onDelete} tone="danger" testId="defense-delete" />
      </div>
    </article>
  );
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest/5 px-2 py-0.5 text-clay">
      <Icon size={11} />
      {children}
    </span>
  );
}

function ActBtn({
  icon: Icon,
  label,
  onClick,
  tone,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "good" | "warn" | "danger";
  testId?: string;
}) {
  const hover =
    tone === "good"
      ? "hover:bg-emerald-500/12 hover:text-emerald-600 dark:hover:text-emerald-300"
      : tone === "warn"
        ? "hover:bg-amber-500/12 hover:text-amber-600 dark:hover:text-amber-300"
        : tone === "danger"
          ? "hover:bg-red-500/10 hover:text-red-500"
          : "hover:bg-forest/10 hover:text-forest";
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} data-testid={testId} className={`grid size-9 place-items-center rounded-xl text-clay transition ${hover}`}>
      <Icon size={16} />
    </button>
  );
}

function DefenseTable({
  items,
  lang,
  onEdit,
  onDelete,
}: {
  items: AdminDefense[];
  lang?: string;
  onEdit: (d: AdminDefense) => void;
  onDelete: (d: AdminDefense) => void;
}) {
  const { t } = useTranslation();
  const th = "px-4 py-3 text-start text-[11px] font-semibold whitespace-nowrap";
  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]" data-testid="defenses-table">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-start">
          <thead>
            <tr className="bg-forest text-cream">
              <th className={th}>{t("admin.defensesPage.col.when")}</th>
              <th className={th}>{t("admin.proj.col.project")}</th>
              <th className={th}>{t("admin.room")}</th>
              <th className={th}>{t("admin.committee")}</th>
              <th className={th}>{t("admin.proj.defenseForm.status")}</th>
              <th className={th}>{t("admin.grade")}</th>
              <th className={`${th} w-24`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {items.map((d) => {
              const phase = phaseOf(d);
              const president = (d.committee ?? []).find((c: any) => c.role === "president") as any;
              return (
                <tr key={d.id} className="transition-colors hover:bg-forest/4">
                  <td className="px-4 py-3 text-[12px] whitespace-nowrap text-forest">
                    <p className="font-semibold">{new Date(d.date).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" })}</p>
                    <p className="text-[11px] text-clay tabular-nums">
                      {clock(d.date)} – {clock(d.endsAt ?? d.date)}
                    </p>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <Link to={`/${lang}/admin/defenses/${d.id}`} className="line-clamp-1 text-[13px] font-semibold text-forest hover:text-gold">
                      {(d.group?.topic as any)?.title ?? "—"}
                    </Link>
                    <p className="truncate text-[11px] text-clay">{(d.group?.members ?? []).map((m: any) => nameOf(m.student?.user)).join("، ")}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-forest">
                    {d.room}
                    {(d.clashes?.room.length ?? 0) > 0 && <AlertTriangle size={12} className="ms-1 inline text-red-500" />}
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-clay">
                    {president ? (
                      <span className="inline-flex items-center gap-1 text-forest">
                        <Crown size={11} className="text-gold" />
                        {nameOf(president.professor?.user)}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">{t("admin.proj.alert.noPresident")}</span>
                    )}
                    <span className="ms-1 text-clay">({d.committee?.length ?? 0})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${PHASE[phase].chip}`}>{t(`admin.defensesPage.phase.${phase}`)}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-forest tabular-nums">{formatGrade(d.grade) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center justify-end gap-0.5">
                      <ActBtn icon={Pencil} label={t("admin.proj.editDefense")} onClick={() => onEdit(d)} />
                      <ActBtn icon={Trash2} label={t("admin.proj.deleteDefense")} onClick={() => onDelete(d)} tone="danger" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-forest/10 px-4 py-2 text-[10.5px] text-clay">{t("admin.defensesPage.tableHint")}</p>
    </div>
  );
}
