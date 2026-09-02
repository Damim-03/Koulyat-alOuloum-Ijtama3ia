import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Info, ClipboardList, Clock, Check, X } from "lucide-react";
import type { AdminApplication } from "../../../../types/admin";
import { useAdminApplications, useAcceptApplication, useRejectApplication } from "../../hooks/admin-hook";
import i18n from "../../../../i18n/i18n";

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

export function AdminApplicationsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{ search?: string; status?: string }>(
    {},
  );

  const { data, isLoading } = useAdminApplications({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const accept = useAcceptApplication();
  const reject = useRejectApplication();

  const apps = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingCount = apps.filter((a) => a.status === "pending").length;

  function applyFilters() {
    setApplied({ search: search || undefined, status: status || undefined });
    setPage(1);
  }

  function studentName(a: AdminApplication) {
    const u = a.student?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      a.student?.registrationNumber ||
      "\u2014"
    );
  }
  function profName(a: AdminApplication) {
    const u = a.topic?.professor?.user;
    return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
  }
  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
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
            {t("admin.applicationsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.applicationsSubtitle")}
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
            label={t("admin.totalApplications")}
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
              placeholder={t("admin.searchApplication")}
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.student")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.topic")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.priority")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.statusLabel")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.applicationDate")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && apps.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noApplications")}
                  </td>
                </tr>
              )}

              {apps.map((a) => (
                <tr
                  key={a.id}
                  className="transition-colors hover:bg-forest/3"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(
                          a.student?.user?.firstName,
                          a.student?.user?.lastName,
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-forest">
                          {studentName(a)}
                        </p>
                        <p className="text-[11px] text-clay" dir="ltr">
                          {a.student?.registrationNumber ?? ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-forest">
                      {a.topic?.title ?? "\u2014"}
                    </p>
                    <p className="text-[11px] text-clay">{profName(a)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="grid size-7 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {t(`status.${a.status}`, { defaultValue: a.status })}
                      </span>
                      {a.status === "rejected" && a.rejectionReason && (
                        <span className="group relative cursor-help text-red-400">
                          <Info size={14} />
                          <span className="pointer-events-none absolute right-0 top-6 z-10 hidden w-48 rounded-lg bg-forest-deep px-3 py-2 text-[11px] text-cream shadow-lg group-hover:block">
                            {a.rejectionReason}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {fmtDate(a.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => accept.mutate(a.id)}
                        disabled={a.status !== "pending" || accept.isPending}
                        className="grid size-8 place-items-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-30"
                        title={t("admin.accept")}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => reject.mutate({ id: a.id })}
                        disabled={a.status !== "pending" || reject.isPending}
                        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                        title={t("admin.reject")}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-forest/10 px-5 py-3">
          <p className="text-xs text-clay">
            {t("admin.showingRange", {
              from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
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
        </div>
      </div>
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
