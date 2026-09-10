import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Pencil,
  Trash2,
  ListChecks,
  Flag,
  Link2,
  FileText,
  ExternalLink,
  CheckCircle2,
  Users,
  Users2,
  AlertCircle,
  Subtitles,
  Info,
  Inbox,
  Crown,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";
import { useTopic, useDeleteTopic } from "../hooks/Professor-hook";
import { TopicFormDialog } from "../components/topic-form-dialog";
import { StatusBadge } from "../components/status-badge";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type {
  Topic,
  StudentRef,
  TopicGroupRequest,
  TopicReference,
} from "../../../types/professor.types";

/**
 * One topic, from the professor's side.
 *
 * The page used to end at a row of tiles — "3 students" with no way to learn
 * who they were. The students are the point of a topic, so they are now the
 * middle of the page, in two clearly separate parts:
 *
 *   * the team that was accepted and that he supervises;
 *   * the teams that asked for the topic and are still waiting.
 *
 * He decides neither. The administration does, and the page says so rather
 * than offering him buttons that would fail.
 */

/** Display name, falling back to the registration number, then a dash. */
function nameOf(s?: StudentRef | null) {
  const u = s?.user;
  return (
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    s?.registrationNumber ||
    "—"
  );
}

/**
 * The tint behind a request card.
 *
 * Theme tokens rather than raw palette colours: a `bg-amber-50` tint is a
 * near-white wash, which in dark mode sat under near-white text. These flip
 * with the theme, so the card stays a faint tint on either ground. The status
 * itself is named by the badge inside — the tint only groups the card.
 */
const REQUEST_TONES: Record<string, string> = {
  pending: "border-gold/50 bg-gold/10",
  accepted: "border-sage/50 bg-sage/10",
  rejected: "border-forest/10 bg-forest/5 opacity-70",
};

