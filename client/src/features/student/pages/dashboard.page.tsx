import { useTranslation } from "react-i18next";
import {
  FolderKanban,
  Inbox,
  Milestone as MilestoneIcon,
  CalendarClock,
  ArrowLeft,
} from "lucide-react";
import { LocaleLink } from "../../../i18n/locales/components/locale-link";
import { PATHS } from "../../../routes/paths";
import {
  useStudentProject,
  useStudentApplications,
  useStudentMilestones,
} from "../hooks/Student-hook";
import { StatusBadge } from "../components/status-badge";

export function StudentDashboardPage() {
  const { t } = useTranslation();
  const { data: project } = useStudentProject();
  const { data: applications } = useStudentApplications();
  const { data: milestones } = useStudentMilestones();

  const upcoming = (milestones ?? [])
    .filter((m) => m.status === "pending" || m.status === "in_progress")
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);

  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-bold text-forest">{t("stu.dashGreeting")}</h2>
      <p className="mb-6 text-sm text-clay">{t("stu.dashSubtitle")}</p>

      {project && (
        <div className="mb-5 rounded-2xl border border-forest/10 bg-gradient-to-br from-forest to-forest-deep p-6 text-cream">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-soft-sage">{t("stu.myProject")}</p>
              <h3 className="truncate font-serif text-lg font-bold">{project.topic.title}</h3>
            </div>
            <span className="shrink-0 font-serif text-3xl font-bold text-gold">{project.progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-cream/15">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-soft to-gold" style={{ width: `${project.progress}%` }} />
          </div>
          <LocaleLink to={`${PATHS.student.root}/project`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-gold-soft hover:text-gold">
            {t("stu.viewProject")} <ArrowLeft size={14} />
          </LocaleLink>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile icon={Inbox} label={t("stu.myApplications")} value={applications?.length ?? 0} to={`${PATHS.student.root}/topics`} />
        <StatTile icon={CalendarClock} label={t("stu.meetings")} value={project?.stats.meetings ?? 0} to={`${PATHS.student.root}/meetings`} />
        <StatTile icon={MilestoneIcon} label={t("stu.timeline")} value={upcoming.length} to={`${PATHS.student.root}/timeline`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-forest/10 bg-cream-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <Inbox size={16} className="text-gold" /> {t("stu.myApplications")}
          </h3>
          {!applications || applications.length === 0 ? (
            <EmptyMini label={t("stu.noApplications")} />
          ) : (
            <div className="space-y-2">
              {applications.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-forest/10 bg-white/50 p-3">
                  <p className="min-w-0 truncate text-[13px] font-medium text-forest">{a.topic?.title}</p>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-forest/10 bg-cream-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <MilestoneIcon size={16} className="text-gold" /> {t("stu.upcomingMilestones")}
          </h3>
          {upcoming.length === 0 ? (
            <EmptyMini label={t("stu.noMilestones")} />
          ) : (
            <div className="space-y-2">
              {upcoming.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-forest/10 bg-white/50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-forest">{m.title}</p>
                    <p className="text-[11px] text-clay">{new Date(m.deadline).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, to }: { icon: typeof Inbox; label: string; value: number; to: string }) {
  return (
    <LocaleLink to={to} className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 transition hover:-translate-y-px hover:shadow-md hover:shadow-forest/5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest/8 text-forest">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="font-serif text-2xl font-bold text-forest">{value}</p>
        <p className="truncate text-[12px] text-clay">{label}</p>
      </div>
    </LocaleLink>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="grid place-items-center rounded-xl border-2 border-dashed border-forest/15 py-8 text-center">
      <FolderKanban size={28} className="mb-1 text-forest/25" />
      <p className="text-[13px] text-clay">{label}</p>
    </div>
  );
}
