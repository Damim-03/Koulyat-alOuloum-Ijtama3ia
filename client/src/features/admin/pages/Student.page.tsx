import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  X,
  Layers,
  Clock,
  FolderCheck,
  GraduationCap,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useDepartments,
  useFaculties,
  useFilieres,
} from "../hooks/admin-hook";
import { UserFormDialog } from "../components/user-form-dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const PAGE_SIZE = 10;

function chain(s: any) {
  const spec = s.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department;
  const faculty = dept?.faculty;
  return {
    specName: spec?.name ?? null,
    filiereName: filiere?.name ?? null,
    deptName: dept?.name ?? null,
    facultyName: faculty?.name ?? null,
  };
}

export function AdminStudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();
  const goToStudent = (sid: string) =>
    navigate(`/${lang}/admin/students/${sid}`);

  const [search, setSearch] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  // debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, facultyId, departmentId, filiereId, specializationId]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
      specializationId: specializationId || undefined,
    }),
    [
      page,
      debouncedSearch,
      facultyId,
      departmentId,
      filiereId,
      specializationId,
    ],
  );

  const { data, isLoading, isFetching } = useStudents(params);
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();

  // ── cascading option lists ──
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d: any) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );

  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f: any) => {
        if (departmentId && f.departmentId !== departmentId) return false;
        if (facultyId && !departmentId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === f.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [filieres, departmentId, facultyId, departments],
  );

  const specOptions = useMemo(
    () =>
      (specs ?? []).filter((sp: any) => {
        if (filiereId && sp.filiereId !== filiereId) return false;
        if (departmentId && !filiereId && sp.departmentId !== departmentId)
          return false;
        if (facultyId && !departmentId && !filiereId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === sp.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [specs, filiereId, departmentId, facultyId, departments],
  );

  // clear children when a parent becomes incompatible
  useEffect(() => {
    if (departmentId && !deptOptions.some((d: any) => d.id === departmentId))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartmentId("");
  }, [deptOptions, departmentId]);
  useEffect(() => {
    if (filiereId && !filiereOptions.some((f: any) => f.id === filiereId))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFiliereId("");
  }, [filiereOptions, filiereId]);
  useEffect(() => {
    if (
      specializationId &&
      !specOptions.some((s: any) => s.id === specializationId)
    )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpecializationId("");
  }, [specOptions, specializationId]);

  const students = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const facultyName = faculties?.find((f: any) => f.id === facultyId)?.name;
  const deptName = departments?.find((d: any) => d.id === departmentId)?.name;
  const filiereName = filieres?.find((f: any) => f.id === filiereId)?.name;
  const specName = specs?.find((s: any) => s.id === specializationId)?.name;

  const activeFilters =
    (debouncedSearch ? 1 : 0) +
    (facultyId ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (filiereId ? 1 : 0) +
    (specializationId ? 1 : 0);

  function clearAll() {
    setSearch("");
    setFacultyId("");
    setDepartmentId("");
    setFiliereId("");
    setSpecializationId("");
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
      <div className="mb-4 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="relative mb-3">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.searchByNameOrReg")}
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

        {/* row 1: faculty → department → filiere → specialization */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="الكلّية"
            value={facultyId}
            onChange={setFacultyId}
            placeholder="كل الكلّيات"
            options={(faculties ?? []).map((f: any) => ({
              v: f.id,
              l: f.name,
            }))}
          />
          <Select
            label="القسم"
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="كل الأقسام"
            options={deptOptions.map((d: any) => ({ v: d.id, l: d.name }))}
          />
          <Select
            label="الشعبة"
            value={filiereId}
            onChange={setFiliereId}
            placeholder="كل الشُّعب"
            options={filiereOptions.map((f: any) => ({ v: f.id, l: f.name }))}
          />
          <Select
            label={t("admin.specialization")}
            value={specializationId}
            onChange={setSpecializationId}
            placeholder={t("admin.allSpecializations")}
            options={specOptions.map((s: any) => ({ v: s.id, l: s.name }))}
          />
        </div>

        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3">
            <SlidersHorizontal size={14} className="text-clay" />
            {debouncedSearch && (
              <Chip
                label={`بحث: ${debouncedSearch}`}
                onClear={() => setSearch("")}
              />
            )}
            {facultyName && (
              <Chip
                label={`الكلّية: ${facultyName}`}
                onClear={() => setFacultyId("")}
              />
            )}
            {deptName && (
              <Chip
                label={`القسم: ${deptName}`}
                onClear={() => setDepartmentId("")}
              />
            )}
            {filiereName && (
              <Chip
                label={`الشعبة: ${filiereName}`}
                onClear={() => setFiliereId("")}
              />
            )}
            {specName && (
              <Chip
                label={`التخصّص: ${specName}`}
                onClear={() => setSpecializationId("")}
              />
            )}

            <button
              onClick={clearAll}
              className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
            >
              <X size={13} /> مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-clay">
        <GraduationCap size={15} />
        <span>{total} طالب</span>
        {isFetching && (
          <span className="text-[11px] text-clay/70">· تحديث…</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-4 py-3 text-xs font-medium">الاسم</th>
                <th className="px-4 py-3 text-xs font-medium">اللقب</th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.regNumber")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">الشعبة</th>
                <th className="px-4 py-3 text-xs font-medium">القسم</th>
                <th className="px-4 py-3 text-xs font-medium">الكلّية</th>
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
                    colSpan={9}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noStudents")}
                  </td>
                </tr>
              )}

              {students.map((s) => {
                const c = chain(s);
                return (
                  <tr
                    key={s.id}
                    onClick={() => goToStudent(s.id)}
                    className="cursor-pointer transition-colors hover:bg-forest/[0.04]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
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
                        <span className="text-sm font-medium text-forest">
                          {s.user?.firstName ?? "\u2014"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-forest">
                      {s.user?.lastName ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay" dir="ltr">
                      {s.registrationNumber}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay">
                      {c.specName ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay">
                      {c.filiereName ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay">
                      {c.deptName ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay">
                      {c.facultyName ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-clay">
                      {s.academicYear?.title ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-clay">
                      <ChevronLeft size={16} className="opacity-50" />
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

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lockedRole="student"
      />
    </div>
  );
}

/* ── labeled select ───────────────────────────────────────── */
function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
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