export function ProfessorTopicDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: topic, isLoading } = useTopic(id ?? null);
  const deleteTopic = useDeleteTopic();
  const [editOpen, setEditOpen] = useState(false);

  function fmtDate(iso?: string) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function handleDelete() {
    if (!topic) return;
    if (confirm(t("pro.confirmDeleteTopic")))
      deleteTopic.mutate(topic.id, { onSuccess: () => navigate("../topics") });
  }

  if (isLoading)
    return (
      <div className="font-body space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-forest/10" />
        <div className="h-36 animate-pulse rounded-2xl bg-forest/10" />
        <div className="h-64 animate-pulse rounded-2xl bg-forest/10" />
      </div>
    );

  if (!topic)
    return (
      <div className="font-body py-20 text-center text-sm text-clay">
        {t("pro.topicNotFound")}
      </div>
    );

  /** Only an undecided topic is his to change. */
  const editable = topic.status === "pending" || topic.status === "rejected";

  const requirements: string[] = topic.requirements ?? [];
  const objectives: string[] = topic.objectives ?? [];
  const references: TopicReference[] = topic.references ?? [];

  const requests = topic.groupRequests ?? [];
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const group = topic.projectGroup ?? null;
  const members = group?.members ?? [];

  return (
    <div className="font-body">
      {/* ── top bar ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate("../topics")}
          className="inline-flex items-center gap-2 font-serif text-sm font-bold text-forest transition hover:opacity-80"
        >
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("pro.backToTopics")}
        </button>

        <div className="flex items-center gap-2">
          <StatusBadge status={topic.status} />
          {editable && (
            <>
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
              >
                <Pencil size={14} />
                {t("pro.editTopic")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTopic.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {t("pro.delete")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── hero ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-4">
            <h1 className="max-w-3xl break-words font-serif text-2xl font-bold leading-tight text-forest lg:text-3xl">
              {topic.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-[11px] font-medium text-forest">
                {topic.specialization?.name ?? "—"}
              </span>
              <span className="rounded-full bg-forest/5 px-3 py-1 text-[11px] font-medium text-clay">
                {topic.academicYear?.title ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-gold">
                <Users2 size={13} />
                {topic.maxStudents} {t("pro.studentsShort")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/5 px-3 py-1 text-[11px] font-medium text-clay">
                <CalendarDays size={13} />
                {fmtDate(topic.createdAt)}
              </span>
            </div>
          </div>

          {/* Two numbers that answer "how is this topic doing?" at a glance. */}
          <div className="flex shrink-0 gap-3">
            <Stat
              icon={Users}
              value={members.length}
              label={t("pro.teamMembersShort")}
              tone={members.length > 0 ? "gold" : "plain"}
            />
            <Stat
              icon={Inbox}
              value={requests.length}
              label={t("pro.requestsCount")}
              tone={pendingRequests.length > 0 ? "gold" : "plain"}
            />
          </div>
        </div>
      </div>

      {/* ── rejection ── */}
      {topic.status === "rejected" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-700">
              {t("pro.rejectionReasonTitle")}
            </p>
            <p className="text-sm text-red-600">
              {topic.rejectionReason || t("pro.noReasonGiven")}
            </p>
            <p className="mt-1.5 text-[11px] text-red-500/80">
              {t("pro.rejectedResubmitHint")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* ════ left column ════ */}
        <div className="space-y-6 lg:col-span-2">
          {/* description */}
          <Section icon={Subtitles} title={t("pro.projectDetails")}>
            <p className="whitespace-pre-line leading-relaxed text-clay">
              {topic.description || "—"}
            </p>
          </Section>

          {/* ── the team he supervises ── */}
          <Section
            icon={Users}
            title={t("pro.supervisedTeam")}
            badge={
              group
                ? t("pro.membersOfMax", {
                    n: members.length,
                    max: topic.maxStudents,
                  })
                : undefined
            }
            action={
              group ? (
                <Link
                  to={`../groups/${group.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
                >
                  <ArrowLeft size={14} className="ltr:rotate-180" />
                  {t("pro.manageProject")}
                </Link>
              ) : undefined
            }
          >
            {members.length === 0 ? (
              <EmptyNote
                text={
                  pendingRequests.length > 0
                    ? t("pro.teamAwaitingAdmin")
                    : t("pro.noTeamYet")
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {members.map((m) => (
                  <StudentCard
                    key={m.id}
                    student={m.student}
                    leader={m.isLeader}
                    leaderLabel={t("pro.leader")}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* ── who asked for this topic ── */}
          <Section
            icon={Inbox}
            title={t("pro.groupRequestsOnTopic")}
            badge={requests.length > 0 ? String(requests.length) : undefined}
          >
            {requests.length === 0 ? (
              <EmptyNote text={t("pro.noRequestsYet")} />
            ) : (
              <>
                <p className="mb-4 flex items-start gap-2 rounded-xl bg-soft-sage/25 px-3 py-2.5 text-[11px] leading-relaxed text-forest">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  {t("pro.requestsDecidedByAdmin")}
                </p>
                <ul className="space-y-4">
                  {requests.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      date={fmtDate(r.createdAt)}
                      t={t}
                    />
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* requirements */}
          <Section icon={ListChecks} title={t("pro.requirements")}>
            {requirements.length === 0 ? (
              <EmptyNote text={t("pro.noRequirements")} />
            ) : (
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
            )}
          </Section>

          {/* objectives */}
          <Section icon={Flag} title={t("pro.objectives")}>
            {objectives.length === 0 ? (
              <EmptyNote text={t("pro.noObjectives")} />
            ) : (
              <ul className="space-y-4">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest/10 font-bold text-forest tabular-nums">
                      {i + 1}
                    </span>
                    <p className="pt-1 text-sm text-clay">{o}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* references */}
          <Section icon={Link2} title={t("pro.referencesLabel")}>
            {references.length === 0 ? (
              <EmptyNote text={t("pro.noReferencesYet")} />
            ) : (
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
                      {t("pro.view")}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ════ sidebar ════ */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="absolute start-0 top-0 h-full w-1.5 bg-gold" />
            <h3 className="mb-5 font-serif text-lg font-bold text-forest">
              {t("pro.topicInfo")}
            </h3>
            <div className="space-y-1">
              <InfoRow
                label={t("pro.statusLabel")}
                value={t(`status.${topic.status}`, {
                  defaultValue: topic.status,
                })}
              />
              <InfoRow
                label={t("pro.specialization")}
                value={topic.specialization?.name ?? "—"}
              />
              <InfoRow
                label={t("pro.academicYear")}
                value={topic.academicYear?.title ?? "—"}
              />
              <InfoRow
                label={t("pro.maxStudents")}
                value={String(topic.maxStudents)}
              />
              <InfoRow
                label={t("pro.requestsCount")}
                value={String(requests.length)}
              />
              <InfoRow
                label={t("pro.createdAt")}
                value={fmtDate(topic.createdAt)}
                last
              />
            </div>
          </div>

          {/* What the status means, since he has no buttons to press here. */}
          <div className="rounded-2xl border-2 border-forest/10 bg-cream-card p-6 shadow-[0_8px_30px_rgba(38,66,61,0.08)]">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-forest">
              <Info size={18} className="text-gold" />
              {t("pro.whatThisMeans")}
            </h3>
            <div className="mb-3">
              <StatusBadge status={topic.status} />
            </div>
            <p className="text-sm leading-relaxed text-clay">
              {t(`pro.statusMeaning.${topic.status}`, {
                defaultValue: t("pro.statusMeaning.pending"),
              })}
            </p>

            {editable && (
              <button
                onClick={() => setEditOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3 font-bold text-cream transition hover:bg-forest-deep active:scale-95"
              >
                <Pencil size={16} />
                {t("pro.editTopic")}
              </button>
            )}
          </div>
        </div>
      </div>

      <TopicFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        topic={topic as Topic}
      />
    </div>
  );
}

/* ══════════════════ pieces ══════════════════ */

function Section({
  icon: Icon,
  title,
  badge,
  action,
  children,
}: {
  icon: typeof Users;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-gold" />
          <h2 className="font-serif text-lg font-bold text-forest">{title}</h2>
          {badge && (
            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-clay">{text}</p>;
}

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: "gold" | "plain";
}) {
  return (
    <div
      className={`flex min-w-24 items-center gap-3 rounded-xl border p-4 ${
        tone === "gold"
          ? "border-gold/40 bg-gold/10"
          : "border-forest/10 bg-cream-2"
      }`}
    >
      <Icon
        size={18}
        className={tone === "gold" ? "text-gold" : "text-clay"}
      />
      <div>
        <p className="font-serif text-xl font-bold text-forest tabular-nums">
          {value}
        </p>
        <p className="text-[10px] text-clay">{label}</p>
      </div>
    </div>
  );
}

function StudentCard({
  student,
  leader,
  leaderLabel,
}: {
  student?: StudentRef | null;
  leader?: boolean;
  leaderLabel: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        leader ? "border-gold bg-gold/5" : "border-forest/10 bg-cream-2"
      }`}
    >
      <UserAvatar user={student?.user} size={38} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-forest">
          {nameOf(student)}
          {leader && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
              <Crown size={9} />
              {leaderLabel}
            </span>
          )}
        </p>
        <p className="truncate text-[11px] text-clay" dir="ltr">
          {student?.registrationNumber ?? ""}
        </p>
      </div>
    </div>
  );
}

/** One team that asked for this topic, with everyone in it named. */
function RequestCard({
  request,
  date,
  t,
}: {
  request: TopicGroupRequest;
  date: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const leaderId = request.leader?.id;
  const members = request.members ?? [];
  // The leader is stored among the members too; show the team once, and mark
  // the leader inside it rather than repeating them above the list.
  const people = members.length
    ? members.map((m) => m.student)
    : [request.leader];

  return (
    <li
      className={`rounded-xl border p-4 ${
        REQUEST_TONES[request.status] ?? "border-forest/10 bg-cream-2"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={request.status} />
          <span className="text-[11px] text-clay">
            {t("pro.membersCount", { count: people.length })}
          </span>
        </div>
        <span className="text-[11px] text-clay">
          {t("pro.sentOn", { date })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {people.map((s, i) => (
          <div
            key={s?.id ?? i}
            className="flex items-center gap-2.5 rounded-lg bg-cream-card/70 px-3 py-2"
          >
            <UserAvatar user={s?.user} size={30} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-forest">
                {nameOf(s)}
                {s?.id === leaderId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                    <Crown size={9} />
                    {t("pro.leader")}
                  </span>
                )}
              </p>
              <p className="truncate text-[10px] text-clay" dir="ltr">
                {s?.registrationNumber ?? ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {request.status === "rejected" && request.rejectionReason && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-brick">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {request.rejectionReason}
        </p>
      )}
    </li>
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
      className={`flex items-center justify-between gap-3 py-2 ${
        last ? "" : "border-b border-forest/5"
      }`}
    >
      <span className="shrink-0 text-sm text-clay">{label}</span>
      <span className="truncate text-end font-bold text-forest">{value}</span>
    </div>
  );
}
