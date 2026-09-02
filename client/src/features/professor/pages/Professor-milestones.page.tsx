import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  FileText,
  Download,
  CalendarClock,
  ChevronDown,
  CalendarDays,
  FolderKanban,
  Users2,
  ListChecks,
  ChevronLeft,
} from "lucide-react";
import {
  useMyGroups,
  useGroup,
  useDeleteMilestone,
} from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import { MilestoneFormDialog } from "../components/milestone-form-dialog";
import type { Milestone, ProjectGroup } from "../../../types/professor.types";


const MS_NODE: Record<string, string> = {
  pending: "bg-amber-400 ring-amber-200",
  in_progress: "bg-sky-400 ring-sky-200",
  completed: "bg-emerald-400 ring-emerald-200",
  overdue: "bg-red-400 ring-red-200",
};
const MS_BORDER: Record<string, string> = {
  pending: "border-r-amber-400",
  in_progress: "border-r-sky-400",
  completed: "border-r-emerald-400",
  overdue: "border-r-red-400",
};

export function ProfessorMilestonesPage() {
  useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // STATE 2: a project is selected → show its milestones
  if (selectedId) {
    return (
      <MilestonesManager
        groupId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  // STATE 1: pick a project
  return <ProjectPicker onPick={setSelectedId} />;
}

// ════════════════════════════════════════════════════════════
//  STATE 1 — choose a project
// ════════════════════════════════════════════════════════════
function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useMyGroups();
  const list = groups ?? [];

  return (
    <div className="font-body">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">
          {t("pro.milestonesPageTitle")}
        </h1>
        <p className="mt-1 text-sm text-clay">
          {t("pro.milestonesPickPrompt")}
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("pro.noProjectsYet")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((g: ProjectGroup) => {
            const members = g.members ?? [];
            const milestoneCount =
              g._count?.milestones ?? g.milestones?.length ?? 0;
            return (
              <button
                key={g.id}
                onClick={() => onPick(g.id)}
                className="group flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 text-start shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40 hover:shadow-[0_8px_28px_rgba(193,150,90,0.15)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  {g.topic?.status && <StatusBadge status={g.topic.status} />}
                  <div className="grid size-9 place-items-center rounded-full bg-gold/15 text-gold transition group-hover:bg-gold group-hover:text-forest-deep">
                    <FolderKanban size={18} />
                  </div>
                </div>
                <h3 className="mb-3 font-serif text-base font-bold text-forest">
                  {g.topic?.title ?? "\u2014"}
                </h3>
                <div className="mb-4 flex items-center justify-between border-t border-forest/10 pt-3 text-clay">
                  <span className="flex items-center gap-1 text-xs">
                    <ListChecks size={14} />
                    {milestoneCount} {t("pro.milestonesShort")}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <Users2 size={14} />
                    {members.length}
                  </span>
                </div>
                <span className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition group-hover:bg-forest-deep">
                  {t("pro.manageMilestones")}
                  <ChevronLeft size={14} className="ltr:rotate-180" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STATE 2 — manage milestones of the chosen project
// ════════════════════════════════════════════════════════════
function MilestonesManager({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: group, isLoading } = useGroup(groupId);
  const deleteMilestone = useDeleteMilestone();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function fmtDate(iso?: string) {
    if (!iso) return "\u2014";
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  if (isLoading)
    return (
      <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
    );
  if (!group)
    return (
      <div className="py-20 text-center text-sm text-clay">
        {t("pro.projectNotFound")}
      </div>
    );

  const milestones = group.milestones ?? [];
  const completed = milestones.filter((m) => m.status === "completed").length;
  const progress = milestones.length
    ? Math.round((completed / milestones.length) * 100)
    : 0;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(m: Milestone) {
    setEditing(m);
    setDialogOpen(true);
  }
  function handleDelete(m: Milestone) {
    if (confirm(t("pro.confirmDeleteMilestone"))) deleteMilestone.mutate(m.id);
  }

  return (
    <div className="font-body">
      {/* Back to picker */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />
        {t("pro.changeProject")}
      </button>

      {/* Project header + progress */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-gold">
            {t("pro.managingMilestonesFor")}
          </p>
          <h1 className="font-serif text-xl font-bold text-forest">
            {group.topic?.title ?? "\u2014"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-serif text-xl font-bold text-gold">
              {progress}%
            </p>
            <p className="text-[10px] text-clay">{t("pro.completed")}</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-xl font-bold text-forest">
              {milestones.length}
            </p>
            <p className="text-[10px] text-clay">{t("pro.milestonesShort")}</p>
          </div>
        </div>
      </div>

      {/* Timeline card */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]">
        <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
            <CalendarClock size={18} className="text-gold" />
            {t("pro.milestonesTimeline")}
          </h2>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft"
          >
            <Plus size={14} />
            {t("pro.addMilestone")}
          </button>
        </div>

        {milestones.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-cream-2 text-clay">
              <CalendarClock size={26} />
            </div>
            <p className="text-sm text-clay">{t("pro.noMilestones")}</p>
          </div>
        ) : (
          <div className="relative px-5 py-6">
            <div className="absolute bottom-6 right-[2.35rem] top-6 w-0.5 bg-linear-to-b from-gold via-gold-soft to-forest/10" />
            <div className="space-y-5">
              {milestones.map((m) => {
                const subs = m.submissions ?? [];
                const isOpen = expanded === m.id;
                const isCurrent = m.status === "in_progress";
                return (
                  <div key={m.id} className="relative flex gap-4">
                    <div className="relative z-10 shrink-0">
                      <div
                        className={`grid place-items-center rounded-full text-xs font-bold text-white ring-4 ${MS_NODE[m.status] ?? "bg-gray-400 ring-gray-200"} ${isCurrent ? "size-11 animate-pulse" : "size-9"}`}
                      >
                        {String(m.order).padStart(2, "0")}
                      </div>
                    </div>
                    <div
                      className={`flex-1 rounded-xl border border-forest/10 border-r-4 bg-cream-2/60 p-4 ${MS_BORDER[m.status] ?? "border-r-gray-400"}`}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-sm font-bold text-forest">
                              {m.title}
                            </h3>
                            {isCurrent && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-600">
                                {t("pro.currentlyInProgress")}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-clay">
                            <CalendarDays size={11} />
                            {fmtDate(m.deadline)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <StatusBadge status={m.status} />
                          <button
                            onClick={() => openEdit(m)}
                            className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {subs.length > 0 ? (
                        <button
                          onClick={() => setExpanded(isOpen ? null : m.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sage transition hover:text-forest"
                        >
                          <ChevronDown
                            size={12}
                            className={
                              isOpen ? "rotate-180 transition" : "transition"
                            }
                          />
                          {t("pro.viewSubmissions", { n: subs.length })}
                        </button>
                      ) : (
                        <p className="mt-1 text-[11px] text-clay">
                          {t("pro.noSubmissions")}
                        </p>
                      )}
                      {isOpen && subs.length > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-lg bg-cream-card p-2">
                          {subs.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-cream-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText
                                  size={13}
                                  className="shrink-0 text-gold"
                                />
                                <span className="truncate text-[11px] text-forest">
                                  {s.fileName}
                                </span>
                                <span className="shrink-0 text-[10px] text-clay">
                                  {t("pro.byStudent", {
                                    name: [
                                      s.uploadedBy?.firstName,
                                      s.uploadedBy?.lastName,
                                    ]
                                      .filter(Boolean)
                                      .join(" "),
                                  })}
                                </span>
                              </div>
                              <a
                                href={s.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                              >
                                <Download size={13} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MilestoneFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        groupId={groupId}
        milestone={editing}
      />
    </div>
  );
}
