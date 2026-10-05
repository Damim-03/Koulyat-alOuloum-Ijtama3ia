import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Crown,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  Hourglass,
  IdCard,
  Inbox,
  Layers,
  Search,
  Send,
  Star,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useMyGroupRequests,
  useCancelGroupRequest,
  useMyProject,
} from "../hooks/Student-hook";
import type {
  DashPerson,
  GroupRequest,
  GroupRequestMember,
  GroupRequestStatus,
} from "../../../types/student.types";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { DangerConfirm } from "../../../components/dialog/danger-confirm";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import { personName } from "../../../lib/person-name";

/**
 * The student's requests — every team request they are part of, sent by
 * them or by a teammate.
 *
 * Each card answers, in order: what state is it in, where is it on its way
 * (sent → reviewed → decided), who supervises the topic, who is on the team,
 * and what can be done about it now. There is no "new request" button here:
 * a request starts from a topic, so it is sent from the topic's own page.
 */

type Filter = "all" | GroupRequestStatus;

const STATUS: Record<
  GroupRequestStatus,
  { icon: LucideIcon; pill: string; stripe: string; glow: string }
> = {
  pending: {
    icon: Hourglass,
    pill: "bg-gold/15 text-gold ring-gold/30",
    stripe: "bg-gold",
    glow: "bg-gold/10",
  },
  accepted: {
    icon: CheckCircle2,
    pill: "bg-sage/15 text-sage ring-sage/30",
    stripe: "bg-sage",
    glow: "bg-sage/10",
  },
  rejected: {
    icon: XCircle,
    pill: "bg-brick/10 text-brick ring-brick/25",
    stripe: "bg-brick",
    glow: "bg-brick/8",
  },
};

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

function fullName(u?: DashPerson | null) {
  return personName(u);
}

function memberName(m: GroupRequestMember) {
  return fullName(m.student?.user) || m.student?.registrationNumber || "—";
}

