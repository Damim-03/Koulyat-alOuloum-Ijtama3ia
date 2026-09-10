import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  EyeOff,
  Clock,
  FileText,
  FolderKanban,
  GraduationCap,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useProfessorDashboard } from "../hooks/Professor-hook";
import { useAuth } from "../../../hooks/use-auth";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type {
  DashAgendaItem,
  DashMilestoneLite,
  DashProject,
  DashSubmissionLite,
  DashTopicLite,
} from "../../../types/professor.types";

/**
 * The professor's first screen.
 *
 * It answers three questions in order: what needs me today, what is coming,
 * and where do my projects stand. The counters are last in importance and so
 * they are small — a dashboard that only counts things is a report, and a
 * report is not what someone opens their working day with.
 *
 * Everything arrives in one request; see GET /professor/dashboard.
 */
export function ProfessorDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useProfessorDashboard();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "";

  const { attentionCount, filledBuckets } = useMemo(() => {
    const a = data?.attention;
    if (!a) return { attentionCount: 0, filledBuckets: 0 };
    const lists = [
      a.rejectedTopics,
      a.overdueMilestones,
      a.dueThisWeek,
      a.awaitingReview,
      a.approvedNotPublished,
      a.openWithoutRequests,
      a.pendingTopics,
    ];
    return {
      attentionCount: lists.reduce((n, l) => n + l.length, 0),
      // The band lays itself out from this: one bucket should not be given
      // a third of the page with two empty columns beside it.
      filledBuckets: lists.filter((l) => l.length > 0).length,
    };
  }, [data]);

  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  /** Days from today — negative means the date has passed. */
  function daysFrom(iso: string) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return Math.round(
      (new Date(iso).setHours(0, 0, 0, 0) - midnight.getTime()) / 86400000,
    );
  }

  function relative(iso: string) {
    const d = daysFrom(iso);
    if (d === 0) return t("pro.today");
    if (d === 1) return t("pro.tomorrow");
    if (d < 0) return t("pro.lateByDays", { count: Math.abs(d) });
    return t("pro.inDays", { count: d });
  }

  if (isLoading || !data) {
    return (
      <div className="font-body">
        <div className="mb-8 h-9 w-72 animate-pulse rounded-xl bg-forest/10" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, k) => (
            <div
              key={k}
              className="h-28 animate-pulse rounded-2xl bg-forest/5"
            />
          ))}
        </div>
      </div>
    );
  }

  const { topics, stats, topicBreakdown, attention, agenda, projects } = data;

  return (
    <div className="font-body">
      {/* ── greeting ── */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">
          {name ? t("pro.dashGreetingNamed", { name }) : t("pro.dashGreeting")}
        </h1>
        <p className="mt-1.5 text-sm text-clay">{t("pro.dashSubtitle")}</p>
      </div>

      {/* ── counters ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          icon={FileText}
          value={stats.myTopics}
          label={t("pro.myTopicsCount")}
          tint="bg-sage/20 text-sage"
          to="topics"
        />
        <StatTile
          icon={FolderKanban}
          value={stats.supervisedProjects}
          label={t("pro.supervisedProjects")}
          tint="bg-gold/15 text-gold"
          to="groups"
        />
        <StatTile
          icon={Users}
          value={stats.supervisedStudents}
          label={t("pro.supervisedStudents")}
          tint="bg-soft-sage/35 text-forest"
          to="groups"
        />
        <StatTile
          icon={AlertTriangle}
          value={stats.overdueMilestones}
          label={t("pro.overdueMilestones")}
          tint={
            stats.overdueMilestones > 0
              ? "bg-brick/15 text-brick"
              : "bg-forest/8 text-clay"
          }
          to="milestones"
          alarm={stats.overdueMilestones > 0}
        />
        <StatTile
          icon={CalendarCheck}
          value={stats.upcomingDefenses}
          label={t("pro.upcomingDefenses")}
          tint="bg-violet-500/15 text-violet-500"
          to="groups"
        />
      </div>

      {/* ══════════ needs your attention ══════════
          Full width and laid out in columns: the buckets multiply with the
          number of topics, and a tall narrow list is the one shape that does
          not survive that. */}
      <section className="mb-5 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <header className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
          <span className="grid size-8 place-items-center rounded-xl bg-gold/15 text-gold">
            <ClipboardList size={17} />
          </span>
          <h2 className="font-serif text-base font-bold text-forest">
            {t("pro.needsAttention")}
          </h2>
          {attentionCount > 0 && (
            <span className="rounded-full bg-brick/10 px-2 py-0.5 text-[11px] font-bold text-brick tabular-nums">
              {attentionCount}
            </span>
          )}
        </header>

        {attentionCount === 0 ? (
          <Settled text={t("pro.nothingNeedsYou")} />
        ) : (
          <div
            className={`grid grid-cols-1 items-start gap-x-6 gap-y-5 ${
              filledBuckets >= 3
                ? "md:grid-cols-2 2xl:grid-cols-3"
                : filledBuckets === 2
                  ? "md:grid-cols-2"
                  : ""
            }`}
          >
            {/* a rejected topic is the only thing here that is purely the
                professor's to fix, so it leads */}
            <Bucket
              icon={Pencil}
              tone="brick"
              title={t("pro.rejectedTopicsNeedEdit")}
              items={attention.rejectedTopics}
              render={(tp: DashTopicLite) => (
                <Row
                  key={tp.id}
                  to={`topics/${tp.id}`}
                  title={tp.title}
                  meta={tp.rejectionReason ?? t("pro.noReasonGiven")}
                  badge={t("pro.fixIt")}
                  badgeTone="brick"
                />
              )}
            />

            <Bucket
              icon={AlertTriangle}
              tone="brick"
              title={t("pro.overdueMilestones")}
              items={attention.overdueMilestones}
              render={(m: DashMilestoneLite) => (
                <Row
                  key={m.id}
                  to={`groups/${m.groupId}`}
                  title={m.title}
                  meta={m.group.topic.title}
                  badge={relative(m.deadline)}
                  badgeTone="brick"
                />
              )}
            />

            <Bucket
              icon={Clock}
              tone="gold"
              title={t("pro.dueThisWeek")}
              items={attention.dueThisWeek}
              render={(m: DashMilestoneLite) => (
                <Row
                  key={m.id}
                  to={`groups/${m.groupId}`}
                  title={m.title}
                  meta={m.group.topic.title}
                  badge={relative(m.deadline)}
                  badgeTone="gold"
                />
              )}
            />

            <Bucket
              icon={Inbox}
              tone="sage"
              title={t("pro.awaitingReview")}
              items={attention.awaitingReview}
              render={(s: DashSubmissionLite) => (
                <Row
                  key={s.id}
                  to={`groups/${s.milestone.groupId}`}
                  title={s.fileName}
                  meta={`${s.milestone.title} · ${s.milestone.group.topic.title}`}
                  badge={fmtDate(s.createdAt)}
                  badgeTone="sage"
                  avatar={s.uploadedBy}
                />
              )}
            />

            <Bucket
              icon={Clock}
              tone="gold"
              title={t("pro.awaitingAdminApproval")}
              items={attention.pendingTopics}
              render={(tp: DashTopicLite) => (
                <Row
                  key={tp.id}
                  to={`topics/${tp.id}`}
                  title={tp.title}
                  meta={t("pro.sentOn", { date: fmtDate(tp.createdAt) })}
                  badge={relative(tp.createdAt)}
                  badgeTone="gold"
                />
              )}
            />

            {/* Accepted but not on the board yet. The professor cannot
                publish it himself, but he is the one who notices. */}
            <Bucket
              icon={EyeOff}
              tone="gold"
              title={t("pro.approvedNotPublished")}
              items={attention.approvedNotPublished}
              render={(tp: DashTopicLite) => (
                <Row
                  key={tp.id}
                  to={`topics/${tp.id}`}
                  title={tp.title}
                  meta={tp.specialization?.name ?? "—"}
                  badge={t("pro.notPublishedYet")}
                  badgeTone="gold"
                />
              )}
            />

            <Bucket
              icon={FileText}
              tone="sage"
              title={t("pro.publishedNoRequests")}
              items={attention.openWithoutRequests}
              render={(tp: DashTopicLite) => (
                <Row
                  key={tp.id}
                  to={`topics/${tp.id}`}
                  title={tp.title}
                  meta={tp.specialization?.name ?? "—"}
                  badge={t("pro.noRequestsYet")}
                  badgeTone="sage"
                />
              )}
            />
          </div>
        )}
      </section>

      {/* ══════════ the work itself, beside what is coming ══════════ */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        {/* ── projects: the professor's actual objects, so they lead ── */}
        <section>
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-base font-bold text-forest">
              <span className="grid size-8 place-items-center rounded-xl bg-gold/15 text-gold">
                <FolderKanban size={17} />
              </span>
              {t("pro.myProjects")}
              <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay tabular-nums">
                {projects.length}
              </span>
            </h2>
            <Link
              to="groups"
              className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
            >
              {t("pro.viewAll")}
              <ArrowLeft size={12} className="ltr:rotate-180" />
            </Link>
          </header>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card p-8">
              <Empty text={t("pro.noSupervisedProjects")} />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4">
              {projects.map((p: DashProject) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  fmtDate={fmtDate}
                  relative={relative}
                />
              ))}
            </div>
          )}
        </section>

        {/* ══════════ side column ══════════ */}
        <div className="space-y-5">
          {/* ── what is coming ── */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <header className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <span className="grid size-8 place-items-center rounded-xl bg-forest/8 text-forest">
                <CalendarClock size={17} />
              </span>
              <h2 className="font-serif text-base font-bold text-forest">
                {t("pro.whatIsComing")}
              </h2>
            </header>

            {agenda.length === 0 ? (
              <Empty text={t("pro.nothingScheduled")} />
            ) : (
              <ol className="relative space-y-3 ps-4">
                {/* the thread the dates hang from */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 start-[3px] w-px bg-forest/12"
                />
                {agenda.map((a: DashAgendaItem) => {
                  const defense = a.kind === "defense";
                  return (
                    <li key={`${a.kind}-${a.id}`} className="relative">
                      <span
                        aria-hidden="true"
                        className={`absolute -start-4 top-1.5 size-2 rounded-full ring-2 ring-cream-card ${
                          defense ? "bg-violet-500" : "bg-gold"
                        }`}
                      />
                      <Link
                        to={`groups/${a.groupId}`}
                        className="block rounded-xl px-2 py-1.5 transition hover:bg-forest/4"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-forest">
                            {defense ? t("pro.defenseOf", { title: a.title }) : a.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-semibold text-clay">
                            {relative(a.date)}
                          </span>
                        </div>
                        <p className="flex items-center gap-1.5 truncate text-[11px] text-clay">
                          {fmtDate(a.date)}
                          {a.room && (
                            <>
                              <MapPin size={10} />
                              {a.room}
                            </>
                          )}
                          {!defense && <>· {a.topicTitle}</>}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ── topics by status ── */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <header className="mb-4 flex items-center justify-between border-b border-forest/10 pb-3">
              <h2 className="font-serif text-base font-bold text-forest">
                {t("pro.topicsByStatus")}
              </h2>
              <Link
                to="topics"
                className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
              >
                {t("pro.viewAll")}
                <ArrowLeft size={12} className="ltr:rotate-180" />
              </Link>
            </header>

            <StatusBreakdown breakdown={topicBreakdown} total={stats.myTopics} />

            <Link
              to="topics"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-forest/30 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10"
            >
              <Plus size={16} />
              {t("pro.addTopic")}
            </Link>
          </section>
        </div>
      </div>

      {/* ══════════ my topics ══════════
          A count per status cannot say *which* topic is where, and that is
          the question once there are more than a handful. */}
      <section className="mt-5 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <header className="mb-4 flex items-center justify-between border-b border-forest/10 pb-3">
          <h2 className="flex items-center gap-2 font-serif text-base font-bold text-forest">
            <span className="grid size-8 place-items-center rounded-xl bg-sage/15 text-sage">
              <FileText size={17} />
            </span>
            {t("pro.myTopicsCount")}
            <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay tabular-nums">
              {topics.length}
            </span>
          </h2>
          <Link
            to="topics"
            className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
          >
            {t("pro.viewAll")}
            <ArrowLeft size={12} className="ltr:rotate-180" />
          </Link>
        </header>

        {topics.length === 0 ? (
          <Empty text={t("pro.noTopicsYet")} />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-2">
            {topics.slice(0, 9).map((tp: DashTopicLite) => (
              <li key={tp.id}>
                <Link
                  to={`topics/${tp.id}`}
                  className="flex items-center gap-2.5 rounded-xl border border-forest/10 bg-cream-2/60 px-3 py-2.5 transition hover:border-gold/40 hover:bg-gold/5"
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[tp.status] ?? "bg-clay"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-forest">
                      {tp.title}
                    </span>
                    <span className="block truncate text-[11px] text-clay">
                      {[tp.specialization?.name, t(`status.${tp.status}`)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {/* how many teams have asked for it — the number that says
                      whether a published topic is landing */}
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest/8 px-2 py-0.5 text-[10px] font-bold text-clay tabular-nums"
                    title={t("pro.groupRequestsOnTopic")}
                  >
                    <Users size={10} />
                    {tp._count.groupRequests}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {topics.length > 9 && (
          <p className="mt-2.5 text-center text-[11px] text-clay/80">
            {`+${topics.length - 9}`}
          </p>
        )}
      </section>
    </div>
  );
}

/** One colour per status, shared by the list and the breakdown. */
const STATUS_DOT: Record<string, string> = {
  full: "bg-violet-400",
  open: "bg-emerald-400",
  approved: "bg-sky-400",
  pending: "bg-amber-400",
  rejected: "bg-brick",
  archived: "bg-clay",
};

// ─────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
  to,
  alarm,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tint: string;
  to: string;
  alarm?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center rounded-2xl border bg-cream-card p-4 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(38,66,61,0.09)] ${
        alarm ? "border-brick/30" : "border-forest/10"
      }`}
    >
      <div className={`mb-2.5 grid size-11 place-items-center rounded-full ${tint}`}>
        <Icon size={20} />
      </div>
      <p className="font-serif text-2xl font-bold text-forest tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-clay">{label}</p>
    </Link>
  );
}

/** A titled group inside "needs your attention"; absent when it is empty. */
function Bucket<T>({
  icon: Icon,
  tone,
  title,
  items,
  render,
}: {
  icon: LucideIcon;
  tone: "brick" | "gold" | "sage";
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  const toneCls =
    tone === "brick"
      ? "text-brick"
      : tone === "gold"
        ? "text-gold"
        : "text-sage";
  return (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-xs font-bold ${toneCls}`}>
        <Icon size={13} />
        {title}
        <span className="rounded-full bg-forest/8 px-1.5 text-[10px] text-clay tabular-nums">
          {items.length}
        </span>
      </p>
      <ul className="space-y-1.5">{items.slice(0, 4).map(render)}</ul>
      {items.length > 4 && (
        <p className="mt-1.5 ps-2 text-[11px] text-clay/80">
          {`+${items.length - 4}`}
        </p>
      )}
    </div>
  );
}

function Row({
  to,
  title,
  meta,
  badge,
  badgeTone,
  avatar,
}: {
  to: string;
  title: string;
  meta: string;
  badge: string;
  badgeTone: "brick" | "gold" | "sage";
  avatar?: unknown;
}) {
  const toneCls =
    badgeTone === "brick"
      ? "bg-brick/10 text-brick"
      : badgeTone === "gold"
        ? "bg-gold/15 text-gold"
        : "bg-sage/15 text-sage";
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-2.5 rounded-xl border border-forest/10 bg-cream-2/60 px-3 py-2 transition hover:border-gold/40 hover:bg-gold/5"
      >
        {avatar !== undefined && <UserAvatar user={avatar} size={28} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-forest">
            {title}
          </span>
          <span className="block truncate text-[11px] text-clay">{meta}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${toneCls}`}
        >
          {badge}
        </span>
      </Link>
    </li>
  );
}

function ProjectCard({
  project,
  fmtDate,
  relative,
}: {
  project: DashProject;
  fmtDate: (iso: string) => string;
  relative: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const { milestones: ms } = project;
  const pct = ms.total === 0 ? 0 : Math.round((ms.completed / ms.total) * 100);

  return (
    <Link
      to={`groups/${project.id}`}
      className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-px hover:border-gold/40 hover:shadow-[0_8px_24px_rgba(38,66,61,0.09)]"
    >
      <p className="mb-2 line-clamp-2 font-serif text-sm font-bold text-forest">
        {project.topic.title}
      </p>

      {/* members */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {project.members.slice(0, 4).map((m) => (
            <UserAvatar
              key={m.id}
              user={m.student?.user}
              size={26}
              className="border-2 border-cream-card"
            />
          ))}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-clay">
          <GraduationCap size={12} />
          {t("pro.membersCount", { count: project.members.length })}
        </span>
      </div>

      {/* progress */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-clay">{t("pro.milestoneProgress")}</span>
          <span className="font-bold text-forest tabular-nums">
            {ms.completed}/{ms.total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-forest/10">
          <div
            className={`h-full rounded-full transition-all ${
              ms.overdue > 0 ? "bg-brick" : "bg-sage"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* the one date that matters next */}
      <div className="mt-auto space-y-1 pt-1.5 text-[11px]">
        {ms.overdue > 0 && (
          <p className="flex items-center gap-1.5 font-semibold text-brick">
            <AlertTriangle size={11} />
            {t("pro.overdueCount", { count: ms.overdue })}
          </p>
        )}
        {project.nextDeadline && (
          <p className="flex items-center gap-1.5 text-clay">
            <Clock size={11} className="text-gold" />
            <span className="truncate">{project.nextDeadline.title}</span>
            <span className="ms-auto shrink-0 font-semibold text-forest">
              {relative(project.nextDeadline.deadline)}
            </span>
          </p>
        )}
        {project.defense && (
          <p className="flex items-center gap-1.5 text-clay">
            <CalendarCheck size={11} className="text-violet-500" />
            {t("pro.defenseOn", { date: fmtDate(project.defense.date) })}
            {project.defense.room && (
              <span className="ms-auto shrink-0">{project.defense.room}</span>
            )}
          </p>
        )}
        {!project.nextDeadline && ms.total > 0 && ms.overdue === 0 && (
          <p className="flex items-center gap-1.5 text-sage">
            <CheckCircle2 size={11} />
            {t("pro.allMilestonesDone")}
          </p>
        )}
        {ms.total === 0 && (
          <p className="flex items-center gap-1.5 text-clay/80">
            <Plus size={11} />
            {t("pro.noMilestonesYet")}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * The share of each status as one bar, then a line per status that actually
 * occurs. A professor with one topic was being shown six rows, five of them
 * zero — a list of nothing is not information.
 */
function StatusBreakdown({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  const { t } = useTranslation();
  const present = Object.keys(STATUS_DOT).filter((s) => (breakdown[s] ?? 0) > 0);

  if (total === 0) {
    return <p className="py-3 text-center text-xs text-clay">{t("pro.noTopicsYet")}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-forest/8">
        {present.map((s) => (
          <span
            key={s}
            className={STATUS_DOT[s]}
            style={{ width: `${((breakdown[s] ?? 0) / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="space-y-2.5">
        {present.map((s) => (
          <div key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${STATUS_DOT[s]}`} />
              <span className="text-xs text-clay">{t(`status.${s}`)}</span>
            </span>
            <span className="font-serif text-sm font-bold text-forest tabular-nums">
              {breakdown[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-6 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-forest/5 text-clay">
        <Inbox size={18} />
      </span>
      <p className="text-xs text-clay">{text}</p>
    </div>
  );
}

function Settled({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-sage/15 text-sage">
        <CheckCircle2 size={22} />
      </span>
      <p className="text-sm font-medium text-forest">{text}</p>
    </div>
  );
}
