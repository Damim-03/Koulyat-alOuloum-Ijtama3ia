import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search, Check, X, Eye, Inbox, Lightbulb,
} from "lucide-react";
import {
  useApplications,
  useMyTopics,
  useAcceptApplication,
  useRejectApplication,
} from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import type { Application } from "../../../types/professor.types";

const PAGE_SIZE = 10;

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function ProfessorApplicationsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [topicId, setTopicId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{ topicId?: string; status?: string }>({});

  const { data: applications, isLoading } = useApplications(applied);
  const { data: topics } = useMyTopics();
  const acceptApp = useAcceptApplication();
  const rejectApp = useRejectApplication();

  // Client-side search on top of the server filters.
  const filtered = useMemo(() => {
    const list = applications ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      const name = [a.student?.user?.firstName, a.student?.user?.lastName].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || (a.student?.registrationNumber ?? "").toLowerCase().includes(q);
    });
  }, [applications, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = (applications ?? []).filter((a) => a.status === "pending").length;

  function applyFilters() {
    setApplied({ topicId: topicId || undefined, status: status || undefined });
    setPage(1);
  }
  function studentName(a: Application) {
    const u = a.student?.user;
    return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || a.student?.registrationNumber || "\u2014";
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">{t("pro.incomingApplications")}</h1>
          <p className="mt-1 text-sm text-clay">{t("pro.incomingApplicationsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-forest/10 bg-cream-card px-4 py-2.5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <div className="grid size-9 place-items-center rounded-full bg-soft-sage/30 text-forest">
            <Inbox size={18} />
          </div>
          <div>
            <p className="font-serif text-lg font-bold leading-none text-forest">{pendingCount}</p>
            <p className="text-[10px] text-clay">{t("pro.pendingShort")}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-clay" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("pro.searchByNameOrReg")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("pro.allTopics")}</option>
            {topics?.map((tp) => (
              <option key={tp.id} value={tp.id}>{tp.title}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("pro.allStatuses")}</option>
            <option value="pending">{t("status.pending")}</option>
            <option value="accepted">{t("status.accepted")}</option>
            <option value="rejected">{t("status.rejected")}</option>
          </select>

          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("pro.applyFilter")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">{t("pro.student")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.topic")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.priority")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.statusLabel")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-clay">{"\u2026"}</td></tr>
              )}

              {!isLoading && pageItems.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-clay">{t("pro.noApplications")}</td></tr>
              )}

              {pageItems.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-forest/[0.03]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(a.student?.user?.firstName, a.student?.user?.lastName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-forest">{studentName(a)}</p>
                        <p className="text-[11px] text-clay" dir="ltr">Mat: {a.student?.registrationNumber ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">{a.topic?.title ?? "\u2014"}</td>
                  <td className="px-5 py-3.5">
                    <span className="grid size-7 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      {a.status === "pending" && (
                        <>
                          <button
                            onClick={() => acceptApp.mutate(a.id)}
                            disabled={acceptApp.isPending}
                            title={t("pro.acceptHint")}
                            className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-40"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => rejectApp.mutate(a.id)}
                            disabled={rejectApp.isPending}
                            title={t("pro.reject")}
                            className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-40"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      {a.topicId && (
                        <Link
                          to={`../topics/${a.topicId}`}
                          title={t("pro.view")}
                          className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        >
                          <Eye size={16} />
                        </Link>
                      )}
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
            {t("pro.showingRange", {
              from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40">{"\u2039"}</button>
            <span className="px-3 text-sm text-forest">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40">{"\u203a"}</button>
          </div>
        </div>
      </div>

      {/* Smart hint */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-forest/10 bg-cream-2 p-4">
        <Lightbulb size={20} className="mt-0.5 shrink-0 text-gold" />
        <div>
          <p className="text-sm font-bold text-forest">{t("pro.smartHintTitle")}</p>
          <p className="text-xs text-clay">{t("pro.smartHintBody")}</p>
        </div>
      </div>
    </div>
  );
}