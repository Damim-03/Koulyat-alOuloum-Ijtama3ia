import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  FileText,
  Download,
  CalendarClock,
  MapPin,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { useGroup, useDeleteMilestone } from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import type { Milestone } from "../../../types/professor.types";
import { MilestoneFormDialog } from "../components/milestone-form-dialog";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const MS_ACCENT: Record<string, string> = {
  pending: "bg-amber-400",
  in_progress: "bg-sky-400",
  completed: "bg-emerald-400",
  overdue: "bg-red-400",
};

export function ProfessorProjectDetailPage() {
  const { t, i18n } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const { data: group, isLoading } = useGroup(groupId ?? null);
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
  const members = group.members ?? [];
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
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />
        {t("pro.backToProjects")}
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <h1 className="max-w-2xl font-serif text-2xl font-bold leading-snug text-forest">
            {group.topic?.title ?? "\u2014"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Member avatars */}
          <div className="flex -space-x-2 flex-row-reverse">
            {members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="grid size-8 place-items-center rounded-full border-2 border-cream bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream"
              >
                {initials(
                  m.student?.user?.firstName,
                  m.student?.user?.lastName,
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-clay">
            {members.length} {t("pro.membersShort")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-4">
          {/* Defense info */}
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <h3 className="mb-3 font-serif text-base font-bold text-forest">
              {t("pro.defenseInfo")}
            </h3>
            {group.defense ? (
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-clay">
                    <CalendarClock size={14} />
                    {t("pro.defenseDate")}
                  </span>
                  <span className="font-medium text-forest">
                    {fmtDate(group.defense.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-clay">
                    <MapPin size={14} />
                    {t("pro.room")}
                  </span>
                  <span className="font-medium text-forest">
                    {group.defense.room}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-clay">{t("pro.statusLabel")}</span>
                  <StatusBadge status={group.defense.status ?? "scheduled"} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-clay">{t("pro.noDefenseYet")}</p>
            )}
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-forest">
                {t("pro.completionSummary")}
              </h3>
              <span className="font-serif text-lg font-bold text-gold">
                {progress}%
              </span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-cream-2">
              <div
                className="h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cream-2 p-3 text-center">
                <p className="font-serif text-2xl font-bold text-forest">
                  {String(milestones.length).padStart(2, "0")}
                </p>
                <p className="text-[10px] text-clay">
                  {t("pro.totalMilestones")}
                </p>
              </div>
              <div className="rounded-xl bg-cream-2 p-3 text-center">
                <p className="font-serif text-2xl font-bold text-emerald-600">
                  {String(completed).padStart(2, "0")}
                </p>
                <p className="text-[10px] text-clay">
                  {t("pro.completedMilestones")}
                </p>
              </div>
            </div>
          </div>

          {/* Welcome note */}
          <div className="rounded-2xl border border-forest/10 bg-cream-2 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Lightbulb size={16} className="text-gold" />
              <h4 className="text-sm font-bold text-forest">
                {t("pro.welcomeNoteTitle")}
              </h4>
            </div>
            <p className="text-[11px] leading-relaxed text-clay">
              {t("pro.welcomeNoteBody")}
            </p>
          </div>
        </div>

        {/* Right column — milestones timeline */}
        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
              <CalendarClock size={18} />
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
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
              {t("pro.noMilestones")}
            </div>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => {
                const subs = m.submissions ?? [];
                const isOpen = expanded === m.id;
                return (
                  <div
                    key={m.id}
                    className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
                  >
                    <div className="flex items-start gap-3 p-4">
                      {/* Order badge */}
                      <div
                        className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-cream ${MS_ACCENT[m.status] ?? "bg-gray-400"}`}
                      >
                        {String(m.order).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h3 className="font-serif text-sm font-bold text-forest">
                            {m.title}
                          </h3>
                          <div className="flex items-center gap-1">
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
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={m.status} />
                          <span className="text-[11px] text-clay">
                            {fmtDate(m.deadline)}
                          </span>
                        </div>

                        {/* Submissions toggle */}
                        {subs.length > 0 ? (
                          <button
                            onClick={() => setExpanded(isOpen ? null : m.id)}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] text-sage transition hover:text-forest"
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
                          <p className="mt-2 text-[11px] text-clay">
                            {t("pro.noSubmissions")}
                          </p>
                        )}

                        {/* Submissions list */}
                        {isOpen && subs.length > 0 && (
                          <div className="mt-2 space-y-1.5 border-t border-forest/10 pt-2">
                            {subs.map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between rounded-lg bg-cream-2 px-3 py-1.5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText
                                    size={13}
                                    className="shrink-0 text-clay"
                                  />
                                  <span className="truncate text-[11px] text-forest">
                                    {s.fileName}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-clay">
                                    {[
                                      s.uploadedBy?.firstName,
                                      s.uploadedBy?.lastName,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MilestoneFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        groupId={groupId ?? ""}
        milestone={editing}
      />
    </div>
  );
}
