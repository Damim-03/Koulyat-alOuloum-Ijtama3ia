import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { BookOpen, GitBranch, GraduationCap, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDomains,
  useFilieresByDomain,
  useSpecializations,
  useDeleteSpecialization,
  useDeleteFiliere,
} from "../../hooks/admin-hook";
import type { Specialization } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { SpecializationFormDialog } from "../../components/dialog/faculty/specialization.form-dialog.form";
import { FiliereFormDialog } from "../../components/dialog/faculty/filter-dialog.form";
import { HierarchyHeader, HeaderBadge } from "../../components/ui/hierarchy-header";
import { DeleteNodeDialog, EmptyLevel, HeaderAction, NodeCard, NodeToolbar } from "../../components/ui/structure-kit";
import { Select } from "../../../../components/ui/select";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { matchesQuery } from "../../lib/structure-stats";
import i18n from "../../../../i18n/i18n";

const LEVELS = ["licence", "master", "doctorate"] as const;

/** The level's own colour, on the icon tile and the badge. */
const LEVEL_TINT: Record<string, string> = {
  licence: "border-sky-400/30 bg-sky-500/12 text-sky-600 dark:text-sky-300",
  master: "border-gold/35 bg-gold/15 text-gold",
  doctorate: "border-violet-400/30 bg-violet-500/12 text-violet-600 dark:text-violet-300",
};

