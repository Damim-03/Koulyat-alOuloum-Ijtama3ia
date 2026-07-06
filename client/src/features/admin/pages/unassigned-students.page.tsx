import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../hooks/useLangNavigate";
import {
  Search,
  UserX,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import {
  useStudents,
  useSpecializations,
  useFaculties,
  useAcademicYears,
} from "../hooks/admin-hook";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 12;

const selectCls =
  "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

function initials(first?: string | null, last?: string | null, fb = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fb;
}

export function AdminUnassignedStudentsPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const [search, setSearch] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debounced, facultyId, departmentId, filiereId, specializationId, academicYearId]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      unassigned: "true",
      search: debounced || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
      specializationId: specializationId || undefined,
      academicYearId: academicYearId || undefined,
    }),
    [page, debounced, facultyId, departmentId, filiereId, specializationId, academicYearId],
  );

  const { data, isLoading } = useStudents(params);
  const { data: specs } = useSpecializations();
  const { data: faculties } = useFaculties();
  const { data: years } = useAcademicYears();

  const students = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Cascading options derived from specializations ──
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

  function pathOf(s: any) {
    const filiere = s.specialization?.filiere;
    const dept = filiere?.department;
    const faculty = dept ? facultyById.get(dept.facultyId) : undefined;
    return { faculty, dept, filiere, spec: s.specialization };
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <UserX size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl font-bold text-forest">
                {t("admin.unassignedStudentsTitle")}
              </h1>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                {total}
              </span>
            </div>
            <p className="text-sm text-clay">
              {t("admin.unassignedStudentsSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Deadline hint */}
      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>{t("admin.unassignedStudentsHint")}</p>
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="relative mb-3">
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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

      {/* Table */}
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
                  {t("admin.specialization")}
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
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-clay">
                    {"\u2026"}
                  </td>
                </tr>
              )}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-clay">
                    {t("admin.noUnassignedStudents")}
                  </td>
                </tr>
              )}
              {students.map((s) => {
                const { faculty, dept, filiere, spec } = pathOf(s);
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/students/${s.id}`)}
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
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-forest">{spec?.name ?? "\u2014"}</p>
                      <p className="flex flex-wrap items-center gap-1 text-[10px] text-clay">
                        <span>{faculty?.name ?? "\u2014"}</span>
                        <ChevronLeft size={9} className="text-clay/40" />
                        <span>{dept?.name ?? "\u2014"}</span>
                        <ChevronLeft size={9} className="text-clay/40" />
                        <span>{filiere?.name ?? "\u2014"}</span>
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                      {s.academicYear?.title ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5 text-clay">
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
    </div>
  );
}