import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Subtitles,
  ListChecks,
  Flag,
  Link2,
  FileText,
  Gavel,
  Check,
  X,
  ExternalLink,
  CheckCircle2,
  Users,
  Trash2,
  Send,
  EyeOff,
  Archive,
  Pencil,
  Undo2,
} from "lucide-react";
import {
  useAdminTopic,
  useApproveTopic,
  useRejectTopic,
  useArchiveTopic,
  usePublishTopic,
  useUnpublishTopic,
  useUnarchiveTopic,
  useDeleteTopic,
} from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { ProjectMembersDialog } from "../../components/dialog/projects/project-members-dialog.form";
import { UserAvatar } from "../../components/ui/user-avatar";
import { EditAssignedTopicDialog } from "../../components/dialog/projects/edit-assigned-topic-dialog.form";
import i18n from "../../../../i18n/i18n";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  open: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};

type TopicReference = { title: string; url: string };

type PersonRef = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

/** Display name for a person, falling back to a dash rather than an empty gap. */
function nameOf(user?: PersonRef | null) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";
}

export function AdminTopicDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "", lang } = useParams();

  // Build the topics-list path WITH the current language prefix so we
  // always return to /<lang>/admin/topics (not the admin dashboard).
  const topicsPath = `/${lang}/admin/topics`;

  // NOTE: create useAdminTopic(id) in admin-hook.ts → GET /admin/topics/:id
  const { data: topic, isLoading, refetch } = useAdminTopic(id);
  const approve = useApproveTopic();
  const reject = useRejectTopic();
  const archive = useArchiveTopic();
  const publish = usePublishTopic();
  const unpublish = useUnpublishTopic();
  const unarchive = useUnarchiveTopic();
  const del = useDeleteTopic();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  function fmtDate(iso?: string) {
    if (!iso) return "\u2014";
    try {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  if (isLoading) {
    return (
      <div className="font-body py-20 text-center text-sm text-clay">
        {"\u2026"}
      </div>
    );
  }
  if (!topic) {
    return (
      <div className="font-body py-20 text-center text-sm text-clay">
        {t("admin.noTopics")}
      </div>
    );
  }

  const u = topic.professor?.user;
  const profName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    topic.professor?.universityEmail ||
    "\u2014";
  const requirements: string[] = topic.requirements ?? [];
  const objectives: string[] = topic.objectives ?? [];
  const references: TopicReference[] =
    (topic.references as TopicReference[]) ?? [];
  const projectGroup = (
    topic as {
      projectGroup?: {
        id: string;
        members?: {
          id: string;
          isLeader: boolean;
          student?: {
            id: string;
            registrationNumber?: string | null;
            user?: PersonRef | null;
          };
        }[];
      } | null;
    }
  ).projectGroup;
  const hasGroup = Boolean(projectGroup);
  const groupId = projectGroup?.id ?? null;
  const members = projectGroup?.members ?? [];

  function doApprove() {
    approve.mutate(topic!.id, { onSuccess: () => refetch() });
  }
  function doReject() {
    reject.mutate(
      { id: topic!.id, reason: reason || undefined },
      {
        onSuccess: () => {
          setRejecting(false);
          setReason("");
          refetch();
        },
      },
    );
  }
  function doArchive() {
    archive.mutate(topic!.id, { onSuccess: () => refetch() });
  }
  function doPublish() {
    publish.mutate(topic!.id, { onSuccess: () => refetch() });
  }
  function doUnpublish() {
    unpublish.mutate(topic!.id, { onSuccess: () => refetch() });
  }
  function doUnarchive() {
    unarchive.mutate(topic!.id, { onSuccess: () => refetch() });
  }
  function doDelete() {
    del.mutate(topic!.id, { onSuccess: () => navigate(topicsPath) });
  }

  return (
    <div className="font-body">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(topicsPath)}
          className="inline-flex items-center gap-2 font-serif text-sm font-bold text-forest transition hover:opacity-80"
        >
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("admin.backToTopics")}
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[topic.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {t(`status.${topic.status}`, { defaultValue: topic.status })}
          </span>
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
          >
            <Pencil size={14} />
            {t("admin.editTopic")}
          </button>
          {/* This used to open the members dialog whenever a group existed —
              a red "delete" button that showed a member list instead. Deleting
              is now just deleting; members are managed from their own card. */}
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
          >
            <Trash2 size={14} />
            {t("admin.delete", { defaultValue: t("pro.delete") })}
          </button>
        </div>
      </div>

      {/* Hero header card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-4">
            <h1 className="max-w-3xl font-serif text-2xl font-bold leading-tight text-forest lg:text-3xl">
              {topic.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-[11px] font-medium text-forest">
                {topic.specialization?.name ?? "\u2014"}
              </span>
              <span className="rounded-full bg-forest/5 px-3 py-1 text-[11px] font-medium text-clay">
                {topic.academicYear?.title ?? "\u2014"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-gold">
                <Users size={14} />
                {t("admin.maxStudentsN", { n: topic.maxStudents })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-2 p-4">
            <div className="text-start">
              <h4 className="text-sm font-bold text-forest">{profName}</h4>
              <p className="text-[11px] text-clay">{t("admin.supervisor")}</p>
            </div>
            <UserAvatar user={u} size={48} className="rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left column (wide) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <Subtitles size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.topicDescriptionLabel")}
              </h2>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-clay">
              {topic.description || "\u2014"}
            </p>
          </section>

          {/* Group members — for an assigned topic this is the point of the
              page, and it was previously reachable only through the delete
              button. */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.groupMembers")}
                </h2>
                {hasGroup && (
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
                    {t("admin.membersOfMax", {
                      n: members.length,
                      max: topic.maxStudents,
                    })}
                  </span>
                )}
              </div>
              {hasGroup && (
                <button
                  onClick={() => setMembersOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
                >
                  <Users size={14} />
                  {t("admin.manageMembers")}
                </button>
              )}
            </div>

            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-clay">
                {t("admin.noGroupYet")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      m.isLeader
                        ? "border-gold bg-gold/5"
                        : "border-forest/10 bg-cream-2"
                    }`}
                  >
                    <UserAvatar user={m.student?.user} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-forest">
                        {nameOf(m.student?.user)}
                        {m.isLeader && (
                          <span className="ms-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                            {t("admin.leader")}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-clay" dir="ltr">
                        {m.student?.registrationNumber ?? ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Requirements */}
          {requirements.length > 0 ? (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <ListChecks size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.requirementsLabel")}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {requirements.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg bg-cream-2 p-3 transition hover:bg-forest/5"
                  >
                    <CheckCircle2 size={18} className="shrink-0 text-sage" />
                    <span className="text-sm font-medium text-forest">{r}</span>
                  </div>
                ))}
              </div>
            </section>
          )
           : (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
                <ListChecks size={18} className="text-clay/60" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.requirementsLabel")}
                </h2>
              </div>
              <p className="py-2 text-center text-sm text-clay">
                {t("admin.noRequirements")}
              </p>
            </section>
          )}

          {/* Objectives */}
          {objectives.length > 0 ? (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Flag size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.objectivesLabel")}
                </h2>
              </div>
              <ul className="space-y-4">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest/10 font-bold text-forest">
                      {i + 1}
                    </span>
                    <p className="pt-1 text-sm text-clay">{o}</p>
                  </li>
                ))}
              </ul>
            </section>
          )
           : (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Flag size={18} className="text-clay/60" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.objectivesLabel")}
                </h2>
              </div>
              <p className="py-2 text-center text-sm text-clay">
                {t("admin.noObjectives")}
              </p>
            </section>
          )}

          {/* References */}
          {references.length > 0 ? (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Link2 size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.referencesLabel")}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {references.map((ref, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-forest/15 p-4 transition hover:bg-cream-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText size={18} className="shrink-0 text-clay" />
                      <p className="truncate text-sm font-medium text-forest">
                        {ref.title}
                      </p>
                    </div>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forest/20 px-3 py-1 text-[11px] font-bold text-forest transition hover:bg-forest/5"
                    >
                      <ExternalLink size={12} />
                      {t("admin.openLink")}
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )
           : (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Link2 size={18} className="text-clay/60" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.referencesLabel")}
                </h2>
              </div>
              <p className="py-2 text-center text-sm text-clay">
                {t("admin.noReferencesYet")}
              </p>
            </section>
          )}
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-6">
          {/* Summary info */}
          <div className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-gold" />
            <h3 className="mb-6 font-serif text-lg font-bold text-forest">
              {t("admin.topicInfo")}
            </h3>
            <div className="space-y-1">
              <InfoRow
                label={t("admin.specialization")}
                value={topic.specialization?.name ?? "\u2014"}
              />
              <InfoRow
                label={t("admin.academicYear")}
                value={topic.academicYear?.title ?? "\u2014"}
              />
              <InfoRow
                label={t("admin.maxCapacity")}
                value={t("admin.maxStudentsN", { n: topic.maxStudents })}
              />
              <InfoRow
                label={t("admin.createdAt")}
                value={fmtDate(topic.createdAt)}
                last
              />
            </div>
          </div>

          {/* Decision card */}
          <div className="rounded-2xl border-2 border-forest/10 bg-cream-card p-6 shadow-[0_8px_30px_rgba(38,66,61,0.08)]">
            <h3 className="mb-6 flex items-center gap-2 font-serif text-lg font-bold text-forest">
              <Gavel size={18} />
              {t("admin.adminAction")}
            </h3>

            {rejecting ? (
              <div className="space-y-3">
                <label className="text-xs font-medium text-forest">
                  {t("admin.rejectionReason")}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-forest/15 bg-cream-2 p-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                  placeholder={t("admin.rejectionReasonPlaceholder")}
                />
                <p className="text-[11px] text-clay">
                  {t("admin.rejectReasonToProf", {
                    defaultValue: t("admin.rejectionReachesProfessor"),
                  })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={doReject}
                    disabled={reject.isPending}
                    className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                  >
                    {t("admin.confirmReject")}
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(false);
                      setReason("");
                    }}
                    className="flex-1 rounded-xl border border-forest/20 py-3 font-bold text-forest transition hover:bg-forest/5"
                  >
                    {t("admin.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* current status */}
                <div className="flex items-center justify-between rounded-xl bg-cream-2 px-3 py-2.5">
                  <span className="text-xs text-clay">
                    {t("admin.currentStatus", {
                      defaultValue: t("admin.currentStatus"),
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[topic.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {t(`status.${topic.status}`, {
                      defaultValue: topic.status,
                    })}
                  </span>
                </div>

                {hasGroup && (
                  <p className="rounded-lg bg-soft-sage/30 px-3 py-2 text-xs leading-relaxed text-forest">
                    {t("admin.hasGroupNote", {
                      defaultValue:
                        t("admin.topicHasGroupHint"),
                    })}
                  </p>
                )}

                {/* contextual, reversible actions */}
                {(topic.status === "pending" || topic.status === "rejected") &&
                  !hasGroup && (
                    <ActBtn
                      onClick={doApprove}
                      disabled={approve.isPending}
                      variant="approve"
                    >
                      <Check size={18} />
                      {t("admin.approveTopicBtn")}
                    </ActBtn>
                  )}
                {topic.status === "approved" && !hasGroup && (
                  <ActBtn
                    onClick={doPublish}
                    disabled={publish.isPending}
                    variant="publish"
                  >
                    <Send size={18} />
                    {t("admin.publish", { defaultValue: t("admin.publishTopic") })}
                  </ActBtn>
                )}
                {topic.status === "open" && (
                  <ActBtn
                    onClick={doUnpublish}
                    disabled={unpublish.isPending}
                    variant="neutral"
                  >
                    <EyeOff size={18} />
                    {t("admin.unpublish", { defaultValue: t("admin.unpublish") })}
                  </ActBtn>
                )}
                {(topic.status === "pending" ||
                  topic.status === "approved" ||
                  topic.status === "open") &&
                  !hasGroup && (
                    <ActBtn onClick={() => setRejecting(true)} variant="reject">
                      <X size={18} />
                      {t("admin.rejectTopicBtn")}
                    </ActBtn>
                  )}
                {topic.status === "archived" ? (
                  <ActBtn
                    onClick={doUnarchive}
                    disabled={unarchive.isPending}
                    variant="publish"
                  >
                    <Undo2 size={18} />
                    {t("admin.unarchive", { defaultValue: t("admin.unarchive") })}
                  </ActBtn>
                ) : (
                  <ActBtn
                    onClick={doArchive}
                    disabled={archive.isPending}
                    variant="neutral"
                  >
                    <Archive size={18} />
                    {t("admin.archive", { defaultValue: t("admin.archive") })}
                  </ActBtn>
                )}

                {topic.status === "rejected" && topic.rejectionReason && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
                    <span className="font-semibold">
                      {t("status.rejected")}:
                    </span>{" "}
                    {topic.rejectionReason}
                  </p>
                )}

                <p className="pt-1 text-center text-[11px] text-clay opacity-70">
                  {t("admin.decisionNote")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProjectMembersDialog
        open={membersOpen}
        groupId={groupId}
        topicId={topic.id}
        topicTitle={topic.title}
        maxStudents={topic.maxStudents}
        specializationId={topic.specialization?.id ?? null}
        onClose={() => setMembersOpen(false)}
        onChanged={() => refetch()}
        onDeleted={() => navigate(topicsPath)}
      />

      <EditAssignedTopicDialog
        topicId={editOpen ? topic.id : null}
        onClose={() => setEditOpen(false)}
        onUpdated={() => refetch()}
      />

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={t("admin.deleteTopicTitle", { defaultValue: t("admin.deleteTopic") })}
        message={t("admin.confirmDeleteTopicLong", { title: topic.title })}
        confirmLabel={t("admin.confirmDelete", { defaultValue: t("admin.yesDelete") })}
        cancelLabel={t("admin.cancel", { defaultValue: t("pro.cancel") })}
        loading={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-forest/5"}`}
    >
      <span className="text-sm text-clay">{label}</span>
      <span className="font-bold text-forest">{value}</span>
    </div>
  );
}

const ACT_VARIANTS: Record<string, string> = {
  approve: "bg-emerald-600 text-white shadow-md hover:bg-emerald-700",
  publish: "bg-forest text-cream shadow-md hover:bg-forest-deep",
  reject: "border-2 border-red-400 text-red-500 hover:bg-red-50",
  neutral: "border border-forest/20 text-forest hover:bg-forest/5",
};

function ActBtn({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "approve" | "publish" | "reject" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-3 rounded-xl py-3.5 font-bold transition active:scale-95 disabled:opacity-60 ${ACT_VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}
