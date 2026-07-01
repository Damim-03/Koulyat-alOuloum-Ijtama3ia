import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Inbox,
  CalendarClock,
  FileText,
  ArrowLeft,
  Plus,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useMyProject, useMyGroupRequests } from "../hooks/Student-hook";

const REQ_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const MS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  in_progress: "bg-sky-400",
  completed: "bg-emerald-400",
  overdue: "bg-red-400",
};

export function StudentDashboardPage() {
  const { t, i18n } = useTranslation();
  const { data: project } = useMyProject();
  const { data: requests } = useMyGroupRequests();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reqList = requests ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const milestones = project?.milestones ?? [];

  const stats = useMemo(() => {
    const pending = reqList.filter((r) => r.status === "pending").length;
    const completed = milestones.filter((m) => m.status === "completed").length;
    return {
      requests: reqList.length,
      pending,
      hasProject: !!project,
      milestonesDone: completed,
      milestonesTotal: milestones.length,
    };
  }, [reqList, milestones, project]);

  const upcoming = useMemo(
    () =>
      [...milestones]
        .filter((m) => m.status === "pending" || m.status === "in_progress")
        .sort((a, b) => a.order - b.order)
        .slice(0, 3),
    [milestones],
  );

  function fmtDate(iso?: string) {
    if (!iso) return "\u2014";
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="font-body">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">
          {t("stu.dashGreeting")}
        </h1>
        <p className="mt-1.5 text-sm text-clay">{t("stu.dashSubtitle")}</p>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Inbox}
          value={stats.requests}
          label={t("stu.myRequestsTitle")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={Clock}
          value={stats.pending}
          label={t("stu.reqStatus.pending")}
          tint="bg-amber-100 text-amber-600"
        />
        <StatTile
          icon={FolderKanban}
          value={stats.hasProject ? 1 : 0}
          label={t("stu.myProject")}
          tint="bg-gold/15 text-gold"
        />
        <StatTile
          icon={CheckCircle2}
          value={stats.milestonesDone}
          label={t("stu.completedMilestones")}
          tint="bg-emerald-100 text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent requests */}
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
            <h3 className="font-serif text-lg font-bold text-forest">
              {t("stu.myRequestsTitle")}
            </h3>
            <Link
              to="../requests"
              className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
            >
              {t("stu.viewAll")}
              <ArrowLeft size={14} />
            </Link>
          </div>
          <div className="p-4">
            {reqList.length === 0 ? (
              <div className="py-10 text-center">
                <p className="mb-3 text-sm text-clay">
                  {t("stu.noRequestsYet")}
                </p>
                <Link
                  to="../topics"
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
                >
                  <Plus size={16} />
                  {t("stu.browseTopics")}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {reqList.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-forest/10 bg-cream-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {r.topic?.title ?? "\u2014"}
                      </p>
                      <p className="text-[11px] text-clay">
                        {t("stu.priorityN", { n: r.priority })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${REQ_STATUS[r.status]}`}
                    >
                      {t(`stu.reqStatus.${r.status}`, {
                        defaultValue: r.status,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming milestones / project status */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-serif text-base font-bold text-forest">
                <CalendarClock size={18} className="text-gold" />
                {t("stu.upcomingMilestones")}
              </h3>
              {stats.hasProject && (
                <Link
                  to="../project"
                  className="text-xs text-sage transition hover:text-forest"
                >
                  {t("stu.viewAll")}
                </Link>
              )}
            </div>

            {!stats.hasProject ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-cream-2 text-clay">
                  <FolderKanban size={22} />
                </div>
                <p className="text-xs text-clay">{t("stu.noProjectYet")}</p>
              </div>
            ) : upcoming.length === 0 ? (
              <p className="py-6 text-center text-xs text-clay">
                {t("stu.noUpcomingMilestones")}
              </p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${MS_DOT[m.status] ?? "bg-gray-400"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-forest">{m.title}</p>
                      <p className="text-[11px] text-clay">
                        {fmtDate(m.deadline)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof FileText;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-forest/10 bg-cream-card p-5 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div
        className={`mb-3 grid size-12 place-items-center rounded-full ${tint}`}
      >
        <Icon size={22} />
      </div>
      <p className="font-serif text-2xl font-bold text-forest">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-clay">{label}</p>
    </div>
  );
}
