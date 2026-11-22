import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  FileText,
  Download,
  CalendarClock,
  ChevronDown,
  CalendarDays,
  FolderKanban,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import {
  useMyGroups,
  useGroup,
  useDeleteMilestone,
} from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import { MilestoneFormDialog } from "../components/milestone-form-dialog";
import { ConfirmDialog } from "../../admin/components/form/confirm-dialog.form";
import type { Milestone } from "../../../types/professor.types";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { Highlight } from "../../../components/ui/highlight";
import { personName } from "../../../lib/person-name";
import { foldText, searchWords } from "../../../lib/search-text";
import { isPhoneNow } from "../../../hooks/use-media-query";
import { BoardHero } from "../components/milestone-board/board-hero";
import { BoardFilterBar } from "../components/milestone-board/board-filters";
import { BoardCard } from "../components/milestone-board/board-card";
import {
  DEFAULT_FILTERS,
  deriveRow,
  facets,
  isLate,
  passes,
  fieldWords,
  readFilters,
  searchHits,
  sortRows,
  writeFilters,
  type BoardFilters,
} from "../lib/milestone-board";

const MS_NODE: Record<string, string> = {
  pending: "bg-amber-400 ring-amber-200",
  in_progress: "bg-sky-400 ring-sky-200",
  completed: "bg-emerald-400 ring-emerald-200",
  overdue: "bg-red-400 ring-red-200",
};
const MS_BORDER: Record<string, string> = {
  pending: "border-r-amber-400",
  in_progress: "border-r-sky-400",
  completed: "border-r-emerald-400",
  overdue: "border-r-red-400",
};

const CARD = "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

/**
 * مراحل مذكّرات الأستاذ: لوحةٌ يختار منها مذكرةً (ببحثٍ وفلاتر وترتيب)،
 * ثمّ مراحلها تُدار.
 *
 * والمذكرة المختارة في العنوان (`?group=…`) مع الفلاتر: «رجوع» المتصفّح
 * يعود إلى اللوحة بفلاترها، والتحديث لا يُضيّع شيئاً.
 */
export function ProfessorMilestonesPage() {
  const [sp, setSp] = useSearchParams();
  const selectedId = sp.get("group");
  const pick = (id: string | null) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("group", id);
      else next.delete("group");
      return next;
    });

  if (selectedId) return <MilestonesManager groupId={selectedId} onBack={() => pick(null)} />;
  return <ProjectPicker onPick={pick} />;
}

// ════════════════════════════════════════════════════════════
//  STATE 1 — the board: choose a project
// ════════════════════════════════════════════════════════════

const OPEN_KEY = "pro.milestones.filtersOpen";

