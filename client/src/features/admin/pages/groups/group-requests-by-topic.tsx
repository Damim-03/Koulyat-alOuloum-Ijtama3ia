import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  ChevronLeft,
  Clock,
  FolderKanban,
  Inbox,
  Layers,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { AdminGroupRequest, AdminRequestTopic } from "../../../../types/admin";
import { useAcceptGroupRequest, useRejectGroupRequest } from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { personName as nameByLang } from "../../../../lib/person-name";
import { noneText } from "../../../../lib/none-text";
import i18n from "../../../../i18n/i18n";

const personName = (u: unknown) => nameByLang(u as never) || "—";
const fmtDate = (iso?: string) => {
  if (!iso) return noneText();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? noneText() : d.toLocaleDateString(i18n.language, { dateStyle: "medium" });
};

/**
 * Group requests gathered under their topics.
 *
 * Several teams ask for one topic at once and the administration picks one,
 * so the choice is made here, per topic: its waiting teams in the order they
 * arrived, the team it went to, and the requests that ended — rejected, or
 * cancelled when another team was chosen. Accepting asks first, saying how
 * many other teams it will release.
 */
export function TopicRequestsBoard({
  topics,
  onOpenRequest,
  onDelete,
}: {
  topics: AdminRequestTopic[];
  onOpenRequest: (id: string) => void;
  onDelete: (r: AdminGroupRequest) => void;
}) {
  const { t } = useTranslation();
  const accept = useAcceptGroupRequest();
  const reject = useRejectGroupRequest();
  const [toAccept, setToAccept] = useState<{ request: AdminGroupRequest; others: number } | null>(null);

  return (
    <>
      <div className="space-y-5">
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onAccept={(request, others) => setToAccept({ request, others })}
            onReject={(id) => reject.mutate({ id })}
            rejecting={reject.isPending}
            onOpenRequest={onOpenRequest}
            onDelete={onDelete}
          />
        ))}
      </div>

      <ConfirmDialog
        icon={Check}
        open={!!toAccept}
        title={t("admin.grt.acceptTitle")}
        message={
          toAccept
            ? toAccept.others > 0
              ? t("admin.grt.acceptConfirmOthers", { name: personName(toAccept.request.leader?.user), count: toAccept.others })
              : t("admin.grt.acceptConfirm", { name: personName(toAccept.request.leader?.user) })
            : ""
        }
        confirmLabel={t("admin.accept")}
        loading={accept.isPending}
        onConfirm={() => toAccept && accept.mutate(toAccept.request.id, { onSettled: () => setToAccept(null) })}
        onClose={() => setToAccept(null)}
      />
    </>
  );
}

/** The status colours, each with its dark-theme counterpart: a pale wash on
    the light card, a translucent one with light ink on the dark card. */
const TONE = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25",
  red: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25",
};
const INK = {
  amber: "text-amber-700 dark:text-amber-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  red: "text-red-600 dark:text-red-300",
};

