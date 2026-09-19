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
  ChevronUp,
  CircleAlert,
  CircleDot,
  Inbox,
  Users2,
  CalendarDays,
  Layers,
  FileText,
  RotateCcw,
} from "lucide-react";
import {
  useMyTopics,
  useDeleteTopic,
  useSpecializations,
  useAcademicYears,
} from "../hooks/Professor-hook";
import { TopicFormDialog } from "../components/topic-form-dialog";
import { StatusBadge } from "../components/status-badge";
import type { Topic } from "../../../types/professor.types";
import { Select } from "../../../components/ui/select";
import { DangerConfirm } from "../../../components/dialog/danger-confirm";
import { noneText } from "../../../lib/none-text";

/**
 * The professor's topics, in the shape the administration's list settled on:
 * a filter panel over a table, rather than a wall of cards.
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

  // ── filters ──
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  const activeFilters = [search, status, specializationId, academicYearId].filter(
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

  // ── counts per status, for the chips above the table ──
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
  function handleDelete(tp: Topic) {
    setPendingDelete(tp);
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

  return (
    <div className="font-body">
      {/* ── header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("pro.myTopicsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("pro.myTopicsSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreateWithGroup}
            title={t("pro.withGroupSubtitle")}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10"
          >
            <Users size={18} />
            {t("pro.newTopicWithGroup")}
          </button>

          <button
            onClick={openCreate}
            title={t("pro.topicDialogSubtitle")}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
          >
            <Plus size={18} />
            {t("pro.sendNewTopic")}
          </button>
        </div>
      </div>

      {/* ── status chips: a filter and a summary at once ── */}
      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip
            label={t("pro.allTopicsFilter")}
            count={all.length}
            active={status === ""}
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
          />
          {STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
            <Chip
              key={s}
              label={t(`status.${s}`)}
              count={counts[s] ?? 0}
              active={status === s}
              onClick={() => {
                setStatus(status === s ? "" : s);
                setPage(1);
              }}
            />
          ))}
        </div>
      )}

      {/* ── filters ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-forest" />
            <span className="font-semibold text-forest">
              {t("pro.filters")}
            </span>
            {activeFilters > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                {activeFilters}
              </span>
            )}
          </span>
          {filtersOpen ? (
            <ChevronUp size={20} className="text-clay" />
          ) : (
            <ChevronDown size={20} className="text-clay" />
          )}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            filtersOpen ? "max-h-96 border-t border-forest/10 p-4" : "max-h-0"
          }`}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("pro.searchTopic")}
                className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pe-10 ps-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </div>

            <Select
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: t("pro.allStatuses") },
                ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
              ]}
            />

            <Select
              value={specializationId}
              onChange={(v) => {
                setSpecializationId(v);
                setPage(1);
              }}
              options={[
                { value: "", label: t("pro.allSpecializations") },
                ...(specializations ?? []).map((s) => ({ value: s.id, label: s.name })),
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

          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <RotateCcw size={13} />
              {t("pro.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* ── table ── */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.title")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.specialization")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.academicYear")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.statusLabel")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.maxStudents")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.requestsCount")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.createdAt")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("pro.actions")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-forest/10">
              {isLoading &&
                Array.from({ length: 5 }).map((_, k) => (
                  <tr key={`sk-${k}`} className="animate-pulse">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 w-full rounded bg-forest/10" />
                    </td>
                  </tr>
                ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    {all.length === 0 ? (
                      <>
                        <p className="mb-3 text-sm text-clay">
                          {t("pro.noTopicsYet")}
                        </p>
                        <button
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
                        >
                          <Plus size={16} />
                          {t("pro.createFirst")}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mb-3 text-sm text-clay">
                          {t("pro.noTopicsMatch")}
                        </p>
                        <button
                          onClick={resetFilters}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
                        >
                          <RotateCcw size={13} />
                          {t("pro.clearFilters")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading &&
                rows.map((tp) => (
                  <tr
                    key={tp.id}
                    className="align-top transition-colors hover:bg-forest/5"
                  >
                    <td className="max-w-xs px-5 py-3.5">
                      <Link
                        to={`../topics/${tp.id}`}
                        className="block font-medium text-forest transition hover:text-gold"
                      >
                        {tp.title}
                      </Link>
                      {/* The reason is the whole point of a rejection; it
                          belongs in the row, not behind a tooltip. */}
                      {tp.status === "rejected" && tp.rejectionReason && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-brick">
                          <CircleAlert size={12} className="mt-0.5 shrink-0" />
                          {tp.rejectionReason}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-sm text-clay">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={13} className="text-clay/70" />
                        {tp.specialization?.name ?? "—"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-sm text-clay">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-clay/70" />
                        {tp.academicYear?.title ?? "—"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusBadge status={tp.status} />
                    </td>

                    <td className="px-5 py-3.5 text-sm text-clay">
                      <span className="inline-flex items-center gap-1.5">
                        <Users2 size={13} className="text-clay/70" />
                        {tp.maxStudents}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-grid min-w-7 place-items-center rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest tabular-nums">
                        {tp._count?.groupRequests ?? 0}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-clay">
                      {fmtDate(tp.createdAt)}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`../topics/${tp.id}`}
                          title={t("pro.viewDetails")}
                          className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
                        >
                          <FileText size={14} />
                        </Link>
                        {editable(tp) && (
                          <>
                            <button
                              onClick={() => openEdit(tp)}
                              title={t("pro.edit")}
                              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(tp)}
                              title={t("pro.delete")}
                              className="grid size-8 place-items-center rounded-lg border border-brick/25 text-brick transition hover:bg-brick/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ── pagination ── */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-forest/10 px-5 py-3">
            <p className="text-xs text-clay">
              {t("pro.showingRange", {
                from: (current - 1) * PAGE_SIZE + 1,
                to: Math.min(current * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                  className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
                >
                  {"‹"}
                </button>
                <span className="px-3 text-sm text-forest tabular-nums">
                  {current} / {totalPages}
                </span>
                <button
                  disabled={current >= totalPages}
                  onClick={() => setPage(current + 1)}
                  className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
                >
                  {"›"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}

/** A status count that doubles as a one-click filter. */
function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-gold bg-gold/10 text-forest"
          : "border-forest/15 bg-cream-card text-clay hover:border-gold/40 hover:text-forest"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          active ? "bg-gold/20 text-gold" : "bg-forest/8 text-clay"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