/** اللوحة مفتوحةً أوّل مرّة على الشاشة الواسعة، مطويّةً على الهاتف؛ ثمّ كما تُركت. */
function readOpen(): boolean {
  try {
    const v = localStorage.getItem(OPEN_KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch {
    /* التخزين ممنوع: الأصل */
  }
  return !isPhoneNow();
}

function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const tm = (k: string, o?: Record<string, unknown>) => t(`pro.ms.${k}`, o);
  const { data: groups, isLoading, isError, refetch } = useMyGroups();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(readOpen);
  // لحظةٌ واحدة للصفحة: ما تأخّر وما قرُب يُحسب منها كلّه.
  const [now] = useState(() => Date.now());

  const filters = readFilters(sp);
  const update = (patch: Partial<BoardFilters>) =>
    setSp((prev) => writeFilters(prev, { ...readFilters(prev), ...patch }), { replace: true });
  const reset = () => setSp((prev) => writeFilters(prev, DEFAULT_FILTERS), { replace: true });
  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(OPEN_KEY, v ? "1" : "0");
    } catch {
      /* خصوصيّةٌ أو تخزينٌ ممتلئ: لهذه الزيارة وحدها */
    }
  };

  const rows = (groups ?? []).map((g) => deriveRow(g, now));
  const words = searchWords(filters.q);
  const by = fieldWords(filters);
  const found = rows.map((r) => ({ r, hits: searchHits(r.g, words, by) })).filter((x) => x.hits !== null);
  const kept = found.filter((x) => passes(x.r, filters));
  const order = sortRows(
    kept.map((x) => x.r),
    filters.sort,
    i18n.language,
  );
  const hitsOf = new Map(kept.map((x) => [x.r.g.id, x.hits!]));
  const fx = facets(rows, filters, words, by);

  const totals = {
    projects: rows.length,
    students: rows.reduce((n, r) => n + r.size, 0),
    files: rows.reduce((n, r) => n + r.files, 0),
    avg: rows.length ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length) : 0,
  };
  const filtered = JSON.stringify({ ...filters, sort: "" }) !== JSON.stringify({ ...DEFAULT_FILTERS, sort: "" });

  return (
    <div className="space-y-6 font-body">
      <BoardHero totals={totals} counts={fx.health} health={filters.health} onHealth={(h) => update({ health: h })} />

      {rows.length > 0 && (
        <>
          <BoardFilterBar filters={filters} facets={fx} open={open} onOpen={toggle} onChange={update} onReset={reset} />
          <p className="flex min-h-6 items-center gap-2 text-sm text-clay" aria-live="polite" data-testid="board-results">
            <FolderKanban size={15} className="text-gold" />
            {tm("resultsLabel")}:
            <span className="font-semibold text-forest tabular-nums">{tm("results", { shown: order.length, total: rows.length })}</span>
          </p>
        </>
      )}

      {isLoading ? (
        <div aria-hidden className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3" data-testid="board-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`h-72 animate-pulse ${CARD}`} />
          ))}
        </div>
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <div className={`${CARD} grid place-items-center gap-3 px-6 py-20 text-center`}>
          <span className="grid size-16 place-items-center rounded-full bg-gold/10 text-gold ring-8 ring-gold/5">
            <FolderKanban size={26} />
          </span>
          <p className="max-w-sm text-sm text-clay">{t("pro.noProjectsYet")}</p>
        </div>
      ) : order.length === 0 ? (
        <div data-testid="board-empty" className={`${CARD} px-6 py-16 text-center`}>
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-gold/10 ring-8 ring-gold/5">
            <SearchX size={34} className="text-gold" />
          </div>
          <h2 className="mt-5 font-serif text-xl font-bold text-forest">{tm("noMatch")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-clay">{tm("noMatchHint")}</p>
          {filtered && (
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-forest px-5 py-3 text-sm font-bold text-cream transition hover:bg-forest-deep active:scale-95"
            >
              <RotateCcw size={16} />
              {tm("reset")}
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3" data-testid="board-grid">
          {order.map((r) => (
            <li key={r.g.id} className="grid">
              <BoardCard row={r} words={words} by={by} hits={hitsOf.get(r.g.id)!} now={now} onOpen={() => onPick(r.g.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STATE 2 — manage milestones of the chosen project
// ════════════════════════════════════════════════════════════

/** حال المرحلة كما تُفلتر: المتأخّرة بموعدها أو بحالها. */
const MS_FILTERS = ["pending", "in_progress", "completed", "overdue"] as const;
type MsFilter = (typeof MS_FILTERS)[number] | "";

function MilestonesManager({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: group, isLoading } = useGroup(groupId);
  const deleteMilestone = useDeleteMilestone();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [toDelete, setToDelete] = useState<Milestone | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [msFilter, setMsFilter] = useState<MsFilter>("");
  const [now] = useState(() => Date.now());

  function fmtDate(iso?: string) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  if (isLoading)
    return (
      <LoadingArea className="py-20" />
    );
  if (!group)
    return (
      <div className="py-20 text-center text-sm text-clay">
        {t("pro.projectNotFound")}
      </div>
    );

  const milestones = group.milestones ?? [];
  const completed = milestones.filter((m) => m.status === "completed").length;
  const progress = milestones.length
    ? Math.round((completed / milestones.length) * 100)
    : 0;

  // البحث في العنوان والوصف وأسماء الملفات؛ والحال فلترٌ بعدد كلٍّ منها.
  const stateOf = (m: Milestone): MsFilter => (isLate(m, now) ? "overdue" : (m.status as MsFilter));
  const words = searchWords(query);
  const searched = milestones.filter((m) => {
    if (!words.length) return true;
    const hay = foldText([m.title, m.description ?? "", ...(m.submissions ?? []).map((s) => s.fileName)].join(" "));
    return words.every((w) => hay.includes(w));
  });
  const msCounts = Object.fromEntries(MS_FILTERS.map((s) => [s, searched.filter((m) => stateOf(m) === s).length]));
  const visible = searched.filter((m) => !msFilter || stateOf(m) === msFilter);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(m: Milestone) {
    setEditing(m);
    setDialogOpen(true);
  }
  function handleDelete(m: Milestone) {
    setToDelete(m);
  }

  return (
    <div className="font-body">
      {/* Back to picker */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />
        {t("pro.changeProject")}
      </button>

      {/* Project header + progress */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-gold">
            {t("pro.managingMilestonesFor")}
          </p>
          <h1 className="font-serif text-xl font-bold text-forest">
            {group.topic?.title ?? "—"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-serif text-xl font-bold text-gold">
              {progress}%
            </p>
            <p className="text-[10px] text-clay">{t("pro.completed")}</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-xl font-bold text-forest">
              {milestones.length}
            </p>
            <p className="text-[10px] text-clay">{t("pro.milestonesShort")}</p>
          </div>
        </div>
      </div>

      {/* Timeline card */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]">
        <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
            <CalendarClock size={18} className="text-gold" />
            {t("pro.milestonesTimeline")}
          </h2>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft"
          >
            <Plus size={14} />
            {t("pro.addMilestone")}
          </button>
        </div>

        {/* البحث في المراحل، وحالها */}
        {milestones.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-forest/10 bg-cream-2/40 px-5 py-3.5 lg:flex-row lg:items-center" data-testid="ms-toolbar">
            <div className="relative lg:w-80">
              <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-clay" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder={t("pro.ms.msSearch")}
                aria-label={t("pro.ms.msSearch")}
                className="w-full rounded-xl border border-forest/15 bg-cream-card py-2.5 ps-10 pe-9 text-sm text-forest outline-none transition placeholder:text-clay/80 focus:border-gold focus:ring-4 focus:ring-gold/15 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("pro.ms.clearSearch")}
                  className="absolute inset-y-0 end-1.5 my-auto grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/8 hover:text-forest"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div role="group" aria-label={t("pro.ms.msFilter")} className="flex flex-wrap gap-1.5">
              {(["", ...MS_FILTERS] as MsFilter[]).map((s) => {
                const active = msFilter === s;
                const n = s ? msCounts[s]! : searched.length;
                return (
                  <button
                    key={s || "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMsFilter(active && s ? "" : s)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      active
                        ? "border-gold bg-gold/15 text-forest shadow-[0_0_0_1px_rgba(193,150,90,0.35)]"
                        : "border-forest/15 text-clay hover:border-gold/40 hover:text-forest"
                    }`}
                  >
                    {s ? t(`status.${s}`) : t("pro.ms.any")}
                    <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? "bg-gold text-[var(--t-brand-deep)]" : "bg-forest/8 text-clay"}`}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {milestones.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-cream-2 text-clay">
              <CalendarClock size={26} />
            </div>
            <p className="text-sm text-clay">{t("pro.noMilestones")}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center gap-3 py-14 text-center" data-testid="ms-empty">
            <SearchX size={28} className="text-gold" />
            <p className="text-sm text-clay">{t("pro.ms.msNoMatch")}</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setMsFilter("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
            >
              <RotateCcw size={13} />
              {t("pro.ms.reset")}
            </button>
          </div>
        ) : (
          <div className="relative px-5 py-6">
            <div className="absolute bottom-6 right-[2.35rem] top-6 w-0.5 bg-linear-to-b from-gold via-gold-soft to-forest/10" />
            <div className="space-y-5">
              {visible.map((m) => {
                const subs = m.submissions ?? [];
                const isOpen = expanded === m.id;
                const isCurrent = m.status === "in_progress";
                return (
                  <div key={m.id} className="relative flex gap-4">
                    <div className="relative z-10 shrink-0">
                      <div
                        className={`grid place-items-center rounded-full text-xs font-bold text-white ring-4 ${MS_NODE[m.status] ?? "bg-gray-400 ring-gray-200"} ${isCurrent ? "size-11 animate-pulse" : "size-9"}`}
                      >
                        {String(m.order).padStart(2, "0")}
                      </div>
                    </div>
                    <div
                      className={`flex-1 rounded-xl border border-forest/10 border-r-4 bg-cream-2/60 p-4 ${MS_BORDER[m.status] ?? "border-r-gray-400"}`}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-sm font-bold text-forest">
                              <Highlight text={m.title} words={words} />
                            </h3>
                            {isCurrent && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-600">
                                {t("pro.currentlyInProgress")}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-clay">
                            <CalendarDays size={11} />
                            {fmtDate(m.deadline)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <StatusBadge status={m.status} />
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            aria-label={t("pro.edit")}
                            title={t("pro.edit")}
                            className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(m)}
                            aria-label={t("pro.delete")}
                            title={t("pro.delete")}
                            className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {subs.length > 0 ? (
                        <button
                          onClick={() => setExpanded(isOpen ? null : m.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sage transition hover:text-forest"
                        >
                          <ChevronDown
                            size={12}
                            className={
                              isOpen ? "rotate-180 transition" : "transition"
                            }
                          />
                          {t("pro.viewSubmissions", { n: subs.length })}
                        </button>
                      ) : (
                        <p className="mt-1 text-[11px] text-clay">
                          {t("pro.noSubmissions")}
                        </p>
                      )}
                      {isOpen && subs.length > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-lg bg-cream-card p-2">
                          {subs.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-cream-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText
                                  size={13}
                                  className="shrink-0 text-gold"
                                />
                                <span className="truncate text-[11px] text-forest">
                                  <Highlight text={s.fileName} words={words} />
                                </span>
                                <span className="shrink-0 text-[10px] text-clay">
                                  {t("pro.byStudent", {
                                    name: personName(s.uploadedBy),
                                  })}
                                </span>
                              </div>
                              <a
                                href={s.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                              >
                                <Download size={13} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MilestoneFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        groupId={groupId}
        milestone={editing}
      />
      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        icon={Trash2}
        title={t("pro.deleteMilestoneTitle")}
        message={t("pro.deleteMilestoneBody", { title: toDelete?.title ?? "" })}
        confirmLabel={t("admin.delete")}
        loading={deleteMilestone.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && deleteMilestone.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </div>
  );
}
