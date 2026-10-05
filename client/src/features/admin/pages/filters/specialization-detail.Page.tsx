import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  BookOpen,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  GraduationCap,
  IdCard,
  Inbox,
  Pencil,
  Search,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useFaculties,
  useAcademicYears,
  useAdminTopics,
  useDomains,
  useDeleteSpecialization,
} from "../../hooks/admin-hook";
import type { AdminTopic, Faculty } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { HierarchyHeader, HeaderBadge } from "../../components/ui/hierarchy-header";
import { DeleteNodeDialog, EmptyLevel, HeaderAction } from "../../components/ui/structure-kit";
import { StudentPreviewDialog } from "../../components/dialog/student/student-preview-dialog";
import { SpecializationFormDialog } from "../../components/dialog/faculty/specialization.form-dialog.form";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { Select } from "../../../../components/ui/select";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { statusChip } from "../../utils/status-styles";
import { relative } from "../projects/project-utils";
import { specChain } from "../academic/spec-utils";
import { otherScriptName, personName } from "../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One specialization: where it sits, who is enrolled in it, and what topics
 * it carries.
 *
 * The students' table no longer repeats the specialization, filiere,
 * department and faculty on every row — they are this page's own. Instead it
 * says what differs from one student to the next: their year, their account,
 * when they last came, and whether they have chosen a topic yet.
 */

const PAGE_SIZE = 12;
const SPECIALIZATIONS_ROUTE = "/admin/specializations";

