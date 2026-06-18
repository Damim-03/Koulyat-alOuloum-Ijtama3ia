import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  FolderKanban,
  ClipboardList,
  FileText,
  Plus,
  Eye,
  ArrowLeft,
  CalendarCheck,
  Download,
} from "lucide-react";
import {
  useMyTopics,
  useApplications,
  useMyGroups,
} from "../hooks/Professor-hook";
import type { Application } from "../../../types/professor.types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
  accepted: "bg-emerald-100 text-emerald-700",
};

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function ProfessorDashboardPage() {
  const { t } = useTranslation();

  const { data: topics } = useMyTopics();
  const { data: applications } = useApplications();
  const { data: groups } = useMyGroups();

  // ── Derived stats (computed client-side; no stats endpoint needed) ──
  const stats = useMemo(() => {
    const topicList = topics ?? [];
    const appList = applications ?? [];
    const groupList = groups ?? [];

    const pendingApps = appList.filter((a) => a.status === "pending").length;
    const upcomingMilestones = groupList.reduce(
      (acc, g) => acc + (g._count?.milestones ?? 0),
      0,
    );

    return {
      myTopics: topicList.length,
      pendingApps,
      supervisedProjects: groupList.length,
      upcomingMilestones,
    };
  }, [topics, applications, groups]);

  // ── Topics grouped by status (for the side list) ──
  const byStatus = useMemo(() => {
    const c = { reserved: 0, available: 0, waiting: 0 };
    for (const tp of topics ?? []) {
      if (tp.status === "full") c.reserved += 1;
      else if (tp.status === "approved" || tp.status === "open")
        c.available += 1;
      else if (tp.status === "pending") c.waiting += 1;
    }
    return c;
  }, [topics]);

  const recentApps = (applications ?? []).slice(0, 5);

  function studentName(a: Application) {
    const u = a.student?.user;
    return (
      [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
      a.student?.registrationNumber ||
      "\u2014"
    );
  }

  return (
    <div className="font-body">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">
          {t("pro.dashGreeting")}
        </h1>
        <p className="mt-1.5 text-sm text-clay">{t("pro.dashSubtitle")}</p>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={CalendarClock}
          value={stats.upcomingMilestones}
          label={t("pro.upcomingMilestones")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={FolderKanban}
          value={stats.supervisedProjects}
          label={t("pro.supervisedProjects")}
          tint="bg-gold/15 text-gold"
        />
        <StatTile
          icon={ClipboardList}
          value={stats.pendingApps}
          label={t("pro.pendingApplications")}
          tint="bg-amber-100 text-amber-600"
        />
        <StatTile
          icon={FileText}
          value={stats.myTopics}
          label={t("pro.myTopicsCount")}
          tint="bg-sage/20 text-sage"
        />
      </div>

      {/* Pending highlight */}
      {stats.pendingApps > 0 && (
        <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl bg-linear-to-l from-gold to-gold-soft p-5 text-forest-deep shadow-lg md:flex-row">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-forest-deep/10">
              <ClipboardList size={24} />
            </div>
            <p className="text-sm font-semibold">
              {t("pro.pendingBanner", { n: stats.pendingApps })}
            </p>
          </div>
          <Link
            to="applications"
            className="rounded-xl bg-forest-deep px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest"
          >
            {t("pro.reviewNow")}
          </Link>
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent applications (wide) */}
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] lg:col-span-8">
          <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
            <h3 className="font-serif text-lg font-bold text-forest">
              {t("pro.recentApplications")}
            </h3>
            <Link
              to="applications"
              className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
            >
              {t("pro.viewAll")}
              <ArrowLeft size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-forest text-cream">
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("pro.student")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("pro.topicTitle")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("pro.statusLabel")}
                  </th>
                  <th className="px-5 py-3 text-xs font-medium">
                    {t("pro.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {recentApps.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm text-clay"
                    >
                      {t("pro.noApplications")}
                    </td>
                  </tr>
                )}
                {recentApps.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-forest/[0.03]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[11px] font-bold text-cream">
                          {initials(
                            a.student?.user?.firstName,
                            a.student?.user?.lastName,
                          )}
                        </div>
                        <span className="text-sm text-forest">
                          {studentName(a)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay">
                      {a.topic?.title ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {t(`status.${a.status}`, { defaultValue: a.status })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.topicId && (
                        <Link
                          to={`topics/${a.topicId}`}
                          className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        >
                          <Eye size={16} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-5 lg:col-span-4">
          {/* Topics by status */}
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-forest">
                {t("pro.topicsByStatus")}
              </h3>
              <Link
                to="topics"
                className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
              >
                {t("pro.viewAll")}
                <ArrowLeft size={12} />
              </Link>
            </div>
            <div className="space-y-3">
              <StatusRow
                color="bg-violet-400"
                label={t("pro.reservedTopics")}
                value={byStatus.reserved}
              />
              <StatusRow
                color="bg-emerald-400"
                label={t("pro.availableTopics")}
                value={byStatus.available}
              />
              <StatusRow
                color="bg-amber-400"
                label={t("pro.waitingTopics")}
                value={byStatus.waiting}
              />
            </div>

            <Link
              to="topics"
              className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-forest/30 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
            >
              <Plus size={16} />
              {t("pro.addTopic")}
            </Link>
          </div>

          {/* Defense schedule decor card */}
          <div className="overflow-hidden rounded-2xl bg-forest-deep p-5 text-cream">
            <div className="mb-2 flex items-center gap-2">
              <CalendarCheck size={20} className="text-gold" />
              <h3 className="font-serif text-base font-bold">
                {t("pro.defenseScheduleTitle")}
              </h3>
            </div>
            <p className="mb-4 text-xs text-cream/70">
              {t("pro.defenseScheduleBody")}
            </p>
            <button className="flex items-center gap-2 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft">
              <Download size={14} />
              {t("pro.downloadSchedule")}
            </button>
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

function StatusRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${color}`} />
        <span className="text-xs text-clay">{label}</span>
      </div>
      <span className="font-serif text-sm font-bold text-forest">{value}</span>
    </div>
  );
}
