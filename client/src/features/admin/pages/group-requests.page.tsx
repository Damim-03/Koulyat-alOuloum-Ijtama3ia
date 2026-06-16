import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Check,
  X,
  Crown,
  Users,
  Info,
  ClipboardList,
  Clock,
} from "lucide-react";
import {
  useGroupRequests,
  useAcceptGroupRequest,
  useRejectGroupRequest,
} from "../hooks/admin-hook";
import type { AdminGroupRequest } from "../../../types/admin";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 10;

export function AdminGroupRequestsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{ search?: string; status?: string }>(
    {},
  );

  const { data, isLoading } = useGroupRequests({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const accept = useAcceptGroupRequest();
  const reject = useRejectGroupRequest();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingCount = items.filter((r) => r.status === "pending").length;

  function applyFilters() {
    setApplied({ search: search || undefined, status: status || undefined });
    setPage(1);
  }

  function leaderName(r: AdminGroupRequest) {
    const u = r.leader?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      r.leader?.registrationNumber ||
      "\u2014"
    );
  }
  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.groupRequestsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.groupRequestsSubtitle")}
          </p>
        </div>
        <div className="flex gap-3">
          <MiniStat
            icon={Clock}
            value={pendingCount}
            label={t("admin.pendingShort")}
          />
          <MiniStat
            icon={ClipboardList}
            value={total}
            label={t("admin.totalRequests")}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchGroupRequest")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allStatuses")}</option>
            <option value="pending">{t("status.pending")}</option>
            <option value="accepted">{t("status.accepted")}</option>
            <option value="rejected">{t("status.rejected")}</option>
          </select>

          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("admin.filter")}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="py-16 text-center text-sm text-clay">{"\u2026"}</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
            {t("admin.noGroupRequests")}
          </div>
        )}

        {items.map((r) => {
          const members = r.members ?? [];
          const isPending = r.status === "pending";
          return (
            <div
              key={r.id}
              className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                {/* Left: topic + leader + members */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-base font-bold text-forest">
                      {r.topic?.title ?? "\u2014"}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`status.${r.status}`, { defaultValue: r.status })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-gold">
                      {t("admin.priorityN", { n: r.priority })}
                    </span>
                  </div>

                  {/* Leader */}
                  <div className="mb-3 flex items-center gap-2 text-xs text-clay">
                    <Crown size={14} className="text-gold" />
                    <span className="font-medium text-forest">
                      {leaderName(r)}
                    </span>
                    <span dir="ltr">{r.leader?.registrationNumber ?? ""}</span>
                    <span className="text-clay/60">·</span>
                    <span>{fmtDate(r.createdAt)}</span>
                  </div>

                  {/* Members */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-clay">
                      <Users size={13} />
                      {t("admin.membersCount", { count: members.length })}:
                    </span>
                    {members.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 px-2.5 py-1 text-[11px] text-forest"
                      >
                        <span className="grid size-5 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[8px] font-bold text-cream">
                          {initials(
                            m.student?.user?.firstName,
                            m.student?.user?.lastName,
                          )}
                        </span>
                        {[m.student?.user?.firstName, m.student?.user?.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                          m.student?.registrationNumber ||
                          "\u2014"}
                      </span>
                    ))}
                  </div>

                  {r.status === "rejected" && r.rejectionReason && (
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
                      <Info size={13} className="mt-0.5 shrink-0" />
                      {r.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Right: actions (only when pending) */}
                {isPending && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => accept.mutate(r.id)}
                      disabled={accept.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-60"
                    >
                      <Check size={15} />
                      {t("admin.accept")}
                    </button>
                    <button
                      onClick={() => reject.mutate({ id: r.id })}
                      disabled={reject.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-400 px-4 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <X size={15} />
                      {t("admin.reject")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u2039"}
          </button>
          <span className="px-3 text-sm text-forest">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u203a"}
          </button>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ClipboardList;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-forest/10 bg-cream-card px-3 py-2 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="grid size-9 place-items-center rounded-full bg-soft-sage/30 text-forest">
        <Icon size={16} />
      </div>
      <div>
        <p className="font-serif text-base font-bold leading-none text-forest">
          {value}
        </p>
        <p className="text-[10px] text-clay">{label}</p>
      </div>
    </div>
  );
}
