import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  FolderKanban,
  FileText,
  Plus,
  ArrowLeft,
  CalendarCheck,
  Download,
} from "lucide-react";
import {
  useMyTopics,
  useMyGroups,
} from "../hooks/Professor-hook";

export function ProfessorDashboardPage() {
  const { t } = useTranslation();

  const { data: topics } = useMyTopics();
  const { data: groups } = useMyGroups();

  // ── Derived stats (computed client-side; no stats endpoint needed) ──
  const stats = useMemo(() => {
    const topicList = topics ?? [];
    const groupList = groups ?? [];

    const upcomingMilestones = groupList.reduce(
      (acc, g) => acc + (g._count?.milestones ?? 0),
      0,
    );

    return {
      myTopics: topicList.length,
      supervisedProjects: groupList.length,
      upcomingMilestones,
    };
  }, [topics, groups]);

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
          icon={FileText}
          value={stats.myTopics}
          label={t("pro.myTopicsCount")}
          tint="bg-sage/20 text-sage"
        />
      </div>


      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6">

        {/* Side column */}
        <div className="space-y-5">
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
                <ArrowLeft size={12} className="ltr:rotate-180" />
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
