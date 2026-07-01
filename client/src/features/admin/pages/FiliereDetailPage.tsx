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
  Users,
  BookOpen,
} from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDomains,
  useFilieresByDomain,
  useSpecializations,
  useDeleteSpecialization,
} from "../hooks/admin-hook";
import type { Specialization } from "../../../types/admin";
import { SpecializationFormDialog } from "../components/specialization.form-dialog";

const LEVEL_LABEL: Record<string, string> = {
  licence: "admin.levelLicence",
  master: "admin.levelMaster",
  doctorate: "admin.levelDoctorate",
};

/** يقرأ معرّف الشعبة من التخصص سواء كان filiereId أو filiere.id */
function getFiliereId(s: Specialization): string | undefined {
  return s.filiereId ?? s.filiere?.id;
}

export function FiliereDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const {
    facultyId = "",
    departmentId = "",
    domainId = "",
    filiereId = "",
  } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains } = useDomains(departmentId);
  const { data: filieres } = useFilieresByDomain(domainId);
  const { data: specializations, isLoading } = useSpecializations();
  const deleteSpecialization = useDeleteSpecialization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Specialization | null>(null);

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
  const filiere = useMemo(
    () => (filieres ?? []).find((f) => f.id === filiereId),
    [filieres, filiereId],
  );

  // نُصفّي تخصصات هذه الشعبة محلياً
  const list = useMemo(
    () => (specializations ?? []).filter((s) => getFiliereId(s) === filiereId),
    [specializations, filiereId],
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(s: Specialization) {
    setEditing(s);
    setDialogOpen(true);
  }
  function handleDelete(s: Specialization) {
    if (confirm(t("admin.confirmDeleteSpecialization", { name: s.name })))
      deleteSpecialization.mutate(s.id);
  }

  const domainUrl = `/admin/faculties/${facultyId}/departments/${departmentId}/domains/${domainId}`;
  const deptUrl = `/admin/faculties/${facultyId}/departments/${departmentId}`;

  return (
    <div className="font-body">
      {/* Back */}
      <button
        onClick={() => navigate(domainUrl)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ChevronRight size={16} />
        {t("admin.backToDomain")}
      </button>

      {!filiere && filieres ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.filiereNotFound")}
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
                  <button
                    onClick={() => navigate(domainUrl)}
                    className="text-xs text-clay transition hover:text-forest"
                  >
                    {domain?.name}
                  </button>
                  <ChevronLeft size={12} className="text-clay/50" />
                  <span className="text-xs font-semibold text-sage">
                    {filiere?.name}
                  </span>
                </div>

                <h1 className="font-serif text-2xl font-bold text-forest">
                  {filiere?.name ?? "\u2026"}
                </h1>
                <p className="mt-1 text-sm text-clay">
                  {t("admin.filiereSpecializationsSubtitle")}
                </p>
              </div>

              {filiere?.code && (
                <span
                  className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                  dir="ltr"
                >
                  {filiere.code}
                </span>
              )}
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              <Plus size={18} />
              {t("admin.addSpecialization")}
            </button>
          </div>

          {/* Specializations */}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
              {t("admin.noSpecializations")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(s)}
                        className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-forest-deep">
                      {t(LEVEL_LABEL[s.level] ?? s.level)}
                    </span>
                  </div>

                  <h3 className="mb-3 text-right font-serif text-base font-bold text-forest">
                    {s.name}
                  </h3>

                  <div className="mt-auto flex items-center justify-end gap-3 border-t border-forest/10 pt-3 text-clay">
                    <span className="flex items-center gap-1 text-xs">
                      {s._count?.topics ?? 0} {t("admin.topicsShort")}
                      <BookOpen size={13} />
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      {s._count?.students ?? 0} {t("admin.studentsShort")}
                      <Users size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SpecializationFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        specialization={editing}
        filiereId={filiereId}
      />
    </div>
  );
}
