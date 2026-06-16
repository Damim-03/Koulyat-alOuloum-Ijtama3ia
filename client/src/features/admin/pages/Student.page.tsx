import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Layers,
  Clock,
  FolderCheck,
  GraduationCap,
} from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useAcademicYears,
  useDeleteStudent,
} from "../hooks/admin-hook";
import { UserFormDialog } from "../components/user-form-dialog";
import type { Student } from "../../../types/admin";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

function fullName(s: Student) {
  const u = s.user;
  return (
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    s.registrationNumber ||
    "\u2014"
  );
}

const PAGE_SIZE = 10;

export function AdminStudentsPage() {
  const { t } = useTranslation();

  // Filters
  const [search, setSearch] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  // Applied filters (only sent on "apply" click)
  const [applied, setApplied] = useState<{
    search?: string;
    specializationId?: string;
    academicYearId?: string;
  }>({});

  const { data, isLoading } = useStudents({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();
  const deleteStudent = useDeleteStudent();

  const [dialogOpen, setDialogOpen] = useState(false);

  const students = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setApplied({
      search: search || undefined,
      specializationId: specializationId || undefined,
      academicYearId: academicYearId || undefined,
    });
    setPage(1);
  }

  function handleDelete(s: Student) {
    if (confirm(t("admin.confirmDeleteStudent", { name: fullName(s) }))) {
      deleteStudent.mutate(s.id);
    }
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.studentsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.studentsSubtitle")}
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <Plus size={18} />
          {t("admin.addStudent")}
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={GraduationCap}
          value={total}
          label={t("admin.totalStudents")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={FolderCheck}
          value="\u2014"
          label={t("admin.registeredProjects")}
          tint="bg-emerald-100 text-emerald-600"
        />
        <StatTile
          icon={Clock}
          value="\u2014"
          label={t("admin.awaitingProject")}
          tint="bg-amber-100 text-amber-600"
        />
        <StatTile
          icon={Layers}
          value={specs?.length ?? "\u2014"}
          label={t("admin.specializations")}
          tint="bg-gold/15 text-gold"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchByNameOrReg")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <select
            value={specializationId}
            onChange={(e) => setSpecializationId(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allSpecializations")}</option>
            {specs?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allYears")}</option>
            {years?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title}
              </option>
            ))}
          </select>

          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("admin.applyFilter")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.name")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.regNumber")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.academicYear")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && students.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noStudents")}
                  </td>
                </tr>
              )}

              {students.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-forest/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(s.user?.firstName, s.user?.lastName)}
                      </div>
                      <span className="text-sm font-medium text-forest">
                        {fullName(s)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {s.registrationNumber}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {s.specialization?.name ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {s.academicYear?.title ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.view")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.edit")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                        title={t("admin.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lockedRole="student"
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof GraduationCap;
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
