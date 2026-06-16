import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Crown,
  AlertCircle,
  X,
  Inbox,
  GraduationCap,
  CalendarDays,
  History,
  FileText,
  Star,
} from "lucide-react";
import {
  useMyGroupRequests,
  useCancelGroupRequest,
} from "../hooks/Student-hook";
import type { GroupRequestMember } from "../../../types/student.types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};
// شريط جانبي ملوّن حسب الحالة (يمين البطاقة)
const STATUS_ACCENT: Record<string, string> = {
  pending: "",
  accepted: "border-r-4 border-r-emerald-500",
  rejected: "border-r-4 border-r-red-500",
};

function initials(first?: string | null, last?: string | null, fallback = "؟") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function StudentMyRequestsPage() {
  const { t, i18n } = useTranslation();
  const { data: requests, isLoading } = useMyGroupRequests();
  const cancel = useCancelGroupRequest();

  const list = requests ?? [];

  const locale = i18n.language?.startsWith("ar")
    ? "ar"
    : i18n.language?.startsWith("fr")
      ? "fr"
      : "en";
  const fmtDate = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  function memberName(m: GroupRequestMember) {
    const u = m.student?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      m.student?.registrationNumber ||
      "—"
    );
  }

  return (
    <div className="mx-auto max-w-5xl font-body">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("stu.myRequestsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("stu.myRequestsSubtitle")}
          </p>
        </div>
        <Link
          to="../topics"
          relative="path"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
        >
          <Plus size={18} />
          {t("stu.newRequest")}
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-cream-2 text-clay">
            <Inbox size={26} />
          </div>
          <p className="mb-3 text-sm text-clay">{t("stu.noRequestsYet")}</p>
          <Link
            to="../topics"
            relative="path"
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("stu.browseTopics")}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {list.map((req) => {
            const members = req.members ?? [];
            // ⚠️ حقول التصميم الإضافية — صحّح المسارات إن اختلفت في GroupRequest:
            const supervisor =
              [
                req.topic?.professor?.user?.firstName,
                req.topic?.professor?.user?.lastName,
              ]
                .filter(Boolean)
                .join(" ") || null;
            const year = req.topic?.academicYear?.title ?? null;
            const created = fmtDate(req.createdAt);

            return (
              <div
                key={req.id}
                className={`rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(38,66,61,0.08)] ${
                  STATUS_ACCENT[req.status] ?? ""
                }`}
              >
                {/* top: status/priority  +  date/year */}
                <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[req.status] ?? "bg-clay/10 text-clay"
                        }`}
                      >
                        {t(`stu.reqStatus.${req.status}`, {
                          defaultValue: req.status,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold">
                        <Star size={12} />
                        {t("stu.priorityN", { n: req.priority })}
                      </span>
                    </div>
                    <h2 className="font-serif text-xl font-bold leading-snug text-forest">
                      {req.topic?.title ?? "—"}
                    </h2>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-sm text-clay">
                    {created && (
                      <span className="flex items-center gap-1.5">
                        {created}
                        <CalendarDays size={15} />
                      </span>
                    )}
                    {year && (
                      <span className="flex items-center gap-1.5 font-medium text-forest">
                        {year}
                        <History size={15} />
                      </span>
                    )}
                  </div>
                </div>

                {/* rejection reason */}
                {req.status === "rejected" && req.rejectionReason && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-red-500"
                    />
                    <div>
                      <p className="mb-1 text-sm font-bold text-red-700">
                        {t("stu.rejectionReason")}
                      </p>
                      <p className="text-sm text-red-600">
                        {req.rejectionReason}
                      </p>
                    </div>
                  </div>
                )}

                {/* footer grid: supervisor + team  |  action */}
                <div className="grid grid-cols-1 gap-6 border-t border-forest/10 pt-4 md:grid-cols-2">
                  <div className="space-y-3">
                    {supervisor && (
                      <div className="flex items-center gap-2 text-sm text-clay">
                        <GraduationCap size={18} className="text-forest" />
                        <span className="font-medium">
                          {t("stu.supervisor")}:
                        </span>
                        <span className="text-forest">{supervisor}</span>
                      </div>
                    )}

                    {members.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-clay">
                          {t("stu.team")}:
                        </span>
                        <div className="flex -space-x-2 space-x-reverse">
                          {members.map((m) => {
                            const isLeader =
                              m.student?.id === req.leaderStudentId;
                            return (
                              <div
                                key={m.id}
                                title={`${memberName(m)}${
                                  m.student?.registrationNumber
                                    ? ` · ${m.student.registrationNumber}`
                                    : ""
                                }`}
                                className={`relative grid size-8 place-items-center rounded-full border-2 border-cream-card bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream ${
                                  isLeader ? "ring-2 ring-gold" : ""
                                }`}
                              >
                                {isLeader ? (
                                  <Crown size={12} className="text-gold-soft" />
                                ) : (
                                  initials(
                                    m.student?.user?.firstName,
                                    m.student?.user?.lastName,
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-xs text-clay">
                          {t("stu.membersCount", { count: members.length })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* action by status */}
                  <div className="flex items-end justify-end">
                    {req.status === "pending" && (
                      <button
                        onClick={() => {
                          if (confirm(t("stu.confirmCancel")))
                            cancel.mutate(req.id);
                        }}
                        disabled={cancel.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-forest px-5 py-2 text-sm font-bold text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
                      >
                        <X size={16} />
                        {t("stu.cancelRequest")}
                      </button>
                    )}
                    {req.status === "accepted" && (
                      <Link
                        to="../project"
                        relative="path"
                        className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2 text-sm font-bold text-cream transition hover:bg-forest-deep"
                      >
                        <FileText size={16} />
                        {t("stu.viewProjectDetails")}
                      </Link>
                    )}
                    {req.status === "rejected" && req.topic?.id && (
                      <Link
                        to={`../topics/${req.topic.id}`}
                        relative="path"
                        className="text-sm font-bold text-forest transition hover:underline"
                      >
                        {t("stu.editResubmit")}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* help banner */}
      <div className="mt-12 rounded-2xl bg-forest px-6 py-8 text-center text-cream-2">
        <h3 className="font-serif text-xl font-semibold text-cream">
          {t("stu.needTopicHelp")}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-soft-sage">
          {t("stu.needTopicHelpDesc")}
        </p>
        <Link
          to="../topics"
          relative="path"
          className="mt-4 inline-flex rounded-full bg-gold px-6 py-2 text-sm font-bold text-forest-deep transition hover:bg-gold-soft active:scale-95"
        >
          {t("stu.browseResources")}
        </Link>
      </div>
    </div>
  );
}
