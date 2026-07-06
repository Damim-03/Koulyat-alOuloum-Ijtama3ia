import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../hooks/useLangNavigate";
import {
  Search,
  Pencil,
  Trash2,
  CalendarCheck,
  History,
  Users,
  BookOpen,
  GraduationCap,
  ChevronLeft,
  Plus,
  AlertCircle,
} from "lucide-react";
import {
  useSpecializations,
  useFaculties,
  useAcademicYears,
  useActivateAcademicYear,
  useDeleteSpecialization,
  useDeleteAcademicYear,
} from "../hooks/admin-hook";
import { SpecializationFormDialog } from "../components/specialization.form-dialog";
import { AcademicYearFormDialog } from "../components/academic.form-dialog";
import type { Specialization, AcademicYear } from "../../../types/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEVELS = ["all", "licence", "master", "doctorate"] as const;
type LevelFilter = (typeof LEVELS)[number];

const LEVEL_STYLES: Record<string, string> = {
  licence: "bg-soft-sage/30 text-forest",
  master: "bg-gold/15 text-gold",
  doctorate: "bg-sage/20 text-sage",
};

const PAGE_SIZE = 8;

/** يقرأ سلسلة التخصص: شعبة ← قسم ← كلية (الكلية تُشتقّ من facultyId). */
function pathOf(s: any, facultyById: Map<string, any>) {
  const filiere = s.filiere;
  const dept = filiere?.department;
  const faculty = dept ? facultyById.get(dept.facultyId) : undefined;
  return { filiere, dept, faculty };
}

