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
  Layers,
  GitBranch,
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

  const facultyUrl = `/admin/faculties/${facultyId}`;
  const deptUrl = `/admin/faculties/${facultyId}/departments/${departmentId}`;
  const domainUrl = `${deptUrl}/domains/${domainId}`;
  const filiereUrl = (id: string) => `${domainUrl}/filieres/${id}`;

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
          {/* Breadcrumb */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => navigate("/admin/faculties")}
              className="text-xs text-clay transition hover:text-forest"
            >
              {t("admin.facultiesBreadcrumb")}
            </button>
            <ChevronLeft size={12} className="text-clay/50" />
            <button
              onClick={() => navigate(facultyUrl)}
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

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-forest text-cream">
                <Layers size={30} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-serif text-2xl font-bold text-forest">
                    {domain?.name ?? "\u2026"}
                  </h1>
                  {domain?.code && (
                    <span
                      className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                      dir="ltr"
                    >
                      {domain.code}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] font-medium text-forest">
                    {list.length} {t("admin.filieresShort")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-clay">
                  {t("admin.domainFilieresSubtitle")}
                </p>
              </div>
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-[0.98]"
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => (
                <div
                  key={f.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40"
                >
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="grid size-14 place-items-center rounded-xl bg-soft-sage/30 text-forest transition group-hover:bg-forest/5">
                        <GitBranch size={26} />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          title={t("admin.edit")}
                          className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          title={t("admin.delete")}
                          className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span
                        className="font-mono text-[11px] font-bold uppercase tracking-widest text-gold"
                        dir="ltr"
                      >
                        {f.code}
                      </span>
                      <h3
                        onClick={() => navigate(filiereUrl(f.id))}
                        className="cursor-pointer font-serif text-lg font-bold text-forest transition hover:text-gold"
                      >
                        {f.name}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-forest/10 bg-cream-2 px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-clay">
                      <GraduationCap size={14} />
                      {f._count?.specializations ?? 0}{" "}
                      {t("admin.specializationsShort")}
                    </span>
                    <button
                      onClick={() => navigate(filiereUrl(f.id))}
                      className="flex items-center gap-1 text-sm font-bold text-forest transition hover:text-gold"
                    >
                      {t("admin.viewDetails")}
                      <ChevronLeft
                        size={16}
                        className="transition group-hover:-translate-x-1"
                      />
                    </button>
                  </div>
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
