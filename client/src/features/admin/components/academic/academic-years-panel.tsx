import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, History, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAcademicYears,
  useActivateAcademicYear,
  useDeleteAcademicYear,
} from "../../hooks/admin-hook";
import type { AcademicYear } from "../../../../types/admin";
import { AcademicYearFormDialog } from "../dialog/academic/academic-dialog.form";

/**
 * Academic years, in full: create, edit, delete, and pick the active one.
 *
 * A year sits at the same level as a faculty — it frames the whole hierarchy
 * rather than belonging to any one branch — so it lives on the academic
 * structure page next to the faculties, not among the specializations.
 */
export function AcademicYearsPanel() {
  const { t } = useTranslation();

  const { data: years, isLoading } = useAcademicYears();
  const activateYear = useActivateAcademicYear();
  const deleteYear = useDeleteAcademicYear();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(y: AcademicYear) {
    setEditing(y);
    setOpen(true);
  }
  function handleDelete(y: AcademicYear) {
    if (confirm(t("admin.confirmDeleteYear", { name: y.title })))
      deleteYear.mutate(y.id);
  }

  return (
    <section className="mt-10">
      {/* Separates the faculties above from the years below. */}
      <div className="mb-8 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-linear-to-r from-transparent to-forest/25" />
        <span className="size-1.5 rotate-45 bg-gold/70" />
        <span className="h-px flex-1 bg-linear-to-l from-transparent to-forest/25" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
          <CalendarCheck size={18} className="text-gold" />
          {t("admin.academicYears")}
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-cream-card px-4 py-2.5 text-sm font-bold text-forest shadow-sm transition hover:border-gold hover:bg-gold/10 active:scale-[0.98]"
        >
          <Plus size={16} className="text-gold" />
          {t("admin.addYear")}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-clay">{"…"}</div>
      ) : (years?.length ?? 0) === 0 ? (
        <p className="rounded-2xl border border-forest/10 bg-cream-card py-10 text-center text-sm text-clay">
          {t("admin.noYears")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {years?.map((y) => (
            <div
              key={y.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                y.isActive
                  ? "border-gold/40 bg-gold/10"
                  : "border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                    y.isActive
                      ? "bg-gold/20 text-gold"
                      : "bg-soft-sage/30 text-forest"
                  }`}
                >
                  {y.isActive ? (
                    <CalendarCheck size={20} />
                  ) : (
                    <History size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate font-serif text-base font-bold text-forest"
                    dir="ltr"
                  >
                    {y.title}
                  </p>
                  {y.isActive && (
                    <span className="text-[10px] font-bold text-gold">
                      {t("admin.activeYear")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!y.isActive && (
                  <button
                    onClick={() => activateYear.mutate(y.id)}
                    className="rounded-lg bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest transition hover:bg-forest/15"
                  >
                    {t("admin.activate")}
                  </button>
                )}
                <button
                  onClick={() => openEdit(y)}
                  title={t("admin.edit")}
                  className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(y)}
                  title={t("admin.delete")}
                  className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AcademicYearFormDialog
        open={open}
        onClose={() => setOpen(false)}
        year={editing}
      />
    </section>
  );
}
