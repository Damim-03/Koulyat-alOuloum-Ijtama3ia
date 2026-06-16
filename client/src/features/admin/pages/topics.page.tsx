import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Check, X, Archive, Eye } from "lucide-react";
import {
  useAdminTopics,
  useApproveTopic,
  useRejectTopic,
  useArchiveTopic,
  useProfessors,
} from "../hooks/admin-hook";
import type { AdminTopic } from "../../../types/admin";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};

const STATUS_FILTERS = ["", "approved", "pending", "rejected"] as const;

const PAGE_SIZE = 10;

export function AdminTopicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();

  const openTopic = (id: string) => navigate(`/${lang}/admin/topics/${id}`);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{
    search?: string;
    status?: string;
    professorId?: string;
  }>({});

  const { data, isLoading } = useAdminTopics({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const { data: profsData } = useProfessors({ limit: 100 });
  const approve = useApproveTopic();
  const reject = useRejectTopic();
  const archive = useArchiveTopic();

  const topics = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const professors = profsData?.items ?? [];

  function applyFilters() {
    setApplied({
      search: search || undefined,
      status: status || undefined,
      professorId: professorId || undefined,
    });
    setPage(1);
  }

  function profName(tp: AdminTopic) {
    const u = tp.professor?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      tp.professor?.universityEmail ||
      "\u2014"
    );
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.topicsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("admin.topicsSubtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchTopic")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <select
            value={professorId}
            onChange={(e) => setProfessorId(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allProfessors")}</option>
            {professors.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.user?.firstName, p.user?.lastName]
                  .filter(Boolean)
                  .join(" ") || p.universityEmail}
              </option>
            ))}
          </select>

          <div className="flex rounded-xl border border-forest/15 bg-cream-2 p-1 md:col-span-1">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st || "all"}
                onClick={() => setStatus(st)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  status === st
                    ? "bg-forest text-cream"
                    : "text-clay hover:text-forest"
                }`}
              >
                {t(st ? `status.${st}` : "admin.statusAll")}
              </button>
            ))}
          </div>

          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("admin.applyFilter")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.topicTitle")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.supervisor")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.statusLabel")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.applicationsCount")}
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

              {!isLoading && topics.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noTopics")}
                  </td>
                </tr>
              )}

              {topics.map((tp) => (
                <tr
                  key={tp.id}
                  className="transition-colors hover:bg-forest/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openTopic(tp.id)}
                      className="text-right"
                    >
                      <p className="text-sm font-medium text-forest transition hover:text-gold">
                        {tp.title}
                      </p>
                    </button>
                    <p className="text-[11px] text-clay" dir="ltr">
                      ID: {tp.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="grid size-7 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream">
                        {initials(
                          tp.professor?.user?.firstName,
                          tp.professor?.user?.lastName,
                        )}
                      </div>
                      <span className="text-sm text-clay">{profName(tp)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {tp.specialization?.name ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[tp.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`status.${tp.status}`, { defaultValue: tp.status })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-grid min-w-7 place-items-center rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">
                      {tp._count?.applications ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTopic(tp.id)}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.view")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => approve.mutate(tp.id)}
                        disabled={tp.status === "approved"}
                        className="grid size-8 place-items-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-30"
                        title={t("admin.approve")}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => reject.mutate({ id: tp.id })}
                        disabled={tp.status === "rejected"}
                        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                        title={t("admin.reject")}
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => archive.mutate(tp.id)}
                        disabled={tp.status === "archived"}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 disabled:opacity-30"
                        title={t("admin.archive")}
                      >
                        <Archive size={16} />
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
