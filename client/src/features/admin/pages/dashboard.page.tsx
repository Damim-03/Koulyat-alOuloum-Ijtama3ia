import { useTranslation } from "react-i18next";
import {
  GraduationCap,
  UserCog,
  FileText,
  CheckCircle2,
  FolderKanban,
  MessagesSquare,
  ClipboardList,
  Eye,
} from "lucide-react";
import { useAdminStats, useAdminApplications } from "../hooks/admin-hook";
import { TopicsDonut } from "../components/topics-donut";
import type { OverviewStats } from "../../../types/admin";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-100 text-gray-600",
};

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

interface Tile {
  key: keyof OverviewStats;
  labelKey: string;
  icon: typeof GraduationCap;
  tint: string;
}

const TILES: Tile[] = [
  { key: "students", labelKey: "dash.students", icon: GraduationCap, tint: "bg-soft-sage/30 text-forest" },
  { key: "professors", labelKey: "dash.professors", icon: UserCog, tint: "bg-gold/15 text-gold" },
  { key: "topics", labelKey: "dash.topics", icon: FileText, tint: "bg-sage/20 text-sage" },
  { key: "approvedTopics", labelKey: "admin.approvedTopics", icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-600" },
  { key: "projects", labelKey: "dash.myProject", icon: FolderKanban, tint: "bg-forest/10 text-forest" },
  { key: "defenses", labelKey: "dash.defense", icon: MessagesSquare, tint: "bg-clay/15 text-clay" },
];

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: apps, isLoading: appsLoading } = useAdminApplications({ limit: 5 });

  return (
    <div className="font-body">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">
          {t("admin.dashGreeting")}
        </h1>
        <p className="mt-1.5 text-sm text-clay">{t("admin.dashSubtitle")}</p>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.key}
              className="flex flex-col items-center rounded-2xl border border-forest/10 bg-cream-card p-5 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
            >
              <div className={`mb-3 grid size-12 place-items-center rounded-full ${tile.tint}`}>
                <Icon size={22} />
              </div>
              <p className="font-serif text-2xl font-bold text-forest">
                {statsLoading ? "\u2026" : (stats?.[tile.key] ?? 0)}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-clay">
                {t(tile.labelKey)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pending applications highlight */}
      <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-gold to-gold-soft p-6 text-forest-deep shadow-lg md:flex-row">
        <div className="flex items-center gap-5">
          <div className="grid size-14 place-items-center rounded-full bg-forest-deep/10">
            <ClipboardList size={28} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold">{t("admin.pendingTitle")}</h3>
            <p className="text-sm opacity-80">
              {t("admin.pendingDesc", { n: stats?.pendingApplications ?? 0 })}
            </p>
          </div>
        </div>
        <span className="font-serif text-4xl font-bold leading-none">
          {statsLoading ? "\u2026" : (stats?.pendingApplications ?? 0)}
        </span>
      </div>

      {/* Two-column: recent applications (wide) + donut (narrow) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent applications */}
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] lg:col-span-8">
          <div className="flex items-center justify-between border-b border-forest/10 px-6 py-4">
            <h3 className="font-serif text-lg font-bold text-forest">
              {t("admin.recentApplications")}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-forest text-cream">
                  <th className="px-6 py-3 text-xs font-medium">{t("admin.studentName")}</th>
                  <th className="px-6 py-3 text-xs font-medium">{t("admin.topicTitle")}</th>
                  <th className="px-6 py-3 text-xs font-medium">{t("admin.statusLabel")}</th>
                  <th className="px-6 py-3 text-xs font-medium">{t("admin.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {appsLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-clay">
                      {"\u2026"}
                    </td>
                  </tr>
                )}

                {!appsLoading && (apps?.items.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-clay">
                      {t("admin.noApplications")}
                    </td>
                  </tr>
                )}

                {apps?.items.map((app) => {
                  const u = app.student?.user;
                  return (
                    <tr key={app.id} className="transition-colors hover:bg-forest/[0.03]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-[11px] font-bold text-cream">
                            {initials(u?.firstName, u?.lastName)}
                          </div>
                          <span className="text-sm text-forest">
                            {[u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
                              app.student?.registrationNumber ||
                              "\u2014"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-clay">
                        {app.topic?.title ?? "\u2014"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                            STATUS_STYLES[app.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t(`status.${app.status}`, { defaultValue: app.status })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-clay transition-colors hover:text-forest">
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut */}
        <div className="lg:col-span-4">
          <TopicsDonut />
        </div>
      </div>
    </div>
  );
}