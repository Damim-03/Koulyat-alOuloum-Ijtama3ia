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
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  Users,
  Users2,
  AlertCircle,
  CircleDot,
  Layers,
  Subtitles,
  Info,
  Inbox,
  Crown,
  CalendarDays,
  CalendarClock,
  ArrowLeft,
  IdCard,
  type LucideIcon,
} from "lucide-react";
import { useTopic, useDeleteTopic } from "../hooks/Professor-hook";
import { TopicFormDialog } from "../components/topic-form-dialog";
import { StatusPill } from "../../../components/ui/status-pill";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { DangerConfirm } from "../../../components/dialog/danger-confirm";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import { noneText } from "../../../lib/none-text";
import type {
  Topic,
  StudentRef,
  TopicGroupRequest,
  TopicReference,
} from "../../../types/professor.types";
import { personName } from "../../../lib/person-name";

/**
 * One topic, from the professor's side.
 *
 * The students are the point of a topic, so they sit near the top, in two
 * clearly separate parts:
 *
 *   * the team that was accepted and that he supervises;
 *   * the teams that asked for the topic and are still waiting.
 *
 * He decides neither. The administration does, and the page says so — in
 * the header, beside the status — rather than offering him buttons that
 * would fail.
 *
 * There is no sidebar: it only repeated the header's facts (status,
 * specialization, year, capacity, date) and left a column of empty space
 * beside the content.
 */

/** Display name, falling back to the registration number, then a dash. */
function nameOf(s?: StudentRef | null) {
  const u = s?.user;
  return (
    personName(u) ||
    s?.registrationNumber ||
    "—"
  );
}

/**
 * The tint behind a request card.
 *
 * Theme tokens rather than raw palette colours: a `bg-amber-50` tint is a
 * near-white wash, which in dark mode sat under near-white text.
 */
const REQUEST_TONES: Record<string, string> = {
  pending: "ring-gold/40 bg-gold/8",
  accepted: "ring-sage/40 bg-sage/8",
  rejected: "ring-forest/10 bg-forest/5 opacity-75",
};

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

