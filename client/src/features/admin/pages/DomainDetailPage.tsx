import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useLangNavigate } from "../../../hooks/useLangNavigate";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
} from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useFilieresByDomain,
  useDeleteFiliere,
  useDomains,
} from "../hooks/admin-hook";
import { FiliereFormDialog } from "../components/Filiere.form-dialog";
import type { Filiere } from "../../../types/admin";

export function DomainDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "", departmentId = "", domainId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains } = useDomains(departmentId);
  const { data: filieres, isLoading } = useFilieresByDomain(domainId);
  const deleteFiliere = useDeleteFiliere();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Filiere | null>(null);

  const faculty = useMemo(
    () => (faculties ?? []).find((f) => f.id === facultyId),
    [faculties, facultyId],
  );
  const department = useMemo(
    () => (departments ?? []).find((d) => d.id === departmentId),
    [departments, departmentId],
  );
  const domain = useMemo(
    () => (domains ?? []).find((dm) => dm.id === domainId),
    [domains, domainId],
  );

  const list = filieres ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(f: Filiere) {
    setEditing(f);
    setDialogOpen(true);
  }
  function handleDelete(f: Filiere) {
    if (confirm(t("admin.confirmDeleteFiliere", { name: f.name })))
      deleteFiliere.mutate(f.id);
  }

  const deptUrl = `/admin/faculties/${facultyId}/departments/${departmentId}`;

  return (
    <div className="font-body">
      {/* Back */}
      <button
        onClick={() => navigate(deptUrl)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ChevronRight size={16} />
        {t("admin.backToDepartment")}
      </button>

      {!domain && domains ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.domainNotFound")}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                {/* Breadcrumb */}
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => navigate("/admin/faculties")}
                    className="text-xs text-clay transition hover:text-forest"
                  >
                    {t("admin.facultiesBreadcrumb")}
                  </button>
                  <ChevronLeft size={12} className="text-clay/50" />
                  <button
                    onClick={() => navigate(`/admin/faculties/${facultyId}`)}
                    className="text-xs text-clay transition hover:text-forest"
                  >
                    {faculty?.name}
                  </button>
                  <ChevronLeft size={12} className="text-clay/50" />
                  <button
                    onClick={() => navigate(deptUrl)}
                    className="text-xs text-clay transition hover:text-forest"
                  >
                    {department?.name}
                  </button>
                  <ChevronLeft size={12} className="text-clay/50" />
                  <span className="text-xs font-semibold text-sage">
                    {domain?.name}
                  </span>
                </div>

                <h1 className="font-serif text-2xl font-bold text-forest">
                  {domain?.name ?? "\u2026"}
                </h1>
                <p className="mt-1 text-sm text-clay">
                  {t("admin.domainFilieresSubtitle")}
                </p>
              </div>

              {domain?.code && (
                <span
                  className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                  dir="ltr"
                >
                  {domain.code}
                </span>
              )}
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              <Plus size={18} />
              {t("admin.addFiliere")}
            </button>
          </div>

          {/* Filieres */}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
              {t("admin.noFilieres")}
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
                    onClick={() =>
                      navigate(
                        `${deptUrl}/domains/${domainId}/filieres/${f.id}`,
                      )
                    }
                    className="mb-2 cursor-pointer text-right font-serif text-base font-bold text-forest transition hover:text-sage"
                  >
                    {f.name}
                  </h3>

                  <div className="mb-4 flex items-center justify-end gap-1.5 text-clay">
                    <span className="text-xs">
                      {f._count?.specializations ?? 0}{" "}
                      {t("admin.specializationsShort")}
                    </span>
                    <GraduationCap size={14} />
                  </div>

                  <button
                    onClick={() =>
                      navigate(
                        `${deptUrl}/domains/${domainId}/filieres/${f.id}`,
                      )
                    }
                    className="mt-auto flex items-center justify-end gap-1 border-t border-forest/10 pt-3 text-xs text-sage transition hover:text-forest"
                  >
                    {t("admin.viewDetails")}
                    <ChevronLeft size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <FiliereFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        filiere={editing}
        domainId={domainId}
      />
    </div>
  );
}