/** A filiere: its figures and its specializations, each one opening its own page. */
export function FiliereDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "", departmentId = "", domainId = "", filiereId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains } = useDomains(departmentId);
  const { data: filieres } = useFilieresByDomain(domainId);
  const { data: specializations, isLoading } = useSpecializations();
  const deleteSpecialization = useDeleteSpecialization();
  const deleteFiliere = useDeleteFiliere();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Specialization | null>(null);
  const [editSelf, setEditSelf] = useState(false);
  const [removing, setRemoving] = useState<Specialization | null>(null);
  const [removeSelf, setRemoveSelf] = useState(false);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("name");
  const [chip, setChip] = useState("all");

  const faculty = useMemo(() => (faculties ?? []).find((f) => f.id === facultyId), [faculties, facultyId]);
  const department = useMemo(() => (departments ?? []).find((d) => d.id === departmentId), [departments, departmentId]);
  const domain = useMemo(() => (domains ?? []).find((dm) => dm.id === domainId), [domains, domainId]);
  const filiere = useMemo(() => (filieres ?? []).find((f) => f.id === filiereId), [filieres, filiereId]);
  const list = useMemo(
    () => (specializations ?? []).filter((s) => (s.filiereId ?? s.filiere?.id) === filiereId),
    [specializations, filiereId],
  );

  const students = (s: Specialization) => s._count?.students ?? 0;
  const topics = (s: Specialization) => s._count?.topics ?? 0;
  const visible = useMemo(
    () =>
      list
        .filter((s) => matchesQuery(q, s.name) && (!level || s.level === level))
        .filter((s) => chip !== "empty" || (s._count?.students ?? 0) === 0)
        .sort((a, b) =>
          sort === "students"
            ? (b._count?.students ?? 0) - (a._count?.students ?? 0)
            : sort === "topics"
              ? (b._count?.topics ?? 0) - (a._count?.topics ?? 0)
              : a.name.localeCompare(b.name, i18n.language),
        ),
    [list, q, level, chip, sort],
  );

  const total = {
    students: list.reduce((n, s) => n + students(s), 0),
    topics: list.reduce((n, s) => n + topics(s), 0),
  };
  const facultyUrl = `/admin/faculties/${facultyId}`;
  const deptUrl = `${facultyUrl}/departments/${departmentId}`;
  const domainUrl = `${deptUrl}/domains/${domainId}`;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="font-body">
      {!filiere && filieres ? (
        <EmptyLevel icon={GitBranch} title={t("admin.filiereNotFound")} />
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
            stats={[
              { icon: GraduationCap, label: t("admin.statSpecializations"), value: list.length, warn: list.length === 0 },
              ...LEVELS.map((l) => ({ icon: GraduationCap, label: t(`admin.proj.level.${l}`), value: list.filter((s) => s.level === l).length })),
              { icon: Users, label: t("admin.struct.students"), value: total.students },
              { icon: BookOpen, label: t("admin.struct.topics"), value: total.topics },
            ]}
            menu={
              <>
                <HeaderAction icon={Pencil} onClick={() => setEditSelf(true)}>
                  {t("admin.edit")}
                </HeaderAction>
                {list.length === 0 && (
                  <HeaderAction icon={Trash2} onClick={() => setRemoveSelf(true)}>
                    {t("admin.delete")}
                  </HeaderAction>
                )}
              </>
            }
            action={
              <HeaderAction icon={Plus} onClick={openCreate} primary>
                {t("admin.addSpecialization")}
              </HeaderAction>
            }
          />

          {list.length > 0 && (
            <NodeToolbar
              query={q}
              onQuery={setQ}
              placeholder={t("admin.struct.searchLevel.spec")}
              sort={sort}
              onSort={setSort}
              sortOptions={[
                { value: "name", label: t("admin.sortNameAsc") },
                { value: "students", label: t("admin.struct.sortStudents") },
                { value: "topics", label: t("admin.struct.sortTopics") },
              ]}
              chips={[
                { value: "all", label: t("admin.struct.all"), count: list.length },
                { value: "empty", label: t("admin.struct.health.noStudents"), count: list.filter((s) => students(s) === 0).length, tone: "warn" },
              ]}
              chip={chip}
              onChip={setChip}
              shown={visible.length}
              total={list.length}
              extra={
                <div className="w-full sm:w-44">
                  <Select
                    value={level}
                    onChange={setLevel}
                    aria-label={t("admin.specializationLevel")}
                    options={[
                      { value: "", label: t("admin.allLevels") },
                      ...LEVELS.map((l) => ({ value: l, label: t(`admin.proj.level.${l}`) })),
                    ]}
                  />
                </div>
              }
            />
          )}

          {isLoading ? (
            <LoadingArea className="py-20" />
          ) : list.length === 0 ? (
            <EmptyLevel
              icon={GraduationCap}
              title={t("admin.noSpecializations")}
              hint={t("admin.struct.emptyHint.spec")}
              actionLabel={t("admin.addSpecialization")}
              onAction={openCreate}
            />
          ) : visible.length === 0 ? (
            <EmptyLevel icon={GraduationCap} title={t("admin.noFilterResults")} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
              {visible.map((s) => {
                const blockers = [
                  students(s) > 0 && t("admin.struct.n.students", { count: students(s) }),
                  topics(s) > 0 && t("admin.struct.n.topics", { count: topics(s) }),
                ].filter(Boolean);
                return (
                  <NodeCard
                    key={s.id}
                    testId="spec-card"
                    to={`/admin/specializations/${s.id}`}
                    icon={GraduationCap}
                    iconTint={LEVEL_TINT[s.level]}
                    coverUrl={s.coverUrl}
                    title={s.name}
                    badge={
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${LEVEL_TINT[s.level] ?? ""}`}>
                        {t(`admin.proj.level.${s.level}`)}
                      </span>
                    }
                    stats={[
                      { icon: Users, label: t("admin.struct.students"), value: students(s) },
                      { icon: BookOpen, label: t("admin.struct.topics"), value: topics(s) },
                    ]}
                    health={
                      students(s) === 0
                        ? { tone: "info", label: t("admin.struct.health.noStudents"), detail: t("admin.struct.health.noStudentsHint") }
                        : topics(s) === 0
                          ? { tone: "info", label: t("admin.struct.health.noTopics"), detail: t("admin.struct.health.noTopicsHint") }
                          : null
                    }
                    onEdit={() => {
                      setEditing(s);
                      setDialogOpen(true);
                    }}
                    onDelete={() => setRemoving(s)}
                    deleteBlocked={blockers.length ? t("admin.struct.blocked", { what: blockers.join("، ") }) : null}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <SpecializationFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} specialization={editing} filiereId={filiereId} />
      <FiliereFormDialog open={editSelf} onClose={() => setEditSelf(false)} filiere={filiere ?? null} domainId={domainId} />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.spec")}
        loading={deleteSpecialization.isPending}
        onConfirm={() => removing && deleteSpecialization.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
      <DeleteNodeDialog
        target={removeSelf && filiere ? filiere : null}
        title={t("admin.struct.deleteTitle.filiere")}
        loading={deleteFiliere.isPending}
        onConfirm={() => deleteFiliere.mutate(filiereId, { onSuccess: () => navigate(domainUrl) })}
        onClose={() => setRemoveSelf(false)}
      />
    </div>
  );
}
