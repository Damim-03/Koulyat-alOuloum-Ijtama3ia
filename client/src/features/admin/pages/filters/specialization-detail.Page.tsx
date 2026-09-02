import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { Search, ChevronLeft, GraduationCap, IdCard } from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useFaculties,
  useAcademicYears,
} from "../../hooks/admin-hook";
import {
  HierarchyHeader,
  HeaderBadge,
} from "../../components/ui/hierarchy-header";
import { StudentPreviewDialog } from "../../components/dialog/student/student-preview-dialog";
import { SearchField } from "../../components/ui/search-field";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 10;

/** Reads a student's academic chain: specialization -> filiere -> dept -> faculty. */
function chain(s: any) {
  const spec = s.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department;
  return {
    specName: spec?.name ?? null,
    filiereName: filiere?.name ?? null,
    deptName: dept?.name ?? null,
    facultyName: dept?.faculty?.name ?? null,
  };
}

// عدّل هذا المسار ليطابق مسار صفحة التخصصات/الهيكل عندك في الراوتر.
const SPECIALIZATIONS_ROUTE = "/admin/specializations";

function initials(first?: string | null, last?: string | null, fb = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fb;
}

export function SpecializationDetailPage() {
  const { t } = useTranslation();
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
      {!specsLoaded ? (
        <div className="py-20 text-center text-sm text-clay">{"…"}</div>
      ) : !spec ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.specializationNotFound")}
        </div>
      ) : (
        <>
          <HierarchyHeader
            crumbs={[
              { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
              { label: path.faculty?.name },
              { label: path.dept?.name },
              { label: path.filiere?.name },
              { label: spec.name },
            ]}
            backLabel={t("admin.backToSpecializations")}
            backTo={SPECIALIZATIONS_ROUTE}
            icon={GraduationCap}
            title={spec.name}
            subtitle={t("admin.specStudentsSubtitle")}
            coverUrl={spec.coverUrl}
            badges={
              <>
                {spec.level && (
                  <HeaderBadge>{t(`admin.level_${spec.level}`)}</HeaderBadge>
                )}
                {spec._count?.students != null && (
                  <HeaderBadge>
                    {spec._count.students} {t("admin.studentsShort")}
                  </HeaderBadge>
                )}
                {spec._count?.topics != null && (
                  <HeaderBadge>
                    {spec._count.topics} {t("admin.topicsShort")}
                  </HeaderBadge>
                )}
              </>
            }
          />

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
  const [regNumber, setRegNumber] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedRegNumber, setDebouncedRegNumber] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedRegNumber(regNumber.trim()), 350);
    return () => clearTimeout(id);
  }, [regNumber]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, debouncedRegNumber, academicYearId]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      specializationId,
      // `search` is the person's name; the number has its own field.
      search: debouncedSearch || undefined,
      registrationNumber: debouncedRegNumber || undefined,
      academicYearId: academicYearId || undefined,
    }),
    [
      page,
      specializationId,
      debouncedSearch,
      debouncedRegNumber,
      academicYearId,
    ],
  );

  const { data, isLoading, isFetching } = useStudents(params);
  const { data: years } = useAcademicYears();

  const students = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToStudent = (id: string) => navigate(`/admin/students/${id}`);

  // A row opens a preview; the details page is one button away inside it.
  const [preview, setPreview] = useState<any | null>(null);

  return (
    <>
      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] md:grid-cols-3">
        <SearchField
          icon={Search}
          label={t("admin.searchByName")}
          placeholder={t("admin.searchByNamePlaceholder")}
          value={search}
          onChange={setSearch}
        />
        <SearchField
          icon={IdCard}
          label={t("admin.searchByRegNumber")}
          placeholder={t("admin.searchByRegNumberPlaceholder")}
          value={regNumber}
          onChange={setRegNumber}
        />
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-clay">
            {t("admin.academicYear")}
          </span>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allYears")}</option>
            {(years ?? []).map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Students table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="w-20 px-4 py-3 text-xs font-medium">
                  {t("admin.avatarColumn")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.firstNameColumn")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.lastName")}</th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.regNumber")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.filiere")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.department")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.faculty")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.academicYear")}
                </th>
                <th className="w-8 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && students.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noStudents")}
                  </td>
                </tr>
              )}

              {students.map((s: any) => (
                <tr
                  key={s.id}
                  onClick={() => setPreview(s)}
                  className="cursor-pointer transition-colors hover:bg-forest/4"
                >
                  <td className="px-4 py-3.5">
                    {s.user?.avatarUrl ? (
                      <img
                        src={s.user.avatarUrl}
                        alt=""
                        className="size-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(s.user?.firstName, s.user?.lastName)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-forest">
                    {s.user?.firstName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-forest">
                    {s.user?.lastName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay" dir="ltr">
                    {s.registrationNumber ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {chain(s).specName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {chain(s).filiereName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {chain(s).deptName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {chain(s).facultyName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay" dir="ltr">
                    {s.academicYear?.title ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-clay">
                    <ChevronLeft size={16} className="opacity-50 ltr:rotate-180" />
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

      <StudentPreviewDialog
        open={preview !== null}
        student={preview}
        onClose={() => setPreview(null)}
        onOpenDetails={(id) => {
          setPreview(null);
          goToStudent(id);
        }}
      />
    </>
  );
}
