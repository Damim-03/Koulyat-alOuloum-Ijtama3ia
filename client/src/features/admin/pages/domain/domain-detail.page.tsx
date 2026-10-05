import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { BookOpen, GitBranch, GraduationCap, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useFilieres,
  useFilieresByDomain,
  useDeleteFiliere,
  useDeleteDomain,
  useDomains,
  useSpecializations,
} from "../../hooks/admin-hook";
import type { Filiere } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { FiliereFormDialog } from "../../components/dialog/faculty/filter-dialog.form";
import { DomainFormDialog } from "../../components/dialog/domain/domain-dialog.form";
import { HierarchyHeader, HeaderBadge } from "../../components/ui/hierarchy-header";
import { DeleteNodeDialog, EmptyLevel, HeaderAction, NodeCard, NodeToolbar } from "../../components/ui/structure-kit";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { buildReach, matchesQuery } from "../../lib/structure-stats";
import i18n from "../../../../i18n/i18n";

const LEVELS = ["licence", "master", "doctorate"] as const;

/** A domain: its figures, its filieres, and the levels each one teaches. */
export function DomainDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "", departmentId = "", domainId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains } = useDomains(departmentId);
  const { data: filieres, isLoading } = useFilieresByDomain(domainId);
  const { data: allFilieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const deleteFiliere = useDeleteFiliere();
  const deleteDomain = useDeleteDomain();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Filiere | null>(null);
  const [editSelf, setEditSelf] = useState(false);
  const [removing, setRemoving] = useState<Filiere | null>(null);
  const [removeSelf, setRemoveSelf] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [chip, setChip] = useState("all");

  const faculty = useMemo(() => (faculties ?? []).find((f) => f.id === facultyId), [faculties, facultyId]);
  const department = useMemo(() => (departments ?? []).find((d) => d.id === departmentId), [departments, departmentId]);
  const domain = useMemo(() => (domains ?? []).find((dm) => dm.id === domainId), [domains, domainId]);
  const list = useMemo(() => filieres ?? [], [filieres]);
  const reach = useMemo(() => buildReach(departments ?? [], allFilieres ?? [], specs ?? []), [departments, allFilieres, specs]);

  const specsOf = (f: Filiere) => reach.filiere(f.id).specializations;
  const visible = useMemo(
    () =>
      list
        .filter((f) => matchesQuery(q, f.name, f.code))
        .filter((f) => chip !== "gaps" || reach.filiere(f.id).specializations === 0)
        .sort((a, b) =>
          sort === "students"
            ? reach.filiere(b.id).students - reach.filiere(a.id).students
            : sort === "specs"
              ? reach.filiere(b.id).specializations - reach.filiere(a.id).specializations
              : a.name.localeCompare(b.name, i18n.language),
        ),
    [list, q, chip, sort, reach],
  );

  const r = reach.domain(domainId);
  const facultyUrl = `/admin/faculties/${facultyId}`;
  const deptUrl = `${facultyUrl}/departments/${departmentId}`;
  const domainUrl = `${deptUrl}/domains/${domainId}`;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="font-body">
      {!domain && domains ? (
        <EmptyLevel icon={Layers} title={t("admin.domainNotFound")} />
      ) : (
        <>
          <HierarchyHeader
            crumbs={[
              { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
              { label: faculty?.name, to: facultyUrl },
              { label: department?.name, to: deptUrl },
              { label: domain?.name },
            ]}
            backLabel={t("admin.backToDepartment")}
            backTo={deptUrl}
            icon={Layers}
            title={domain?.name ?? "…"}
            subtitle={t("admin.domainFilieresSubtitle")}
            code={domain?.code}
            coverUrl={domain?.coverUrl}
            badges={
              <HeaderBadge>
                {list.length} {t("admin.filieresShort")}
              </HeaderBadge>
            }
            stats={[
              { icon: GitBranch, label: t("admin.statFilieres"), value: list.length },
              { icon: GraduationCap, label: t("admin.statSpecializations"), value: r.specializations, warn: list.length > 0 && r.specializations === 0 },
              ...LEVELS.map((l) => ({ icon: GraduationCap, label: t(`admin.proj.level.${l}`), value: r.levels[l] ?? 0 })),
              { icon: Users, label: t("admin.struct.students"), value: r.students },
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
                {t("admin.addFiliere")}
              </HeaderAction>
            }
          />

          {list.length > 0 && (
            <NodeToolbar
              query={q}
              onQuery={setQ}
              placeholder={t("admin.struct.searchLevel.filiere")}
              sort={sort}
              onSort={setSort}
              sortOptions={[
                { value: "name", label: t("admin.sortNameAsc") },
                { value: "specs", label: t("admin.struct.sortSpecs") },
                { value: "students", label: t("admin.struct.sortStudents") },
              ]}
              chips={[
                { value: "all", label: t("admin.struct.all"), count: list.length },
                { value: "gaps", label: t("admin.struct.health.filiereEmpty"), count: list.filter((f) => specsOf(f) === 0).length, tone: "warn" },
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
            <EmptyLevel icon={GitBranch} title={t("admin.noFilieres")} hint={t("admin.struct.emptyHint.filiere")} actionLabel={t("admin.addFiliere")} onAction={openCreate} />
          ) : visible.length === 0 ? (
            <EmptyLevel icon={GitBranch} title={t("admin.noFilterResults")} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
              {visible.map((f) => {
                const fr = reach.filiere(f.id);
                return (
                  <NodeCard
                    key={f.id}
                    testId="filiere-card"
                    to={`${domainUrl}/filieres/${f.id}`}
                    icon={GitBranch}
                    coverUrl={f.coverUrl}
                    code={f.code}
                    title={f.name}
                    stats={[
                      { icon: GraduationCap, label: t("admin.statSpecializations"), value: fr.specializations },
                      { icon: Users, label: t("admin.struct.students"), value: fr.students },
                      { icon: BookOpen, label: t("admin.struct.topics"), value: fr.topics },
                    ]}
                    badge={
                      fr.specializations > 0 ? (
                        <span className="inline-flex gap-1">
                          {LEVELS.filter((l) => fr.levels[l]).map((l) => (
                            <span key={l} className="rounded-full bg-forest/6 px-1.5 py-0.5 text-[10px] font-semibold text-forest">
                              {t(`admin.proj.level.${l}`)} {fr.levels[l]}
                            </span>
                          ))}
                        </span>
                      ) : undefined
                    }
                    health={
                      fr.specializations === 0
                        ? { tone: "warn", label: t("admin.struct.health.filiereEmpty"), detail: t("admin.struct.health.filiereEmptyHint") }
                        : null
                    }
                    onEdit={() => {
                      setEditing(f);
                      setDialogOpen(true);
                    }}
                    onDelete={() => setRemoving(f)}
                    deleteBlocked={
                      fr.specializations > 0 ? t("admin.struct.blocked", { what: t("admin.struct.n.specs", { count: fr.specializations }) }) : null
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <FiliereFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} filiere={editing} domainId={domainId} />
      <DomainFormDialog open={editSelf} onClose={() => setEditSelf(false)} domain={domain ?? null} departmentId={departmentId} />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.filiere")}
        loading={deleteFiliere.isPending}
        onConfirm={() => removing && deleteFiliere.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
      <DeleteNodeDialog
        target={removeSelf && domain ? domain : null}
        title={t("admin.struct.deleteTitle.domain")}
        loading={deleteDomain.isPending}
        onConfirm={() => deleteDomain.mutate(domainId, { onSuccess: () => navigate(deptUrl) })}
        onClose={() => setRemoveSelf(false)}
      />
    </div>
  );
}
