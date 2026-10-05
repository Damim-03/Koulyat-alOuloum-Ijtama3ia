import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { BookOpen, GitBranch, GraduationCap, Layers, Network, Pencil, Plus, Trash2, TriangleAlert, UserCog, Users } from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDomains,
  useDeleteDomain,
  useDeleteDepartment,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";
import type { Domain } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { DomainFormDialog } from "../../components/dialog/domain/domain-dialog.form";
import { DepartmentFormDialog } from "../../components/dialog/department/department-dialog.form";
import { HierarchyHeader, HeaderBadge } from "../../components/ui/hierarchy-header";
import { DeleteNodeDialog, EmptyLevel, HeaderAction, NodeCard, NodeToolbar } from "../../components/ui/structure-kit";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { buildReach, matchesQuery } from "../../lib/structure-stats";
import i18n from "../../../../i18n/i18n";

/** A department: its figures, its domains, and the filieres no domain holds. */
export function DepartmentDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "", departmentId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains, isLoading } = useDomains(departmentId);
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const deleteDomain = useDeleteDomain();
  const deleteDepartment = useDeleteDepartment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [editSelf, setEditSelf] = useState(false);
  const [removing, setRemoving] = useState<Domain | null>(null);
  const [removeSelf, setRemoveSelf] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [chip, setChip] = useState("all");

  const faculty = useMemo(() => (faculties ?? []).find((f) => f.id === facultyId), [faculties, facultyId]);
  const department = useMemo(() => (departments ?? []).find((d) => d.id === departmentId), [departments, departmentId]);
  const list = useMemo(() => domains ?? [], [domains]);
  const reach = useMemo(() => buildReach(departments ?? [], filieres ?? [], specs ?? []), [departments, filieres, specs]);
  // Filieres of this department that sit under no domain: no domain page reaches them.
  const loose = useMemo(() => (filieres ?? []).filter((f) => f.departmentId === departmentId && !f.domainId), [filieres, departmentId]);

  const empty = (dm: Domain) => (dm._count?.filieres ?? 0) === 0;
  const visible = useMemo(
    () =>
      list
        .filter((dm) => matchesQuery(q, dm.name, dm.code))
        .filter((dm) => chip !== "gaps" || empty(dm))
        .sort((a, b) =>
          sort === "students"
            ? reach.domain(b.id).students - reach.domain(a.id).students
            : sort === "specs"
              ? reach.domain(b.id).specializations - reach.domain(a.id).specializations
              : a.name.localeCompare(b.name, i18n.language),
        ),
    [list, q, chip, sort, reach],
  );

  const r = reach.department(departmentId);
  const facultyUrl = `/admin/faculties/${facultyId}`;
  const domainUrl = (id: string) => `${facultyUrl}/departments/${departmentId}/domains/${id}`;
  const c = department?._count;
  const selfBlocked = (c?.domains ?? 0) + (c?.filieres ?? 0) + (c?.professors ?? 0) > 0;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="font-body">
      {!department && departments ? (
        <EmptyLevel icon={Network} title={t("admin.departmentNotFound")} />
      ) : (
        <>
          <HierarchyHeader
            crumbs={[
              { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
              { label: faculty?.name, to: facultyUrl },
              { label: department?.name },
            ]}
            backLabel={t("admin.backToFaculty")}
            backTo={facultyUrl}
            icon={Network}
            title={department?.name ?? "…"}
            subtitle={t("admin.departmentDomainsSubtitle")}
            code={department?.code}
            coverUrl={department?.coverUrl}
            badges={
              <HeaderBadge>
                {list.length} {t("admin.domainsShort")}
              </HeaderBadge>
            }
            stats={[
              { icon: Layers, label: t("admin.statDomains"), value: list.length },
              { icon: GitBranch, label: t("admin.statFilieres"), value: c?.filieres ?? 0 },
              { icon: GraduationCap, label: t("admin.statSpecializations"), value: r.specializations },
              { icon: Users, label: t("admin.struct.students"), value: r.students },
              { icon: UserCog, label: t("admin.struct.professors"), value: c?.professors ?? 0 },
              { icon: BookOpen, label: t("admin.struct.topics"), value: r.topics },
            ]}
            menu={
              <>
                <HeaderAction icon={Pencil} onClick={() => setEditSelf(true)}>
                  {t("admin.edit")}
                </HeaderAction>
                {!selfBlocked && (
                  <HeaderAction icon={Trash2} onClick={() => setRemoveSelf(true)}>
                    {t("admin.delete")}
                  </HeaderAction>
                )}
              </>
            }
            action={
              <HeaderAction icon={Plus} onClick={openCreate} primary>
                {t("admin.addDomain")}
              </HeaderAction>
            }
          />

          {loose.length > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0 text-[12.5px] leading-relaxed text-forest">
                <p className="font-semibold">{t("admin.struct.looseTitle", { count: loose.length })}</p>
                <p className="mt-0.5 text-clay">{t("admin.struct.looseHint")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {loose.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-cream-card px-2.5 py-1 text-[11.5px] font-semibold text-forest">
                      <GitBranch size={12} className="text-amber-600 dark:text-amber-300" />
                      {f.name}
                      {f.code && (
                        <span dir="ltr" className="font-mono text-[10px] text-gold">
                          {f.code}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {list.length > 0 && (
            <NodeToolbar
              query={q}
              onQuery={setQ}
              placeholder={t("admin.struct.searchLevel.domain")}
              sort={sort}
              onSort={setSort}
              sortOptions={[
                { value: "name", label: t("admin.sortNameAsc") },
                { value: "specs", label: t("admin.struct.sortSpecs") },
                { value: "students", label: t("admin.struct.sortStudents") },
              ]}
              chips={[
                { value: "all", label: t("admin.struct.all"), count: list.length },
                { value: "gaps", label: t("admin.struct.health.domainEmpty"), count: list.filter(empty).length, tone: "warn" },
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
            <EmptyLevel icon={Layers} title={t("admin.noDomains")} hint={t("admin.struct.emptyHint.domain")} actionLabel={t("admin.addDomain")} onAction={openCreate} />
          ) : visible.length === 0 ? (
            <EmptyLevel icon={Layers} title={t("admin.noFilterResults")} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
              {visible.map((dm) => {
                const dr = reach.domain(dm.id);
                const n = dm._count?.filieres ?? 0;
                return (
                  <NodeCard
                    key={dm.id}
                    testId="domain-card"
                    to={domainUrl(dm.id)}
                    icon={Layers}
                    coverUrl={dm.coverUrl}
                    code={dm.code}
                    title={dm.name}
                    stats={[
                      { icon: GitBranch, label: t("admin.statFilieres"), value: n },
                      { icon: GraduationCap, label: t("admin.statSpecializations"), value: dr.specializations },
                      { icon: Users, label: t("admin.struct.students"), value: dr.students },
                    ]}
                    people={[{ icon: BookOpen, label: t("admin.struct.topics"), value: dr.topics }]}
                    health={
                      n === 0
                        ? { tone: "warn", label: t("admin.struct.health.domainEmpty"), detail: t("admin.struct.health.domainEmptyHint") }
                        : dr.specializations === 0
                          ? { tone: "warn", label: t("admin.struct.health.noSpecs"), detail: t("admin.struct.health.noSpecsHint") }
                          : null
                    }
                    onEdit={() => {
                      setEditing(dm);
                      setDialogOpen(true);
                    }}
                    onDelete={() => setRemoving(dm)}
                    deleteBlocked={n > 0 ? t("admin.struct.blocked", { what: t("admin.struct.n.filieres", { count: n }) }) : null}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <DomainFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} domain={editing} departmentId={departmentId} />
      <DepartmentFormDialog open={editSelf} onClose={() => setEditSelf(false)} department={department ?? null} facultyId={facultyId} />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.domain")}
        loading={deleteDomain.isPending}
        onConfirm={() => removing && deleteDomain.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
      <DeleteNodeDialog
        target={removeSelf && department ? department : null}
        title={t("admin.struct.deleteTitle.department")}
        loading={deleteDepartment.isPending}
        onConfirm={() => deleteDepartment.mutate(departmentId, { onSuccess: () => navigate(facultyUrl) })}
        onClose={() => setRemoveSelf(false)}
      />
    </div>
  );
}
