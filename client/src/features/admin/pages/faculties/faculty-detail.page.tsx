import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { BookOpen, Building2, GitBranch, GraduationCap, Layers, Network, Pencil, Plus, Trash2, UserCog, Users } from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDeleteDepartment,
  useDeleteFaculty,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";
import type { Department } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { DepartmentFormDialog } from "../../components/dialog/department/department-dialog.form";
import { FacultyFormDialog } from "../../components/dialog/faculty/faculty-dialog.form";
import { HierarchyHeader, HeaderBadge } from "../../components/ui/hierarchy-header";
import { DeleteNodeDialog, EmptyLevel, HeaderAction, NodeCard, NodeToolbar } from "../../components/ui/structure-kit";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { buildReach, matchesQuery } from "../../lib/structure-stats";
import i18n from "../../../../i18n/i18n";

/** A faculty: its figures, its departments, and what each of them reaches. */
export function FacultyDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments, isLoading } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const deleteDepartment = useDeleteDepartment();
  const deleteFaculty = useDeleteFaculty();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [editSelf, setEditSelf] = useState(false);
  const [removing, setRemoving] = useState<Department | null>(null);
  const [removeSelf, setRemoveSelf] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [chip, setChip] = useState("all");

  const faculty = useMemo(() => (faculties ?? []).find((f) => f.id === facultyId), [faculties, facultyId]);
  const list = useMemo(
    () => (departments ?? []).filter((d) => (d.facultyId ?? d.faculty?.id) === facultyId),
    [departments, facultyId],
  );
  const reach = useMemo(() => buildReach(departments ?? [], filieres ?? [], specs ?? []), [departments, filieres, specs]);
  const empty = (d: Department) => (d._count?.filieres ?? 0) === 0;

  const visible = useMemo(
    () =>
      list
        .filter((d) => matchesQuery(q, d.name, d.code))
        .filter((d) => chip !== "gaps" || empty(d))
        .sort((a, b) =>
          sort === "students"
            ? reach.department(b.id).students - reach.department(a.id).students
            : sort === "specs"
              ? reach.department(b.id).specializations - reach.department(a.id).specializations
              : a.name.localeCompare(b.name, i18n.language),
        ),
    [list, q, chip, sort, reach],
  );

  const r = reach.faculty(facultyId);
  const domains = list.reduce((n, d) => n + (d._count?.domains ?? 0), 0);
  const fils = list.reduce((n, d) => n + (d._count?.filieres ?? 0), 0);
  const gaps = list.filter(empty).length;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="font-body">
      {!faculty && faculties ? (
        <EmptyLevel icon={Building2} title={t("admin.facultyNotFound")} />
      ) : (
        <>
          <HierarchyHeader
            crumbs={[{ label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" }, { label: faculty?.name }]}
            backLabel={t("admin.backToFaculties")}
            backTo="/admin/faculties"
            icon={Building2}
            title={faculty?.name ?? "…"}
            subtitle={t("admin.facultyDepartmentsSubtitle")}
            code={faculty?.code}
            coverUrl={faculty?.coverUrl}
            badges={
              <HeaderBadge>
                {list.length} {t("admin.departmentsShort")}
              </HeaderBadge>
            }
            stats={[
              { icon: Network, label: t("admin.statDepartments"), value: list.length },
              { icon: Layers, label: t("admin.statDomains"), value: domains },
              { icon: GitBranch, label: t("admin.statFilieres"), value: fils },
              { icon: GraduationCap, label: t("admin.statSpecializations"), value: r.specializations, warn: list.length > 0 && r.specializations === 0 },
              { icon: Users, label: t("admin.struct.students"), value: r.students },
              { icon: UserCog, label: t("admin.struct.professors"), value: r.professors },
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
                {t("admin.addDepartment")}
              </HeaderAction>
            }
          />

          {list.length > 0 && (
            <NodeToolbar
              query={q}
              onQuery={setQ}
              placeholder={t("admin.struct.searchLevel.department")}
              sort={sort}
              onSort={setSort}
              sortOptions={[
                { value: "name", label: t("admin.sortNameAsc") },
                { value: "specs", label: t("admin.struct.sortSpecs") },
                { value: "students", label: t("admin.struct.sortStudents") },
              ]}
              chips={[
                { value: "all", label: t("admin.struct.all"), count: list.length },
                { value: "gaps", label: t("admin.struct.health.deptEmpty"), count: gaps, tone: "warn" },
              ]}
              chip={chip}
              onChip={setChip}
              shown={visible.length}
              total={list.length}
            />
          )}

          {isLoading ? (
            <LoadingArea className="py-20" />
          ) : list.length === 0 ? (
            <EmptyLevel icon={Network} title={t("admin.noDepartments")} hint={t("admin.struct.emptyHint.department")} actionLabel={t("admin.addDepartment")} onAction={openCreate} />
          ) : visible.length === 0 ? (
            <EmptyLevel icon={Network} title={t("admin.noFilterResults")} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
              {visible.map((d) => {
                const dr = reach.department(d.id);
                const blockers = [
                  (d._count?.domains ?? 0) > 0 && t("admin.struct.n.domains", { count: d._count?.domains }),
                  (d._count?.filieres ?? 0) > 0 && t("admin.struct.n.filieres", { count: d._count?.filieres }),
                  (d._count?.professors ?? 0) > 0 && t("admin.struct.n.professors", { count: d._count?.professors }),
                ].filter(Boolean);
                return (
                  <NodeCard
                    key={d.id}
                    testId="department-card"
                    to={`/admin/faculties/${facultyId}/departments/${d.id}`}
                    icon={Network}
                    coverUrl={d.coverUrl}
                    code={d.code}
                    title={d.name}
                    stats={[
                      { icon: Layers, label: t("admin.statDomains"), value: d._count?.domains ?? 0 },
                      { icon: GitBranch, label: t("admin.statFilieres"), value: d._count?.filieres ?? 0 },
                      { icon: GraduationCap, label: t("admin.statSpecializations"), value: dr.specializations },
                    ]}
                    people={[
                      { icon: Users, label: t("admin.struct.students"), value: dr.students },
                      { icon: UserCog, label: t("admin.struct.professors"), value: d._count?.professors ?? 0 },
                      { icon: BookOpen, label: t("admin.struct.topics"), value: dr.topics },
                    ]}
                    health={
                      empty(d)
                        ? { tone: "warn", label: t("admin.struct.health.deptEmpty"), detail: t("admin.struct.health.deptEmptyHint") }
                        : dr.specializations === 0
                          ? { tone: "warn", label: t("admin.struct.health.noSpecs"), detail: t("admin.struct.health.noSpecsHint") }
                          : null
                    }
                    onEdit={() => {
                      setEditing(d);
                      setDialogOpen(true);
                    }}
                    onDelete={() => setRemoving(d)}
                    deleteBlocked={blockers.length ? t("admin.struct.blocked", { what: blockers.join("، ") }) : null}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <DepartmentFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} department={editing} facultyId={facultyId} />
      <FacultyFormDialog open={editSelf} onClose={() => setEditSelf(false)} faculty={faculty ?? null} />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.department")}
        loading={deleteDepartment.isPending}
        onConfirm={() => removing && deleteDepartment.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
      <DeleteNodeDialog
        target={removeSelf && faculty ? faculty : null}
        title={t("admin.struct.deleteTitle.faculty")}
        loading={deleteFaculty.isPending}
        onConfirm={() => deleteFaculty.mutate(facultyId, { onSuccess: () => navigate("/admin/faculties") })}
        onClose={() => setRemoveSelf(false)}
      />
    </div>
  );
}
