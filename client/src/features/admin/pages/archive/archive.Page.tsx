import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarCheck,
  Search,
  Users,
  BookOpen,
  ChevronLeft,
} from "lucide-react";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { useAcademicYears, useStudents, useAdminTopics } from "../../hooks/admin-hook";
import { UserAvatar } from "../../../../components/ui/user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};


export function AdminArchivePage() {
  const { t } = useTranslation();
  const { data: years } = useAcademicYears();

  const [yearId, setYearId] = useState("");

  // اختَر السنة النشطة افتراضياً عند أول تحميل.
  useEffect(() => {
    if (yearId || !years?.length) return;
    const active = (years as any[]).find((y) => y.isActive) ?? years[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setYearId(active.id);
  }, [years, yearId]);

  const activeYear = useMemo(
    () => ((years ?? []) as any[]).find((y) => y.id === yearId),
    [years, yearId],
  );

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-forest text-cream">
            <Archive size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest">
              {t("admin.archiveTitle")}
            </h1>
            <p className="text-sm text-clay">{t("admin.archiveSubtitle")}</p>
          </div>
        </div>

        {/* Year selector */}
        <div className="relative">
          <CalendarCheck
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={16}
          />
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="appearance-none rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-9 pl-4 text-sm font-semibold text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            dir="ltr"
          >
            {(years ?? []).map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.title}
                {y.isActive ? " \u2713" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!years?.length ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.noYears")}
        </div>
      ) : yearId ? (
        <ArchiveBody
          key={yearId}
          yearId={yearId}
          isActive={!!activeYear?.isActive}
        />
      ) : null}
    </div>
  );
}

function ArchiveBody({
  yearId,
  isActive,
}: {
  yearId: string;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const [tab, setTab] = useState<"students" | "topics">("students");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debounced, tab]);

  const studentParams = useMemo(
    () => ({
      page: tab === "students" ? page : 1,
      limit: PAGE_SIZE,
      academicYearId: yearId,
      search: tab === "students" && debounced ? debounced : undefined,
    }),
    [tab, page, yearId, debounced],
  );
  const topicParams = useMemo(
    () => ({
      page: tab === "topics" ? page : 1,
      limit: PAGE_SIZE,
      academicYearId: yearId,
      search: tab === "topics" && debounced ? debounced : undefined,
    }),
    [tab, page, yearId, debounced],
  );

  const { data: studentsData, isLoading: studentsLoading } =
    useStudents(studentParams);
  const { data: topicsData, isLoading: topicsLoading } =
    useAdminTopics(topicParams);

  const studentsTotal = studentsData?.total ?? 0;
  const topicsTotal = topicsData?.total ?? 0;

  const isStudents = tab === "students";
  const total = isStudents ? studentsTotal : topicsTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {/* Summary chips */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryTile
          icon={Users}
          value={studentsTotal}
          label={t("admin.archiveStudentsTab")}
          tint="bg-soft-sage/30 text-forest"
        />
        <SummaryTile
          icon={BookOpen}
          value={topicsTotal}
          label={t("admin.archiveTopicsTab")}
          tint="bg-gold/15 text-gold"
        />
      </div>

      {/* Tabs + search */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-forest/15 bg-cream-2 p-1">
          <TabBtn
            active={isStudents}
            onClick={() => setTab("students")}
            label={`${t("admin.archiveStudentsTab")} (${studentsTotal})`}
          />
          <TabBtn
            active={!isStudents}
            onClick={() => setTab("topics")}
            label={`${t("admin.archiveTopicsTab")} (${topicsTotal})`}
          />
        </div>
        <div className="relative sm:w-72">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isStudents ? t("admin.searchByNameOrReg") : t("admin.searchTopic")
            }
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          {isStudents ? (
            <table className="w-full text-start">
              <thead>
                <tr className="bg-forest text-cream">
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.student")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.regNumber")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.specialization")}
                  </th>
                  <th className="w-10 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {studentsLoading && <Row colSpan={4}>{"\u2026"}</Row>}
                {!studentsLoading &&
                  (studentsData?.items?.length ?? 0) === 0 && (
                    <Row colSpan={4}>{t("admin.noStudents")}</Row>
                  )}
                {(studentsData?.items ?? []).map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/students/${s.id}`)}
                    className="cursor-pointer transition-colors hover:bg-forest/4"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={s.user} size={36} />
                        <p className="text-sm font-medium text-forest">
                          {[s.user?.firstName, s.user?.lastName]
                            .filter(Boolean)
                            .join(" ") || "\u2014"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                      {s.registrationNumber ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay">
                      {s.specialization?.name ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5 text-clay">
                      <ChevronLeft size={16} className="opacity-50 ltr:rotate-180" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-start">
              <thead>
                <tr className="bg-forest text-cream">
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.topicTitle")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.supervisor")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.statusLabel")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("admin.applicationsCount")}
                  </th>
                  <th className="w-10 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {topicsLoading && <Row colSpan={5}>{"\u2026"}</Row>}
                {!topicsLoading && (topicsData?.items?.length ?? 0) === 0 && (
                  <Row colSpan={5}>{t("admin.noTopics")}</Row>
                )}
                {(topicsData?.items ?? []).map((tp: any) => (
                  <tr
                    key={tp.id}
                    onClick={() => navigate(`/admin/topics/${tp.id}`)}
                    className="cursor-pointer transition-colors hover:bg-forest/4"
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-forest">
                      {tp.title}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay">
                      {[
                        tp.professor?.user?.firstName,
                        tp.professor?.user?.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                        tp.professor?.universityEmail ||
                        "\u2014"}
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
                        {tp._count?.groupRequests ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-clay">
                      <ChevronLeft size={16} className="opacity-50 ltr:rotate-180" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

      {isActive && (
        <p className="mt-3 text-center text-[11px] text-clay/70">
          {"\u2713"} {t("admin.activeYear")}
        </p>
      )}
    </>
  );
}

function SummaryTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Users;
  value: number;
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

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
        active ? "bg-forest text-cream" : "text-clay hover:text-forest"
      }`}
    >
      {label}
    </button>
  );
}

function Row({ colSpan, children }: { colSpan: number; children: any }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-12 text-center text-sm text-clay"
      >
        {children}
      </td>
    </tr>
  );
}
