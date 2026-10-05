import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Inbox,
  Users2,
  CalendarDays,
  Layers,
  FileText,
  FileCheck2,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  useMyTopics,
  useDeleteTopic,
  useSpecializations,
  useAcademicYears,
} from "../hooks/Professor-hook";
import { TopicFormDialog } from "../components/topic-form-dialog";
import type { Topic } from "../../../types/professor.types";
import { Select } from "../../../components/ui/select";
import { DangerConfirm } from "../../../components/dialog/danger-confirm";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import { StatusPill } from "../../../components/ui/status-pill";
import { STATUS_TONE } from "../../../lib/status-tone";
import { noneText } from "../../../lib/none-text";

/**
 * The professor's topics: a header whose status counts are also the
 * status filter, a small filter panel for the rest, and the table.
 *
 * Filtering is done here rather than on the server. `GET /professor/topics`
 * returns only this professor's own topics — tens at most — so a round trip
 * per keystroke would buy nothing.
 */

const PAGE_SIZE = 10;

const STATUSES = [
  "pending",
  "approved",
  "open",
  "full",
  "rejected",
  "archived",
] as const;

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

export function ProfessorTopicsPage() {
  const { t, i18n } = useTranslation();
  const { data: topics, isLoading } = useMyTopics();
  const { data: specializations } = useSpecializations();
  const { data: years } = useAcademicYears();
  const deleteTopic = useDeleteTopic();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [withGroup, setWithGroup] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);
  const [sheetTopicId, setSheetTopicId] = useState<string | null>(null);

  // ── filters ──
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  // The status is chosen in the header, so the panel counts only its own.
  const panelFilters = [search, specializationId, academicYearId].filter(
    Boolean,
  ).length;

  const all = useMemo(() => topics ?? [], [topics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((tp) => {
      if (status && tp.status !== status) return false;
      if (specializationId && tp.specializationId !== specializationId)
        return false;
      if (academicYearId && tp.academicYearId !== academicYearId) return false;
      if (q) {
        const hay = `${tp.title} ${tp.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, search, status, specializationId, academicYearId]);

  // A filter that empties the last page should not leave the reader staring
  // at nothing; clamp instead.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const tp of all) c[tp.status] = (c[tp.status] ?? 0) + 1;
    return c;
  }, [all]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setSpecializationId("");
    setAcademicYearId("");
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setWithGroup(false);
    setDialogOpen(true);
  }
  function openCreateWithGroup() {
    setEditing(null);
    setWithGroup(true);
    setDialogOpen(true);
  }
  function openEdit(tp: Topic) {
    setEditing(tp);
    setWithGroup(false);
    setDialogOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteTopic.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  }

  /** Only an undecided topic is the professor's to change. */
  function editable(tp: Topic) {
    return tp.status === "pending" || tp.status === "rejected";
  }

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

  const actions = {
    onEdit: openEdit,
    onDelete: (tp: Topic) => setPendingDelete(tp),
    onSheet: (tp: Topic) => setSheetTopicId(tp.id),
    editable,
  };

  return (
    <div className="space-y-6 font-body">
      <Hero
        total={all.length}
        counts={counts}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPage(1);
        }}
        onCreate={openCreate}
        onCreateWithGroup={openCreateWithGroup}
      />

      {/* ── the rest of the filters ── */}
      <section className={`overflow-hidden ${CARD}`}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-60 flex-1">
            <Search
              className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("pro.searchTopic")}
              className="w-full rounded-2xl border border-forest/15 bg-cream-2 py-3 ps-4 pe-11 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              filtersOpen || panelFilters > 0
                ? "border-gold/50 bg-gold/10 text-forest"
                : "border-forest/15 text-forest hover:border-gold/40 hover:bg-gold/5"
            }`}
          >
            <SlidersHorizontal size={17} />
            {t("pro.filters")}
            {panelFilters > 0 && (
              <span className="rounded-full bg-gold px-1.5 text-[11px] font-bold text-forest-deep">
                {panelFilters}
              </span>
            )}
            <ChevronDown
              size={16}
              className={`transition ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
          {(panelFilters > 0 || status) && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <RotateCcw size={14} />
              {t("pro.clearFilters")}
            </button>
          )}
        </div>

        <div
          className={`grid transition-all duration-300 ${
            filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 gap-3 border-t border-forest/10 p-4 md:grid-cols-2">
              <Select
                value={specializationId}
                onChange={(v) => {
                  setSpecializationId(v);
                  setPage(1);
                }}
                options={[
                  { value: "", label: t("pro.allSpecializations") },
                  ...(specializations ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
              />
              <Select
                value={academicYearId}
                onChange={(v) => {
                  setAcademicYearId(v);
                  setPage(1);
                }}
                options={[
                  { value: "", label: t("pro.allYears") },
                  ...(years ?? []).map((y) => ({
                    value: y.id,
                    label: `${y.title}${y.isActive ? " ●" : ""}`,
                  })),
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── the topics ── */}
      <section className={`overflow-hidden ${CARD}`}>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, k) => (
              <div
                key={k}
                className="h-16 animate-pulse rounded-2xl bg-forest/5"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            nothingYet={all.length === 0}
            onCreate={openCreate}
            onReset={resetFilters}
          />
        ) : (
          <>
            {/* wide screens: the table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-forest/10 bg-cream-2/70 text-[11px] font-semibold tracking-wide text-clay">
                    <th className="px-6 py-3.5 text-start">{t("pro.title")}</th>
                    <th className="px-4 py-3.5 text-start">
                      {t("pro.specialization")}
                    </th>
                    <th className="px-4 py-3.5 text-start">
                      {t("pro.statusLabel")}
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      {t("pro.maxStudents")}
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      {t("pro.requestsCount")}
                    </th>
                    <th className="px-6 py-3.5 text-end">{t("pro.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/8">
                  {rows.map((tp) => (
                    <tr
                      key={tp.id}
                      className="align-middle transition-colors hover:bg-gold/5"
                    >
                      <td className="max-w-md px-6 py-4">
                        <TitleCell tp={tp} fmtDate={fmtDate} />
                      </td>
                      <td className="px-4 py-4">
                        <p className="flex items-center gap-1.5 text-sm text-forest">
                          <Layers size={13} className="shrink-0 text-gold" />
                          <span className="truncate">
                            {tp.specialization?.name ?? "—"}
                          </span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-clay">
                          <CalendarDays size={12} className="shrink-0" />
                          {tp.academicYear?.title ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={tp.status} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest tabular-nums">
                          <Users2 size={14} className="text-clay" />
                          {tp.maxStudents}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <RequestsCount n={tp._count?.groupRequests ?? 0} />
                      </td>
                      <td className="px-6 py-4">
                        <RowActions tp={tp} {...actions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* phones: the same rows as cards */}
            <ul className="divide-y divide-forest/8 md:hidden">
              {rows.map((tp) => (
                <li key={tp.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <TitleCell tp={tp} fmtDate={fmtDate} />
                    <StatusPill status={tp.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-clay">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={12} className="text-gold" />
                      {tp.specialization?.name ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      {tp.academicYear?.title ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users2 size={12} />
                      {tp.maxStudents}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Inbox size={12} />
                      {tp._count?.groupRequests ?? 0}
                    </span>
                  </div>
                  <RowActions tp={tp} {...actions} />
                </li>
              ))}
            </ul>

            {/* ── pagination ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/40 px-6 py-3.5">
              <p className="text-xs text-clay">
                {t("pro.showingRange", {
                  from: (current - 1) * PAGE_SIZE + 1,
                  to: Math.min(current * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <PageButton
                    icon={ChevronRight}
                    disabled={current <= 1}
                    onClick={() => setPage(current - 1)}
                  />
                  <span
                    dir="ltr"
                    className="rounded-xl bg-cream-card px-3 py-1.5 text-sm font-semibold text-forest ring-1 ring-forest/10 tabular-nums"
                  >
                    {current}/{totalPages}
                  </span>
                  <PageButton
                    icon={ChevronLeft}
                    disabled={current >= totalPages}
                    onClick={() => setPage(current + 1)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/*
        كان الحذف هنا `window.confirm` — سطرٌ من المتصفّح: «حذف هذا
        الموضوع؟» بلا عنوانٍ ولا حالةٍ ولا عددِ طلبات، ولا يتبع سمة الموقع.
        والموضوع يُحذف من صفٍّ في جدول، فالسؤال المجرَّد لا يقول أيّ صفٍّ
        هو. فصارت النافذة تسمّي الموضوع وتقول ما يذهب معه.
      */}
      <DangerConfirm
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleteTopic.isPending}
        title={t("admin.deleteTopicTitle")}
        name={pendingDelete?.title ?? ""}
        kicker={t("admin.topicWord")}
        facts={[
          {
            icon: CircleDot,
            label: t("pro.statusLabel"),
            value: t(`status.${pendingDelete?.status}`),
          },
          {
            icon: Layers,
            label: t("pro.specialization"),
            value: pendingDelete?.specialization?.name ?? noneText(),
          },
          {
            icon: CalendarDays,
            label: t("pro.academicYear"),
            value: pendingDelete?.academicYear?.title ?? noneText(true),
          },
          {
            icon: Users2,
            label: t("pro.maxStudents"),
            value: pendingDelete?.maxStudents ?? 0,
            dir: "ltr",
          },
        ]}
        impacts={[
          {
            icon: Inbox,
            label: t("admin.impactTopicRequests"),
            value: pendingDelete?._count?.groupRequests ?? 0,
            heavy: (pendingDelete?._count?.groupRequests ?? 0) > 0,
          },
          { icon: FileText, label: t("admin.impactTopicApplications") },
        ]}
        warning={t("admin.irreversibleWarning")}
        confirmLabel={t("admin.yesDelete")}
      />

      <TopicFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        topic={editing}
        withGroup={withGroup}
      />

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

/**
 * Title, the two ways to add a topic, and a tile per status. The tiles are
 * the status filter: a count one cannot act on is decoration.
 */
function Hero({
  total,
  counts,
  status,
  onStatus,
  onCreate,
  onCreateWithGroup,
}: {
  total: number;
  counts: Record<string, number>;
  status: string;
  onStatus: (s: string) => void;
  onCreate: () => void;
  onCreateWithGroup: () => void;
}) {
  const { t } = useTranslation();
  const present = STATUSES.filter((s) => (counts[s] ?? 0) > 0);

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

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)]">
            <FileText size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-bold text-cream">
              {t("pro.myTopicsTitle")}
            </h1>
            <p className="mt-1 text-sm text-soft-sage">
              {t("pro.myTopicsSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateWithGroup}
            title={t("pro.withGroupSubtitle")}
            className="inline-flex items-center gap-2 rounded-2xl border border-gold/50 px-4 py-3 text-sm font-semibold text-gold-soft transition hover:bg-gold/15 active:scale-95"
          >
            <Users size={18} />
            {t("pro.newTopicWithGroup")}
          </button>
          <button
            type="button"
            onClick={onCreate}
            title={t("pro.topicDialogSubtitle")}
            className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_8px_20px_rgba(193,150,90,0.3)] transition hover:bg-gold-soft active:scale-95"
          >
            <Plus size={18} />
            {t("pro.sendNewTopic")}
          </button>
        </div>
      </div>

      {total > 0 && (
        <div
          role="group"
          aria-label={t("pro.statusLabel")}
          className="relative mt-7 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3"
        >
          <StatusTile
            label={t("pro.allTopicsFilter")}
            count={total}
            active={status === ""}
            onClick={() => onStatus("")}
          />
          {present.map((s) => (
            <StatusTile
              key={s}
              label={t(`status.${s}`)}
              count={counts[s] ?? 0}
              dot={STATUS_TONE[s]?.dot}
              active={status === s}
              onClick={() => onStatus(status === s ? "" : s)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StatusTile({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition ${
        active
          ? "border-gold/70 bg-white/12 shadow-[0_0_0_1px_rgba(217,174,114,0.35)]"
          : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {dot ? (
          <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
        ) : (
          <Layers size={14} className="shrink-0 text-gold-soft" />
        )}
        <span className="truncate text-xs text-soft-sage">{label}</span>
      </span>
      <span className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  rows
// ─────────────────────────────────────────────────────────────

function TitleCell({
  tp,
  fmtDate,
}: {
  tp: Topic;
  fmtDate: (iso?: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <Link
        to={`../topics/${tp.id}`}
        className="flex items-center gap-2.5 font-serif text-base font-bold text-forest transition hover:text-gold"
      >
        <span
          className={`size-2.5 shrink-0 rounded-full ${STATUS_TONE[tp.status]?.dot ?? "bg-clay"}`}
        />
        <span className="line-clamp-2">{tp.title}</span>
      </Link>
      <p className="mt-1 ps-5 text-[11px] text-clay">
        {t("pro.sentOn", { date: fmtDate(tp.createdAt) })}
      </p>
      {/* The reason is the whole point of a rejection; it belongs in the
          row, not behind a tooltip. */}
      {tp.status === "rejected" && tp.rejectionReason && (
        <p className="mt-2 ms-5 flex items-start gap-1.5 rounded-xl bg-brick/8 px-3 py-2 text-[11px] leading-relaxed text-brick">
          <CircleAlert size={12} className="mt-0.5 shrink-0" />
          {tp.rejectionReason}
        </p>
      )}
    </div>
  );
}

/** How many teams asked — the number that says whether a topic is landing. */
function RequestsCount({ n }: { n: number }) {
  return (
    <span
      className={`inline-grid min-w-8 place-items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
        n > 0 ? "bg-gold/15 text-gold" : "bg-forest/8 text-clay"
      }`}
    >
      {n}
    </span>
  );
}

function RowActions({
  tp,
  editable,
  onEdit,
  onDelete,
  onSheet,
}: {
  tp: Topic;
  editable: (tp: Topic) => boolean;
  onEdit: (tp: Topic) => void;
  onDelete: (tp: Topic) => void;
  onSheet: (tp: Topic) => void;
}) {
  const { t } = useTranslation();
  const btn =
    "inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-3 py-1.5 text-xs font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link to={`../topics/${tp.id}`} className={btn}>
        <Eye size={14} />
        {t("pro.view")}
      </Link>
      {/* The supervision sheet exists once a team holds the topic. */}
      {tp.status === "full" && (
        <button type="button" onClick={() => onSheet(tp)} className={btn}>
          <FileCheck2 size={14} />
          {t("supervision.sheet")}
        </button>
      )}
      {editable(tp) && (
        <>
          <button type="button" onClick={() => onEdit(tp)} className={btn}>
            <Pencil size={14} />
            {t("pro.edit")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(tp)}
            title={t("pro.delete")}
            aria-label={t("pro.delete")}
            className="grid size-8 place-items-center rounded-xl border border-brick/25 text-brick transition hover:bg-brick/10"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function PageButton({
  icon: Icon,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-xl border border-forest/15 text-forest transition hover:border-gold/50 hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-35"
    >
      <Icon size={16} className="ltr:rotate-180" />
    </button>
  );
}

function EmptyState({
  nothingYet,
  onCreate,
  onReset,
}: {
  nothingYet: boolean;
  onCreate: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid place-items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-gold/10 text-gold ring-8 ring-gold/5">
        {nothingYet ? <FileText size={26} /> : <Search size={26} />}
      </span>
      <p className="font-serif text-base font-bold text-forest">
        {nothingYet ? t("pro.noTopicsYet") : t("pro.noTopicsMatch")}
      </p>
      {nothingYet ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft active:scale-95"
        >
          <Plus size={16} />
          {t("pro.createFirst")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
        >
          <RotateCcw size={13} />
          {t("pro.clearFilters")}
        </button>
      )}
    </div>
  );
}
