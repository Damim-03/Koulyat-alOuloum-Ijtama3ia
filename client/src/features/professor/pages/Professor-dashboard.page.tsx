import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crown,
  EyeOff,
  FileText,
  FolderKanban,
  Gavel,
  GraduationCap,
  IdCard,
  Inbox,
  Landmark,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useProfessorDashboard } from "../hooks/Professor-hook";
import { useAuth } from "../../../hooks/use-auth";
import { useDates } from "../../../hooks/use-dates";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type {
  DashCommitteeSeat,
  DashMilestoneLite,
  DashProfile,
  DashProject,
  DashSubmissionLite,
  DashTopicLite,
  ProfessorDashboard,
} from "../../../types/professor.types";
import { givenName, personName } from "../../../lib/person-name";

/**
 * The professor's first screen.
 *
 * It opens on who they are — the card a colleague would recognise — and the
 * figures that matter, then answers in order: what needs me today, what is
 * coming (their own projects' dates and the defenses they sit on for
 * others), where their projects stand, who their students are and what they
 * last handed in, and finally every topic with its state.
 *
 * Everything arrives in one request; see GET /professor/dashboard.
 */
export function ProfessorDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useProfessorDashboard();

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

  if (isLoading || !data) return <DashboardSkeleton />;

  const { topics, stats, topicBreakdown, projects } = data;
  const committee = data.committee ?? [];

  return (
    <div className="space-y-6 font-body">
      <ProfileHero data={data} />

      <AttentionSection
        data={data}
        count={attentionCount}
        filledBuckets={filledBuckets}
      />

      {/* ══════════ the work, what is coming, the people ══════════
          One grid for both rows, so their gutters line up: the projects
          take two of the three columns and the agenda the third, and the
          row beneath is three single columns. Two cards on one row share
          one height, so the shorter never leaves a hole under it.
          On a laptop it is two columns: the projects across the top, the
          other four in two pairs. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <section className={`${SECTION} lg:col-span-2`}>
          <SectionHeader
            icon={FolderKanban}
            title={t("pro.myProjects")}
            badge={String(projects.length)}
            to="groups"
          />
          {projects.length === 0 ? (
            <Empty icon={FolderKanban} text={t("pro.noSupervisedProjects")} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <AgendaSection data={data} />
        <StudentsSection projects={projects} />
        <SubmissionsSection submissions={data.recentSubmissions ?? []} />
        <CommitteeSection seats={committee} />
      </div>

      {/* ══════════ every topic, with where they stand in one line ══════════ */}
      <TopicsSection
        topics={topics}
        breakdown={topicBreakdown}
        total={stats.myTopics}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  shared bits
// ─────────────────────────────────────────────────────────────

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

/** A section card that fills its grid cell, so an empty state can centre in it. */
const SECTION = `flex flex-col p-6 ${CARD}`;

/** One colour per status, shared by the list and the breakdown. */
const STATUS_DOT: Record<string, string> = {
  full: "bg-violet-400",
  open: "bg-emerald-400",
  approved: "bg-sky-400",
  pending: "bg-amber-400",
  rejected: "bg-brick",
  archived: "bg-clay",
};

type Person = {
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined;

function fullName(u: Person) {
  return personName(u);
}

/** `grade` is JSON: a list of strings, or a lone string on older rows. */
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && !!x.trim());
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
  to,
  tint = "bg-gold/15 text-gold",
  id,
  action,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  to?: string;
  tint?: string;
  id?: string;
  /** Something to do from the header — a button beside "view all". */
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header
      id={id}
      className="mb-5 flex scroll-mt-24 items-center justify-between gap-3 border-b border-forest/10 pb-4"
    >
      <h2 className="flex items-center gap-2.5 font-serif text-lg font-bold text-forest">
        <span className={`grid size-9 place-items-center rounded-xl ${tint}`}>
          <Icon size={18} />
        </span>
        {title}
        {badge !== undefined && (
          <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-bold text-clay tabular-nums">
            {badge}
          </span>
        )}
      </h2>
      {(action || to) && (
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {to && (
            <Link
              to={to}
              className="flex items-center gap-1 text-xs text-sage transition hover:text-forest"
            >
              {t("pro.viewAll")}
              <ArrowLeft size={12} className="ltr:rotate-180" />
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

/** Centred in whatever height the row gives it — no fixed padding to pad out. */
function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-4 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-gold/10 text-gold ring-4 ring-gold/5">
        <Icon size={19} />
      </span>
      <p className="max-w-xs text-sm text-clay">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  who you are, and the figures
// ─────────────────────────────────────────────────────────────

function ProfileHero({ data }: { data: ProfessorDashboard }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { daysFrom } = useDates();
  const profile: DashProfile | null = data.profile ?? null;
  const { stats } = data;

  const first = givenName(user);
  const last = user?.lastName?.trim() ?? "";
  const grades = asList(profile?.grade);
  const upcomingSeats = (data.committee ?? []).filter(
    (c) => c.status === "scheduled" && daysFrom(c.date) >= 0,
  ).length;

  const tiles: {
    icon: LucideIcon;
    value: number;
    label: string;
    to: string;
    tone: string;
    alarm?: boolean;
  }[] = [
    { icon: FileText, value: stats.myTopics, label: t("pro.myTopicsCount"), to: "topics", tone: "text-soft-sage" },
    { icon: FolderKanban, value: stats.supervisedProjects, label: t("pro.supervisedProjects"), to: "groups", tone: "text-gold-soft" },
    { icon: Users, value: stats.supervisedStudents, label: t("pro.supervisedStudents"), to: "groups", tone: "text-cream" },
    {
      icon: AlertTriangle,
      value: stats.overdueMilestones,
      label: t("pro.overdueMilestones"),
      to: "milestones",
      tone: stats.overdueMilestones > 0 ? "text-[#f0a48f]" : "text-soft-sage",
      alarm: stats.overdueMilestones > 0,
    },
    { icon: CalendarCheck, value: stats.upcomingDefenses, label: t("pro.upcomingDefenses"), to: "groups", tone: "text-violet-300" },
    { icon: Gavel, value: upcomingSeats, label: t("pro.hub.committeeSeats"), to: "#committee", tone: "text-gold-soft" },
  ];

  return (
    <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
      {/* ornament, clipped by a layer of its own so the card never scrolls */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:text-start">
        {/* photo, in a gold frame */}
        <div className="relative shrink-0">
          <div className="rounded-full bg-linear-to-br from-gold-soft via-gold to-gold-soft/30 p-1 shadow-[0_10px_30px_rgba(193,150,90,0.35)]">
            <UserAvatar
              user={user}
              size={112}
              tone="gold"
              className="text-[var(--t-brand-deep)]! ring-4 ring-[var(--t-brand-deep)]"
            />
          </div>
          <span
            title={t("role.professor")}
            className="absolute end-1 bottom-1 grid size-9 place-items-center rounded-full bg-gold text-[var(--t-brand-deep)] shadow-md ring-4 ring-[var(--t-brand-deep)]"
          >
            <GraduationCap size={17} />
          </span>
        </div>

        {/* name, grade, department */}
        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold-soft">
            <Sparkles size={13} />
            {t("pro.hub.welcome")}
          </p>
          <h1 className="font-serif text-3xl leading-tight font-bold text-cream lg:text-4xl">
            {first || last ? (
              <>
                {first} <span className="text-gold-soft">{last}</span>
              </>
            ) : (
              t("role.professor")
            )}
          </h1>
          <p className="mt-2 text-sm text-soft-sage">{t("pro.dashSubtitle")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
            <HeroChip icon={Award}>
              {grades.length ? grades.join(" · ") : t("role.professor")}
            </HeroChip>
            {profile?.department?.name && (
              <HeroChip icon={Building2}>{profile.department.name}</HeroChip>
            )}
            {profile?.department?.faculty?.name && (
              <HeroChip icon={Landmark}>
                {profile.department.faculty.name}
              </HeroChip>
            )}
          </div>
        </div>

        {/* identity plate */}
        {profile && (
          <div className="w-full shrink-0 space-y-3 rounded-2xl border border-gold/30 bg-white/5 p-4 text-start backdrop-blur-sm lg:w-auto lg:min-w-72">
            <PlateLine
              icon={Mail}
              label={t("pro.hub.universityEmail")}
              value={profile.universityEmail}
            />
            <div className="h-px bg-white/10" />
            <PlateLine
              icon={IdCard}
              label={t("pro.hub.employeeNumber")}
              value={profile.employeeNumber}
              mono
            />
          </div>
        )}
      </div>

      {/* the figures — each one opens what it counts */}
      <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map(({ icon: Icon, value, label, to, tone, alarm }) => {
          const cls = `group flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
            alarm
              ? "border-[#f0a48f]/40 bg-[#f0a48f]/10 hover:bg-[#f0a48f]/15"
              : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
          }`;
          const body = (
            <>
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-none font-bold text-cream tabular-nums">
                  {value}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-tight text-soft-sage">
                  {label}
                </span>
              </span>
            </>
          );
          return to.startsWith("#") ? (
            <a key={label} href={to} className={cls}>
              {body}
            </a>
          ) : (
            <Link key={label} to={to} className={cls}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PlateLine({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-soft-sage">
        <Icon size={13} className="text-gold-soft" />
        {label}
      </p>
      <p
        dir="ltr"
        className={`truncate text-cream rtl:text-right ${
          mono
            ? "font-mono text-lg font-bold tracking-[0.08em]"
            : "text-sm font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function HeroChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-cream">
      <Icon size={12} className="text-gold-soft" />
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  needs your attention
// ─────────────────────────────────────────────────────────────

/**
 * Full width and laid out in columns: the buckets multiply with the number
 * of topics, and a tall narrow list is the one shape that does not survive
 * that.
 */
function AttentionSection({
  data,
  count,
  filledBuckets,
}: {
  data: ProfessorDashboard;
  count: number;
  filledBuckets: number;
}) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();
  const { attention } = data;

  // Nothing waiting is one sentence, not a full card of empty space.
  if (count === 0)
    return (
      <section
        className={`flex flex-wrap items-center gap-3 px-6 py-4 ${CARD}`}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-sage/15 text-sage">
          <CheckCircle2 size={18} />
        </span>
        <h2 className="font-serif text-lg font-bold text-forest">
          {t("pro.needsAttention")}
        </h2>
        <p className="text-sm text-clay">{t("pro.nothingNeedsYou")}</p>
      </section>
    );

  return (
    <section className={SECTION}>
      <SectionHeader
        icon={ClipboardList}
        title={t("pro.needsAttention")}
        badge={count > 0 ? String(count) : undefined}
        tint={count > 0 ? "bg-brick/10 text-brick" : "bg-sage/15 text-sage"}
      />

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
    </section>
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
    tone === "brick" ? "text-brick" : tone === "gold" ? "text-gold" : "text-sage";
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
        <p className="mt-1.5 ps-2 text-[11px] text-clay/80">{`+${items.length - 4}`}</p>
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
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${toneCls}`}>
          {badge}
        </span>
      </Link>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  projects
// ─────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: DashProject }) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();
  const { milestones: ms } = project;
  const pct = ms.total === 0 ? 0 : Math.round((ms.completed / ms.total) * 100);

  return (
    <Link
      to={`groups/${project.id}`}
      className="group flex flex-col rounded-2xl bg-cream-2/60 p-5 ring-1 ring-forest/8 transition hover:-translate-y-0.5 hover:ring-gold/40 hover:shadow-[0_10px_30px_rgba(38,66,61,0.1)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-serif text-base leading-snug font-bold text-forest">
          {project.topic.title}
        </p>
        <span className="shrink-0 font-serif text-xl font-bold text-gold tabular-nums">
          {pct}%
        </span>
      </div>

      {/* members */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {project.members.slice(0, 4).map((m) => (
            <UserAvatar
              key={m.id}
              user={m.student?.user}
              size={30}
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
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-clay">{t("pro.milestoneProgress")}</span>
          <span className="font-bold text-forest tabular-nums">
            {ms.completed}/{ms.total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-forest/10">
          <div
            className={`h-full rounded-full bg-linear-to-l transition-all ${
              ms.overdue > 0 ? "from-brick to-brick/70" : "from-gold to-gold-soft"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* the one date that matters next */}
      <div className="mt-auto space-y-1.5 border-t border-forest/8 pt-3 text-[11px]">
        {ms.overdue > 0 && (
          <p className="flex items-center gap-1.5 font-semibold text-brick">
            <AlertTriangle size={12} />
            {t("pro.overdueCount", { count: ms.overdue })}
          </p>
        )}
        {project.nextDeadline && (
          <p className="flex items-center gap-1.5 text-clay">
            <Clock size={12} className="text-gold" />
            <span className="truncate">{project.nextDeadline.title}</span>
            <span className="ms-auto shrink-0 font-semibold text-forest">
              {relative(project.nextDeadline.deadline)}
            </span>
          </p>
        )}
        {project.defense && (
          <p className="flex items-center gap-1.5 text-clay">
            <CalendarCheck size={12} className="text-violet-500" />
            {t("pro.defenseOn", { date: fmtDate(project.defense.date) })}
            {project.defense.room && (
              <span className="ms-auto shrink-0">{project.defense.room}</span>
            )}
          </p>
        )}
        {!project.nextDeadline && ms.total > 0 && ms.overdue === 0 && (
          <p className="flex items-center gap-1.5 text-sage">
            <CheckCircle2 size={12} />
            {t("pro.allMilestonesDone")}
          </p>
        )}
        {ms.total === 0 && (
          <p className="flex items-center gap-1.5 text-clay/80">
            <Plus size={12} />
            {t("pro.noMilestonesYet")}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
//  what is coming
// ─────────────────────────────────────────────────────────────

function AgendaSection({ data }: { data: ProfessorDashboard }) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();
  const { agenda } = data;

  return (
    <section className={SECTION}>
      <SectionHeader icon={CalendarClock} title={t("pro.whatIsComing")} />
      {agenda.length === 0 ? (
        <Empty icon={CalendarClock} text={t("pro.nothingScheduled")} />
      ) : (
        <ol className="relative space-y-3 ps-5">
          {/* the thread the dates hang from */}
          <span
            aria-hidden="true"
            className="absolute inset-y-2 start-[5px] w-0.5 bg-forest/10"
          />
          {agenda.map((a) => {
            const defense = a.kind === "defense";
            return (
              <li key={`${a.kind}-${a.id}`} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -start-5 top-3 size-3 rounded-full ring-4 ring-cream-card ${
                    defense ? "bg-violet-500" : "bg-gold"
                  }`}
                />
                <Link
                  to={`groups/${a.groupId}`}
                  className="block rounded-xl bg-cream-2/60 px-3 py-2.5 ring-1 ring-forest/5 transition hover:ring-gold/40"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-forest">
                      {defense ? t("pro.defenseOf", { title: a.title }) : a.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        defense ? "bg-violet-500/15 text-violet-500" : "bg-gold/15 text-gold"
                      }`}
                    >
                      {relative(a.date)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-clay">
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
  );
}

/**
 * Defenses the professor sits on — their own projects' and their
 * colleagues'. The agenda only knows the first kind, and the second is the
 * one a professor is likeliest to forget.
 */
function CommitteeSection({ seats }: { seats: DashCommitteeSeat[] }) {
  const { t } = useTranslation();
  const { fmtDate, daysFrom, relative } = useDates();

  // Coming ones first, by date; then the rest, newest first.
  const sorted = [...seats].sort((a, b) => {
    const au = a.status === "scheduled" && daysFrom(a.date) >= 0;
    const bu = b.status === "scheduled" && daysFrom(b.date) >= 0;
    if (au !== bu) return au ? -1 : 1;
    return au
      ? +new Date(a.date) - +new Date(b.date)
      : +new Date(b.date) - +new Date(a.date);
  });

  return (
    <section className={SECTION}>
      <SectionHeader
        id="committee"
        icon={Gavel}
        title={t("pro.hub.committeeTitle")}
        badge={seats.length ? String(seats.length) : undefined}
        tint="bg-violet-500/15 text-violet-500"
      />
      {seats.length === 0 ? (
        <Empty icon={Gavel} text={t("pro.hub.noCommittee")} />
      ) : (
        <ul className="space-y-2.5">
          {sorted.slice(0, 6).map((c) => {
            const upcoming = c.status === "scheduled" && daysFrom(c.date) >= 0;
            return (
              <li
                key={c.id}
                className={`rounded-2xl p-3.5 ring-1 ${
                  upcoming
                    ? "bg-violet-500/5 ring-violet-500/20"
                    : "bg-cream-2/60 ring-forest/5"
                }`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-forest">
                    {c.topic.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-500">
                    {t(`committeeRole.${c.role}`)}
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-clay">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck size={11} />
                    {fmtDate(c.date, true)}
                  </span>
                  {c.room && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {c.room}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users size={11} />
                    {t("pro.membersCount", { count: c.membersCount })}
                  </span>
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-clay">
                    {c.ownProject ? (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 font-bold text-gold">
                        {t("pro.hub.ownProject")}
                      </span>
                    ) : (
                      <>
                        <UserAvatar user={c.supervisor} size={18} />
                        <span className="truncate">
                          {t("pro.hub.supervisedBy", {
                            name: fullName(c.supervisor) || "—",
                          })}
                        </span>
                      </>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-bold ${
                      upcoming ? "text-violet-500" : "text-clay"
                    }`}
                  >
                    {upcoming
                      ? relative(c.date)
                      : c.status === "completed" && c.grade != null
                        ? `${c.grade}/20`
                        : t(`stu.dash.defenseStatus.${c.status}`)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  students and submissions
// ─────────────────────────────────────────────────────────────

function StudentsSection({ projects }: { projects: DashProject[] }) {
  const { t } = useTranslation();
  const rows = projects.flatMap((p) =>
    p.members.map((m) => ({ m, project: p })),
  );

  return (
    <section className={SECTION}>
      <SectionHeader
        icon={Users}
        title={t("pro.hub.myStudents")}
        badge={String(rows.length)}
        to="groups"
        tint="bg-sage/15 text-sage"
      />
      {rows.length === 0 ? (
        <Empty icon={Users} text={t("pro.hub.noStudents")} />
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ m, project }) => (
            <li key={m.id}>
              <Link
                to={`groups/${project.id}`}
                className="flex items-center gap-3 rounded-2xl bg-cream-2/60 p-3 ring-1 ring-forest/5 transition hover:ring-gold/40"
              >
                <UserAvatar
                  user={m.student?.user}
                  size={42}
                  className={m.isLeader ? "ring-2 ring-gold" : ""}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-forest">
                    <span className="truncate">
                      {fullName(m.student?.user) || m.student?.registrationNumber || "—"}
                    </span>
                    {m.isLeader && (
                      <Crown
                        size={12}
                        className="shrink-0 text-gold"
                        aria-label={t("stu.dash.leader")}
                      />
                    )}
                  </span>
                  {m.student?.registrationNumber && (
                    <span
                      dir="ltr"
                      className="flex items-center gap-1 text-[11px] text-clay tabular-nums rtl:justify-end"
                    >
                      <IdCard size={11} />
                      {m.student.registrationNumber}
                    </span>
                  )}
                  <span className="block truncate text-[11px] text-clay/80">
                    {project.topic.title}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmissionsSection({
  submissions,
}: {
  submissions: DashSubmissionLite[];
}) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();

  return (
    <section className={SECTION}>
      <SectionHeader
        icon={Paperclip}
        title={t("pro.hub.recentSubmissions")}
        badge={submissions.length ? String(submissions.length) : undefined}
      />
      {submissions.length === 0 ? (
        <Empty icon={Paperclip} text={t("pro.noSubmissions")} />
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => {
            const waiting = s.milestone.status !== "completed";
            return (
              <li key={s.id}>
                <Link
                  to={`groups/${s.milestone.groupId}`}
                  className="flex items-center gap-3 rounded-2xl bg-cream-2/60 p-3 ring-1 ring-forest/5 transition hover:ring-gold/40"
                >
                  <UserAvatar user={s.uploadedBy} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                      <Paperclip size={12} className="shrink-0 text-gold" />
                      <span className="truncate">{s.fileName}</span>
                    </span>
                    <span className="block truncate text-[11px] text-clay">
                      {fullName(s.uploadedBy) || "—"} · {s.milestone.title} ·{" "}
                      {s.milestone.group.topic.title}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-clay">
                      {fmtDate(s.createdAt)}
                    </span>
                    {waiting && (
                      <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-bold text-sage">
                        {t("pro.awaitingReview")}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  topics
// ─────────────────────────────────────────────────────────────

/**
 * Every topic, with the count per status as one line above the list.
 *
 * The counts used to sit in a card of their own beside the list — a tall
 * card holding a bar and a row or two, and the space around it empty. A
 * count per status cannot say *which* topic is where anyway; the list can.
 */
function TopicsSection({
  topics,
  breakdown,
  total,
}: {
  topics: DashTopicLite[];
  breakdown: Record<string, number>;
  total: number;
}) {
  const { t } = useTranslation();
  // Only the statuses that occur: six rows, five of them zero, say nothing.
  const present = Object.keys(STATUS_DOT).filter((k) => (breakdown[k] ?? 0) > 0);

  return (
    <section className={SECTION}>
      <SectionHeader
        icon={FileText}
        title={t("pro.myTopicsCount")}
        badge={String(topics.length)}
        to="topics"
        tint="bg-sage/15 text-sage"
        action={
          <Link
            to="topics"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-1.5 text-xs font-bold text-forest-deep transition hover:bg-gold-soft active:scale-95"
          >
            <Plus size={14} />
            {t("pro.addTopic")}
          </Link>
        }
      />

      {total > 0 && (
        <div className="mb-5 rounded-2xl bg-cream-2/60 p-4 ring-1 ring-forest/5">
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-forest/8">
            {present.map((k) => (
              <span
                key={k}
                className={STATUS_DOT[k]}
                style={{ width: `${((breakdown[k] ?? 0) / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {present.map((k) => (
              <span key={k} className="flex items-center gap-2 text-xs">
                <span className={`size-2.5 rounded-full ${STATUS_DOT[k]}`} />
                <span className="text-clay">{t(`status.${k}`)}</span>
                <span className="font-serif text-sm font-bold text-forest tabular-nums">
                  {breakdown[k]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <Empty icon={FileText} text={t("pro.noTopicsYet")} />
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-2.5">
            {topics.slice(0, 9).map((tp) => (
              <li key={tp.id}>
                <Link
                  to={`topics/${tp.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-cream-2/60 px-4 py-3 ring-1 ring-forest/5 transition hover:ring-gold/40"
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[tp.status] ?? "bg-clay"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-forest">
                      {tp.title}
                    </span>
                    <span className="block truncate text-[11px] text-clay">
                      {[tp.specialization?.name, t(`status.${tp.status}`)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {/* how many teams have asked for it — the number that
                      says whether a published topic is landing */}
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
          {topics.length > 9 && (
            <p className="mt-2.5 text-center text-[11px] text-clay/80">
              {`+${topics.length - 9}`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 font-body">
      <div className="h-96 animate-pulse rounded-3xl bg-forest/10" />
      <div className="h-32 animate-pulse rounded-3xl bg-forest/5" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="h-80 animate-pulse rounded-3xl bg-forest/5" />
        <div className="h-80 animate-pulse rounded-3xl bg-forest/5" />
      </div>
    </div>
  );
}
