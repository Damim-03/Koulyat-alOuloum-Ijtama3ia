import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Crown,
  Users,
  Check,
  X,
  Trash2,
  UserCog,
  GraduationCap,
  Layers,
  CalendarDays,
  Mail,
  IdCard,
  AlertTriangle,
  UserRound,
  Sparkles,
  Network,
  ClipboardList,
  Hash,
} from "lucide-react";
import {
  useGroupRequest,
  useAcceptGroupRequest,
  useRejectGroupRequest,
  useRemoveGroupRequestMember,
  useSetGroupRequestLeader,
} from "../../hooks/admin-hook";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function initials(first?: string | null, last?: string | null) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || "\u061f";
}
function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
}

export function AdminGroupRequestDetailPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
    return (
      <div className="font-body grid place-items-center py-24 text-sm text-clay">
        {"\u2026"}
      </div>
    );
  }
  if (!req) {
    return (
      <div className="font-body py-24 text-center">
        <p className="text-sm text-clay">{t("admin.requestNotFound")}</p>
        <button
          onClick={back}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <ArrowRight size={16} className="ltr:rotate-180" />{t("admin.backToRequests")}</button>
      </div>
    );
  }

  const topic = req.topic ?? {};
  const prof = topic.professor?.user;
  const members = (req.members ?? []) as any[];
  const status = req.status as string;
  const leaderId = req.leaderStudentId ?? req.leader?.id;
  const busy =
    accept.isPending ||
    reject.isPending ||
    removeMember.isPending ||
    setLeader.isPending;

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
    <div className="font-body mx-auto max-w-4xl">
      {/* back */}
      <button
        onClick={back}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />{t("admin.backToRequests")}</button>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_40px_rgba(38,66,61,0.10)]">
        <div className="relative h-28 bg-linear-to-l from-forest via-forest-deep to-forest">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--color-cream)_1px,transparent_0)] bg-size-[18px_18px]" />
          <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-20 size-40 rounded-full bg-sage/20 blur-3xl" />
          <Network
            className="pointer-events-none absolute -bottom-3 left-6 size-24 text-cream/10"
            strokeWidth={1.5}
          />
          <Sparkles size={16} className="absolute right-6 top-6 text-gold/60" />
        </div>

        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="grid size-20 shrink-0 place-items-center rounded-3xl border-4 border-cream-card bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-lg">
                <ClipboardList size={30} />
              </div>
              <div className="min-w-0 pb-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {t(`status.${status}`, { defaultValue: status })}
                  </span>
                  {req.priority != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-gold">
                      <Hash size={10} />
                      {t("admin.priorityN", {
                        n: req.priority,
                        defaultValue: t("admin.priorityN", { n: req.priority }),
                      })}
                    </span>
                  )}
                </div>
                <h1 className="font-serif text-xl font-bold text-forest sm:text-2xl">
                  {topic.title ?? "\u2014"}
                </h1>
              </div>
            </div>
            <button
              onClick={() =>
                topic.id && navigate(`/${lang}/admin/topics/${topic.id}`)
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-forest/20 bg-cream-card px-3.5 py-2 text-xs font-semibold text-forest transition hover:border-gold/40 hover:bg-gold/5"
            >
              <GraduationCap size={15} />{t("admin.topicDetails")}</button>
          </div>

          {/* professor + meta */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-clay">
            {prof && (
              <span className="inline-flex items-center gap-2">
                {prof.avatarUrl ? (
                  <img
                    src={prof.avatarUrl}
                    alt=""
                    className="size-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-6 place-items-center rounded-full bg-soft-sage/40 text-[9px] font-bold text-forest">
                    {initials(prof.firstName, prof.lastName)}
                  </span>
                )}
                <span className="font-medium text-forest">
                  {fullName(prof)}
                </span>
                <span className="text-[11px] text-clay/70">{t("admin.supervisor")}</span>
              </span>
            )}
            {topic.specialization?.name && (
              <span className="inline-flex items-center gap-1.5">
                <Layers size={14} /> {topic.specialization.name}
              </span>
            )}
            {topic.academicYear?.title && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} /> {topic.academicYear.title}
              </span>
            )}
          </div>

          {/* mini stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat
              icon={Users}
              value={members.length}
              label={t("admin.memberCount")}
              tint="bg-soft-sage/40 text-forest"
            />
            <MiniStat
              icon={UserRound}
              value={topic.maxStudents ?? "\u2014"}
              label={t("admin.maxCapacity")}
              tint="bg-gold/15 text-gold"
            />
            <MiniStat
              icon={Hash}
              value={req.priority ?? "\u2014"}
              label={t("pro.priority")}
              tint="bg-forest/8 text-forest"
            />
          </div>
        </div>
      </div>

      {/* ── Decision (reversible) ── */}
      <div className="mt-6 rounded-3xl border-2 border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
          <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
            <Check size={17} />
          </span>{t("admin.requestDecision")}</h2>

        {rejecting ? (
          <div className="space-y-3">
            <label className="text-xs font-medium text-forest">
              {t("admin.rejectionReason", { defaultValue: t("stu.rejectionReason") })}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t("admin.rejectionReasonPlaceholder", {
                defaultValue: t("admin.rejectionReasonPlaceholder"),
              })}
              className="w-full resize-y rounded-xl border border-forest/15 bg-cream-2 p-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-clay">{t("admin.rejectionReachesLeader")}</p>
            <div className="flex gap-2">
              <button
                onClick={doReject}
                disabled={reject.isPending}
                className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {t("admin.confirmReject", { defaultValue: t("admin.confirmReject") })}
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
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {(status === "pending" || status === "rejected") && (
                <button
                  onClick={doAccept}
                  disabled={accept.isPending}
                  className="flex flex-2 min-w-60 items-center justify-center gap-2 rounded-xl bg-forest py-3.5 font-bold text-cream shadow-md transition hover:bg-forest-deep active:scale-[.98] disabled:opacity-60"
                >
                  <Check size={18} />
                  {status === "rejected"
                    ? t("admin.approveAndReconsider")
                    : t("admin.acceptAndFormTeam")}
                </button>
              )}
              {(status === "pending" || status === "accepted") && (
                <button
                  onClick={() => setRejecting(true)}
                  className="flex flex-1 min-w-35 items-center justify-center gap-2 rounded-xl border-2 border-red-400 py-3.5 font-bold text-red-500 transition hover:bg-red-50 active:scale-[.98]"
                >
                  <X size={18} />
                  {status === "accepted" ? t("admin.undoAndReject") : t("admin.rejectRequest")}
                </button>
              )}
            </div>
            <p className="text-center text-[11px] text-clay opacity-70">
              {t("admin.decisionChangeHint")}
            </p>
          </div>
        )}

        {status === "rejected" && req.rejectionReason && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
            <span className="font-semibold">
              {t("status.rejected", { defaultValue: t("status.rejected") })}:
            </span>{" "}
            {req.rejectionReason}
          </p>
        )}
      </div>

      {/* ── Members ── */}
      <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
          <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
            <Users size={17} />
          </span>{t("admin.teamStudents")}<span className="rounded-full bg-forest/8 px-2 py-0.5 text-xs font-bold text-forest">
            {members.length}
          </span>
        </h2>

        {status === "accepted" && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              {t("admin.approvedProjectHint")}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {members.map((m) => {
            const u = m.student?.user;
            const sid = m.student?.id;
            const isLeader = sid && sid === leaderId;
            const canEdit = status !== "accepted";
            return (
              <li
                key={m.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition ${
                  isLeader
                    ? "border-gold/40 bg-gold/5"
                    : "border-forest/10 bg-cream-2 hover:border-forest/20"
                }`}
              >
                <button
                  onClick={() => goStudent(sid)}
                  className="group flex min-w-0 items-center gap-3 text-start"
                >
                  {u?.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className={`size-10 rounded-full object-cover ${isLeader ? "ring-2 ring-gold/50" : ""}`}
                    />
                  ) : (
                    <div
                      className={`grid size-10 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream ${isLeader ? "ring-2 ring-gold/50" : ""}`}
                    >
                      {initials(u?.firstName, u?.lastName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-forest group-hover:text-forest-deep group-hover:underline">
                      {isLeader && <Crown size={13} className="text-gold" />}
                      {fullName(u)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-clay">
                      <span
                        className="inline-flex items-center gap-1"
                        dir="ltr"
                      >
                        <IdCard size={11} />{" "}
                        {m.student?.registrationNumber ?? "\u2014"}
                      </span>
                      {u?.email && (
                        <span
                          className="inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          <Mail size={11} /> {u.email}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-2">
                    {!isLeader && (
                      <>
                        <button
                          onClick={() => onMakeLeader(sid)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
                          title={t("admin.makeLeader")}
                        >
                          <UserCog size={13} />{t("admin.setAsLeader")}</button>
                        <button
                          onClick={() => onRemove(sid)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={13} />{t("admin.removeCover")}</button>
                      </>
                    )}
                    {isLeader && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-2.5 py-1.5 text-xs font-semibold text-gold">
                        <Crown size={13} />{t("admin.leader")}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-center text-[11px] text-clay opacity-70">{t("admin.clickStudentHint")}</p>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2 p-3.5">
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-serif text-base font-bold text-forest">
          {value}
        </p>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}
