import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Crown,
  FolderKanban,
  GraduationCap,
  Hash,
  Hourglass,
  IdCard,
  Inbox,
  Layers,
  Mail,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useGroupRequest,
  useAcceptGroupRequest,
  useRejectGroupRequest,
  useRemoveGroupRequestMember,
  useSetGroupRequestLeader,
} from "../../hooks/admin-hook";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { StatusPill } from "../../../../components/ui/status-pill";
import { useDates } from "../../../../hooks/use-dates";
import { None } from "../../../../lib/none";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { personName } from "../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One group request, as the administration decides it.
 *
 * The page reads top to bottom as the decision does: what is asked (the
 * topic and its supervisor, with how long the team has waited), what the
 * decision rests on (capacity, specialization, and whether any member is
 * already in a project or waiting on another request — checked here rather
 * than learned from a refusal), the decision itself, and the team, member
 * by member.
 */

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

function fullName(u: any) {
  return personName(u) || "—";
}

export function AdminGroupRequestDetailPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { fmtDate, daysFrom } = useDates();

  const {
    data: req,
    isLoading,
    refetch,
  } = useGroupRequest(id ?? null) as {
    data: any;
    isLoading: boolean;
    refetch: () => void;
  };
  const accept = useAcceptGroupRequest();
  const reject = useRejectGroupRequest();
  const removeMember = useRemoveGroupRequestMember();
  const setLeader = useSetGroupRequestLeader();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const back = () => navigate(`/${lang}/admin/group-requests`);
  const goStudent = (sid?: string) =>
    sid && navigate(`/${lang}/admin/students/${sid}`);

  if (isLoading) {
    return <LoadingArea className="font-body py-24" />;
  }
  if (!req) {
    return (
      <div className={`${CARD} grid place-items-center gap-4 px-6 py-20 text-center font-body`}>
        <p className="text-sm text-clay">{t("admin.requestNotFound")}</p>
        <button
          onClick={back}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft"
        >
          <ArrowRight size={16} className="ltr:rotate-180" />
          {t("admin.backToRequests")}
        </button>
      </div>
    );
  }

  const topic = req.topic ?? {};
  const prof = topic.professor?.user;
  const members = (req.members ?? []) as any[];
  const status = req.status as string;

  /*
   * ما يجوز يأتي من الخادم، لا من حالة الطلب.
   *
   * كانت هذه الصفحة تُقرّر كالقائمة تماماً — `status === "pending" || "accepted"`
   * — فتعرض «تراجَع وارفض» على كل طلبٍ مقبول. وقبولُ الطلب يُنشئ المشروع،
   * فالرفض بعده مرفوضٌ دائماً: زرٌّ لإجراءٍ مستحيل، ورسالةُ خطأٍ مكان الفعل.
   *
   * والاحتياط للخادم الأقدم الذي لا يُرسل الجدول: أظهِر الزرّين ودَع الحكم
   * له — أسوأ ما يقع عندئذٍ رسالة رفض، لا زرٌّ مفقود.
   */
  const acts = (req as any).actions;
  const canAccept = acts ? acts.canAccept : status !== "accepted";
  const canReject = acts ? acts.canReject : status !== "rejected";
  const whyNoAccept: string | undefined = acts?.blockedReasons?.accept;
  const whyNoReject: string | undefined = acts?.blockedReasons?.reject;
  const leaderId = req.leaderStudentId ?? req.leader?.id;
  const busy =
    accept.isPending ||
    reject.isPending ||
    removeMember.isPending ||
    setLeader.isPending;

  // ── what the decision rests on ──
  const max: number | null = topic.maxStudents ?? null;
  const overCapacity = max !== null && members.length > max;
  const otherSpec = members.filter(
    (m) =>
      topic.specialization?.id &&
      m.student?.specialization?.id &&
      m.student.specialization.id !== topic.specialization.id,
  );
  // A member of *this* request's own project (once accepted) is not a
  // conflict; only a project on another topic is.
  const inOtherProject = members.filter(
    (m) => m.project && m.project.topic?.id !== topic.id,
  );
  const withOtherPending = members.filter((m) => (m.otherPending ?? []).length > 0);
  const topicTaken = !!topic.projectGroup && status !== "accepted";
  const cap: number | null = topic.maxRequests ?? null;
  const used: number = topic._count?.groupRequests ?? 0;
  const names = (list: any[]) =>
    list.map((m) => fullName(m.student?.user)).join("، ");

  // What would stand in the way of accepting. Another pending request does
  // not — it is worth reading, not a reason to refuse.
  const issues = [
    overCapacity,
    otherSpec.length > 0,
    inOtherProject.length > 0,
    topicTaken,
  ].filter(Boolean).length;
  const leaderName = fullName(
    members.find((m) => m.student?.id === leaderId)?.student?.user ??
      req.leader?.user,
  );

  const waitedDays = Math.max(0, -daysFrom(req.createdAt));
  const decidedOn = status === "pending" ? null : fmtDate(req.updatedAt);

  function doAccept() {
    accept.mutate(req.id, { onSuccess: () => refetch() });
  }
  function doReject() {
    reject.mutate(
      { id: req.id, reason: reason || undefined },
      {
        onSuccess: () => {
          setRejecting(false);
          setReason("");
          refetch();
        },
      },
    );
  }
  function onRemove(studentId: string) {
    removeMember.mutate(
      { requestId: req.id, studentId },
      { onSuccess: () => refetch() },
    );
  }
  function onMakeLeader(studentId: string) {
    setLeader.mutate(
      { requestId: req.id, studentId },
      { onSuccess: () => refetch() },
    );
  }

  return (
    <div className="space-y-6 font-body">
      {/* back */}
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition hover:text-gold"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />
        {t("admin.backToRequests")}
      </button>

      {/* ══════════ header: what is asked ══════════ */}
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

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)]">
                <ClipboardList size={18} />
              </span>
              <StatusPill status={status} />
              {req.priority != null && (
                <HeroChip icon={Hash}>{t("admin.priorityN", { n: req.priority })}</HeroChip>
              )}
              <HeroChip icon={Send}>
                {t("admin.sentOn", { date: fmtDate(req.createdAt) })}
              </HeroChip>
            </div>

            <h1 className="font-serif text-3xl leading-tight font-bold break-words text-cream lg:text-4xl">
              {topic.title ?? <None />}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {prof && (
                <span className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 ps-2 pe-4">
                  <UserAvatar
                    user={prof}
                    size={40}
                    tone="gold"
                    className="text-[var(--t-brand-deep)]! ring-2 ring-gold/60"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] text-soft-sage">{t("admin.supervisor")}</span>
                    <span className="block truncate text-sm font-bold text-cream">{fullName(prof)}</span>
                  </span>
                </span>
              )}
              {topic.specialization?.name && (
                <HeroChip icon={Layers}>{topic.specialization.name}</HeroChip>
              )}
              {topic.academicYear?.title && (
                <HeroChip icon={CalendarDays}>{topic.academicYear.title}</HeroChip>
              )}
              {topic.id && (
                <button
                  onClick={() => navigate(`/${lang}/admin/topics/${topic.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold/50 px-3.5 py-2 text-xs font-semibold text-gold-soft transition hover:bg-gold/15"
                >
                  <GraduationCap size={15} />
                  {t("admin.topicDetails")}
                </button>
              )}
            </div>
          </div>

          {/* the numbers that matter for the decision */}
          <div className="grid shrink-0 grid-cols-3 gap-3">
            <HeroStat
              icon={Users}
              value={max !== null ? `${members.length}/${max}` : String(members.length)}
              label={t("admin.memberCount")}
              tone={overCapacity ? "alarm" : undefined}
            />
            <HeroStat
              icon={Inbox}
              value={cap !== null ? `${used}/${cap}` : String(used)}
              label={t("admin.grd.topicRequests")}
              tone={cap !== null && used >= cap ? "alarm" : undefined}
            />
            <HeroStat
              icon={Hourglass}
              value={status === "pending" ? String(waitedDays) : "—"}
              label={t("admin.grd.daysWaiting")}
              tone={status === "pending" && waitedDays >= 7 ? "gold" : undefined}
            />
          </div>
        </div>

        {/* sent → reviewed → decided */}
        <Tracker status={status} sentOn={fmtDate(req.createdAt)} decidedOn={decidedOn} />
      </section>

      {/* ══════════ what it rests on, and the decision ══════════
          Side by side, one height: the checks are read to make it. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={`flex flex-col p-6 ${CARD}`}>
          <SectionHeader icon={ShieldCheck} title={t("admin.grd.checksTitle")} />
          <ul className="space-y-2.5">
            <CheckRow
              ok={!overCapacity}
              text={
                overCapacity
                  ? t("admin.grd.capacityOver", { n: members.length, max })
                  : t("admin.grd.capacityOk", { n: members.length, max: max ?? "—" })
              }
            />
            <CheckRow
              ok={otherSpec.length === 0}
              text={
                otherSpec.length === 0
                  ? t("admin.grd.specOk")
                  : t("admin.grd.specOther", { names: names(otherSpec) })
              }
            />
            <CheckRow
              ok={inOtherProject.length === 0}
              text={
                inOtherProject.length === 0
                  ? t("admin.grd.projectOk")
                  : t("admin.grd.projectTaken", { names: names(inOtherProject) })
              }
            />
            <CheckRow
              ok={withOtherPending.length === 0}
              warnOnly
              text={
                withOtherPending.length === 0
                  ? t("admin.grd.otherOk")
                  : t("admin.grd.otherPending", { names: names(withOtherPending) })
              }
            />
            <CheckRow
              ok={!topicTaken}
              text={topicTaken ? t("admin.grd.topicTaken") : t("admin.grd.topicFree")}
            />
          </ul>
        </section>

        <section className={`flex flex-col p-6 ${CARD}`}>
          <SectionHeader icon={Check} title={t("admin.requestDecision")} />

          {rejecting ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-forest">
                {t("admin.rejectionReason", { defaultValue: t("stu.rejectionReason") })}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                autoFocus
                placeholder={t("admin.rejectionReasonPlaceholder")}
                className="w-full resize-y rounded-2xl border border-forest/15 bg-cream-2 p-4 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
              <p className="text-[11px] text-clay">{t("admin.rejectionReachesLeader")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={doReject}
                  disabled={reject.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brick py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  <X size={17} />
                  {t("admin.confirmReject")}
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  className="flex-1 rounded-xl border border-forest/20 py-3 font-bold text-forest transition hover:bg-forest/5"
                >
                  {t("admin.cancel", { defaultValue: t("pro.cancel") })}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {/* the checks, summed up in one line — only while undecided */}
              {status === "pending" && (
                <p
                  className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${
                    issues === 0
                      ? "bg-sage/10 text-forest ring-sage/25"
                      : "bg-brick/8 text-brick ring-brick/25"
                  }`}
                >
                  {issues === 0 ? (
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sage" />
                  ) : (
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  )}
                  {issues === 0
                    ? t("admin.grd.allClear")
                    : t("admin.grd.issues", { count: issues })}
                </p>
              )}

              {/* the request in four facts */}
              <dl className="grid grid-cols-2 gap-2.5">
                <Fact label={t("admin.leader")} value={leaderName} />
                <Fact
                  label={t("pro.priority")}
                  value={req.priority != null ? String(req.priority) : "—"}
                />
                <Fact label={t("admin.grd.sentAt")} value={fmtDate(req.createdAt) ?? "—"} />
                <Fact label={t("admin.grd.decidedAt")} value={decidedOn ?? "—"} />
              </dl>

              {status === "rejected" && req.rejectionReason && (
                <p className="flex items-start gap-2 rounded-2xl bg-brick/8 px-4 py-3 text-xs leading-relaxed text-brick ring-1 ring-brick/20">
                  <XCircle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-bold">{t("status.rejected")}:</span>{" "}
                    {req.rejectionReason}
                  </span>
                </p>
              )}
              {status === "accepted" && (
                <p className="flex items-start gap-2 rounded-2xl bg-sage/10 px-4 py-3 text-xs leading-relaxed text-forest ring-1 ring-sage/25">
                  <FolderKanban size={15} className="mt-0.5 shrink-0 text-sage" />
                  {t("admin.approvedProjectHint")}
                </p>
              )}

              {/*
                * مُطفأٌ بسبب، لا مخفيّ.
                *
                * الزرّ المخفيّ يترك الإدارة تسأل «أين ذهب؟»، والمُطفأ بتلميحٍ
                * يقول لماذا — وفي حالة الرفض يقول البديل أيضاً: افسخ المشروع
                * من صفحة «المشاريع».
                */}
              <div className="mt-auto flex flex-col gap-2.5 sm:flex-row">
                <button
                  onClick={doAccept}
                  disabled={!canAccept || accept.isPending}
                  title={whyNoAccept}
                  className="flex flex-2 items-center justify-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft py-3.5 font-bold text-forest-deep shadow-[0_8px_20px_rgba(193,150,90,0.3)] transition hover:brightness-105 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <Check size={18} />
                  {status === "rejected"
                    ? t("admin.approveAndReconsider")
                    : t("admin.acceptAndFormTeam")}
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  disabled={!canReject}
                  title={whyNoReject}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brick/50 py-3.5 font-bold text-brick transition hover:bg-brick/10 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={18} />
                  {status === "accepted" ? t("admin.undoAndReject") : t("admin.rejectRequest")}
                </button>
              </div>

              {/* السبب مكتوباً تحت الأزرار — لا يراه إلا من يمرّ بالفأرة فوق التلميح. */}
              {(whyNoAccept || whyNoReject) && (
                <p className="flex items-start gap-2 rounded-2xl bg-gold/10 px-4 py-3 text-[11.5px] leading-relaxed text-forest ring-1 ring-gold/30">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold" />
                  {whyNoReject ?? whyNoAccept}
                </p>
              )}
              <p className="text-center text-[11px] text-clay/80">{t("admin.decisionChangeHint")}</p>
            </div>
          )}
        </section>
      </div>

      {/* ══════════ the team, member by member ══════════ */}
      <section className={`p-6 ${CARD}`}>
        <SectionHeader
          icon={Users}
          title={t("admin.teamStudents")}
          badge={String(members.length)}
        />

        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {members.map((m) => {
            const u = m.student?.user;
            const sid = m.student?.id;
            const isLeader = !!sid && sid === leaderId;
            const canEdit = status !== "accepted";
            const spec = m.student?.specialization;
            const specDiffers =
              !!spec?.id && !!topic.specialization?.id && spec.id !== topic.specialization.id;
            const project = m.project && m.project.topic?.id !== topic.id ? m.project : null;
            const others = (m.otherPending ?? []) as any[];

            return (
              <li
                key={m.id}
                className={`flex flex-col rounded-2xl p-4 ring-1 transition ${
                  isLeader ? "bg-gold/8 ring-gold/35" : "bg-cream-2/70 ring-forest/8 hover:ring-gold/30"
                }`}
              >
                <button
                  onClick={() => goStudent(sid)}
                  className="group flex min-w-0 items-center gap-3 text-start"
                >
                  <UserAvatar
                    user={u}
                    size={52}
                    className={isLeader ? "ring-2 ring-gold" : "ring-2 ring-forest/10"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-serif text-base font-bold text-forest group-hover:text-gold">
                      <span className="truncate">{fullName(u)}</span>
                      {isLeader && (
                        <Crown size={13} className="shrink-0 text-gold" aria-label={t("admin.leader")} />
                      )}
                    </span>
                    <span dir="ltr" className="flex items-center gap-1 text-[11px] text-clay tabular-nums rtl:justify-end">
                      <IdCard size={11} />
                      {m.student?.registrationNumber ?? "—"}
                    </span>
                    {u?.email && (
                      <span dir="ltr" className="flex items-center gap-1 truncate text-[11px] text-clay rtl:justify-end">
                        <Mail size={11} className="shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </span>
                    )}
                  </span>
                </button>

                {/* what the decision needs to know about this student */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isLeader && (
                    <Badge tone="gold" icon={Crown}>{t("admin.leader")}</Badge>
                  )}
                  {spec?.name && (
                    <Badge tone={specDiffers ? "brick" : "plain"} icon={Layers}>
                      {spec.name}
                    </Badge>
                  )}
                  {m.student?.academicYear?.title && (
                    <Badge tone="plain" icon={CalendarDays}>{m.student.academicYear.title}</Badge>
                  )}
                  {project && (
                    <Badge tone="brick" icon={FolderKanban}>
                      {t("admin.grd.inProject", { title: project.topic?.title ?? "—" })}
                    </Badge>
                  )}
                  {others.map((o) => (
                    <Badge key={o.id} tone="gold" icon={Hourglass}>
                      {t("admin.grd.alsoWaiting", { title: o.topic?.title ?? "—" })}
                    </Badge>
                  ))}
                </div>

                {canEdit && !isLeader && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-forest/8 pt-3">
                    <button
                      onClick={() => onMakeLeader(sid)}
                      disabled={busy}
                      title={t("admin.makeLeader")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
                    >
                      <UserCog size={13} />
                      {t("admin.setAsLeader")}
                    </button>
                    <button
                      onClick={() => onRemove(sid)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brick/30 px-3 py-1.5 text-xs font-semibold text-brick transition hover:bg-brick/10 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      {t("admin.removeCover")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-center text-[11px] text-clay/80">{t("admin.clickStudentHint")}</p>
      </section>
    </div>
  );
}

/* ══════════════════ pieces ══════════════════ */

function HeroChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
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
      <span className="mt-1 text-[11px] leading-tight text-soft-sage">{label}</span>
    </div>
  );
}

/** Sent → reviewed → decided, on the brand ground. */
function Tracker({
  status,
  sentOn,
  decidedOn,
}: {
  status: string;
  sentOn: string | null;
  decidedOn: string | null;
}) {
  const { t } = useTranslation();
  const decided = status !== "pending";
  const steps = [
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
      state: status === "accepted" ? "done" : status === "rejected" ? "refused" : "todo",
      icon: status === "rejected" ? XCircle : status === "accepted" ? CheckCircle2 : ClipboardList,
    },
  ] as const;

  const node: Record<string, string> = {
    done: "bg-soft-sage text-[var(--t-brand-deep)]",
    current: "bg-gold text-[var(--t-brand-deep)] ring-4 ring-gold/25",
    todo: "bg-white/10 text-soft-sage",
    refused: "bg-[#f0a48f] text-[var(--t-brand-deep)]",
  };

  return (
    <ol className="relative mt-7 grid grid-cols-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const nextState = steps[i + 1]?.state;
        return (
          <li key={i} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute top-4 start-1/2 h-0.5 w-full ${
                  nextState === "todo" ? "bg-white/10" : nextState === "refused" ? "bg-[#f0a48f]/50" : "bg-soft-sage/60"
                }`}
              />
            )}
            <span className={`relative z-10 grid size-8 place-items-center rounded-full ${node[s.state]}`}>
              <Icon size={15} />
            </span>
            <span className={`mt-2 text-xs font-semibold ${s.state === "todo" ? "text-soft-sage" : "text-cream"}`}>
              {s.label}
            </span>
            {s.sub && <span className="mt-0.5 text-[11px] text-soft-sage">{s.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
}) {
  return (
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
  );
}

/**
 * One check: a tick when it holds, a warning when it does not. `warnOnly`
 * for a condition that should be read but does not block — another pending
 * request does not stop this one from being accepted.
 */
function CheckRow({ ok, text, warnOnly }: { ok: boolean; text: string; warnOnly?: boolean }) {
  const cls = ok
    ? "bg-sage/8 ring-sage/20 [&>svg]:text-sage"
    : warnOnly
      ? "bg-gold/10 ring-gold/30 [&>svg]:text-gold"
      : "bg-brick/8 ring-brick/25 [&>svg]:text-brick";
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm text-forest ring-1 ${cls}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">{text}</span>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream-2/70 px-4 py-2.5 ring-1 ring-forest/5">
      <dt className="text-[11px] text-clay">{label}</dt>
      <dd className="truncate text-sm font-semibold text-forest">{value}</dd>
    </div>
  );
}

function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: "gold" | "brick" | "plain";
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const cls =
    tone === "gold"
      ? "bg-gold/15 text-gold ring-gold/30"
      : tone === "brick"
        ? "bg-brick/10 text-brick ring-brick/25"
        : "bg-cream-card text-clay ring-forest/10";
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>
      <Icon size={11} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}
