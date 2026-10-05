import { useState } from "react";
import { actionsOf, can, blockReason } from "../../lib/topic-actions";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Subtitles,
  ListChecks,
  Flag,
  Link2,
  FileText,
  FileCheck2,
  Gavel,
  Check,
  X,
  ExternalLink,
  CheckCircle2,
  Users,
  Users2,
  Trash2,
  Send,
  EyeOff,
  Archive,
  Pencil,
  Undo2,
  History,
  ChevronDown,
  Hourglass,
  Inbox,
  Layers,
  CalendarDays,
  CalendarClock,
  Crown,
  IdCard,
  Info,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useAdminTopic,
  useApproveTopic,
  useRejectTopic,
  useArchiveTopic,
  usePublishTopic,
  useUnpublishTopic,
  useUnarchiveTopic,
} from "../../hooks/admin-hook";
import { TopicDeleteDialog } from "../../components/dialog/topic/topic-delete-dialog.form";
import { ProjectMembersDialog } from "../../components/dialog/projects/project-members-dialog.form";
import { EditAssignedTopicDialog } from "../../components/dialog/projects/edit-assigned-topic-dialog.form";
import { SupervisionDialog } from "../../../supervision/components/supervision-dialog";
import i18n from "../../../../i18n/i18n";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { StatusPill } from "../../../../components/ui/status-pill";
import { noneText } from "../../../../lib/none-text";
import { None } from "../../../../lib/none";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { personName } from "../../../../lib/person-name";

/**
 * One topic, from the administration's side.
 *
 * The administration decides here, so the decision leads: right under the
 * header, full width, with the reason any button is missing said beside the
 * buttons. It used to sit at the bottom of a narrow sidebar, under a card
 * that only repeated the header's facts.
 *
 * Below it, in order: a team waiting for that decision (the usual reason a
 * button is missing), what the topic is and who took it, earlier refused
 * attempts, and the topic's requirements, objectives and references.
 */

type TopicReference = { title: string; url: string };

type PersonRef = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

type StudentLite = {
  id: string;
  registrationNumber?: string | null;
  user?: PersonRef | null;
};

/** Display name for a person, falling back to a dash rather than an empty gap. */
function nameOf(user?: PersonRef | null) {
  return personName(user) || "—";
}

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