export function AdminAcademicStructurePage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const { data: specs, isLoading: specsLoading } = useSpecializations();
  const { data: faculties } = useFaculties();
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const activateYear = useActivateAcademicYear();
  const deleteSpec = useDeleteSpecialization();
  const deleteYear = useDeleteAcademicYear();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [facultyId, setFacultyId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [page, setPage] = useState(1);

  // edit dialogs (no creation here — specializations are created inside the hierarchy)
  const [specOpen, setSpecOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null);
  const [yearOpen, setYearOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const facultyById = useMemo(
    () => new Map((faculties ?? []).map((f: any) => [f.id, f])),
    [faculties],
  );

  // Faculty options: only faculties that actually own specializations.
  const facultyOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of (specs ?? []) as any[]) {
      const fac = pathOf(s, facultyById).faculty;
      if (fac && !seen.has(fac.id)) seen.set(fac.id, fac);
    }
    return [...seen.values()];
  }, [specs, facultyById]);

  // Filiere options, cascaded by the selected faculty.
  const filiereOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of (specs ?? []) as any[]) {
      const { filiere, faculty } = pathOf(s, facultyById);
      if (!filiere) continue;
      if (facultyId && faculty?.id !== facultyId) continue;
      if (!seen.has(filiere.id)) seen.set(filiere.id, filiere);
    }
    return [...seen.values()];
  }, [specs, facultyById, facultyId]);

  const filtered = useMemo(() => {
    let list = (specs ?? []) as any[];
    if (level !== "all") list = list.filter((s) => s.level === level);
    if (facultyId)
      list = list.filter(
        (s) => pathOf(s, facultyById).faculty?.id === facultyId,
      );
    if (filiereId) list = list.filter((s) => s.filiereId === filiereId);
    if (onlyEmpty) list = list.filter((s) => (s._count?.students ?? 0) === 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        const { filiere, dept, faculty } = pathOf(s, facultyById);
        return (
          s.name.toLowerCase().includes(q) ||
          filiere?.name?.toLowerCase().includes(q) ||
          dept?.name?.toLowerCase().includes(q) ||
          faculty?.name?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [specs, level, facultyId, filiereId, onlyEmpty, search, facultyById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { licence: 0, master: 0, doctorate: 0, empty: 0 };
    for (const s of (specs ?? []) as any[]) {
      c[s.level as "licence" | "master" | "doctorate"]++;
      if ((s._count?.students ?? 0) === 0) c.empty++;
    }
    return c;
  }, [specs]);

  function resetPage() {
    setPage(1);
  }
  function openEditSpec(s: Specialization) {
    setEditingSpec(s);
    setSpecOpen(true);
  }
  function openCreateYear() {
    setEditingYear(null);
    setYearOpen(true);
  }
  function openEditYear(y: AcademicYear) {
    setEditingYear(y);
    setYearOpen(true);
  }
  function handleDeleteSpec(s: Specialization) {
    if (confirm(t("admin.confirmDeleteSpec", { name: s.name })))
      deleteSpec.mutate(s.id);
  }
  function handleDeleteYear(y: AcademicYear) {
    if (confirm(t("admin.confirmDeleteYear", { name: y.title })))
      deleteYear.mutate(y.id);
  }

  const selectCls =
    "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.academicStructure")}
          </h1>
          <p className="text-sm text-clay">
            {t("admin.academicStructureSubtitle")}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-forest/10 bg-cream-card px-3 py-2 text-sm text-clay shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <GraduationCap size={16} className="text-gold" />
          <span className="font-bold text-forest">{specs?.length ?? 0}</span>
          {t("admin.specShort")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Specializations (wide) ── */}
        <div className="lg:col-span-8">
          {/* Filters */}
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-55 flex-1">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                  size={18}
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPage();
                  }}
                  placeholder={t("admin.searchSpecialization")}
                  className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </div>
              <div className="flex rounded-xl border border-forest/15 bg-cream-2 p-1">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    onClick={() => {
                      setLevel(lv);
                      resetPage();
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      level === lv
                        ? "bg-forest text-cream"
                        : "text-clay hover:text-forest"
                    }`}
                  >
                    {t(`admin.level_${lv}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={facultyId}
                onChange={(e) => {
                  setFacultyId(e.target.value);
                  setFiliereId("");
                  resetPage();
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
                value={filiereId}
                onChange={(e) => {
                  setFiliereId(e.target.value);
                  resetPage();
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

              <button
                onClick={() => {
                  setOnlyEmpty((v) => !v);
                  resetPage();
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  onlyEmpty
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-forest/15 bg-cream-2 text-clay hover:text-forest"
                }`}
              >
                <AlertCircle size={15} />
                {t("admin.onlyEmpty")}
              </button>
            </div>
          </div>

          {/* Cards */}
          {specsLoading ? (
            <div className="py-16 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
              {t("admin.noSpecializations")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pageItems.map((s) => {
                const { filiere, dept, faculty } = pathOf(s, facultyById);
                const empty = (s._count?.students ?? 0) === 0;
                return (
                  <div
                    key={s.id}
                    className={`group flex flex-col rounded-2xl border bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40 ${
                      empty ? "border-amber-200" : "border-forest/10"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${LEVEL_STYLES[s.level] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {t(`admin.level_${s.level}`)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditSpec(s)}
                          title={t("admin.edit")}
                          className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSpec(s)}
                          title={t("admin.delete")}
                          className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h3
                      onClick={() => navigate(`/admin/specializations/${s.id}`)}
                      className="cursor-pointer font-serif text-base font-bold text-forest transition hover:text-gold"
                    >
                      {s.name}
                    </h3>

                    {/* Path */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-clay">
                      <span>{faculty?.name ?? "\u2014"}</span>
                      <ChevronLeft size={9} className="text-clay/40" />
                      <span>{dept?.name ?? "\u2014"}</span>
                      <ChevronLeft size={9} className="text-clay/40" />
                      <span className="font-medium text-sage">
                        {filiere?.name ?? "\u2014"}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-forest/10 pt-3">
                      <div className="flex items-center gap-3 text-clay">
                        <span className="flex items-center gap-1 text-xs">
                          <Users size={13} />
                          {s._count?.students ?? 0} {t("admin.studentsShort")}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <BookOpen size={13} />
                          {s._count?.topics ?? 0} {t("admin.topicsShort")}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          navigate(`/admin/specializations/${s.id}`)
                        }
                        className="flex items-center gap-0.5 text-xs font-bold text-forest transition hover:text-gold"
                      >
                        {t("admin.viewDetails")}
                        <ChevronLeft
                          size={14}
                          className="transition group-hover:-translate-x-1"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-1">
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

        {/* ── Academic Years (narrow) ── */}
        <div className="lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
              <CalendarCheck size={18} />
              {t("admin.academicYears")}
            </h2>
            <button
              onClick={openCreateYear}
              className="inline-flex items-center gap-1 rounded-lg bg-forest/10 px-2.5 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/15"
            >
              <Plus size={14} />
              {t("admin.addYear")}
            </button>
          </div>

          <div className="space-y-2.5">
            {yearsLoading && <p className="text-sm text-clay">{"\u2026"}</p>}
            {!yearsLoading && (years?.length ?? 0) === 0 && (
              <p className="rounded-xl border border-forest/10 bg-cream-card p-4 text-center text-sm text-clay">
                {t("admin.noYears")}
              </p>
            )}
            {years?.map((y) => (
              <div
                key={y.id}
                className={`flex items-center justify-between rounded-xl border p-3.5 transition ${
                  y.isActive
                    ? "border-gold/40 bg-gold/10"
                    : "border-forest/10 bg-cream-card"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`grid size-9 place-items-center rounded-lg ${y.isActive ? "bg-gold/20 text-gold" : "bg-forest/5 text-clay"}`}
                  >
                    {y.isActive ? (
                      <CalendarCheck size={16} />
                    ) : (
                      <History size={16} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-forest" dir="ltr">
                      {y.title}
                    </p>
                    {y.isActive && (
                      <span className="text-[10px] font-bold text-gold">
                        {t("admin.activeYear")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!y.isActive && (
                    <button
                      onClick={() => activateYear.mutate(y.id)}
                      className="rounded-lg bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest transition hover:bg-forest/15"
                    >
                      {t("admin.activate")}
                    </button>
                  )}
                  <button
                    onClick={() => openEditYear(y)}
                    className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteYear(y)}
                    className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Gold summary card */}
          <div className="mt-5 rounded-2xl bg-forest-deep p-5 text-cream">
            <p className="mb-1 text-xs text-cream/70">
              {t("admin.totalSpecsLabel")}
            </p>
            <p className="mb-3 font-serif text-3xl font-bold text-gold">
              {specs?.length ?? 0} {t("admin.specShort")}
            </p>
            <div className="mb-3 flex items-center gap-4 text-[11px] text-cream/80">
              <span>
                {counts.licence} {t("admin.level_licence")}
              </span>
              <span>
                {counts.master} {t("admin.level_master")}
              </span>
              <span>
                {counts.doctorate} {t("admin.level_doctorate")}
              </span>
            </div>
            {counts.empty > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-medium text-amber-200">
                <AlertCircle size={13} />
                {counts.empty} {t("admin.emptySpecsNote")}
              </div>
            )}
          </div>
        </div>
      </div>

      <SpecializationFormDialog
        open={specOpen}
        onClose={() => setSpecOpen(false)}
        specialization={editingSpec}
        filiereId={(editingSpec as any)?.filiereId ?? ""}
      />
      <AcademicYearFormDialog
        open={yearOpen}
        onClose={() => setYearOpen(false)}
        year={editingYear}
      />
    </div>
  );
}
