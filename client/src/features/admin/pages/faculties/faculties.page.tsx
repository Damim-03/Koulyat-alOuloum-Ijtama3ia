import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Building2,
  GitBranch,
  GraduationCap,
  LayoutGrid,
  Layers,
  Layers3,
  ListTree,
  Network,
  Plus,
  Sparkles,
  TriangleAlert,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useFaculties,
  useDeleteFaculty,
  useDepartments,
  useDomains,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";
import type { Faculty } from "../../../../types/admin";
import { FacultyFormDialog } from "../../components/dialog/faculty/faculty-dialog.form";
import { AcademicStructureWizard } from "../../components/dialog/academic/academic-structure-wizard";
import { AcademicYearsPanel } from "../../components/academic/academic-years-panel";
import i18n from "../../../../i18n/i18n";
import { buildFacultyIndex, hasGap, type FacultyGaps } from "../../lib/faculty-index";
import { buildReach } from "../../lib/structure-stats";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { DeleteNodeDialog, EmptyLevel, NodeCard, NodeToolbar, type NodeHealth } from "../../components/ui/structure-kit";
import { StructureTree } from "./structure-tree";

/**
 * The academic structure, from the top.
 *
 * The university's figures across every level; the faculties as cards — what
 * each holds and reaches, and where its chain is broken — or the whole
 * structure as one tree; and the academic years that frame it all.
 */

type SortKey = "name" | "departments" | "students";

/** Reads a relation counter from `_count` (0 until the server sends it). */
function countOf(f: Faculty, key: string): number {
  const c = (f as unknown as { _count?: Record<string, number> })._count;
  return c?.[key] ?? 0;
}