/** Where the topic stands for requests — one word, coloured. */
function topicState(topic: AdminRequestTopic) {
  if (topic.projectGroup || topic.status === "full")
    return { key: "taken", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" };
  if (topic.status === "open")
    return topic.maxRequests !== null && topic.pendingRequestCount >= topic.maxRequests
      ? { key: "capFull", tone: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" }
      : { key: "open", tone: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300" };
  if (topic.status === "approved") return { key: "unpublished", tone: "bg-forest/8 text-clay" };
  return { key: topic.status, tone: "bg-forest/8 text-clay" };
}

function TopicCard({
  topic,
  onAccept,
  onReject,
  rejecting,
  onOpenRequest,
  onDelete,
}: {
  topic: AdminRequestTopic;
  onAccept: (r: AdminGroupRequest, others: number) => void;
  onReject: (id: string) => void;
  rejecting: boolean;
  onOpenRequest: (id: string) => void;
  onDelete: (r: AdminGroupRequest) => void;
}) {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const [showEnded, setShowEnded] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Arrived from this topic's own page: bring it into view, once.
  useEffect(() => {
    if (topic.focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [topic.focused]);

  const pending = topic.requests.filter((r) => r.status === "pending");
  const accepted = topic.requests.filter((r) => r.status === "accepted");
  const ended = topic.requests.filter((r) => r.status === "rejected");
  const state = topicState(topic);
  const taken = state.key === "taken";
  const winner = accepted[0];
  const cap = topic.maxRequests;
  // Every waiting team, not only those the filters show: accepting releases them all.
  const waitingOnTopic = topic.counts.pending;

  return (
    <section
      ref={ref}
      className={`overflow-hidden rounded-3xl border bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] ${
        topic.focused ? "focus-glow border-gold" : pending.length ? "border-gold/40" : "border-forest/10"
      }`}
      data-testid="request-topic"
      data-focused={topic.focused || undefined}
    >
      {/* ── the topic ── */}
      <header className="border-b border-forest/10 bg-linear-to-l from-cream-2/70 to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {topic.focused && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-forest-deep">
                  <Crosshair size={12} /> {t("admin.grt.focused")}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${state.tone}`}>
                {t(`admin.grt.state.${state.key}`, { defaultValue: t(`status.${state.key}`, { defaultValue: state.key }) })}
              </span>
            </div>
            <Link
              to={`/${lang}/admin/topics/${topic.id}`}
              className="font-serif text-lg leading-snug font-bold break-words text-forest transition hover:text-gold"
            >
              {topic.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-clay">
              {topic.professor?.user && (
                <span className="inline-flex items-center gap-1">
                  <UserRound size={12} /> {personName(topic.professor.user)}
                </span>
              )}
              {topic.specialization?.name && (
                <span className="inline-flex items-center gap-1">
                  <Layers size={12} /> {topic.specialization.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {t("admin.grt.seats", { count: topic.maxStudents })}
              </span>
            </div>
          </div>

          {taken ? (
            // Assigned: nothing waits any more, so the cap would only ever
            // read 0. Say who it went to instead — when the filters show them.
            winner && (
              <div
                data-testid="topic-assigned"
                className="w-full shrink-0 rounded-2xl border border-emerald-300/60 bg-emerald-50/60 px-3.5 py-2.5 sm:w-auto sm:max-w-64 sm:min-w-44 dark:border-emerald-400/25 dark:bg-emerald-400/10"
              >
                <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${INK.emerald}`}>
                  <CheckCircle2 size={13} /> {t("admin.grt.assignedTo")}
                </p>
                <p className="truncate font-serif text-[15px] font-bold text-forest">
                  {t("admin.grt.teamOf", { name: personName(winner.leader?.user) })}
                </p>
              </div>
            )
          ) : (
            // the cap: how many teams wait, against how many it takes
            <div data-testid="topic-waiting" className="w-full shrink-0 rounded-2xl border border-forest/10 bg-cream-card px-3.5 py-2.5 sm:w-auto sm:min-w-44">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-clay">
                <Inbox size={13} className="text-gold" /> {t("admin.grt.waitingNow")}
              </p>
              <p className="font-serif text-xl font-bold text-forest tabular-nums">
                {cap !== null ? `${topic.pendingRequestCount}/${cap}` : topic.pendingRequestCount}
                {cap === null && <span className="ms-1.5 text-[11px] font-normal text-clay">{t("admin.grt.noCap")}</span>}
              </p>
              {cap !== null && (
                <span className="mt-1.5 flex gap-1" aria-hidden>
                  {Array.from({ length: cap }, (_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < topic.pendingRequestCount ? "bg-gold" : "bg-forest/10"}`} />
                  ))}
                </span>
              )}
            </div>
          )}
        </div>

        {/* all of its requests, by status */}
        <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] font-semibold">
          <CountChip icon={Clock} tone={TONE.amber} value={topic.counts.pending} label={t("admin.grt.countPending")} />
          <CountChip icon={CheckCircle2} tone={TONE.emerald} value={topic.counts.accepted} label={t("admin.grt.countAccepted")} />
          <CountChip icon={XCircle} tone={TONE.red} value={topic.counts.rejected} label={t("admin.grt.countEnded")} />
        </div>
      </header>

      <div className="divide-y divide-forest/10">
        {/* ── waiting for a decision, in the order they came ── */}
        {pending.length > 0 && (
          <Block icon={Clock} title={t("admin.grt.pendingTitle")} count={pending.length} tone={INK.amber}>
            {pending.map((r, i) => (
              <RequestRow key={r.id} request={r} rank={i + 1} onOpen={onOpenRequest}>
                <button
                  type="button"
                  onClick={() => onAccept(r, Math.max(0, waitingOnTopic - 1))}
                  disabled={r.actions ? !r.actions.canAccept : false}
                  title={r.actions?.blockedReasons?.accept}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-forest px-3 py-2 text-[12px] font-bold text-cream transition hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                >
                  <Check size={13} /> {t("admin.accept")}
                </button>
                <button
                  type="button"
                  onClick={() => onReject(r.id)}
                  disabled={rejecting || (r.actions ? !r.actions.canReject : false)}
                  title={r.actions?.blockedReasons?.reject}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-300 px-3 py-2 text-[12px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
                >
                  <X size={13} /> {t("admin.reject")}
                </button>
              </RequestRow>
            ))}
          </Block>
        )}

        {/* ── the team it went to ── */}
        {accepted.length > 0 && (
          <Block icon={CheckCircle2} title={t("admin.grt.acceptedTitle")} tone={INK.emerald}>
            {accepted.map((r) => (
              <RequestRow key={r.id} request={r} onOpen={onOpenRequest}>
                {topic.projectGroup && (
                  <Link
                    to={`/${lang}/admin/projects/${topic.projectGroup.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-[12px] font-bold text-emerald-700 transition hover:bg-emerald-50 sm:flex-none dark:border-emerald-400/40 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                  >
                    <FolderKanban size={13} /> {t("admin.grt.openProject")}
                  </Link>
                )}
              </RequestRow>
            ))}
          </Block>
        )}

        {/* ── what ended: rejected, or cancelled for another team ── */}
        {ended.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowEnded((v) => !v)}
              aria-expanded={showEnded}
              className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-[12.5px] font-bold transition hover:bg-forest/[0.03] sm:px-5 ${INK.red}`}
            >
              <span className="flex items-center gap-2">
                <XCircle size={15} /> {t("admin.grt.endedTitle")}
                <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ring-1 ${TONE.red}`}>{ended.length}</span>
              </span>
              <ChevronDown size={16} className={`text-clay transition ${showEnded ? "rotate-180" : ""}`} />
            </button>
            {showEnded && (
              <div className="space-y-2 px-4 pb-4 sm:px-5">
                {ended.map((r) => (
                  <RequestRow key={r.id} request={r} onOpen={onOpenRequest} muted>
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      title={t("admin.delete")}
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-red-300/60 text-red-500 transition hover:bg-red-50 dark:border-red-400/35 dark:text-red-300 dark:hover:bg-red-400/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </RequestRow>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Block({
  icon: Icon,
  title,
  count,
  tone,
  children,
}: {
  icon: typeof Clock;
  title: string;
  count?: number;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <p className={`mb-2 flex items-center gap-2 text-[12.5px] font-bold ${tone}`}>
        <Icon size={15} /> {title}
        {count !== undefined && <span className="rounded-full bg-cream-2 px-2 py-0.5 text-[11px] tabular-nums ring-1 ring-forest/10">{count}</span>}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** One team's request: who, how many, when — and what may be done with it. */
function RequestRow({
  request: r,
  rank,
  muted,
  onOpen,
  children,
}: {
  request: AdminGroupRequest;
  rank?: number;
  muted?: boolean;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const members = r.members ?? [];
  return (
    <div className={`rounded-2xl border p-3 ${muted ? "border-forest/10 bg-cream-2/40" : "border-forest/10 bg-cream-card"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {rank !== undefined && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/15 font-serif text-[13px] font-bold text-gold tabular-nums"
            title={t("admin.grt.arrival", { n: rank })}
          >
            {rank}
          </span>
        )}
        <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 basis-48 items-center gap-2.5 text-start">
          <UserAvatar user={r.leader?.user} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-bold text-forest">{personName(r.leader?.user)}</span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-clay">
              <span dir="ltr">{r.leader?.registrationNumber}</span>
              <span className="inline-flex items-center gap-1">
                <Users size={11} /> {members.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} /> {fmtDate(r.createdAt)}
              </span>
            </span>
          </span>
        </button>
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          {children}
          <button
            type="button"
            onClick={() => onOpen(r.id)}
            title={t("admin.details")}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-forest/15 text-forest transition hover:bg-forest/5"
          >
            <ChevronLeft size={15} className="ltr:rotate-180" />
          </button>
        </div>
      </div>
      {r.status === "rejected" && r.rejectionReason && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-[11.5px] text-red-700 ring-1 ring-red-200/70 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-400/20">
          <span className="font-semibold">{t("admin.rejectionReasonColon")}</span> {r.rejectionReason}
        </p>
      )}
    </div>
  );
}

function CountChip({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: typeof Clock;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${tone} ${value === 0 ? "opacity-55" : ""}`}>
      <Icon size={12} /> <span className="tabular-nums">{value}</span> {label}
    </span>
  );
}