export function AdminTopicDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "", lang } = useParams();

  // Build the topics-list path WITH the current language prefix so we
  // always return to /<lang>/admin/topics (not the admin dashboard).
  const topicsPath = `/${lang}/admin/topics`;

  const { data: topic, isLoading, isError, refetch } = useAdminTopic(id);
  const approve = useApproveTopic();
  const reject = useRejectTopic();
  const archive = useArchiveTopic();
  const publish = usePublishTopic();
  const unpublish = useUnpublishTopic();
  const unarchive = useUnarchiveTopic();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  function fmtDate(iso?: string) {
    if (!iso) return noneText();
    try {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  if (isLoading) {
    return <LoadingArea className="font-body py-20" />;
  }

  // انقطاعُ الاتّصال ليس «غير موجود»: يُقال ما جرى ويُعرض زرُّ إعادة.
  if (isError) {
    return <ErrorRetry onRetry={() => refetch()} />;
  }
  if (!topic) {
    return (
      <div className={`${CARD} px-6 py-20 text-center font-body text-sm text-clay`}>
        {t("admin.noTopics")}
      </div>
    );
  }

  const u = topic.professor?.user;
  const profName =
    personName(u) ||
    topic.professor?.universityEmail ||
    "—";
  const requirements: string[] = topic.requirements ?? [];
  const objectives: string[] = topic.objectives ?? [];
  const references: TopicReference[] =
    (topic.references as TopicReference[]) ?? [];
  const projectGroup = (
    topic as {
      projectGroup?: {
        id: string;
        members?: { id: string; isLeader: boolean; student?: StudentLite }[];
      } | null;
    }
  ).projectGroup;
  const hasGroup = Boolean(projectGroup);
  const groupId = projectGroup?.id ?? null;
  const members = projectGroup?.members ?? [];

  /**
   * زرّ الحذف: يُفتح لما يستطيع المعالج تذليله.
   *
   * حكم الخادم وحده كان يقرّر، وهو يرفض الحذف ما دامت للموضوع مجموعة. فبعد
   * أن صار للحذف معالجٌ **يفسخ المجموعة أوّلاً**، بقي الزرّ مطفأً على الحالة
   * التي بُني لها بالضبط — وضغطةٌ عليه لا تفتح شيئاً.
   *
   * والاستثناء محصورٌ في المانع الذي يزيله المعالج: `hasGroup` ومعه مُعرّف
   * المجموعة. أمّا طلب فريقٍ ينتظر قراراً (`waiting`/`reserved`) فيبقى
   * مانعاً — لا يملك المعالج البتّ فيه، ولا يصحّ أن يَعِد بما لا يفعل.
   */
  const deleteBlock = actionsOf(topic).blockedCodes.delete?.code;
  const deletableViaWizard =
    can(topic, "delete") || (deleteBlock === "hasGroup" && !!groupId);

  /**
   * Teams still waiting for a decision on this topic.
   *
   * A pending request reserves the topic, so the server refuses to publish,
   * reject or archive it. The team is on the page, and the decision card
   * says why those buttons stepped aside.
   */
  const pendingRequests =
    (
      topic as {
        groupRequests?: {
          id: string;
          createdAt: string;
          leader?: { id: string } | null;
          members?: { id: string; student?: StudentLite | null }[];
        }[];
      }
    ).groupRequests ?? [];
  const claimed = pendingRequests.length > 0;

  /**
   * المحاولاتُ السابقة — مرفوضةٌ كلُّها، للقراءة لا للقرار.
   *
   * ولا تُخلط بـ`pendingRequests`: من تلك يُحسب `claimed` الذي يُطفئ أزرار
   * النشر والرفض والأرشفة، ومحاولةٌ رُفضت قبل شهرٍ لا تحجز شيئاً.
   */
  const pastRequests =
    (
      topic as {
        pastRequests?: {
          id: string;
          rejectionReason: string | null;
          createdAt: string;
          updatedAt: string;
          leader?: { id: string; registrationNumber?: string | null } | null;
          members?: { id: string; student?: StudentLite | null }[];
        }[];
      }
    ).pastRequests ?? [];

  const requestCap = topic.maxRequests ?? null;
  const requestsUsed =
    (topic as { _count?: { groupRequests?: number } })._count?.groupRequests ??
    0;
  const capReached = requestCap !== null && requestsUsed >= requestCap;

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

        {/* back, and the topic's own actions */}
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(topicsPath)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-soft-sage transition hover:text-cream"
          >
            <ChevronRight size={17} className="ltr:rotate-180" />
            {t("admin.backToTopics")}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {hasGroup && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gold/50 px-3.5 py-2 text-xs font-semibold text-gold-soft transition hover:bg-gold/15"
              >
                <FileCheck2 size={15} />
                {t("supervision.sheet")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-[var(--t-brand-deep)] transition hover:bg-gold-soft"
            >
              <Pencil size={15} />
              {t("admin.editTopic")}
            </button>
            {/* Deleting is just deleting; members are managed from their own
                card. The server's verdict decides whether it is offered, and
                its reason is the tooltip when it is not. */}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!deletableViaWizard}
              title={
                can(topic, "delete")
                  ? undefined
                  : deletableViaWizard
                    ? t("admin.deleteStartsWithDissolve")
                    : blockReason(topic, "delete", t)
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#f0a48f]/50 px-3.5 py-2 text-xs font-semibold text-[#f0a48f] transition hover:bg-[#f0a48f]/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
            >
              <Trash2 size={15} />
              {t("admin.delete", { defaultValue: t("pro.delete") })}
            </button>
          </div>
        </div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          {/* what the topic is */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill status={topic.status} />
              <HeroChip icon={Layers}>
                {topic.specialization?.name ?? <None />}
              </HeroChip>
              <HeroChip icon={CalendarDays}>
                {topic.academicYear?.title ?? <None fem />}
              </HeroChip>
              <HeroChip icon={Users2}>
                {t("admin.maxStudentsN", { n: topic.maxStudents })}
              </HeroChip>
              <HeroChip icon={CalendarClock}>{fmtDate(topic.createdAt)}</HeroChip>
            </div>
            <h1 className="font-serif text-3xl leading-tight font-bold break-words text-cream lg:text-4xl">
              {topic.title}
            </h1>

            {/* who proposed it */}
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 ps-2 pe-5">
              <UserAvatar
                user={u}
                size={44}
                tone="gold"
                className="text-[var(--t-brand-deep)]! ring-2 ring-gold/60"
              />
              <div className="min-w-0">
                <p className="text-[11px] text-soft-sage">{t("admin.supervisor")}</p>
                <p className="truncate text-sm font-bold text-cream">{profName}</p>
              </div>
            </div>
          </div>

          {/* how it is doing, in three numbers */}
          <div className="grid shrink-0 grid-cols-3 gap-3">
            <HeroStat
              icon={Users}
              value={hasGroup ? `${members.length}/${topic.maxStudents}` : "0"}
              label={t("admin.groupMembers")}
            />
            <HeroStat
              icon={Inbox}
              // The cap is read before a refusal: the last one closes the topic.
              value={requestCap !== null ? `${requestsUsed}/${requestCap}` : String(requestsUsed)}
              label={t("pro.requestsCount")}
              tone={capReached ? "alarm" : undefined}
            />
            <HeroStat
              icon={Hourglass}
              value={String(pendingRequests.length)}
              label={t("admin.td.awaiting")}
              tone={claimed ? "gold" : undefined}
            />
          </div>
        </div>
      </section>

      {/* ══════════ the decision ══════════ */}
      <section className={`p-6 ${CARD}`}>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-4">
          <h2 className="flex items-center gap-2.5 font-serif text-lg font-bold text-forest">
            <span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold">
              <Gavel size={18} />
            </span>
            {t("admin.adminAction")}
          </h2>
          <span className="flex items-center gap-2 text-xs text-clay">
            {t("admin.currentStatus")}
            <StatusPill status={topic.status} />
          </span>
        </header>

        {rejecting ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-forest">
              {t("admin.rejectionReason")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              className="w-full resize-y rounded-2xl border border-forest/15 bg-cream-2 p-4 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              placeholder={t("admin.rejectionReasonPlaceholder")}
            />
            <p className="text-[11px] text-clay">
              {t("admin.rejectReasonToProf", {
                defaultValue: t("admin.rejectionReachesProfessor"),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doReject}
                disabled={reject.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-brick px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <X size={16} />
                {t("admin.confirmReject")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(false);
                  setReason("");
                }}
                className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-bold text-forest transition hover:bg-forest/5"
              >
                {t("admin.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Why buttons are missing, said beside them rather than left as
                a gap the reader has to explain to themselves. */}
            {(hasGroup || claimed || (topic.status === "rejected" && topic.rejectionReason)) && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {hasGroup && (
                  <Note tone="sage" icon={Info}>
                    {t("admin.hasGroupNote", {
                      defaultValue: t("admin.topicHasGroupHint"),
                    })}
                  </Note>
                )}
                {claimed && (
                  <Note tone="gold" icon={Hourglass}>
                    {t("admin.blockedByRequest")}{" "}
                    <Link
                      to={`/${lang}/admin/group-requests`}
                      className="inline-flex items-center gap-1 font-bold text-gold transition hover:opacity-80"
                    >
                      <Gavel size={12} />
                      {t("admin.decideOnRequest")}
                    </Link>
                  </Note>
                )}
                {topic.status === "rejected" && topic.rejectionReason && (
                  <Note tone="brick" icon={AlertCircle}>
                    <span className="font-bold">{t("status.rejected")}:</span>{" "}
                    {topic.rejectionReason}
                  </Note>
                )}
              </div>
            )}

            {/*
              Contextual actions.

              Each reads the server's verdict. When it says no, the button
              stays visible but disabled with the reason on hover: an action
              that simply vanishes teaches nothing about why.
            */}
            <div className="flex flex-wrap gap-2.5">
              {can(topic, "approve") && (
                <ActBtn onClick={doApprove} disabled={approve.isPending} variant="approve">
                  <Check size={17} />
                  {t("admin.approveTopicBtn")}
                </ActBtn>
              )}
              {can(topic, "publish") && (
                <ActBtn onClick={doPublish} disabled={publish.isPending} variant="publish">
                  <Send size={17} />
                  {t("admin.publish", { defaultValue: t("admin.publishTopic") })}
                </ActBtn>
              )}
              {can(topic, "unpublish") && (
                <ActBtn onClick={doUnpublish} disabled={unpublish.isPending} variant="neutral">
                  <EyeOff size={17} />
                  {t("admin.unpublish")}
                </ActBtn>
              )}
              {can(topic, "reject") && (
                <ActBtn onClick={() => setRejecting(true)} variant="reject">
                  <X size={17} />
                  {t("admin.rejectTopicBtn")}
                </ActBtn>
              )}
              {topic.status === "archived" ? (
                <ActBtn
                  onClick={doUnarchive}
                  disabled={unarchive.isPending || !can(topic, "unarchive")}
                  title={blockReason(topic, "unarchive", t)}
                  variant="publish"
                >
                  <Undo2 size={17} />
                  {t("admin.unarchive")}
                </ActBtn>
              ) : (
                // Archiving is offered on every decided topic, and refused
                // with its reason when a team is still waiting on it.
                ["approved", "open", "full"].includes(topic.status) && (
                  <ActBtn
                    onClick={doArchive}
                    disabled={archive.isPending || !can(topic, "archive")}
                    title={blockReason(topic, "archive", t)}
                    variant="neutral"
                  >
                    <Archive size={17} />
                    {t("admin.archive")}
                  </ActBtn>
                )
              )}
            </div>

            <p className="text-[11px] text-clay/80">{t("admin.decisionNote")}</p>
          </div>
        )}
      </section>

      {/* ══════════ a team waiting on that decision ══════════ */}
      {claimed && (
        <section className="rounded-3xl border-2 border-gold/45 bg-gold/5 p-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 pb-4">
            <h2 className="flex items-center gap-2.5 font-serif text-lg font-bold text-forest">
              <span className="grid size-9 place-items-center rounded-xl bg-gold/20 text-gold">
                <Users size={18} />
              </span>
              {t("admin.teamWaiting")}
            </h2>
            <Link
              to={`/${lang}/admin/group-requests`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-forest-deep transition hover:bg-gold-soft"
            >
              <Gavel size={14} />
              {t("admin.decideOnRequest")}
            </Link>
          </header>

          <p className="mb-4 text-xs leading-relaxed text-clay">
            {t("admin.teamWaitingNote")}
          </p>

          <div className="space-y-4">
            {pendingRequests.map((r) => (
              <div key={r.id}>
                <p className="mb-2 text-[11px] text-clay">
                  {t("admin.sentOn", { date: fmtDate(r.createdAt) })}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(r.members ?? []).map((m) => (
                    <StudentCard
                      key={m.id}
                      student={m.student}
                      leader={m.student?.id === r.leader?.id}
                      leaderLabel={t("admin.leader")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════ what it asks, and who took it ══════════
          Two cards on one row share one height. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={Subtitles} title={t("admin.topicDescriptionLabel")}>
          <p className="leading-relaxed whitespace-pre-line text-forest/85">
            {topic.description || <None />}
          </p>
        </Section>

        <Section
          icon={Users}
          title={t("admin.groupMembers")}
          badge={
            hasGroup
              ? t("admin.membersOfMax", { n: members.length, max: topic.maxStudents })
              : undefined
          }
          action={
            hasGroup ? (
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10"
              >
                <Users size={14} />
                {t("admin.manageMembers")}
              </button>
            ) : undefined
          }
        >
          {members.length === 0 ? (
            <EmptyNote icon={Users} text={t("admin.noGroupYet")} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {members.map((m) => (
                <StudentCard
                  key={m.id}
                  student={m.student}
                  leader={m.isLeader}
                  leaderLabel={t("admin.leader")}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/*
        المحاولاتُ السابقة — تحت الحيّ لا بجانبه.
        الفرقُ بينهما ليس في التاريخ بل في ما يُفعل بهما: ذاك يُقرَّر فيه،
        وهذه تُقرأ. ولو عُرضا سواءً لَبدا للمسؤول أنّ أمامه اختياراً بين
        فرقٍ — وهو اختيارٌ لا وجود له.
      */}
      {pastRequests.length > 0 && (
        <details className={`group ${CARD}`}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5 p-5 text-forest marker:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-forest/8 text-clay">
              <History size={17} />
            </span>
            <h2 className="font-serif text-base font-bold">{t("admin.pastAttempts")}</h2>
            <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay tabular-nums">
              {pastRequests.length}
            </span>
            <ChevronDown size={16} className="ms-auto text-clay transition group-open:rotate-180" />
          </summary>

          <div className="space-y-3 border-t border-forest/10 p-5">
            <p className="text-xs leading-relaxed text-clay">{t("admin.pastAttemptsNote")}</p>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {pastRequests.map((r) => (
                <div key={r.id} className="rounded-2xl bg-cream-2/70 p-4 ring-1 ring-forest/8">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusPill status="rejected" />
                    <span className="text-[11px] text-clay">
                      {t("admin.sentOn", { date: fmtDate(r.createdAt) })}
                    </span>
                    <span className="text-[11px] text-clay">
                      {t("admin.rejectedOn", { date: fmtDate(r.updatedAt) })}
                    </span>
                  </div>

                  <p className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-forest">
                    {(r.members ?? []).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-cream-card px-2 py-1 ring-1 ring-forest/10"
                      >
                        <span className="text-[13px]">{nameOf(m.student?.user)}</span>
                        <span dir="ltr" className="font-mono text-[11px] text-clay">
                          {m.student?.registrationNumber ?? ""}
                        </span>
                      </span>
                    ))}
                  </p>

                  {r.rejectionReason ? (
                    <p className="rounded-xl bg-brick/8 px-3 py-2 text-[13px] leading-relaxed text-brick">
                      <span className="font-bold">{t("stu.rejectionReason")}: </span>
                      {r.rejectionReason}
                    </p>
                  ) : (
                    <p className="text-[12px] text-clay/80">{t("admin.noRejectionReason")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* ══════════ requirements, objectives, references ══════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Section icon={ListChecks} title={t("admin.requirementsLabel")}>
          {requirements.length === 0 ? (
            <EmptyNote icon={ListChecks} text={t("admin.noRequirements")} />
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

        <Section icon={Flag} title={t("admin.objectivesLabel")}>
          {objectives.length === 0 ? (
            <EmptyNote icon={Flag} text={t("admin.noObjectives")} />
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
          <Section icon={Link2} title={t("admin.referencesLabel")}>
            {references.length === 0 ? (
              <EmptyNote icon={Link2} text={t("admin.noReferencesYet")} />
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
                      {t("admin.openLink")}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>
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

      {sheetOpen && (
        <SupervisionDialog topicId={topic.id} onClose={() => setSheetOpen(false)} />
      )}

      {/*
        الحذف معالجٌ لا تأكيدٌ واحد: موضوعٌ قامت عليه مجموعةٌ لا تقبل الخلفية
        حذفه، فكان الزرّ يفتح تأكيداً ثم يُردّ بخطأ. والمعالج يمرّ بما يمنع:
        يفسخ المجموعة بسببٍ يصل أعضاءها، ثم يُراسل المشرف، ثم يحذف.
      */}
      {confirmOpen && (
        <TopicDeleteDialog
          onClose={() => setConfirmOpen(false)}
          topicId={topic.id}
          topicTitle={topic.title}
          groupId={groupId}
          members={members}
          supervisor={topic.professor ?? null}
          supervisorUserId={
            (topic.professor?.user as { id?: string } | undefined)?.id ?? null
          }
          onDeleted={() => navigate(topicsPath)}
        />
      )}
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
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  /** `alarm` for a cap that has been reached — read before refusing. */
  tone?: "gold" | "alarm";
}) {
  return (
    <div
      className={`flex min-w-24 flex-col items-center rounded-2xl border px-4 py-3 text-center ${
        tone === "alarm"
          ? "border-[#f0a48f]/50 bg-[#f0a48f]/10"
          : tone === "gold"
            ? "border-gold/60 bg-gold/15"
            : "border-white/10 bg-white/5"
      }`}
    >
      <Icon size={17} className={`mb-1 ${tone === "alarm" ? "text-[#f0a48f]" : "text-gold-soft"}`} />
      <span dir="ltr" className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">
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
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col p-6 ${CARD}`}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-4">
        <h2 className="flex items-center gap-2.5 font-serif text-lg font-bold text-forest">
          <span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold">
            <Icon size={18} />
          </span>
          {title}
          {badge && (
            <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-bold text-clay tabular-nums">
              {badge}
            </span>
          )}
        </h2>
        {action}
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

function Note({
  tone,
  icon: Icon,
  children,
}: {
  tone: "sage" | "gold" | "brick";
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const cls =
    tone === "gold"
      ? "bg-gold/10 ring-gold/30 [&>svg]:text-gold"
      : tone === "brick"
        ? "bg-brick/8 ring-brick/25 text-brick [&>svg]:text-brick"
        : "bg-sage/10 ring-sage/25 [&>svg]:text-sage";
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs leading-relaxed text-forest ring-1 ${cls}`}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function StudentCard({
  student,
  leader,
  leaderLabel,
}: {
  student?: StudentLite | null;
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
          {nameOf(student?.user)}
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

const ACT_VARIANTS: Record<string, string> = {
  approve: "bg-sage text-cream-card shadow-[0_6px_16px_rgba(74,112,102,0.3)] hover:opacity-90",
  publish: "bg-gold text-forest-deep shadow-[0_6px_16px_rgba(193,150,90,0.3)] hover:bg-gold-soft",
  reject: "border-2 border-brick/50 text-brick hover:bg-brick/10",
  neutral: "border border-forest/20 text-forest hover:border-gold/50 hover:bg-gold/10",
};

function ActBtn({
  onClick,
  disabled,
  title,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** سبب التعطيل — يظهر عند المرور، فلا يبقى الزرّ مطفأً بلا تفسير. */
  title?: string;
  variant: "approve" | "publish" | "reject" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? title : undefined}
      className={`inline-flex min-w-40 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${ACT_VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}
