import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Network,
  ChevronLeft,
} from "lucide-react";
import { useFaculties, useDeleteFaculty } from "../hooks/admin-hook";
import { FacultyFormDialog } from "../components/Faculty.form-dialog";
import type { Faculty } from "../../../types/admin";
import { useLangNavigate } from "../../../hooks/useLangNavigate";

export function AdminFacultiesPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const { data: faculties, isLoading } = useFaculties();
  const deleteFaculty = useDeleteFaculty();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);

  const list = faculties ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(f: Faculty) {
    setEditing(f);
    setDialogOpen(true);
  }
  function handleDelete(f: Faculty) {
    if (confirm(t("admin.confirmDeleteFaculty", { name: f.name })))
      deleteFaculty.mutate(f.id);
  }
  function openDetails(f: Faculty) {
    navigate(`/admin/faculties/${f.id}`);
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.facultiesTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.facultiesSubtitle")}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("admin.addFaculty")}
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.noFaculties")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => (
            <div
              key={f.id}
              className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDelete(f)}
                    className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(f)}
                    className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <span
                  className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                  dir="ltr"
                >
                  {f.code}
                </span>
              </div>

              <h3
                onClick={() => openDetails(f)}
                className="mb-2 cursor-pointer text-right font-serif text-base font-bold text-forest transition hover:text-sage"
              >
                {f.name}
              </h3>

              <div className="mb-4 flex items-center justify-end gap-1.5 text-clay">
                <span className="text-xs">
                  {f._count?.departments ?? 0} {t("admin.departmentsShort")}
                </span>
                <Network size={14} />
              </div>

              <button
                onClick={() => openDetails(f)}
                className="mt-auto flex items-center justify-end gap-1 border-t border-forest/10 pt-3 text-xs text-sage transition hover:text-forest"
              >
                {t("admin.viewDetails")}
                <ChevronLeft size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Decorative academic excellence card */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-forest-deep p-6 text-cream">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-gold" />
          <div>
            <h3 className="font-serif text-lg font-bold">
              {t("admin.excellenceTitle")}
            </h3>
            <p className="text-sm text-cream/70">{t("admin.excellenceBody")}</p>
          </div>
        </div>
      </div>

      <FacultyFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        faculty={editing}
      />
    </div>
  );
}
