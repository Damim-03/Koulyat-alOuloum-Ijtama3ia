import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import {
  Search,
  Check,
  X,
  Archive,
  Send,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  Undo2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  useAdminTopics,
  useApproveTopic,
  useRejectTopic,
  useArchiveTopic,
  usePublishTopic,
  useUnpublishTopic,
  useUnarchiveTopic,
  useDeleteTopic,
  useProfessors,
  useSpecializations,
  useFaculties,
  useAcademicYears,
} from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { AssignedTopicDialog } from "../../components/dialog/projects/assigned-topic-dialog.form";
import { EditAssignedTopicDialog } from "../../components/dialog/projects/edit-assigned-topic-dialog.form";

/* eslint-disable @typescript-eslint/no-explicit-any */

function initials(first?: string | null, last?: string | null, fb = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fb;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};

const STATUS_FILTERS = [
  "",
  "pending",
  "approved",
  "open",
  "full",
  "rejected",
  "archived",
] as const;

const PAGE_SIZE = 10;

const selectCls =
  "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

export function AdminTopicsPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const openTopic = (id: string) => navigate(`/admin/topics/${id}`);

  // filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [specializationId, setSpecializationId] = useState("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const activeFilters =
    (search ? 1 : 0) +
    (professorId ? 1 : 0) +
    (status ? 1 : 0) +
    (facultyId ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (filiereId ? 1 : 0) +
    (specializationId ? 1 : 0) +
    (academicYearId ? 1 : 0);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // reset page + selection whenever a filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    debouncedSearch,
    status,
    professorId,
    academicYearId,
    facultyId,
    departmentId,
    filiereId,
    specializationId,
  ]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: status || undefined,
      professorId: professorId || undefined,
      academicYearId: academicYearId || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
      specializationId: specializationId || undefined,
    }),
    [
      page,
      debouncedSearch,
      status,
      professorId,
      academicYearId,
      facultyId,
      departmentId,
      filiereId,
      specializationId,
    ],
  );

  const { data, isLoading, refetch } = useAdminTopics(params);
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: specs } = useSpecializations();
  const { data: faculties } = useFaculties();
  const { data: years } = useAcademicYears();

  const approve = useApproveTopic();
  const reject = useRejectTopic();
  const archive = useArchiveTopic();
  const publish = usePublishTopic();
  const unpublish = useUnpublishTopic();
  const unarchive = useUnarchiveTopic();
  const del = useDeleteTopic();

  const topics = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const professors = profsData?.items ?? [];

  // ── Cascading options derived from specializations (each carries filiere.department) ──
  const facultyById = useMemo(
    () => new Map((faculties ?? []).map((f: any) => [f.id, f])),
    [faculties],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const specList = (specs ?? []) as any[];

  const facultyOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const fid = s.filiere?.department?.facultyId;
      const fac = fid ? facultyById.get(fid) : undefined;
      if (fac && !seen.has(fac.id)) seen.set(fac.id, fac);
    }
    return [...seen.values()];
  }, [specList, facultyById]);

  const deptOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const d = s.filiere?.department;
      if (!d) continue;
      if (facultyId && d.facultyId !== facultyId) continue;
      if (!seen.has(d.id)) seen.set(d.id, d);
    }
    return [...seen.values()];
  }, [specList, facultyId]);

  const filiereOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const f = s.filiere;
      if (!f) continue;
      if (facultyId && f.department?.facultyId !== facultyId) continue;
      if (departmentId && f.departmentId !== departmentId) continue;
      if (!seen.has(f.id)) seen.set(f.id, f);
    }
    return [...seen.values()];
  }, [specList, facultyId, departmentId]);

  const specOptions = useMemo(() => {
    return specList.filter((s) => {
      if (filiereId) return s.filiereId === filiereId;
      if (departmentId) return s.filiere?.departmentId === departmentId;
      if (facultyId) return s.filiere?.department?.facultyId === facultyId;
      return true;
    });
  }, [specList, facultyId, departmentId, filiereId]);

  // ── Multi-select ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
  }, [params]);

  const pageIds = topics.map((tp) => tp.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedTopics = topics.filter((tp) => selected.has(tp.id));
  const approvable = selectedTopics.filter(
    (tp) => tp.status === "pending" || tp.status === "rejected",
  );
  const publishable = selectedTopics.filter((tp) => tp.status === "approved");
  const unpublishable = selectedTopics.filter((tp) => tp.status === "open");
  const rejectable = selectedTopics.filter(
    (tp) =>
      tp.status === "pending" ||
      tp.status === "approved" ||
      tp.status === "open",
  );
  const archivable = selectedTopics.filter((tp) => tp.status !== "archived");
  const unarchivable = selectedTopics.filter((tp) => tp.status === "archived");
  // A "full" topic already has a formed project group → the backend blocks its
  // deletion, so we exclude it from the deletable set up front.
  const deletable = selectedTopics.filter((tp) => tp.status !== "full");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function runBulk(items: any[], fn: (id: string) => Promise<unknown>) {
    if (items.length === 0) return;
    setBulkBusy(true);
    try {
      for (const tp of items) await fn(tp.id);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  // Tolerant delete: keep going even if some topics are blocked by the guard.
  async function bulkDelete() {
    if (deletable.length === 0) return;
    setBulkBusy(true);
    try {
      for (const tp of deletable) {
        try {
          await del.mutateAsync(tp.id);
        } catch {
          // topic with a formed project group — blocked by the backend
        }
      }
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
      setConfirmDeleteOpen(false);
    }
  }

  const bulkApprove = () =>
    runBulk(approvable, (id) => approve.mutateAsync(id));
  const bulkPublish = () =>
    runBulk(publishable, (id) => publish.mutateAsync(id));
  const bulkUnpublish = () =>
    runBulk(unpublishable, (id) => unpublish.mutateAsync(id));
  const bulkReject = () =>
    runBulk(rejectable, (id) => reject.mutateAsync({ id }));
  const bulkArchive = () =>
    runBulk(archivable, (id) => archive.mutateAsync(id));
  const bulkUnarchive = () =>
    runBulk(unarchivable, (id) => unarchive.mutateAsync(id));

  function profName(tp: any) {
    const u = tp.professor?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      tp.professor?.universityEmail ||
      "\u2014"
    );
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.topicsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("admin.topicsSubtitle")}</p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep shadow-sm transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("admin.assignTopicBtn")}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {/* Header */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-forest" />

            <span className="font-semibold text-forest">{t("admin.filters")}</span>

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
          className={`overflow-hidden transition-all duration-300 ${
            filtersOpen
              ? "max-h-[900px] border-t border-forest/10 p-4"
              : "max-h-0"
          }`}
        >
          {/* Search + Professor + Status */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                size={18}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.searchTopic")}
                className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </div>

            <select
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className={selectCls}
            >
              <option value="">{t("admin.allProfessors")}</option>

              {professors.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {[p.user?.firstName, p.user?.lastName]
                    .filter(Boolean)
                    .join(" ") || p.universityEmail}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
            >
              {STATUS_FILTERS.map((st) => (
                <option key={st || "all"} value={st}>
                  {st ? t(`status.${st}`) : t("admin.statusAll")}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Filters */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            <select
              value={facultyId}
              onChange={(e) => {
                setFacultyId(e.target.value);
                setDepartmentId("");
                setFiliereId("");
                setSpecializationId("");
              }}
              className={selectCls}
            >
              <option value="">{t("admin.allFaculties")}</option>

              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setFiliereId("");
                setSpecializationId("");
              }}
              className={selectCls}
            >
              <option value="">{t("admin.allDepartments")}</option>

              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={filiereId}
              onChange={(e) => {
                setFiliereId(e.target.value);
                setSpecializationId("");
              }}
              className={selectCls}
            >
              <option value="">{t("admin.allFilieres")}</option>

              {filiereOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <select
              value={specializationId}
              onChange={(e) => setSpecializationId(e.target.value)}
              className={selectCls}
            >
              <option value="">{t("admin.allSpecializations")}</option>

              {specOptions.map((s) => (
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
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
          <span className="text-sm font-semibold text-forest">
            {t("admin.selectedN", { n: selected.size })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={bulkApprove}
              disabled={bulkBusy || approvable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              <Check size={14} />
              {t("admin.approve")} ({approvable.length})
            </button>
            <button
              onClick={bulkPublish}
              disabled={bulkBusy || publishable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-40"
            >
              <Send size={14} />
              {t("admin.publish")} ({publishable.length})
            </button>
            <button
              onClick={bulkUnpublish}
              disabled={bulkBusy || unpublishable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-40"
            >
              <EyeOff size={14} />
              {t("admin.unpublish")} ({unpublishable.length})
            </button>
            <button
              onClick={bulkReject}
              disabled={bulkBusy || rejectable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              <X size={14} />
              {t("admin.reject")} ({rejectable.length})
            </button>
            <button
              onClick={bulkArchive}
              disabled={bulkBusy || archivable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3.5 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              <Archive size={14} />
              {t("admin.archive")} ({archivable.length})
            </button>
            <button
              onClick={bulkUnarchive}
              disabled={bulkBusy || unarchivable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3.5 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              <Undo2 size={14} />
              {t("admin.unarchive", { defaultValue: t("admin.unarchive") })} (
              {unarchivable.length})
            </button>
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={bulkBusy || deletable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 size={14} />
              {t("admin.delete", { defaultValue: t("pro.delete") })} ({deletable.length})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-clay transition hover:text-forest"
            >
              <X size={14} />
              {t("admin.clearSelection")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="size-4 accent-gold"
                    aria-label={t("admin.selectAll")}
                  />
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.topicTitle")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.supervisor")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.statusLabel")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.applicationsCount")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.actions", { defaultValue: t("admin.actions") })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && topics.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noTopics")}
                  </td>
                </tr>
              )}

              {topics.map((tp) => {
                const checked = selected.has(tp.id);
                return (
                  <tr
                    key={tp.id}
                    className={`transition-colors ${checked ? "bg-gold/5" : "hover:bg-forest/3"}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(tp.id)}
                        className="size-4 accent-gold"
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openTopic(tp.id)}
                        className="text-start"
                      >
                        <p className="text-sm font-medium text-forest transition hover:text-gold">
                          {tp.title}
                        </p>
                      </button>
                      <p className="text-[11px] text-clay" dir="ltr">
                        {tp.academicYear?.title ?? ""}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="grid size-7 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream">
                          {initials(
                            tp.professor?.user?.firstName,
                            tp.professor?.user?.lastName,
                          )}
                        </div>
                        <span className="text-sm text-clay">
                          {profName(tp)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay">
                      {tp.specialization?.name ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[tp.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {t(`status.${tp.status}`, { defaultValue: tp.status })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-grid min-w-7 place-items-center rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">
                        {tp._count?.applications ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setEditId(tp.id)}
                        title={t("admin.edit", { defaultValue: t("pro.edit") })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-forest/15 px-2.5 py-1.5 text-xs font-medium text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
                      >
                        <Pencil size={13} />
                        {t("admin.edit", { defaultValue: t("pro.edit") })}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-forest/10 px-5 py-3">
          <p className="text-xs text-clay">
            {t("admin.showingRange", {
              from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u2039"}
            </button>
            <span className="px-3 text-sm text-forest">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u203a"}
            </button>
          </div>
        </div>
      </div>

      {/* Assign-topic dialog */}
      <AssignedTopicDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => refetch()}
      />

      {/* Edit-topic dialog */}
      <EditAssignedTopicDialog
        topicId={editId}
        onClose={() => setEditId(null)}
        onUpdated={() => refetch()}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        tone="danger"
        title={t("admin.deleteTopicsTitle", { defaultValue: t("admin.deleteTopics") })}
        message={t("admin.confirmDeleteTopicsLong", { count: deletable.length })}
        confirmLabel={t("admin.confirmDelete", { defaultValue: t("admin.yesDelete") })}
        cancelLabel={t("admin.cancel", { defaultValue: t("pro.cancel") })}
        loading={bulkBusy}
        onConfirm={bulkDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
