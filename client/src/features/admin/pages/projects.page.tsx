import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  ListChecks,
  CalendarCheck,
  ChevronLeft,
} from "lucide-react";
import { useAdminProjects } from "../hooks/admin-hook";
import { ProjectDetailDialog } from "../components/project-detail-dialog";
import type { AdminProject } from "../../../types/admin";

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const PAGE_SIZE = 9;

export function AdminProjectsPage() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useAdminProjects({ page, limit: PAGE_SIZE });

  const projects = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function profName(p: AdminProject) {
    const u = p.topic?.professor?.user;
    return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">{t("admin.projectsTitle")}</h1>
        <p className="mt-1 text-sm text-clay">{t("admin.projectsSubtitle")}</p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.noProjects")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const members = p.members ?? [];
            const hasDefense = !!p.defense;
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
              >
                {/* Defense badge */}
                <div className="mb-3 flex justify-end">
                  {hasDefense ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-gold">
                      <CalendarCheck size={12} />
                      {t("admin.defenseScheduled")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-500">
                      {t("admin.noDefense")}
                    </span>
                  )}
                </div>

                {/* Topic */}
                <h3 className="mb-3 text-right font-serif text-base font-bold text-forest">
                  {p.topic?.title ?? "\u2014"}
                </h3>

                {/* Supervisor */}
                <div className="mb-3 flex items-center justify-end gap-2">
                  <div className="text-right">
                    <p className="text-[10px] text-clay">{t("admin.supervisor")}</p>
                    <p className="text-xs font-medium text-forest">{profName(p)}</p>
                  </div>
                  <div className="grid size-7 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream">
                    {initials(p.topic?.professor?.user?.firstName, p.topic?.professor?.user?.lastName)}
                  </div>
                </div>

                {/* Members + milestones */}
                <div className="mb-4 flex items-center justify-between border-t border-forest/10 pt-3">
                  <span className="flex items-center gap-1 text-xs text-clay">
                    <ListChecks size={14} />
                    {p._count?.milestones ?? 0} {t("admin.milestonesShort")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-clay">
                      <Users size={14} />
                      {members.length}
                    </span>
                    <div className="flex -space-x-2 flex-row-reverse">
                      {members.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="grid size-6 place-items-center rounded-full border-2 border-cream-card bg-linear-to-br from-sage to-forest text-[9px] font-bold text-cream"
                        >
                          {initials(m.student?.user?.firstName, m.student?.user?.lastName)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDetailId(p.id)}
                  className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
                >
                  {t("admin.viewDetails")}
                  <ChevronLeft size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u2039"}
          </button>
          <span className="px-3 text-sm text-forest">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u203a"}
          </button>
        </div>
      )}

      <ProjectDetailDialog
        projectId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}