import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Check,
  X,
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  ChevronLeft,
  UserRound,
  Layers,
  CalendarDays,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { AdminGroupRequest } from "../../../../types/admin";
import i18n from "../../../../i18n/i18n";
import {
  useGroupRequests,
  useAcceptGroupRequest,
  useRejectGroupRequest,
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";

/* eslint-disable @typescript-eslint/no-explicit-any */

function initials(first?: string | null, last?: string | null, fb = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fb;
}
function personName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
}
function fmtDate(iso?: string) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "\u2014"
    : d.toLocaleDateString(i18n.language, { dateStyle: "medium" } as any);
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};
const STATUS_FILTERS = ["", "pending", "accepted", "rejected"] as const;

const PAGE_SIZE = 10;
const selectCls =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

export function AdminGroupRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const goToRequest = (id: string) =>
    navigate(`/${lang}/admin/group-requests/${id}`);

  // ── filters ──
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    debouncedSearch,
    status,
    professorId,
    facultyId,
    departmentId,
    filiereId,
    specializationId,
    dateFrom,
    dateTo,
  ]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: status || undefined,
      professorId: professorId || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
      specializationId: specializationId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      page,
      debouncedSearch,
      status,
      professorId,
      facultyId,
      departmentId,
      filiereId,
      specializationId,
      dateFrom,
      dateTo,
    ],
  );

  const { data, isLoading, isFetching } = useGroupRequests(params);
  const accept = useAcceptGroupRequest();
  const reject = useRejectGroupRequest();

  // lightweight per-status counts for the stat strip
  const { data: pendData } = useGroupRequests({
    page: 1,
    limit: 1,
    status: "pending",
  });
  const { data: accData } = useGroupRequests({
    page: 1,
    limit: 1,
    status: "accepted",
  });
  const { data: rejData } = useGroupRequests({
    page: 1,
    limit: 1,
    status: "rejected",
  });
  const pendCount = pendData?.total ?? 0;
  const accCount = accData?.total ?? 0;
  const rejCount = rejData?.total ?? 0;

  // filter lookups
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const professors = profsData?.items ?? [];

  // cascade options
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d: any) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f: any) =>
        departmentId ? f.departmentId === departmentId : true,
      ),
    [filieres, departmentId],
  );
  const specOptions = useMemo(
    () =>
      (specs ?? []).filter((s: any) =>
        filiereId ? s.filiereId === filiereId : true,
      ),
    [specs, filiereId],
  );

  const items = (data?.items ?? []) as AdminGroupRequest[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilters =
    (debouncedSearch ? 1 : 0) +
    (status ? 1 : 0) +
    (professorId ? 1 : 0) +
    (facultyId ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (filiereId ? 1 : 0) +
    (specializationId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const profObj = professors.find((p: any) => p.id === professorId);
  const specName = specs?.find((s: any) => s.id === specializationId)?.name;

  function clearAll() {
    setSearch("");
    setStatus("");
    setProfessorId("");
    setFacultyId("");
    setDepartmentId("");
    setFiliereId("");
    setSpecializationId("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">
          {t("admin.groupRequestsTitle", { defaultValue: t("admin.groupRequests") })}
        </h1>
        <p className="mt-1 text-sm text-clay">
          {t("admin.groupRequestsSubtitle", {
            defaultValue: t("admin.groupRequestsPageSubtitle"),
          })}
        </p>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={ClipboardList}
          value={pendCount + accCount + rejCount}
          label={t("admin.totalRequests")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={Clock}
          value={pendCount}
          label={t("admin.pendingRequests", { defaultValue: t("stu.reqStatus.pending") })}
          tint="bg-amber-100 text-amber-600"
        />
        <StatTile
          icon={CheckCircle2}
          value={accCount}
          label={t("admin.acceptedRequests", { defaultValue: t("status.accepted") })}
          tint="bg-emerald-100 text-emerald-600"
        />
        <StatTile
          icon={XCircle}
          value={rejCount}
          label={t("admin.rejectedRequests", { defaultValue: t("status.rejected") })}
          tint="bg-red-100 text-red-500"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
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
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            filtersOpen
              ? "max-h-300 border-t border-forest/10 p-4 opacity-100"
              : "max-h-0 border-t-0 p-0 opacity-0"
          }`}
        >
          {/* search */}
          <div className="relative mb-3">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.searchRequest", {
                defaultValue: t("admin.searchByTopicOrLeader"),
              })}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-9 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* row 1 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label={t("admin.statusLabel", { defaultValue: t("status.label") })}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                {STATUS_FILTERS.map((st) => (
                  <option key={st || "all"} value={st}>
                    {st
                      ? t(`status.${st}`, { defaultValue: st })
                      : t("admin.statusAll", {
                          defaultValue: t("pro.allStatuses"),
                        })}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label={t("admin.supervisor", { defaultValue: t("admin.professorLabel") })}>
              <select
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
                className={selectCls}
              >
                <option value="">
                  {t("admin.allProfessors", {
                    defaultValue: t("messages.allProfessors"),
                  })}
                </option>

                {professors.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {personName(p.user) || p.universityEmail}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label={t("admin.dateFrom", { defaultValue: t("admin.fromDate") })}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={selectCls}
              />
            </Labeled>

            <Labeled label={t("admin.dateTo", { defaultValue: t("admin.toDate") })}>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={selectCls}
              />
            </Labeled>
          </div>

          {/* row 2 */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label={t("admin.facultyLabel")}>
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
                <option value="">{t("admin.allFacultiesShort")}</option>

                {(faculties ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label={t("admin.department")}>
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

                {deptOptions.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label={t("admin.filiere")}>
              <select
                value={filiereId}
                onChange={(e) => {
                  setFiliereId(e.target.value);
                  setSpecializationId("");
                }}
                className={selectCls}
              >
                <option value="">{t("admin.allFilieresShort")}</option>

                {filiereOptions.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled
              label={t("admin.specialization", {
                defaultValue: t("admin.specializationLabelAlt"),
              })}
            >
              <select
                value={specializationId}
                onChange={(e) => setSpecializationId(e.target.value)}
                className={selectCls}
              >
                <option value="">
                  {t("admin.allSpecializations", {
                    defaultValue: t("messages.allSpecializations"),
                  })}
                </option>

                {specOptions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Labeled>
          </div>

          {/* Active Filters */}
          {activeFilters > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3">
              <SlidersHorizontal size={14} className="text-clay" />

              {debouncedSearch && (
                <Chip
                  label={t("admin.chipSearchValue", { value: debouncedSearch })}
                  onClear={() => setSearch("")}
                />
              )}

              {status && (
                <Chip
                  label={t(`status.${status}`, {
                    defaultValue: status,
                  })}
                  onClear={() => setStatus("")}
                />
              )}

              {profObj && (
                <Chip
                  label={t("admin.chipProfessor", { value: personName(profObj.user) })}
                  onClear={() => setProfessorId("")}
                />
              )}

              {specName && (
                <Chip
                  label={t("admin.chipSpecialization", { value: specName })}
                  onClear={() => setSpecializationId("")}
                />
              )}

              {dateFrom && (
                <Chip
                  label={t("admin.chipFrom", { value: dateFrom })}
                  onClear={() => setDateFrom("")}
                />
              )}

              {dateTo && (
                <Chip label={t("admin.chipTo", { value: dateTo })} onClear={() => setDateTo("")} />
              )}

              <button
                onClick={clearAll}
                className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
              >
                <X size={13} />{t("admin.clearAll")}</button>
            </div>
          )}
        </div>
      </div>

      {/* count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-clay">
        <ClipboardList size={15} />
        <span>{t("admin.requestsCount", { count: total })}</span>
        {isFetching && (
          <span className="text-[11px] text-clay/70">{t("admin.refreshingSuffix")}</span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-forest/10 bg-cream-card py-16 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <div className="grid size-14 place-items-center rounded-full bg-forest/5 text-clay">
            <ClipboardList size={24} />
          </div>
          <p className="text-sm text-clay">
            {t("admin.noGroupRequests", { defaultValue: t("admin.noRequests") })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((r: any) => {
            const members = r.members ?? [];
            const st = STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600";
            return (
              <div
                key={r.id}
                onClick={() => goToRequest(r.id)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_8px_28px_rgba(38,66,61,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st}`}
                      >
                        {t(`status.${r.status}`, { defaultValue: r.status })}
                      </span>
                      {r.priority != null && (
                        <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-gold">
                          {t("admin.priorityN", {
                            n: r.priority,
                            defaultValue: t("admin.priorityN", { n: r.priority }),
                          })}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-clay">
                        <CalendarDays size={11} /> {fmtDate(r.createdAt)}
                      </span>
                    </div>
                    <h3 className="truncate font-serif text-base font-bold text-forest group-hover:text-forest-deep">
                      {r.topic?.title ?? "\u2014"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clay">
                      {r.topic?.professor?.user && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound size={12} />{" "}
                          {personName(r.topic.professor.user)}
                        </span>
                      )}
                      {r.topic?.specialization?.name && (
                        <span className="inline-flex items-center gap-1">
                          <Layers size={12} /> {r.topic.specialization.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft
                    size={18}
                    className="shrink-0 text-clay/40 transition rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 group-hover:text-gold ltr:rotate-180"
                  />
                </div>

                {/* leader + members */}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-forest/10 pt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream ring-2 ring-gold/40">
                      {initials(
                        r.leader?.user?.firstName,
                        r.leader?.user?.lastName,
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-forest">
                        {personName(r.leader?.user)}
                      </p>
                      <p className="text-[10px] text-clay">{t("admin.leader")}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2.5 py-1 text-[11px] font-semibold text-forest">
                    <Users size={12} />{" "}
                    {t("admin.membersCountShort", { count: members.length })}
                  </span>
                </div>

                {/* reversible actions */}
                <div
                  className="mt-3 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(r.status === "pending" || r.status === "rejected") && (
                    <button
                      onClick={() => accept.mutate(r.id)}
                      disabled={accept.isPending}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-60"
                    >
                      <Check size={14} />
                      {t("admin.accept", { defaultValue: t("pro.accept") })}
                    </button>
                  )}
                  {(r.status === "pending" || r.status === "accepted") && (
                    <button
                      onClick={() => reject.mutate({ id: r.id })}
                      disabled={reject.isPending}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-red-400 px-4 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <X size={14} />
                      {t("admin.reject", { defaultValue: t("pro.reject") })}
                    </button>
                  )}
                  <button
                    onClick={() => goToRequest(r.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-forest/20 px-3 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
                  >{t("admin.details")}</button>
                </div>

                {r.status === "rejected" && r.rejectionReason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
                    <span className="font-semibold">{t("admin.rejectionReasonColon")}</span>{" "}
                    {r.rejectionReason}
                  </p>
                )}
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
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────── */
function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className={`grid size-11 place-items-center rounded-full ${tint}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="font-serif text-xl font-bold text-forest">{value}</p>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2.5 py-1 text-[11px] text-forest">
      {label}
      <button onClick={onClear} className="text-clay hover:text-red-500">
        <X size={12} />
      </button>
    </span>
  );
}
