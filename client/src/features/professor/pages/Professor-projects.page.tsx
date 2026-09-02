import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
   Users2, ListChecks, CalendarCheck, ChevronLeft,
} from "lucide-react";
import { useMyGroups } from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import type { ProjectGroup } from "../../../types/professor.types";

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function ProfessorProjectsPage() {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useMyGroups();

  const list = groups ?? [];

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">{t("pro.myProjectsTitle")}</h1>
        <p className="mt-1 text-sm text-clay">{t("pro.myProjectsSubtitle")}</p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("pro.noProjectsYet")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((g: ProjectGroup) => {
            const members = g.members ?? [];
            const milestoneCount = g._count?.milestones ?? g.milestones?.length ?? 0;
            const hasDefense = !!g.defense;
            return (
              <div key={g.id} className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
                {/* Top: defense badge */}
                <div className="mb-3 flex items-center justify-between">
                  {g.topic?.status && <StatusBadge status={g.topic.status} />}
                  {hasDefense ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-gold">
                      <CalendarCheck size={12} />
                      {t("pro.defenseScheduledShort")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-500">
                      {t("pro.noDefenseShort")}
                    </span>
                  )}
                </div>

                {/* Topic title */}
                <h3 className="mb-3 font-serif text-base font-bold text-forest">
                  {g.topic?.title ?? "\u2014"}
                </h3>

                {/* Members + milestones */}
                <div className="mb-4 flex items-center justify-between border-t border-forest/10 pt-3">
                  <span className="flex items-center gap-1 text-xs text-clay">
                    <ListChecks size={14} />
                    {milestoneCount} {t("pro.milestonesShort")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-clay">
                      <Users2 size={14} />
                      {members.length}
                    </span>
                    <div className="flex -space-x-2 flex-row-reverse">
                      {members.slice(0, 3).map((m) => (
                        <div key={m.id} className="grid size-6 place-items-center rounded-full border-2 border-cream-card bg-linear-to-br from-sage to-forest text-[9px] font-bold text-cream">
                          {initials(m.student?.user?.firstName, m.student?.user?.lastName)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  to={`../groups/${g.id}`}
                  className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
                >
                  {t("pro.manageProject")}
                  <ChevronLeft size={14} className="ltr:rotate-180" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}