export function AdminFacultiesPage() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const view = sp.get("view") === "tree" ? "tree" : "cards";

  const { data: faculties, isLoading, isError, refetch } = useFaculties();
  const deleteFaculty = useDeleteFaculty();
  const { data: departments } = useDepartments();
  const { data: domains } = useDomains();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [removing, setRemoving] = useState<Faculty | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [chip, setChip] = useState("all");

  const list = useMemo(() => faculties ?? [], [faculties]);
  const index = useMemo(
    () => buildFacultyIndex(list, departments ?? [], filieres ?? [], specs ?? []),
    [list, departments, filieres, specs],
  );
  const reach = useMemo(() => buildReach(departments ?? [], filieres ?? [], specs ?? []), [departments, filieres, specs]);

  const needing = list.filter((f) => {
    const g = index.get(f.id)?.gaps;
    return g && hasGap(g);
  }).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((f) => !q || index.get(f.id)?.haystack.includes(q))
      .filter((f) => {
        if (chip !== "gaps") return true;
        const g = index.get(f.id)?.gaps;
        return !!g && hasGap(g);
      })
      .sort((a, b) =>
        sort === "departments"
          ? countOf(b, "departments") - countOf(a, "departments")
          : sort === "students"
            ? reach.faculty(b.id).students - reach.faculty(a.id).students
            : a.name.localeCompare(b.name, i18n.language),
      );
  }, [list, search, sort, chip, index, reach]);

  function setView(v: "cards" | "tree") {
    const next = new URLSearchParams(sp);
    if (v === "tree") next.set("view", "tree");
    else next.delete("view");
    setSp(next, { replace: true });
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  const total = reach.total;
  const sum = (k: string) => list.reduce((n, f) => n + countOf(f, k), 0);
  const tiles: { icon: LucideIcon; label: string; value: number; warn?: boolean }[] = [
    { icon: Building2, label: t("admin.struct.kindPlural.faculty"), value: list.length },
    { icon: Network, label: t("admin.statDepartments"), value: sum("departments") },
    { icon: Layers, label: t("admin.statDomains"), value: sum("domains") },
    { icon: GitBranch, label: t("admin.statFilieres"), value: sum("filieres") },
    { icon: GraduationCap, label: t("admin.statSpecializations"), value: total.specializations },
    { icon: Users, label: t("admin.struct.students"), value: total.students },
    { icon: UserCog, label: t("admin.struct.professors"), value: total.professors },
    { icon: BookOpen, label: t("admin.struct.topics"), value: total.topics },
  ];

  return (
    <div className="font-body">
      {/* ── hero ── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-6 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
                <Building2 size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.struct.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">{t("admin.facultiesTitle")}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.struct.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-cream/10 px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream/20"
              >
                <Layers3 size={17} className="text-gold-soft" />
                {t("admin.addAcademicStructure")}
              </button>
              <button
                type="button"
                onClick={openCreate}
                data-testid="faculty-add"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
              >
                <Plus size={17} />
                {t("admin.addFaculty")}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {tiles.map((x) => (
              <div key={x.label} className="rounded-2xl border border-white/10 bg-cream/5 p-3.5 backdrop-blur-sm">
                <span className="mb-2 flex items-center gap-1.5 text-[11px] text-cream/70">
                  <x.icon size={14} className="text-gold-soft" />
                  <span className="truncate">{x.label}</span>
                </span>
                <b className="block font-serif text-2xl leading-none text-cream tabular-nums">{x.value}</b>
              </div>
            ))}
          </div>
          {needing > 0 && (
            <button
              type="button"
              onClick={() => {
                setChip("gaps");
                setView("cards");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3.5 py-1.5 text-[12px] font-semibold text-amber-100 transition hover:bg-amber-400/20"
            >
              <TriangleAlert size={13} className="text-amber-200" />
              {t("admin.struct.needing", { count: needing })}
            </button>
          )}
        </div>
      </section>

      <NodeToolbar
        query={search}
        onQuery={setSearch}
        placeholder={t("admin.searchFaculty")}
        sort={sort}
        onSort={(v) => setSort(v as SortKey)}
        sortOptions={[
          { value: "name", label: t("admin.sortNameAsc") },
          { value: "departments", label: t("admin.sortDepartmentsDesc") },
          { value: "students", label: t("admin.struct.sortStudents") },
        ]}
        chips={
          view === "cards"
            ? [
                { value: "all", label: t("admin.struct.all"), count: list.length },
                { value: "gaps", label: t("admin.needsCompletion"), count: needing, tone: "warn" },
              ]
            : undefined
        }
        chip={chip}
        onChip={setChip}
        shown={visible.length}
        total={list.length}
        extra={
          <div className="flex h-11 items-center rounded-xl border border-forest/15 p-1" role="group" aria-label={t("admin.struct.view")}>
            <ViewBtn on={view === "cards"} onClick={() => setView("cards")} icon={LayoutGrid} label={t("admin.struct.viewCards")} />
            <ViewBtn on={view === "tree"} onClick={() => setView("tree")} icon={ListTree} label={t("admin.struct.viewTree")} />
          </div>
        }
      />

      {isLoading ? (
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyLevel icon={GraduationCap} title={t("admin.noFaculties")} hint={t("admin.noFacultiesHint")} actionLabel={t("admin.addFaculty")} onAction={openCreate} />
      ) : view === "tree" ? (
        <StructureTree
          faculties={[...list].sort((a, b) => a.name.localeCompare(b.name, i18n.language))}
          departments={departments ?? []}
          domains={domains ?? []}
          filieres={filieres ?? []}
          specs={specs ?? []}
          reach={reach}
          query={search}
        />
      ) : visible.length === 0 ? (
        <EmptyLevel icon={TriangleAlert} title={t("admin.noFilterResults")} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-5">
          {visible.map((f) => {
            const r = reach.faculty(f.id);
            const deps = countOf(f, "departments");
            return (
              <NodeCard
                key={f.id}
                testId="faculty-card"
                to={`/admin/faculties/${f.id}`}
                icon={Building2}
                iconUrl={f.iconUrl}
                coverUrl={f.coverUrl}
                code={f.code}
                title={f.name}
                stats={[
                  { icon: Network, label: t("admin.statDepartments"), value: deps },
                  { icon: Layers, label: t("admin.statDomains"), value: countOf(f, "domains") },
                  { icon: GitBranch, label: t("admin.statFilieres"), value: countOf(f, "filieres") },
                  { icon: GraduationCap, label: t("admin.statSpecializations"), value: countOf(f, "specializations") },
                ]}
                people={[
                  { icon: Users, label: t("admin.struct.students"), value: r.students },
                  { icon: UserCog, label: t("admin.struct.professors"), value: r.professors },
                  { icon: BookOpen, label: t("admin.struct.topics"), value: r.topics },
                ]}
                health={facultyHealth(index.get(f.id)?.gaps, t)}
                onEdit={() => {
                  setEditing(f);
                  setDialogOpen(true);
                }}
                onDelete={() => setRemoving(f)}
                deleteBlocked={deps > 0 ? t("admin.struct.blocked", { what: t("admin.struct.n.departments", { count: deps }) }) : null}
              />
            );
          })}
        </div>
      )}

      {/* Academic years — they frame the whole structure, so they live here. */}
      <AcademicYearsPanel />

      {wizardOpen && <AcademicStructureWizard open onClose={() => setWizardOpen(false)} />}
      <FacultyFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} faculty={editing} />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.faculty")}
        loading={deleteFaculty.isPending}
        onConfirm={() => removing && deleteFaculty.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

/** Where a faculty's chain is broken — or that it is whole. */
function facultyHealth(g: FacultyGaps | undefined, t: (k: string, o?: Record<string, unknown>) => string): NodeHealth | null {
  if (!g) return null;
  if (!hasGap(g)) return { tone: "ok", label: t("admin.struct.health.complete") };
  if (g.noDept) return { tone: "warn", label: t("admin.gapNoDepartments") };
  return {
    tone: "warn",
    label: t("admin.needsCompletion"),
    detail: [
      g.deptNoFiliere > 0 && t("admin.gapDeptNoFiliere", { count: g.deptNoFiliere }),
      g.filiereNoSpec > 0 && t("admin.gapFiliereNoSpec", { count: g.filiereNoSpec }),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function ViewBtn({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className={`inline-flex h-full items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition ${
        on ? "bg-forest text-cream dark:bg-gold/15 dark:text-gold" : "text-clay hover:bg-forest/5 hover:text-forest"
      }`}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
