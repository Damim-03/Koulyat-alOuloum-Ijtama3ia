import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
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
} from "../../hooks/admin-hook";
import type { Specialization } from "../../../../types/admin";
import { SpecializationFormDialog } from "../../components/dialog/faculty/specialization.form-dialog.form";
import { CoverBanner } from "../../components/ui/cover-banner";
import { SearchField } from "../../components/ui/search-field";
import {
  HierarchyHeader,
  HeaderBadge,
} from "../../components/ui/hierarchy-header";

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

  // Client-side filters: the list arrives whole, so no request is needed.
  // A specialization carries no code, so the level stands in for one.
  const [nameQuery, setNameQuery] = useState("");
  const [level, setLevel] = useState("");
  const visible = useMemo(() => {
    const n = nameQuery.trim().toLowerCase();
    return list.filter(
      (s) =>
        (!n || (s.name ?? "").toLowerCase().includes(n)) &&
        (!level || s.level === level),
    );
  }, [list, nameQuery, level]);

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
      {!filiere && filieres ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.filiereNotFound")}
        </div>
      ) : (
        <>
          <HierarchyHeader
            crumbs={[
              { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
              { label: faculty?.name, to: facultyUrl },
              { label: department?.name, to: deptUrl },
              { label: domain?.name, to: domainUrl },
              { label: filiere?.name },
            ]}
            backLabel={t("admin.backToDomain")}
            backTo={domainUrl}
            icon={GitBranch}
            title={filiere?.name ?? "…"}
            subtitle={t("admin.filiereSpecializationsSubtitle")}
            code={filiere?.code}
            coverUrl={filiere?.coverUrl}
            badges={
              <HeaderBadge>
                {list.length} {t("admin.specializationsShort")}
              </HeaderBadge>
            }
            action={
              <button
                onClick={openCreate}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-[0.98]"
              >
                <Plus size={18} />
                {t("admin.addSpecialization")}
              </button>
            }
          />

          {/* Filters — one field per identifier, as on the other lists. */}
          {list.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] md:grid-cols-2">
              <SearchField
                icon={Search}
                label={t("admin.filterByName")}
                placeholder={t("admin.filterNamePlaceholder")}
                value={nameQuery}
                onChange={setNameQuery}
              />
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-clay">
                  {t("admin.specializationLevel")}
                </span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="">{t("admin.allLevels")}</option>
                  <option value="licence">{t("admin.levelLicence")}</option>
                  <option value="master">{t("admin.levelMaster")}</option>
                  <option value="doctorate">{t("admin.levelDoctorate")}</option>
                </select>
              </label>
            </div>
          )}

          {/* Specializations */}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
              {t("admin.noSpecializations")}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
              {t("admin.noFilterResults")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((s) => {
                const tint =
                  LEVEL_TINT[s.level] ?? "bg-soft-sage/30 text-forest";
                return (
                  <div
                    key={s.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40"
                  >
                    <div className="p-5">
                      <CoverBanner src={s.coverUrl} />
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