function useFmtDate() {
  const { i18n } = useTranslation();
  return (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(i18n.language || "ar", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  };
}

export function StudentMyRequestsPage() {
  const { t } = useTranslation();
  const { data: requests, isLoading, isError, refetch } = useMyGroupRequests();
  const { data: project } = useMyProject();
  const cancel = useCancelGroupRequest();

  const [filter, setFilter] = useState<Filter>("all");
  const [sheetTopicId, setSheetTopicId] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<GroupRequest | null>(null);

  const list = useMemo(() => requests ?? [], [requests]);

  const counts = useMemo(
    () => ({
      all: list.length,
      pending: list.filter((r) => r.status === "pending").length,
      accepted: list.filter((r) => r.status === "accepted").length,
      rejected: list.filter((r) => r.status === "rejected").length,
    }),
    [list],
  );

  const shown =
    filter === "all" ? list : list.filter((r) => r.status === filter);

  return (
    <div className="font-body">
      <Hero counts={counts} filter={filter} onFilter={setFilter} />

      {/* the project, when there is one — the thing these requests were for */}
      {project && (
        <ProjectBanner
          title={project.topic?.title ?? "—"}
          supervisor={fullName(project.topic?.professor?.user)}
        />
      )}

      {isLoading ? (
        <div className="space-y-5">
          {[0, 1].map((k) => (
            <div
              key={k}
              className="h-72 animate-pulse rounded-3xl bg-forest/5"
            />
          ))}
        </div>
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState hasProject={!!project} />
      ) : shown.length === 0 ? (
        <div className={`${CARD} py-14 text-center text-sm text-clay`}>
          {t("stu.req.noneInFilter")}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onCancel={() => setToCancel(req)}
              onOpenSheet={(id) => setSheetTopicId(id)}
            />
          ))}
        </div>
      )}

      {/* cancelling frees the topic for another team — say so before it happens */}
      <DangerConfirm
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={() =>
          toCancel &&
          cancel.mutate(toCancel.id, { onSuccess: () => setToCancel(null) })
        }
        loading={cancel.isPending}
        icon={X}
        title={t("stu.cancelRequest")}
        name={toCancel?.topic?.title ?? "—"}
        kicker={t("stu.req.requestWord")}
        avatar={
          <span className="grid size-13 place-items-center rounded-xl bg-gold/15 text-gold">
            <Send size={22} />
          </span>
        }
        facts={
          toCancel
            ? [
                {
                  icon: Star,
                  label: t("stu.priority"),
                  value: toCancel.priority,
                },
                {
                  icon: Users,
                  label: t("stu.teamMembers"),
                  value: (toCancel.members ?? []).map(memberName).join("، "),
                },
              ]
            : []
        }
        warning={t("stu.req.cancelWarning")}
        confirmLabel={t("stu.cancelRequest")}
        cancelLabel={t("stu.req.keepRequest")}
      />

      {sheetTopicId && (
        <SupervisionDialog
          topicId={sheetTopicId}
          onClose={() => setSheetTopicId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  header
// ─────────────────────────────────────────────────────────────

/**
 * Title and the four counts, on the brand green like the dashboard's
 * identity card. The counts double as filters — a count one cannot act on
 * is decoration.
 */
function Hero({
  counts,
  filter,
  onFilter,
}: {
  counts: Record<Filter, number>;
  filter: Filter;
  onFilter: (f: Filter) => void;
}) {
  const { t } = useTranslation();

  const tiles: { key: Filter; label: string; icon: LucideIcon; tone: string }[] =
    [
      { key: "all", label: t("stu.req.all"), icon: Layers, tone: "text-cream" },
      {
        key: "pending",
        label: t("stu.reqStatus.pending"),
        icon: Hourglass,
        tone: "text-gold-soft",
      },
      {
        key: "accepted",
        label: t("stu.reqStatus.accepted"),
        icon: CheckCircle2,
        tone: "text-soft-sage",
      },
      {
        key: "rejected",
        label: t("stu.reqStatus.rejected"),
        icon: XCircle,
        tone: "text-[#f0a48f]",
      },
    ];

  return (
    <section className="relative mb-6 rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
      {/* ornament, clipped by its own layer so the section never scrolls */}
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
        <div className="absolute -end-16 -top-28 size-80 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-72 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative">
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)]">
            <Inbox size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-bold text-cream">
              {t("stu.myRequestsTitle")}
            </h1>
            <p className="mt-1 text-sm text-soft-sage">
              {t("stu.myRequestsSubtitle")}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label={t("stu.req.filterBy")}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {tiles.map(({ key, label, icon: Icon, tone }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter(key)}
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                  active
                    ? "border-gold/70 bg-white/12 shadow-[0_0_0_1px_rgba(217,174,114,0.35)]"
                    : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-2xl leading-none font-bold text-cream tabular-nums">
                    {counts[key]}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-soft-sage">
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProjectBanner({
  title,
  supervisor,
}: {
  title: string;
  supervisor: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-gold/30 bg-gold/8 p-5 sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/20 text-gold">
        <FolderKanban size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gold">
          {t("stu.req.projectActive")}
        </p>
        <p className="truncate font-serif text-lg font-bold text-forest">
          {title}
        </p>
        {supervisor && (
          <p className="text-xs text-clay">
            {t("stu.academicSupervisor")}: {supervisor}
          </p>
        )}
      </div>
      <Link
        to="../project"
        relative="path"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
      >
        {t("stu.viewProject")}
        <ArrowLeft size={16} className="ltr:rotate-180" />
      </Link>
    </div>
  );
}

function EmptyState({ hasProject }: { hasProject: boolean }) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  return (
    <div className={`${CARD} relative overflow-hidden px-6 py-16 text-center`}>
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-linear-to-br from-gold/25 to-gold/5 text-gold ring-8 ring-gold/5">
        <Inbox size={34} />
      </div>
      <h2 className="font-serif text-xl font-bold text-forest">
        {t("stu.noRequestsYet")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-clay">
        {hasProject ? t("stu.req.emptyWithProject") : t("stu.req.emptyBody")}
      </p>
      {!hasProject && (
        <Link
          to={localePath(PATHS.topics)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
        >
          <Search size={16} />
          {t("stu.browseTopics")}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  one request
// ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onCancel,
  onOpenSheet,
}: {
  req: GroupRequest;
  onCancel: () => void;
  onOpenSheet: (topicId: string) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFmtDate();
  const st = STATUS[req.status] ?? STATUS.pending;
  const StatusIcon = st.icon;

  const members = req.members ?? [];
  const prof = req.topic?.professor?.user;
  const leader = members.find((m) => m.student?.id === req.leaderStudentId);
  const isLeader = req.isLeader ?? true;

  return (
    <article className={`relative overflow-hidden ${CARD}`}>
      {/* status stripe and a faint wash of the same colour */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 start-0 w-1.5 ${st.stripe}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -end-24 -top-24 size-64 rounded-full blur-3xl ${st.glow}`}
      />

      <div className="relative p-6 ps-8">
        {/* badges */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${st.pill}`}
          >
            <StatusIcon size={13} />
            {t(`stu.reqStatus.${req.status}`, { defaultValue: req.status })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-xs font-bold text-gold ring-1 ring-gold/25">
            <Star size={12} className="fill-current" />
            {t("stu.priorityN", { n: req.priority })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/6 px-3 py-1 text-xs text-clay">
            <Send size={12} />
            {isLeader
              ? t("stu.dash.sentByYou")
              : t("stu.dash.sentBy", {
                  name: leader ? memberName(leader) : "—",
                })}
          </span>
        </div>

        {/* title */}
        <h2 className="font-serif text-xl leading-snug font-bold text-forest sm:text-2xl">
          {req.topic?.title ?? "—"}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-clay">
          {req.topic?.specialization?.name && (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={13} className="text-gold" />
              {req.topic.specialization.name}
            </span>
          )}
          {req.topic?.academicYear?.title && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={13} className="text-gold" />
              {req.topic.academicYear.title}
            </span>
          )}
        </div>

        {/* where it is on its way */}
        <Tracker
          status={req.status}
          sentOn={fmt(req.createdAt)}
          decidedOn={req.status === "pending" ? null : fmt(req.updatedAt)}
        />

        {/* why it was refused */}
        {req.status === "rejected" && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brick/25 bg-brick/8 p-4">
            <XCircle size={18} className="mt-0.5 shrink-0 text-brick" />
            <div>
              <p className="mb-0.5 text-sm font-bold text-brick">
                {t("stu.rejectionReason")}
              </p>
              <p className="text-sm leading-relaxed text-forest/80">
                {req.rejectionReason || t("stu.dash.noReasonGiven")}
              </p>
            </div>
          </div>
        )}

        {/* supervisor | team */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex items-center gap-3 rounded-2xl bg-cream-2/70 p-4 ring-1 ring-forest/5">
            <UserAvatar user={prof} size={48} className="ring-2 ring-gold/40" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[11px] text-clay">
                <GraduationCap size={12} className="text-gold" />
                {t("stu.academicSupervisor")}
              </p>
              <p className="truncate font-serif text-base font-bold text-forest">
                {fullName(prof) || "—"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-cream-2/70 p-4 ring-1 ring-forest/5">
            <p className="mb-2.5 flex items-center justify-between text-[11px] text-clay">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-gold" />
                {t("stu.teamMembers")}
              </span>
              <span className="tabular-nums">
                {req.topic?.maxStudents
                  ? `${members.length}/${req.topic.maxStudents}`
                  : members.length}
              </span>
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {members.map((m) => {
                const lead = m.student?.id === req.leaderStudentId;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl bg-cream-card px-2.5 py-2 ring-1 ring-forest/8"
                  >
                    <UserAvatar
                      user={m.student?.user}
                      size={32}
                      className={lead ? "ring-2 ring-gold" : ""}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-[13px] font-medium text-forest">
                        <span className="truncate">{memberName(m)}</span>
                        {lead && (
                          <Crown
                            size={12}
                            className="shrink-0 text-gold"
                            aria-label={t("stu.dash.leader")}
                          />
                        )}
                      </span>
                      {m.student?.registrationNumber && (
                        <span
                          dir="ltr"
                          className="flex items-center gap-1 text-[11px] text-clay tabular-nums rtl:justify-end"
                        >
                          <IdCard size={11} />
                          {m.student.registrationNumber}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* what can be done now */}
        <Actions
          req={req}
          isLeader={isLeader}
          onCancel={onCancel}
          onOpenSheet={onOpenSheet}
        />
      </div>
    </article>
  );
}

/**
 * Sent → reviewed → decided. A request that has only a status badge says
 * where it is, not how far it has come or what is still ahead of it.
 */
function Tracker({
  status,
  sentOn,
  decidedOn,
}: {
  status: GroupRequestStatus;
  sentOn: string | null;
  decidedOn: string | null;
}) {
  const { t } = useTranslation();

  const decided = status !== "pending";
  const steps: {
    label: string;
    sub: string | null;
    state: "done" | "current" | "todo" | "refused";
    icon: LucideIcon;
  }[] = [
    { label: t("stu.req.stepSent"), sub: sentOn, state: "done", icon: Send },
    {
      label: t("stu.req.stepReview"),
      sub: decided ? null : t("stu.req.inProgress"),
      state: decided ? "done" : "current",
      icon: Hourglass,
    },
    {
      label:
        status === "accepted"
          ? t("stu.req.stepAccepted")
          : status === "rejected"
            ? t("stu.req.stepRejected")
            : t("stu.req.stepDecision"),
      sub: decidedOn,
      state:
        status === "accepted"
          ? "done"
          : status === "rejected"
            ? "refused"
            : "todo",
      icon:
        status === "rejected"
          ? XCircle
          : status === "accepted"
            ? CheckCircle2
            : FileCheck2,
    },
  ];

  const node = {
    done: "bg-sage text-cream-card",
    current: "bg-gold text-[var(--t-brand-deep)] ring-4 ring-gold/20",
    todo: "bg-cream-2 text-clay ring-1 ring-forest/10",
    refused: "bg-brick text-cream-card",
  } as const;

  return (
    <ol className="my-5 grid grid-cols-3 rounded-2xl bg-cream-2/60 px-3 py-4 ring-1 ring-forest/5">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const lineDone = i < steps.length - 1 && steps[i + 1].state !== "todo";
        return (
          <li key={i} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute top-4 start-1/2 h-0.5 w-full ${
                  lineDone
                    ? steps[i + 1].state === "refused"
                      ? "bg-brick/50"
                      : "bg-sage/70"
                    : "bg-forest/10"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid size-8 place-items-center rounded-full ${node[s.state]}`}
            >
              <Icon size={15} />
            </span>
            <span
              className={`mt-2 text-[11px] font-semibold sm:text-xs ${
                s.state === "todo"
                  ? "text-clay"
                  : s.state === "refused"
                    ? "text-brick"
                    : "text-forest"
              }`}
            >
              {s.label}
            </span>
            {s.sub && (
              <span className="mt-0.5 text-[10px] text-clay sm:text-[11px]">
                {s.sub}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Actions({
  req,
  isLeader,
  onCancel,
  onOpenSheet,
}: {
  req: GroupRequest;
  isLeader: boolean;
  onCancel: () => void;
  onOpenSheet: (topicId: string) => void;
}) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const topicId = req.topic?.id ?? null;

  let content: React.ReactNode = null;

  if (req.status === "pending") {
    content = isLeader ? (
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 rounded-xl border border-brick/40 px-4 py-2 text-sm font-semibold text-brick transition hover:bg-brick/10 active:scale-95"
      >
        <X size={16} />
        {t("stu.cancelRequest")}
      </button>
    ) : (
      <p className="text-xs text-clay">{t("stu.req.onlyLeaderCancels")}</p>
    );
  } else if (req.status === "accepted") {
    content = (
      <>
        {topicId && (
          <button
            type="button"
            onClick={() => onOpenSheet(topicId)}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10 active:scale-95"
          >
            <FileCheck2 size={16} />
            {t("supervision.sheet")}
          </button>
        )}
        <Link
          to="../project"
          relative="path"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
        >
          <FolderKanban size={16} />
          {t("stu.viewProjectDetails")}
        </Link>
      </>
    );
  } else if (req.status === "rejected" && topicId) {
    content = (
      <Link
        to={localePath(`${PATHS.topics}/${topicId}`)}
        className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10 active:scale-95"
      >
        {t("stu.editResubmit")}
        <ArrowLeft size={16} className="ltr:rotate-180" />
      </Link>
    );
  }

  if (!content) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-forest/10 pt-4">
      {content}
    </div>
  );
}
