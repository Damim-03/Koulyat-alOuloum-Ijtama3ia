import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  CalendarCheck,
  History,
  Users,
  BookOpen,
} from "lucide-react";
import {
  useSpecializations,
  useAcademicYears,
  useActivateAcademicYear,
  useDeleteSpecialization,
  useDeleteAcademicYear,
} from "../hooks/admin-hook";
import type { Specialization, AcademicYear } from "../../../types/admin";

const LEVELS = ["all", "licence", "master", "doctorate"] as const;
type LevelFilter = (typeof LEVELS)[number];

const LEVEL_STYLES: Record<string, string> = {
  licence: "bg-soft-sage/30 text-forest",
  master: "bg-gold/15 text-gold",
  doctorate: "bg-sage/20 text-sage",
};

const PAGE_SIZE = 6;

export function AdminAcademicStructurePage() {
  const { t } = useTranslation();

  const { data: specs, isLoading: specsLoading } = useSpecializations();
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const activateYear = useActivateAcademicYear();
  const deleteSpec = useDeleteSpecialization();
  const deleteYear = useDeleteAcademicYear();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [page, setPage] = useState(1);

  // Client-side filter (specializations come unpaginated from backend).
  const filtered = useMemo(() => {
    let list = specs ?? [];
    if (level !== "all") list = list.filter((s) => s.level === level);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.department?.name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [specs, level, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Level counts for the gold summary card.
  const counts = useMemo(() => {
    const c = { licence: 0, master: 0, doctorate: 0 };
    for (const s of specs ?? []) c[s.level] = (c[s.level] ?? 0) + 1;
    return c;
  }, [specs]);

  function handleDeleteSpec(s: Specialization) {
    if (confirm(t("admin.confirmDeleteSpec", { name: s.name })))
      deleteSpec.mutate(s.id);
  }
  function handleDeleteYear(y: AcademicYear) {
    if (confirm(t("admin.confirmDeleteYear", { name: y.title })))
      deleteYear.mutate(y.id);
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.academicStructure")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.academicStructureSubtitle")}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep">
          <Plus size={18} />
          {t("admin.addSpecialization")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Specializations (wide) ── */}
        <div className="lg:col-span-8">
          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
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
                    setPage(1);
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

          {/* Cards grid */}
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
              {pageItems.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDeleteSpec(s)}
                        className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest">
                        <Pencil size={14} />
                      </button>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${LEVEL_STYLES[s.level] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`admin.level_${s.level}`)}
                    </span>
                  </div>

                  <h3 className="mb-1 text-right font-serif text-base font-bold text-forest">
                    {s.name}
                  </h3>
                  <p className="mb-3 text-right text-[11px] text-clay">
                    {s.department?.name ?? "\u2014"}
                  </p>

                  <div className="flex items-center justify-end gap-4 border-t border-forest/10 pt-3 text-clay">
                    <span className="flex items-center gap-1 text-xs">
                      <BookOpen size={14} />
                      {s._count?.topics ?? 0} {t("admin.topicsShort")}
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <Users size={14} />
                      {s._count?.students ?? 0} {t("admin.studentsShort")}
                    </span>
                  </div>
                </div>
              ))}
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
            <button className="inline-flex items-center gap-1 rounded-lg bg-forest/10 px-2.5 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/15">
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
            <div className="flex items-center gap-4 text-[11px] text-cream/80">
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
          </div>
        </div>
      </div>
    </div>
  );
}
