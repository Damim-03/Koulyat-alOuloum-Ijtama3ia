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
  GitBranch,
  GraduationCap,
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

/** لون مميّز لكل مستوى (يُستخدم لصندوق الأيقونة وشارة المستوى). */
const LEVEL_TINT: Record<string, string> = {
  licence: "bg-soft-sage/30 text-forest",
  master: "bg-gold/15 text-gold",
  doctorate: "bg-sage/20 text-sage",
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

  const facultyUrl = `/admin/faculties/${facultyId}`;
  const deptUrl = `/admin/faculties/${facultyId}/departments/${departmentId}`;
  const domainUrl = `${deptUrl}/domains/${domainId}`;

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

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-forest text-cream">
                <GitBranch size={30} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-serif text-2xl font-bold text-forest">
                    {filiere?.name ?? "\u2026"}
                  </h1>
                  {filiere?.code && (
                    <span
                      className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                      dir="ltr"
                    >
                      {filiere.code}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] font-medium text-forest">
                    {list.length} {t("admin.specializationsShort")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-clay">
                  {t("admin.filiereSpecializationsSubtitle")}
                </p>
              </div>
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-[0.98]"
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => {
                const tint =
                  LEVEL_TINT[s.level] ?? "bg-soft-sage/30 text-forest";
                return (
                  <div
                    key={s.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40"
                  >
                    <div className="p-5">
                      <div className="mb-4 flex items-start justify-between">
                        <div
                          className={`grid size-14 place-items-center rounded-xl ${tint}`}
                        >
                          <GraduationCap size={26} />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            title={t("admin.edit")}
                            className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            title={t("admin.delete")}
                            className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tint}`}
                        >
                          {t(LEVEL_LABEL[s.level] ?? s.level)}
                        </span>
                        <h3 className="font-serif text-lg font-bold text-forest">
                          {s.name}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-forest/10 bg-cream-2 px-5 py-3.5 text-clay">
                      <span className="flex items-center gap-1.5 text-xs">
                        <BookOpen size={14} />
                        {s._count?.topics ?? 0} {t("admin.topicsShort")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs">
                        <Users size={14} />
                        {s._count?.students ?? 0} {t("admin.studentsShort")}
                      </span>
                    </div>
                  </div>
                );
              })}
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
