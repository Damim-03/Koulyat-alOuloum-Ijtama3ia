import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../hooks/useLangNavigate";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useFaculties,
  useAcademicYears,
} from "../hooks/admin-hook";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEVEL_STYLES: Record<string, string> = {
  licence: "bg-soft-sage/30 text-forest",
  master: "bg-gold/15 text-gold",
  doctorate: "bg-sage/20 text-sage",
};

const PAGE_SIZE = 10;

// عدّل هذا المسار ليطابق مسار صفحة التخصصات/الهيكل عندك في الراوتر.
const SPECIALIZATIONS_ROUTE = "/admin/specializations";

function initials(first?: string | null, last?: string | null, fb = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fb;
}

export function SpecializationDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { specializationId = "" } = useParams();

  const { data: specs } = useSpecializations();
  const { data: faculties } = useFaculties();

  const spec = useMemo(
    () => ((specs ?? []) as any[]).find((s) => s.id === specializationId),
    [specs, specializationId],
  );
  const specsLoaded = specs !== undefined;

  const path = useMemo(() => {
    const filiere = spec?.filiere;
    const dept = filiere?.department;
    const faculty = dept
      ? ((faculties ?? []) as any[]).find((f) => f.id === dept.facultyId)
      : undefined;
    return { filiere, dept, faculty };
  }, [spec, faculties]);

  return (
    <div className="font-body">
      {/* Back */}
      <button
        onClick={() => navigate(SPECIALIZATIONS_ROUTE)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ChevronRight size={16} />
        {t("admin.backToSpecializations")}
      </button>

      {!specsLoaded ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : !spec ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.specializationNotFound")}
        </div>
      ) : (
        <>
          {/* Breadcrumb */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => navigate(SPECIALIZATIONS_ROUTE)}
              className="text-xs text-clay transition hover:text-forest"
            >
              {t("admin.specializations")}
            </button>
            <ChevronLeft size={12} className="text-clay/50" />
            <span className="text-xs font-semibold text-sage">{spec.name}</span>
          </div>

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`grid size-16 shrink-0 place-items-center rounded-2xl ${LEVEL_STYLES[spec.level] ?? "bg-soft-sage/30 text-forest"}`}
              >
                <GraduationCap size={30} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-serif text-2xl font-bold text-forest">
                    {spec.name}
                  </h1>
                  {spec.level && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${LEVEL_STYLES[spec.level] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`admin.level_${spec.level}`)}
                    </span>
                  )}
                  {spec._count?.topics != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest/5 px-2.5 py-0.5 text-[11px] font-medium text-clay">
                      <BookOpen size={12} />
                      {spec._count.topics} {t("admin.topicsShort")}
                    </span>
                  )}
                </div>
                {/* Path */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-clay">
                  <span>{path.faculty?.name ?? "\u2014"}</span>
                  <ChevronLeft size={10} className="text-clay/40" />
                  <span>{path.dept?.name ?? "\u2014"}</span>
                  <ChevronLeft size={10} className="text-clay/40" />
                  <span className="font-medium text-sage">
                    {path.filiere?.name ?? "\u2014"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* الطلبة — يُركَّب فقط عند وجود تخصص صالح، فلا يُطلَق أي طلب بمعرّف غير صالح */}
          <StudentsPanel specializationId={spec.id} />
        </>
      )}
    </div>
  );
}

function StudentsPanel({ specializationId }: { specializationId: string }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, academicYearId]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      specializationId,
      search: debouncedSearch || undefined,
      academicYearId: academicYearId || undefined,
    }),
    [page, specializationId, debouncedSearch, academicYearId],
  );

  const { data, isLoading, isFetching } = useStudents(params);
  const { data: years } = useAcademicYears();

  const students = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToStudent = (id: string) => navigate(`/admin/students/${id}`);

  return (
    <>
      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.searchByNameOrReg")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <select
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 sm:w-56"
        >
          <option value="">{t("admin.allYears")}</option>
          {(years ?? []).map((y: any) => (
            <option key={y.id} value={y.id}>
              {y.title}
            </option>
          ))}
        </select>
      </div>

      {/* Students table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.student")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.regNumber")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.academicYear")}
                </th>
                <th className="w-10 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && students.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noStudents")}
                  </td>
                </tr>
              )}

              {students.map((s: any) => (
                <tr
                  key={s.id}
                  onClick={() => goToStudent(s.id)}
                  className="cursor-pointer transition-colors hover:bg-forest/4"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(s.user?.firstName, s.user?.lastName)}
                      </div>
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
                  <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                    {s.academicYear?.title ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5 text-clay">
                    <ChevronLeft size={16} className="opacity-50" />
                  </td>
                </tr>
              ))}
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
            {isFetching && <span className="text-clay/60"> · {"\u2026"}</span>}
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
    </>
  );
}