export function ProfessorTopicDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: topic, isLoading } = useTopic(id ?? null);
  const deleteTopic = useDeleteTopic();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  function confirmDelete() {
    if (!topic) return;
    deleteTopic.mutate(topic.id, {
      onSuccess: () => navigate("../topics"),
    });
  }

  if (isLoading)
    return (
      <div className="space-y-6 font-body">
        <div className="h-72 animate-pulse rounded-3xl bg-forest/10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-3xl bg-forest/5" />
          <div className="h-56 animate-pulse rounded-3xl bg-forest/5" />
        </div>
      </div>
    );

  if (!topic)
    return (
      <div className={`${CARD} grid place-items-center gap-3 px-6 py-20 text-center font-body`}>
        <span className="grid size-16 place-items-center rounded-full bg-gold/10 text-gold ring-8 ring-gold/5">
          <FileText size={26} />
        </span>
        <p className="font-serif text-base font-bold text-forest">
          {t("pro.topicNotFound")}
        </p>
        <Link
          to="../topics"
          className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5"
        >
          <ChevronRight size={16} className="ltr:rotate-180" />
          {t("pro.backToTopics")}
        </Link>
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
    <div className="space-y-6 font-body">
      {/* ══════════ header ══════════ */}
      <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
        {/* ornament, clipped by a layer of its own so the card never scrolls */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
          <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
          <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
        </div>

        {/* back, and what can be done */}
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("../topics")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-soft-sage transition hover:text-cream"
          >
            <ChevronRight size={17} className="ltr:rotate-180" />
            {t("pro.backToTopics")}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {group && (
              <>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold/50 px-3.5 py-2 text-xs font-semibold text-gold-soft transition hover:bg-gold/15"
                >
                  <FileCheck2 size={15} />
                  {t("supervision.sheet")}
                </button>
                <Link
                  to={`../groups/${group.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-[var(--t-brand-deep)] transition hover:bg-gold-soft"
                >
                  {t("pro.manageProject")}
                  <ArrowLeft size={15} className="ltr:rotate-180" />
                </Link>
              </>
            )}
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-[var(--t-brand-deep)] transition hover:bg-gold-soft"
                >
                  <Pencil size={15} />
                  {t("pro.editTopic")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleteTopic.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#f0a48f]/50 px-3.5 py-2 text-xs font-semibold text-[#f0a48f] transition hover:bg-[#f0a48f]/10 disabled:opacity-60"
                >
                  <Trash2 size={15} />
                  {t("pro.delete")}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          {/* what the topic is */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill status={topic.status} />
              <HeroChip icon={Layers}>{topic.specialization?.name ?? "—"}</HeroChip>
              <HeroChip icon={CalendarDays}>
                {topic.academicYear?.title ?? "—"}
              </HeroChip>
              <HeroChip icon={Users2}>
                {topic.maxStudents} {t("pro.studentsShort")}
              </HeroChip>
              <HeroChip icon={CalendarClock}>{fmtDate(topic.createdAt)}</HeroChip>
            </div>
            <h1 className="font-serif text-3xl leading-tight font-bold break-words text-cream lg:text-4xl">
              {topic.title}
            </h1>
          </div>

          {/* how it is doing, in three numbers */}
          <div className="grid shrink-0 grid-cols-3 gap-3">
            <HeroStat
              icon={Users}
              value={group ? `${members.length}/${topic.maxStudents}` : "0"}
              label={t("pro.teamMembersShort")}
            />
            <HeroStat
              icon={Inbox}
              value={String(requests.length)}
              label={t("pro.requestsCount")}
              highlight={pendingRequests.length > 0}
            />
            <HeroStat
              icon={CalendarClock}
              value={String(group?._count?.milestones ?? 0)}
              label={t("pro.tp.milestones")}
            />
          </div>
        </div>

        {/* what the status means — he has no buttons for most of them */}
        <div className="relative mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-gold-soft" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-cream">
              {t("pro.whatThisMeans")}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-soft-sage">
              {t(`pro.statusMeaning.${topic.status}`, {
                defaultValue: t("pro.statusMeaning.pending"),
              })}
            </p>
          </div>
        </div>
      </section>

      {/* ══════════ refused: why, and what to do ══════════ */}
      {topic.status === "rejected" && (
        <div className="flex items-start gap-3 rounded-3xl border border-brick/30 bg-brick/8 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brick/15 text-brick">
            <AlertCircle size={20} />
          </span>
          <div>
            <p className="text-sm font-bold text-brick">
              {t("pro.rejectionReasonTitle")}
            </p>
            <p className="mt-0.5 text-sm text-forest">
              {topic.rejectionReason || t("pro.noReasonGiven")}
            </p>
            <p className="mt-1.5 text-xs text-clay">
              {t("pro.rejectedResubmitHint")}
            </p>
          </div>
        </div>
      )}

      {/* ══════════ what it asks, and who took it ══════════
          Two cards on one row share one height. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={Subtitles} title={t("pro.projectDetails")}>
          <p className="leading-relaxed whitespace-pre-line text-forest/85">
            {topic.description || "—"}
          </p>
        </Section>

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
        >
          {members.length === 0 ? (
            <EmptyNote
              icon={Users}
              text={
                pendingRequests.length > 0
                  ? t("pro.teamAwaitingAdmin")
                  : t("pro.noTeamYet")
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      {/* ══════════ who asked for it ══════════ */}
      <Section
        icon={Inbox}
        title={t("pro.groupRequestsOnTopic")}
        badge={requests.length > 0 ? String(requests.length) : undefined}
      >
        {requests.length === 0 ? (
          <EmptyNote icon={Inbox} text={t("pro.noRequestsYet")} />
        ) : (
          <>
            <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sage/10 px-4 py-3 text-xs leading-relaxed text-forest ring-1 ring-sage/20">
              <Info size={14} className="mt-0.5 shrink-0 text-sage" />
              {t("pro.requestsDecidedByAdmin")}
            </p>
            <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} date={fmtDate(r.createdAt)} />
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* ══════════ requirements, objectives, references ══════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Section icon={ListChecks} title={t("pro.requirements")}>
          {requirements.length === 0 ? (
            <EmptyNote icon={ListChecks} text={t("pro.noRequirements")} />
          ) : (
            <ul className="space-y-2">
              {requirements.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-cream-2/70 px-4 py-3 ring-1 ring-forest/5"
                >
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sage" />
                  <span className="text-sm font-medium text-forest">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Flag} title={t("pro.objectives")}>
          {objectives.length === 0 ? (
            <EmptyNote icon={Flag} text={t("pro.noObjectives")} />
          ) : (
            <ol className="space-y-2">
              {objectives.map((o, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-cream-2/70 px-4 py-3 ring-1 ring-forest/5"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 font-serif text-sm font-bold text-gold tabular-nums">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-forest">{o}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <div className="grid lg:col-span-2 2xl:col-span-1">
          <Section icon={Link2} title={t("pro.referencesLabel")}>
            {references.length === 0 ? (
              <EmptyNote icon={Link2} text={t("pro.noReferencesYet")} />
            ) : (
              <ul className="space-y-2">
                {references.map((ref, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-cream-2/70 px-4 py-3 ring-1 ring-forest/5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileText size={16} className="shrink-0 text-gold" />
                      <span className="truncate text-sm font-medium text-forest">
                        {ref.title}
                      </span>
                    </span>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forest/15 px-2.5 py-1 text-[11px] font-bold text-forest transition hover:border-gold/50 hover:bg-gold/10"
                    >
                      <ExternalLink size={12} />
                      {t("pro.view")}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <TopicFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        topic={topic as Topic}
      />

      {sheetOpen && (
        <SupervisionDialog
          topicId={topic.id}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/*
        هنا يُعرف المانع، بخلاف شاشة القائمة: صفحة التفصيل تحمل
        `projectGroup`. والخادم يرفض حذف موضوعٍ تشكّلت له مجموعة ويقول
        «أرشفه بدلاً من ذلك» — فيُقال ذلك قبل الضغط لا بعده.
      */}
      <DangerConfirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteTopic.isPending}
        title={t("admin.deleteTopicTitle")}
        name={topic.title}
        kicker={t("admin.topicWord")}
        facts={[
          {
            icon: CircleDot,
            label: t("pro.statusLabel"),
            value: t(`status.${topic.status}`),
          },
          {
            icon: Layers,
            label: t("pro.specialization"),
            value: topic.specialization?.name ?? noneText(),
          },
          {
            icon: CalendarDays,
            label: t("pro.academicYear"),
            value: topic.academicYear?.title ?? noneText(true),
          },
          {
            icon: Users2,
            label: t("pro.maxStudents"),
            value: topic.maxStudents,
            dir: "ltr",
          },
        ]}
        block={
          topic.projectGroup
            ? {
                message: t("admin.blockTopicHasGroup"),
                hint: t("admin.blockTopicHasGroupHint"),
              }
            : null
        }
        impacts={[
          {
            icon: Inbox,
            label: t("admin.impactTopicRequests"),
            value: topic._count?.groupRequests ?? topic.groupRequests?.length ?? 0,
            heavy:
              (topic._count?.groupRequests ?? topic.groupRequests?.length ?? 0) >
              0,
          },
          { icon: FileText, label: t("admin.impactTopicApplications") },
        ]}
        warning={t("admin.irreversibleWarning")}
        confirmLabel={t("admin.yesDelete")}
      />
    </div>
  );
}

/* ══════════════════ pieces ══════════════════ */

function HeroChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-cream">
      <Icon size={12} className="text-gold-soft" />
      {children}
    </span>
  );
}

function HeroStat({
  icon: Icon,
  value,
  label,
  highlight,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex min-w-24 flex-col items-center rounded-2xl border px-4 py-3 text-center ${
        highlight
          ? "border-gold/60 bg-gold/15"
          : "border-white/10 bg-white/5"
      }`}
    >
      <Icon size={17} className="mb-1 text-gold-soft" />
      <span className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[11px] text-soft-sage">{label}</span>
    </div>
  );
}

/** A card that fills its grid cell, so neighbours on a row share one height. */
function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col p-6 ${CARD}`}>
      <header className="mb-5 flex items-center gap-2.5 border-b border-forest/10 pb-4">
        <span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold">
          <Icon size={18} />
        </span>
        <h2 className="font-serif text-lg font-bold text-forest">{title}</h2>
        {badge && (
          <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-bold text-clay tabular-nums">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Centred in whatever height the row gives it. */
function EmptyNote({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-4 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-gold/10 text-gold ring-4 ring-gold/5">
        <Icon size={19} />
      </span>
      <p className="max-w-sm text-sm text-clay">{text}</p>
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
      className={`flex items-center gap-3 rounded-2xl p-3.5 ring-1 ${
        leader ? "bg-gold/8 ring-gold/35" : "bg-cream-2/70 ring-forest/8"
      }`}
    >
      <UserAvatar
        user={student?.user}
        size={46}
        className={leader ? "ring-2 ring-gold" : "ring-2 ring-forest/10"}
      />
      <div className="min-w-0">
        <p className="truncate font-serif text-sm font-bold text-forest">
          {nameOf(student)}
        </p>
        <p
          dir="ltr"
          className="flex items-center gap-1 text-[11px] text-clay tabular-nums rtl:justify-end"
        >
          <IdCard size={11} />
          {student?.registrationNumber ?? ""}
        </p>
        {leader && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
            <Crown size={10} />
            {leaderLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/** One team that asked for this topic, with everyone in it named. */
function RequestCard({
  request,
  date,
}: {
  request: TopicGroupRequest;
  date: string;
}) {
  const { t } = useTranslation();
  const leaderId = request.leader?.id;
  const members = request.members ?? [];
  // The leader is stored among the members too; show the team once, and mark
  // the leader inside it rather than repeating them above the list.
  const people = members.length
    ? members.map((m) => m.student)
    : [request.leader];

  return (
    <li
      className={`rounded-2xl p-4 ring-1 ${
        REQUEST_TONES[request.status] ?? "bg-cream-2/70 ring-forest/10"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={request.status} />
          <span className="text-[11px] text-clay">
            {t("pro.membersCount", { count: people.length })}
          </span>
        </div>
        <span className="text-[11px] text-clay">
          {t("pro.sentOn", { date })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {people.map((s, i) => (
          <div
            key={s?.id ?? i}
            className="flex items-center gap-2.5 rounded-xl bg-cream-card/80 px-3 py-2"
          >
            <UserAvatar user={s?.user} size={30} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-forest">
                {nameOf(s)}
                {s?.id === leaderId && (
                  <Crown
                    size={11}
                    className="shrink-0 text-gold"
                    aria-label={t("pro.leader")}
                  />
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
