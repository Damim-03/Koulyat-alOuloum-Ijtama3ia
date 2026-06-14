import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Crown, AlertCircle, X, Inbox } from "lucide-react";
import {
  useMyGroupRequests,
  useCancelGroupRequest,
} from "../hooks/Student-hook";
import type { GroupRequest } from "../../../types/student.types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function StudentMyRequestsPage() {
  const { t } = useTranslation();
  const { data: requests, isLoading } = useMyGroupRequests();
  const cancel = useCancelGroupRequest();

  const list = requests ?? [];

  function memberName(
    m: GroupRequest["members"] extends (infer U)[] ? U : never,
  ) {
    const u = m.student?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      m.student?.registrationNumber ||
      "\u2014"
    );
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
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
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("stu.newRequest")}
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-cream-2 text-clay">
            <Inbox size={26} />
          </div>
          <p className="mb-3 text-sm text-clay">{t("stu.noRequestsYet")}</p>
          <Link
            to="../topics"
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("stu.browseTopics")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((req) => {
            const members = req.members ?? [];
            return (
              <div
                key={req.id}
                className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
              >
                {/* top bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[req.status]}`}
                    >
                      {t(`stu.reqStatus.${req.status}`, {
                        defaultValue: req.status,
                      })}
                    </span>
                    <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-gold">
                      {t("stu.priorityN", { n: req.priority })}
                    </span>
                  </div>
                  {req.status === "pending" && (
                    <button
                      onClick={() => {
                        if (confirm(t("stu.confirmCancel")))
                          cancel.mutate(req.id);
                      }}
                      disabled={cancel.isPending}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 transition hover:text-red-600 disabled:opacity-40"
                    >
                      <X size={14} />
                      {t("stu.cancelRequest")}
                    </button>
                  )}
                </div>

                {/* body */}
                <div className="px-5 py-4">
                  <h3 className="mb-3 font-serif text-base font-bold text-forest">
                    {req.topic?.title ?? "\u2014"}
                  </h3>

                  {/* members */}
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const isLeader = m.student?.id === req.leaderStudentId;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 rounded-full border border-forest/10 bg-cream-2 px-2.5 py-1"
                        >
                          <div className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-[9px] font-bold text-cream">
                            {initials(
                              m.student?.user?.firstName,
                              m.student?.user?.lastName,
                            )}
                          </div>
                          <span className="text-[11px] text-forest">
                            {memberName(m)}
                          </span>
                          <span className="text-[10px] text-clay" dir="ltr">
                            {m.student?.registrationNumber}
                          </span>
                          {isLeader && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                              <Crown size={9} />
                              {t("stu.leader")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* rejection reason */}
                  {req.status === "rejected" && req.rejectionReason && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                      <AlertCircle
                        size={16}
                        className="mt-0.5 shrink-0 text-red-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-red-700">
                          {t("stu.rejectionReason")}
                        </p>
                        <p className="text-xs text-red-600">
                          {req.rejectionReason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
