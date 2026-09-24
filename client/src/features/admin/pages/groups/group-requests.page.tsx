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
  Trash2,
} from "lucide-react";
import type { AdminGroupRequest } from "../../../../types/admin";
import { DangerConfirm } from "../../../../components/dialog/danger-confirm";
import i18n from "../../../../i18n/i18n";
import {
  useGroupRequests,
  useAcceptGroupRequest,
  useRejectGroupRequest,
  useDeleteGroupRequest,
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { noneText } from "../../../../lib/none-text";
import { None } from "../../../../lib/none";
import { Select } from "../../../../components/ui/select";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/* eslint-disable @typescript-eslint/no-explicit-any */

function personName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
}
function fmtDate(iso?: string) {
  if (!iso) return noneText();
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? noneText()
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

  const { data, isLoading, isFetching, isError, refetch } =
    useGroupRequests(params);
  const accept = useAcceptGroupRequest();
  const reject = useRejectGroupRequest();
  const remove = useDeleteGroupRequest();
  const [toDelete, setToDelete] = useState<AdminGroupRequest | null>(null);

  /*
   * العدّادات تأتي مع القائمة، محسوبةً **بنفس الفلاتر**.
   *
   * كانت ثلاثة نداءاتٍ إضافية بـ`limit: 1` تقرأ `total` — ولا تُمرّر فلاتر
   * الشاشة. فترشيحٌ بأستاذٍ أو تاريخ يُضيّق القائمة ويترك الشريط على الإجمالي
   * العامّ: أرقامٌ تناقض ما تحتها مباشرةً. والآن رحلةٌ واحدة، ورقمٌ يصف ما
   * تراه.
   */
  const counts = (data as any)?.counts;
  const pendCount = counts?.pending ?? 0;
  const accCount = counts?.accepted ?? 0;
  const rejCount = counts?.rejected ?? 0;

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
          value={counts?.all ?? pendCount + accCount + rejCount}
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
              <Select
                value={status}
                onChange={(v) => setStatus(v)}
                options={[
                  ...STATUS_FILTERS.map((st) => ({ value: st, label: st
                              ? t(`status.${st}`, { defaultValue: st })
                              : t("admin.statusAll", {
                                  defaultValue: t("pro.allStatuses"),
                                }) })),
                ]}
              />
            </Labeled>

            <Labeled label={t("admin.supervisor", { defaultValue: t("admin.professorLabel") })}>
              <Select
                value={professorId}
                onChange={(v) => setProfessorId(v)}
                options={[
                  { value: "", label: t("admin.allProfessors", {
                            defaultValue: t("messages.allProfessors"),
                          }) },
                  ...professors.map((p: any) => ({ value: p.id, label: personName(p.user) || p.universityEmail })),
                ]}
              />
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
              <Select
                value={facultyId}
                onChange={(v) => {
                  setFacultyId(v);
                  setDepartmentId("");
                  setFiliereId("");
                  setSpecializationId("");
                }}
                options={[
                  { value: "", label: t("admin.allFacultiesShort") },
                  ...(faculties ?? []).map((f: any) => ({ value: f.id, label: f.name })),
                ]}
              />
            </Labeled>

            <Labeled label={t("admin.department")}>
              <Select
                value={departmentId}
                onChange={(v) => {
                  setDepartmentId(v);
                  setFiliereId("");
                  setSpecializationId("");
                }}
                options={[
                  { value: "", label: t("admin.allDepartments") },
                  ...deptOptions.map((d: any) => ({ value: d.id, label: d.name })),
                ]}
              />
            </Labeled>

            <Labeled label={t("admin.filiere")}>
              <Select
                value={filiereId}
                onChange={(v) => {
                  setFiliereId(v);
                  setSpecializationId("");
                }}
                options={[
                  { value: "", label: t("admin.allFilieresShort") },
                  ...filiereOptions.map((f: any) => ({ value: f.id, label: f.name })),
                ]}
              />
            </Labeled>

            <Labeled
              label={t("admin.specialization", {
                defaultValue: t("admin.specializationLabelAlt"),
              })}
            >
              <Select
                value={specializationId}
                onChange={(v) => setSpecializationId(v)}
                options={[
                  { value: "", label: t("admin.allSpecializations", {
                            defaultValue: t("messages.allSpecializations"),
                          }) },
                  ...specOptions.map((s: any) => ({ value: s.id, label: s.name })),
                ]}
              />
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
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
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
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          {/* ترويسة الأعمدة — للشاشات الواسعة وحدها. الضيّقة تقرأ الصفّ سطراً سطراً. */}
          <div className="hidden items-center gap-4 border-b border-forest/10 bg-forest/[0.03] px-4 py-2.5 text-[11px] font-bold text-clay lg:flex">
            <span className="min-w-0 flex-1">{t("admin.topicLabel")}</span>
            <span className="w-44 shrink-0">{t("admin.leader")}</span>
            <span className="w-20 shrink-0 text-center">{t("admin.membersLabel")}</span>
            <span className="w-28 shrink-0 text-center">{t("admin.statusLabel")}</span>
            <span className="w-24 shrink-0 text-center">{t("admin.dateLabel")}</span>
            <span className="w-56 shrink-0" />
          </div>

          <ul className="divide-y divide-forest/10">
            {items.map((r: any) => {
              const members = r.members ?? [];
              const st = STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600";

              /*
               * لا شرط هنا. الخادم يقول ما يجوز ولماذا لا، والشاشة تعرض حكمه.
               * وكان هنا شرطان يُقلّدان الخادم ويتباعدان عنه — فيُعرض «رفض»
               * على كل طلبٍ مقبول، وقبولُ الطلب يُنشئ المشروع، فالرفض بعده
               * مرفوضٌ دائماً.
               *
               * والاحتياط للخادم الأقدم الذي لا يُرسل الجدول: أظهِر الزرّين
               * ودَع الحكم له — أسوأ ما يقع عندئذٍ رسالة رفض، لا زرٌّ مفقود.
               */
              const acts = r.actions;
              const canAccept = acts ? acts.canAccept : r.status !== "accepted";
              const canReject = acts ? acts.canReject : r.status !== "rejected";
              const whyNoAccept = acts?.blockedReasons?.accept;
              const whyNoReject = acts?.blockedReasons?.reject;

              return (
                <li
                  key={r.id}
                  onClick={() => goToRequest(r.id)}
                  className="group cursor-pointer px-4 py-3 transition hover:bg-forest/[0.03]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-serif text-sm font-bold text-forest group-hover:text-forest-deep">
                        {r.topic?.title ?? <None />}
                      </h3>
                      {r.priority != null && (
                        <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                          {t("admin.priorityN", { n: r.priority })}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-clay">
                      {r.topic?.professor?.user && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound size={11} /> {personName(r.topic.professor.user)}
                        </span>
                      )}
                      {r.topic?.specialization?.name && (
                        <span className="inline-flex items-center gap-1">
                          <Layers size={11} /> {r.topic.specialization.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex w-44 shrink-0 items-center gap-2">
                    <UserAvatar user={r.leader?.user} size={26} />
                    <span className="truncate text-xs text-forest">
                      {personName(r.leader?.user)}
                    </span>
                  </div>

                  <div className="w-20 shrink-0 lg:text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-semibold text-forest">
                      <Users size={11} /> {members.length}
                    </span>
                  </div>

                  <div className="w-28 shrink-0 lg:text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st}`}>
                      {t(`status.${r.status}`, { defaultValue: r.status })}
                    </span>
                  </div>

                  <div className="w-24 shrink-0 text-[11px] text-clay lg:text-center">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={11} /> {fmtDate(r.createdAt)}
                    </span>
                  </div>

                  <div
                    className="flex w-56 shrink-0 items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => accept.mutate(r.id)}
                      disabled={!canAccept || accept.isPending}
                      title={whyNoAccept}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Check size={12} />
                      {t("admin.accept", { defaultValue: t("pro.accept") })}
                    </button>
                    <button
                      onClick={() => reject.mutate({ id: r.id })}
                      disabled={!canReject || reject.isPending}
                      title={whyNoReject}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-400 px-2.5 py-1.5 text-[11px] font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X size={12} />
                      {t("admin.reject", { defaultValue: t("pro.reject") })}
                    </button>
                    {/*
                      الحذفُ للمرفوض وحده: الطلبُ المعلّق يُبَتّ فيه لا
                      يُمحى — فحذفُه يُسقطه من تحت فريقٍ ينتظر بلا خبر —
                      والمقبولُ تحته مشروعٌ قائم. والحارسُ في الخادم على
                      كلّ حال، وهذا يُخفي زرّاً لا ينجح.
                    */}
                    {r.status === "rejected" && (
                      <button
                        onClick={() => setToDelete(r)}
                        title={t("admin.delete")}
                        className="grid size-7 shrink-0 place-items-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-50 hover:border-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => goToRequest(r.id)}
                      title={t("admin.details")}
                      className="grid size-7 shrink-0 place-items-center rounded-lg border border-forest/20 text-forest transition hover:bg-forest/5"
                    >
                      <ChevronLeft size={14} className="ltr:rotate-180" />
                    </button>
                  </div>

                  </div>

                  {/* السبب على سطره: حشرُه بين الأعمدة يضغطها ويُخفيه. */}
                  {r.status === "rejected" && r.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
                      <span className="font-semibold">{t("admin.rejectionReasonColon")}</span>{" "}
                      {r.rejectionReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
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

      {/*
        الحذفُ يُسأل عنه: هو محوُ سطرٍ لا رجعةَ فيه، والبطاقةُ تُري
        صاحبَه وموضوعَه قبل أن يُمحى — فلا يُحذف سطرٌ ظنّه المسؤول غيره.
      */}
      <DangerConfirm
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        loading={remove.isPending}
        title={t("admin.deleteRequestTitle")}
        name={toDelete?.topic?.title ?? ""}
        kicker={t("admin.requestLabel")}
        facts={
          toDelete
            ? [
                {
                  icon: UserRound,
                  label: t("admin.leader"),
                  value: personName(toDelete.leader?.user) || "—",
                },
                {
                  icon: ClipboardList,
                  label: t("admin.statusLabel"),
                  value: t(`stu.reqStatus.${toDelete.status}`, {
                    defaultValue: toDelete.status,
                  }),
                },
              ]
            : []
        }
        impacts={[
          {
            icon: Users,
            label: t("admin.deleteRequestImpact"),
            value: toDelete?.members?.length ?? 0,
          },
        ]}
        confirmLabel={t("admin.delete")}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
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