export function SpecializationDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { specializationId = "" } = useParams();

  const { data: specs } = useSpecializations();
  const { data: faculties } = useFaculties();
  const deleteSpec = useDeleteSpecialization();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [tab, setTab] = useState<"students" | "topics">("students");

  const spec = useMemo(() => (specs ?? []).find((s) => s.id === specializationId), [specs, specializationId]);
  const facultyById = useMemo(() => new Map((faculties ?? []).map((f) => [f.id, f] as [string, Faculty])), [faculties]);
  const c = spec ? specChain(spec, facultyById) : null;
  const { data: domains } = useDomains(c?.dept?.id);
  const domain = (domains ?? []).find((d) => d.id === c?.domainId);

  // The figures the header needs, asked for once each.
  // Both carry the id from the address, so neither ever asks for everyone.
  const unassigned = useStudents({ specializationId, unassigned: "true", limit: 1 });
  const topicsQ = useAdminTopics({ specializationId, limit: 100 });
  const topics = useMemo(() => ((topicsQ.data?.items ?? []) as AdminTopic[]), [topicsQ.data]);

  if (specs === undefined) return <LoadingArea className="py-20" />;
  if (!spec || !c) return <EmptyLevel icon={GraduationCap} title={t("admin.specializationNotFound")} />;

  const students = spec._count?.students ?? 0;
  const topicCount = spec._count?.topics ?? 0;
  const free = unassigned.data?.total ?? null;
  const byStatus = (s: string) => topics.filter((x) => x.status === s).length;
  const blocked = students > 0 || topicCount > 0;

  return (
    <div className="font-body">
      <HierarchyHeader
        crumbs={[
          { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
          { label: c.faculty?.name, to: c.facultyUrl },
          { label: c.dept?.name, to: c.deptUrl },
          ...(c.domainId ? [{ label: domain?.name, to: c.domainUrl }] : []),
          { label: c.filiere?.name, to: c.filiereUrl },
          { label: spec.name },
        ]}
        backLabel={c.filiereUrl ? t("admin.struct.spec.backToFiliere") : t("admin.backToSpecializations")}
        backTo={c.filiereUrl ?? SPECIALIZATIONS_ROUTE}
        icon={GraduationCap}
        title={spec.name}
        subtitle={t("admin.struct.spec.subtitle")}
        coverUrl={spec.coverUrl}
        badges={<HeaderBadge>{t(`admin.proj.level.${spec.level}`)}</HeaderBadge>}
        stats={[
          { icon: Users, label: t("admin.struct.students"), value: students },
          { icon: UserX, label: t("admin.struct.spec.unassigned"), value: free ?? "…", warn: (free ?? 0) > 0 },
          { icon: BookOpen, label: t("admin.struct.topics"), value: topicCount },
          { icon: Inbox, label: t("status.open"), value: topicsQ.data ? byStatus("open") : "…" },
          { icon: Crown, label: t("status.full"), value: topicsQ.data ? byStatus("full") : "…" },
          { icon: Clock, label: t("status.pending"), value: topicsQ.data ? byStatus("pending") : "…", warn: byStatus("pending") > 0 },
        ]}
        menu={
          <>
            <HeaderAction icon={Pencil} onClick={() => setEditing(true)}>
              {t("admin.edit")}
            </HeaderAction>
            {!blocked && (
              <HeaderAction icon={Trash2} onClick={() => setRemoving(true)}>
                {t("admin.delete")}
              </HeaderAction>
            )}
          </>
        }
      />

      {/* tabs */}
      <div className="mb-5 flex gap-1 rounded-2xl border border-forest/10 bg-cream-card p-1.5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]" role="tablist">
        {(
          [
            ["students", Users, students],
            ["topics", BookOpen, topicCount],
          ] as const
        ).map(([k, Icon, n]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`spec-tab-${k}`}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
                on
                  ? "bg-forest text-cream shadow-sm dark:bg-gold/15 dark:text-gold dark:shadow-[inset_0_0_0_1px_rgba(193,150,90,0.4)]"
                  : "text-clay hover:bg-forest/5 hover:text-forest"
              }`}
            >
              <Icon size={15} />
              {t(`admin.struct.spec.tab.${k}`)}
              <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${on ? "bg-cream/15 dark:bg-gold/20" : "bg-forest/8 text-forest"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {tab === "students" ? (
        <StudentsPanel specializationId={spec.id} />
      ) : (
        <TopicsPanel topics={topics} loading={topicsQ.isLoading} error={topicsQ.isError} onRetry={() => topicsQ.refetch()} />
      )}

      <SpecializationFormDialog open={editing} onClose={() => setEditing(false)} specialization={spec} filiereId={spec.filiereId ?? spec.filiere?.id ?? ""} />
      <DeleteNodeDialog
        target={removing ? spec : null}
        title={t("admin.struct.deleteTitle.spec")}
        loading={deleteSpec.isPending}
        onConfirm={() => deleteSpec.mutate(spec.id, { onSuccess: () => navigate(c.filiereUrl ?? SPECIALIZATIONS_ROUTE) })}
        onClose={() => setRemoving(false)}
      />
    </div>
  );
}

/* ── students ─────────────────────────────────────────────── */

function StudentsPanel({ specializationId }: { specializationId: string }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const [search, setSearch] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState({ search: "", reg: "" });
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced({ search: search.trim(), reg: regNumber.trim() });
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search, regNumber]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      specializationId,
      search: debounced.search || undefined,
      registrationNumber: debounced.reg || undefined,
      academicYearId: academicYearId || undefined,
      unassigned: onlyFree ? "true" : undefined,
    }),
    [page, specializationId, debounced, academicYearId, onlyFree],
  );
  const { data, isLoading, isFetching, isError, refetch } = useStudents(params);
  const { data: years } = useAcademicYears();
  const [preview, setPreview] = useState<any | null>(null);

  const students = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <section className="mb-4 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <Field icon={Search} value={search} onChange={setSearch} placeholder={t("admin.searchByNamePlaceholder")} testId="spec-student-search" />
          <Field icon={IdCard} value={regNumber} onChange={setRegNumber} placeholder={t("admin.searchByRegNumberPlaceholder")} ltr />
          <Select
            value={academicYearId}
            icon={CalendarRange}
            filter
            onChange={(v) => {
              setAcademicYearId(v);
              setPage(1);
            }}
            options={[{ value: "", label: t("admin.allYears") }, ...(years ?? []).map((y: any) => ({ value: y.id, label: y.title }))]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/8 pt-3">
          {(
            [
              [false, t("admin.struct.all")],
              [true, t("admin.struct.spec.unassigned")],
            ] as const
          ).map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={onlyFree === v}
              onClick={() => {
                setOnlyFree(v);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                onlyFree === v ? "border-gold/60 bg-gold/15 text-forest" : "border-forest/12 text-clay hover:border-forest/25 hover:text-forest"
              }`}
            >
              {v && <UserX size={12} className="text-amber-500" />}
              {label}
            </button>
          ))}
          <span className="ms-auto text-[11.5px] text-clay tabular-nums">
            {t("admin.showingRange", { from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
            {isFetching && !isLoading && " · …"}
          </span>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-[12.5px]" data-testid="spec-students">
            <colgroup>
              <col className="w-12" />
              <col className="w-[32%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
              <col />
              <col className="w-10" />
            </colgroup>
            <thead className="border-b border-forest/10 bg-cream-2/60">
              <tr className="text-[11px] font-bold tracking-wide text-clay">
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3 text-start">{t("admin.yearArchive.col.student")}</th>
                <th className="px-4 py-3 text-start">{t("admin.regNumber")}</th>
                <th className="px-4 py-3 text-start">{t("admin.academicYear")}</th>
                <th className="px-4 py-3 text-start">{t("admin.struct.spec.account")}</th>
                <th className="px-4 py-3 text-start">{t("admin.struct.spec.lastSeen")}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/6">
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <LoadingArea size={96} className="py-10" />
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-5">
                    <ErrorRetry compact onRetry={() => refetch()} />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Users size={26} className="mx-auto mb-2 text-clay/50" />
                    <p className="text-sm font-semibold text-forest">{t("admin.noStudents")}</p>
                  </td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const u = s.user ?? {};
                  const other = otherScriptName(u);
                  return (
                    <tr key={s.id} onClick={() => setPreview(s)} className="cursor-pointer transition hover:bg-gold/[0.05]">
                      <td className="px-4 py-3 text-center text-[11px] text-clay tabular-nums">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} size={38} className="ring-2 ring-gold/20" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-forest">{personName(u) || "—"}</p>
                            {other && (
                              <p className="truncate text-[11px] text-clay">
                                <bdi>{other}</bdi>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span dir="ltr" className="inline-flex rounded-lg border border-forest/10 bg-cream-2/60 px-2 py-1 font-mono text-[11.5px] text-forest tabular-nums">
                          {s.registrationNumber ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.academicYear?.isActive ? "bg-gold/15 text-gold" : "bg-forest/6 text-forest"}`}>
                          {s.academicYear?.title ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <AccountChip
                            icon={u.status === "suspended" ? ShieldOff : UserCheck}
                            label={t(`admin.struct.spec.status.${u.status === "suspended" ? "suspended" : "active"}`)}
                            cls={u.status === "suspended" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}
                          />
                          {u.isVerified && <AccountChip icon={BadgeCheck} label={t("admin.struct.spec.verified")} cls="bg-sky-500/10 text-sky-700 dark:text-sky-300" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11.5px] text-clay">{u.lastLoginAt ? relative(u.lastLoginAt) : <span className="text-amber-700 dark:text-amber-300">{t("admin.proj.neverSignedIn")}</span>}</td>
                      <td className="px-2 py-3 text-clay">
                        <ChevronLeft size={15} className="opacity-50 ltr:rotate-180" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-end gap-1.5 border-t border-forest/10 px-4 py-3">
            <PageBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)} label={t("admin.proj.prev")}>
              <ChevronRight size={16} className="ltr:rotate-180" />
            </PageBtn>
            <span className="px-2 text-[12.5px] font-semibold text-forest tabular-nums">
              {page} / {pages}
            </span>
            <PageBtn disabled={page >= pages} onClick={() => setPage((p) => p + 1)} label={t("admin.proj.next")}>
              <ChevronLeft size={16} className="ltr:rotate-180" />
            </PageBtn>
          </div>
        )}
      </div>

      <StudentPreviewDialog
        open={preview !== null}
        student={preview}
        onClose={() => setPreview(null)}
        onOpenDetails={(id) => {
          setPreview(null);
          navigate(`/admin/students/${id}`);
        }}
      />
    </>
  );
}

/* ── topics ───────────────────────────────────────────────── */

function TopicsPanel({ topics, loading, error, onRetry }: { topics: AdminTopic[]; loading: boolean; error: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [status, setStatus] = useState("");
  const statuses = ["open", "full", "approved", "pending", "rejected", "archived"].filter((s) => topics.some((x) => x.status === s));
  const shown = topics.filter((x) => !status || x.status === status);

  if (loading) return <LoadingArea className="py-16" />;
  if (error) return <ErrorRetry onRetry={onRetry} />;
  if (topics.length === 0) return <EmptyLevel icon={BookOpen} title={t("admin.struct.spec.noTopics")} hint={t("admin.struct.spec.noTopicsHint")} />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["", ...statuses].map((s) => {
          const on = status === s;
          const n = s ? topics.filter((x) => x.status === s).length : topics.length;
          return (
            <button
              key={s || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setStatus(s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                on ? "border-gold/60 bg-gold/15 text-forest" : "border-forest/12 bg-cream-card text-clay hover:border-forest/25 hover:text-forest"
              }`}
            >
              {s ? t(`status.${s}`) : t("admin.struct.all")}
              <span className="rounded-full bg-forest/6 px-1.5 text-[10.5px] tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4" data-testid="spec-topics">
        {shown.map((x) => {
          const members = x.occupancy?.groupMemberCount ?? 0;
          const fill = x.maxStudents ? Math.min(100, Math.round((members / x.maxStudents) * 100)) : 0;
          const prof = x.professor as any;
          return (
            <li key={x.id} className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.04)] transition hover:border-gold/35">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <Link to={`/${lang}/admin/topics/${x.id}`} className="line-clamp-2 font-serif text-[14.5px] leading-snug font-bold text-forest transition hover:text-gold">
                  {x.title}
                </Link>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${statusChip(x.status)}`}>{t(`status.${x.status}`)}</span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-[12px] text-clay">
                <UserAvatar user={prof?.user} size={24} tone="gold" />
                <span className="truncate font-medium text-forest">{personName(prof?.user) || "—"}</span>
              </div>
              <div className="mt-auto space-y-2 border-t border-forest/8 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-clay">
                    <Users size={12} className="text-gold" />
                    {t("admin.yearArchive.seats")}
                  </span>
                  <span className="font-semibold text-forest tabular-nums">
                    {members}/{x.maxStudents}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
                  <div className={`h-full rounded-full ${fill >= 100 ? "bg-violet-500" : "bg-sky-500"} transition-[width] duration-700`} style={{ width: `${fill}%` }} />
                </div>
                <p className="flex items-center justify-between text-[11px] text-clay">
                  <span className="inline-flex items-center gap-1">
                    <Inbox size={12} className="text-gold" />
                    {t("admin.yearArchive.requests", { count: x._count?.groupRequests ?? 0 })}
                  </span>
                  <span>{relative(x.createdAt)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ── small pieces ─────────────────────────────────────────── */

function Field({
  icon: Icon,
  value,
  onChange,
  placeholder,
  ltr,
  testId,
}: {
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ltr?: boolean;
  testId?: string;
}) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-clay" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={ltr && value ? "ltr" : undefined}
        data-testid={testId}
        className="h-11 w-full rounded-xl border border-forest/15 bg-cream-2 ps-10 pe-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
      />
    </div>
  );
}

function AccountChip({ icon: Icon, label, cls }: { icon: LucideIcon; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function PageBtn({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid size-9 place-items-center rounded-xl border border-forest/12 text-forest transition hover:bg-forest/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
