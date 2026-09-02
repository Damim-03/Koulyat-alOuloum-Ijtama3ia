import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import {
  Search,
  Pencil,
  Trash2,
  Layers3,
  GraduationCap,
  ChevronLeft,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  useSpecializations,
  useFaculties,
  useDeleteSpecialization,
} from "../../hooks/admin-hook";
import type { Specialization } from "../../../../types/admin";
import { SpecializationFormDialog } from "../../components/dialog/faculty/specialization.form-dialog.form";
import { CoverBanner } from "../../components/ui/cover-banner";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEVELS = ["all", "licence", "master", "doctorate"] as const;
type LevelFilter = (typeof LEVELS)[number];

const PAGE_SIZE = 9;

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
  const deleteSpec = useDeleteSpecialization();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [facultyId, setFacultyId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [page, setPage] = useState(1);

  // edit dialogs (no creation here — specializations are created inside the hierarchy)
  const [specOpen, setSpecOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null);

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
  function handleDeleteSpec(s: Specialization) {
    if (confirm(t("admin.confirmDeleteSpec", { name: s.name })))
      deleteSpec.mutate(s.id);
  }

  const selectCls =
    "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold text-forest">
            {t("admin.specializationsTitle")}
          </h1>
          <p className="text-sm text-clay">
            {t("admin.specializationsSubtitle")}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-forest/10 bg-cream-card px-3 py-2 text-sm text-clay shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <GraduationCap size={16} className="text-gold" />
          <span className="font-bold text-forest">{specs?.length ?? 0}</span>
          {t("admin.specShort")}
        </span>
      </div>

      {/* Summary */}
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-forest-deep p-5 text-cream">
        <div>
          <p className="mb-1 text-xs text-cream/70">
            {t("admin.totalSpecsLabel")}
          </p>
          <p className="font-serif text-3xl font-bold text-gold">
            {specs?.length ?? 0} {t("admin.specShort")}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-cream/80">
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
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-medium text-amber-200 ms-auto">
            <AlertCircle size={13} />
            {counts.empty} {t("admin.emptySpecsNote")}
          </div>
        )}
      </div>

      <div>
        <div>
          {/* Filters */}
          <div className="mb-5 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            {/* Header */}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-forest" />

                <span className="font-semibold text-forest">{t("admin.filters")}</span>

                {(search ||
                  facultyId ||
                  filiereId ||
                  level !== "all" ||
                  onlyEmpty) && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                    {(search ? 1 : 0) +
                      (facultyId ? 1 : 0) +
                      (filiereId ? 1 : 0) +
                      (level !== "all" ? 1 : 0) +
                      (onlyEmpty ? 1 : 0)}
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
              className={`overflow-hidden transition-all duration-300 ${
                filtersOpen
                  ? "max-h-187.5 border-t border-forest/10 p-4"
                  : "max-h-0"
              }`}
            >
              {/* Search + Levels */}
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

              {/* Faculty + Filiere + Empty */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((s) => {
                const { filiere, dept, faculty } = pathOf(s, facultyById);
                return (
                  <SpecializationCard
                    key={s.id}
                    spec={s}
                    faculty={faculty}
                    dept={dept}
                    filiere={filiere}
                    onDetails={() =>
                      navigate(`/admin/specializations/${s.id}`)
                    }
                    onEdit={() => openEditSpec(s)}
                    onDelete={() => handleDeleteSpec(s)}
                  />
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

      </div>

      <SpecializationFormDialog
        open={specOpen}
        onClose={() => setSpecOpen(false)}
        specialization={editingSpec}
        filiereId={(editingSpec as any)?.filiereId ?? ""}
      />
    </div>
  );
}

/** يعرض العدد برقمين (مثل 08) لمطابقة تصميم بطاقات الكليات. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/* ── بطاقة تخصص ─────────────────────────────────────────────── */
function SpecializationCard({
  spec: s,
  faculty,
  dept,
  filiere,
  onDetails,
  onEdit,
  onDelete,
}: {
  spec: any;
  faculty: any;
  dept: any;
  filiere: any;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const empty = (s._count?.students ?? 0) === 0;

  const stats = [
    { label: t("admin.statStudents"), value: s._count?.students ?? 0 },
    { label: t("admin.statTopics"), value: s._count?.topics ?? 0 },
  ];

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40 ${
        empty ? "border-amber-200" : "border-forest/10"
      }`}
    >
      <div className="p-5">
        {/* Icon + actions */}
        <CoverBanner src={s.coverUrl} />
        <div className="mb-5 flex items-start justify-between">
          <div className="grid size-14 place-items-center rounded-xl bg-soft-sage/30 text-forest transition group-hover:bg-forest/5">
            <Layers3 size={26} />
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              title={t("admin.edit")}
              className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onDelete}
              title={t("admin.delete")}
              className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Level + name */}
        <div className="mb-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gold">
            {t(`admin.level_${s.level}`)}
          </span>
          <h3
            onClick={onDetails}
            className="cursor-pointer font-serif text-lg font-bold text-forest transition hover:text-gold"
          >
            {s.name}
          </h3>
        </div>

        {/* Where it sits: faculty ← department ← filiere */}
        <div className="mb-5 flex flex-wrap items-center gap-1 text-[10px] text-clay">
          <span>{faculty?.name ?? "\u2014"}</span>
          <ChevronLeft size={9} className="text-clay/40 ltr:rotate-180" />
          <span>{dept?.name ?? "\u2014"}</span>
          <ChevronLeft size={9} className="text-clay/40 ltr:rotate-180" />
          <span className="font-medium text-sage">
            {filiere?.name ?? "\u2014"}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-y-4 border-y border-forest/10 py-5">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center ${
                i % 2 === 0 ? "border-l border-forest/10" : ""
              }`}
            >
              <p className="mb-1 text-[11px] text-clay">{stat.label}</p>
              <p className="font-serif text-lg font-bold text-forest">
                {pad2(stat.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <button
        onClick={onDetails}
        className="mt-auto flex items-center justify-end gap-2 bg-cream-2 px-5 py-4 text-sm font-bold text-forest transition hover:text-gold"
      >
        {t("admin.viewDetails")}
        <ChevronLeft
          size={16}
          className="transition rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1 ltr:rotate-180"
        />
      </button>
    </div>
  );
}
