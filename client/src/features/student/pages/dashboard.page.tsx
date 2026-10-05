import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  Hash,
  Hourglass,
  IdCard,
  Inbox,
  Info,
  MapPin,
  Paperclip,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useStudentDashboard } from "../hooks/Student-hook";
import { useDates } from "../../../hooks/use-dates";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import type {
  DashPerson,
  StudentDashboard,
  StudentDashProject,
  StudentDashRequest,
  StudentStage,
} from "../../../types/student.types";
import { givenName, personName } from "../../../lib/person-name";

/**
 * The student's first screen.
 *
 * A student opens it to learn three things, in this order: where they stand
 * in the graduation-project journey, what to do next, and whether anything
 * is late. So the journey and its next step lead, what needs attention
 * follows, and the details — the project, the defense, the requests — come
 * after. The old counters ("my project: 1") are gone: a number that can only
 * be 0 or 1 is not information.
 *
 * Everything arrives in one request; see GET /student/dashboard.
 */
export function StudentDashboardPage() {
  const { data, isLoading, isError, refetch } = useStudentDashboard();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <ErrorRetry onRetry={() => refetch()} />;

  const { student, stage, project, requests, attention, availableTopics } =
    data;

  const attentionCount =
    attention.overdueMilestones.length +
    attention.dueThisWeek.length +
    attention.rejectedRequests.length;

  return (
    <div className="font-body">
      {/* ── who the platform thinks you are ── */}
      <ProfileHero student={student} />

      {/* ══════════ the journey, and the one next step ══════════ */}
      <JourneyCard data={data} />

      {/* ══════════ needs your attention ══════════ */}
      {attentionCount > 0 && (
        <AttentionBand attention={attention} count={attentionCount} />
      )}

      {/* ══════════ the details ══════════ */}
      {project ? (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[2fr_1fr]">
          <ProjectPanel
            project={project}
            myRegistration={student.registrationNumber}
          />
          <div className="space-y-5">
            <DefensePanel defense={project.defense} stage={stage} />
            <SupervisionPanel
              document={project.supervisionDocument}
              onOpen={() => setSheetOpen(true)}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
          <RequestsPanel requests={requests} />
          <AvailableTopicsPanel
            count={availableTopics}
            specialization={student.specialization?.name ?? null}
          />
        </div>
      )}

      {sheetOpen && project && (
        <SupervisionDialog
          topicId={project.topic.id}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  helpers
// ─────────────────────────────────────────────────────────────

const CARD =
  "rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]";

const STAGE_INDEX: Record<StudentStage, number> = {
  choose_topic: 0,
  awaiting_decision: 1,
  in_progress: 2,
  defense_scheduled: 3,
  defended: 4,
};

const STEPS = [
  { key: "topic", icon: Search },
  { key: "decision", icon: Hourglass },
  { key: "work", icon: FolderKanban },
  { key: "defense", icon: Award },
] as const;

const REQ_BADGE: Record<string, string> = {
  pending: "bg-gold/15 text-gold",
  accepted: "bg-sage/15 text-sage",
  rejected: "bg-brick/10 text-brick",
};

function fullName(u?: DashPerson | null) {
  return personName(u);
}

// ─────────────────────────────────────────────────────────────
//  who you are
// ─────────────────────────────────────────────────────────────

const LEVEL_KEY: Record<string, string> = {
  licence: "stu.levelLicence",
  master: "stu.levelMaster",
  doctorate: "stu.levelDoctorate",
};

/**
 * The student's card: photo, name and registration number, set on the
 * brand green so it reads as an identity card rather than one more panel.
 *
 * The registration number gets its own plate with a copy button — it is the
 * one thing a student is asked for most (teammates add each other by it),
 * and it was a small grey chip.
 *
 * Colours that must not invert in dark mode (the ring around the photo, the
 * silhouette on gold) read `--t-brand-deep` directly: the `forest-deep`
 * utilities for rings and text turn light in dark mode.
 */
function ProfileHero({ student }: { student: StudentDashboard["student"] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const first = givenName(user);
  const last = user?.lastName?.trim() ?? "";
  const level = student.specialization?.level;

  async function copyRegistration() {
    try {
      await navigator.clipboard.writeText(student.registrationNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (insecure context, permissions) — the number is
      // on screen anyway.
    }
  }

  return (
    <section className="relative mb-6 rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
      {/* Ornament: a faint dot grid, two glows, a gold hairline. The glows
          spill past the card, so they are clipped by a layer of their own:
          clipping them on the section made it a scroll container, and
          focusing the copy button scrolled the card's content sideways. */}
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
        <div className="absolute -end-20 -top-28 size-80 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-72 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:text-start">
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
            title={t("role.student")}
            className="absolute end-1 bottom-1 grid size-9 place-items-center rounded-full bg-gold text-[var(--t-brand-deep)] shadow-md ring-4 ring-[var(--t-brand-deep)]"
          >
            <GraduationCap size={17} />
          </span>
        </div>

        {/* name */}
        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold-soft">
            <Sparkles size={13} />
            {t("stu.dashGreeting")}
          </p>
          <h1 className="font-serif text-3xl leading-tight font-bold text-cream lg:text-4xl">
            {first || last ? (
              <>
                {first} <span className="text-gold-soft">{last}</span>
              </>
            ) : (
              t("role.student")
            )}
          </h1>
          <p className="mt-2 text-sm text-soft-sage">
            {t("stu.dash.subtitle")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
            <HeroChip icon={BadgeCheck}>
              {t("role.student")}
              {level && LEVEL_KEY[level] ? ` · ${t(LEVEL_KEY[level])}` : ""}
            </HeroChip>
            {student.specialization?.name && (
              <HeroChip icon={BookOpen}>{student.specialization.name}</HeroChip>
            )}
            {student.academicYear?.title && (
              <HeroChip icon={CalendarClock}>
                {student.academicYear.title}
              </HeroChip>
            )}
          </div>
        </div>

        {/* the registration number, as a plate */}
        <div className="w-full shrink-0 rounded-2xl border border-gold/30 bg-white/5 p-4 backdrop-blur-sm md:w-auto md:min-w-64">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-soft-sage uppercase md:justify-start">
            <IdCard size={14} className="text-gold-soft" />
            {t("stu.dash.regNumber")}
          </p>
          <div className="flex items-center justify-center gap-3 md:justify-between">
            <span
              dir="ltr"
              className="font-mono text-xl font-bold tracking-[0.06em] text-cream tabular-nums sm:text-2xl sm:tracking-[0.14em]"
            >
              {student.registrationNumber}
            </span>
            <button
              type="button"
              onClick={copyRegistration}
              aria-label={copied ? t("stu.dash.copied") : t("stu.dash.copy")}
              title={copied ? t("stu.dash.copied") : t("stu.dash.copy")}
              className={`grid size-9 shrink-0 place-items-center rounded-xl border transition active:scale-95 ${
                copied
                  ? "border-gold/60 bg-gold/20 text-gold-soft"
                  : "border-white/15 text-gold-soft hover:border-gold/50 hover:bg-white/10"
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
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
//  the journey
// ─────────────────────────────────────────────────────────────

/**
 * Four steps every student walks, with the current one marked, and under
 * them the single thing to do now. A student who has just logged in for the
 * first time learns the whole process from this card alone.
 */
function JourneyCard({ data }: { data: StudentDashboard }) {
  const { t } = useTranslation();
  const current = STAGE_INDEX[data.stage];
  const next = useNextStep(data);
  const NextIcon = next.icon;

  return (
    <section className={`mb-5 p-5 ${CARD}`}>
      <h2 className="mb-5 font-serif text-base font-bold text-forest">
        {t("stu.dash.journeyTitle")}
      </h2>

      {/* the steps */}
      <ol className="mb-5 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < current;
          const here = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.key} className="relative flex flex-col items-center">
              {/* the line to the next step */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-5 start-1/2 h-0.5 w-full ${
                    done ? "bg-sage" : "bg-forest/10"
                  }`}
                />
              )}
              <span
                className={`relative z-10 grid size-10 place-items-center rounded-full ring-4 ring-cream-card transition ${
                  done
                    ? "bg-sage text-cream-card"
                    : here
                      ? "bg-gold text-forest-deep"
                      : "bg-cream-2 text-clay"
                }`}
              >
                <Icon size={18} />
              </span>
              <span
                className={`mt-2 text-center text-[11px] leading-tight sm:text-xs ${
                  here
                    ? "font-bold text-forest"
                    : done
                      ? "font-medium text-sage"
                      : "text-clay"
                }`}
              >
                {t(`stu.dash.steps.${s.key}`)}
              </span>
              {here && (
                <span className="mt-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                  {t("stu.dash.youAreHere")}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* the next step */}
      <div
        className={`flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center ${
          next.alarm
            ? "border border-brick/30 bg-brick/8"
            : "border border-gold/25 bg-gold/8"
        }`}
      >
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${
            next.alarm ? "bg-brick/15 text-brick" : "bg-gold/20 text-gold"
          }`}
        >
          <NextIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-clay">
            {t("stu.dash.nextStep")}
          </p>
          <p className="font-serif text-base font-bold text-forest">
            {next.title}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-clay">
            {next.body}
          </p>
        </div>
        {next.cta && (
          <Link
            to={next.cta.to}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
          >
            {next.cta.label}
            <ArrowLeft size={16} className="ltr:rotate-180" />
          </Link>
        )}
      </div>
    </section>
  );
}

/** What the student should do now, worded for where they stand. */
function useNextStep(data: StudentDashboard): {
  icon: LucideIcon;
  title: string;
  body: string;
  alarm?: boolean;
  cta: { to: string; label: string } | null;
} {
  const { t } = useTranslation();
  const { fmtDate, daysFrom, relative } = useDates();
  const { localePath } = useLanguage();
  const { stage, project, requests, availableTopics, student } = data;

  const toProject = { to: "project", label: t("stu.viewProject") };

  switch (stage) {
    case "choose_topic":
      return {
        icon: Search,
        title: t("stu.dash.chooseTitle"),
        body:
          availableTopics > 0
            ? t("stu.dash.chooseBody", {
                topics: t("stu.dash.topicsAvailable", {
                  count: availableTopics,
                }),
                spec: student.specialization?.name ?? "",
              })
            : t("stu.dash.chooseNone"),
        cta: { to: localePath(PATHS.topics), label: t("stu.browseTopics") },
      };

    case "awaiting_decision": {
      const r = requests.find((x) => x.status === "pending")!;
      const since = t("stu.dash.sinceDays", {
        count: Math.max(0, -daysFrom(r.createdAt)),
      });
      return {
        icon: Hourglass,
        title: t("stu.dash.awaitingTitle"),
        body: r.isLeader
          ? t("stu.dash.awaitingBodyLeader", { topic: r.topic.title, since })
          : t("stu.dash.awaitingBodyMember", {
              topic: r.topic.title,
              since,
              leader: fullName(r.leader?.user) || "—",
            }),
        cta: { to: "requests", label: t("stu.dash.followRequests") },
      };
    }

    case "in_progress": {
      const p = project!;
      if (p.progress.overdue > 0)
        return {
          icon: AlertTriangle,
          alarm: true,
          title: t("stu.dash.overdueTitle"),
          body: t("stu.dash.overdueBody", {
            overdue: t("pro.overdueCount", { count: p.progress.overdue }),
            prof: fullName(p.topic.professor?.user) || "—",
          }),
          cta: toProject,
        };
      if (p.nextMilestone)
        return {
          icon: CalendarClock,
          title: t("stu.dash.nextMilestoneTitle", {
            title: p.nextMilestone.title,
          }),
          body: t("stu.dash.nextMilestoneBody", {
            date: fmtDate(p.nextMilestone.deadline),
            relative: relative(p.nextMilestone.deadline),
          }),
          cta: toProject,
        };
      if (p.progress.total === 0)
        return {
          icon: Clock,
          title: t("stu.dash.noMilestonesTitle"),
          body: t("stu.dash.noMilestonesBody"),
          cta: toProject,
        };
      return {
        icon: CheckCircle2,
        title: t("stu.dash.allDoneTitle"),
        body: t("stu.dash.allDoneBody"),
        cta: toProject,
      };
    }

    case "defense_scheduled": {
      const d = project!.defense!;
      const passed = daysFrom(d.date) < 0;
      return {
        icon: CalendarCheck,
        title: passed
          ? t("stu.dash.defenseAwaitingResult")
          : t("stu.dash.defenseTitle", { relative: relative(d.date) }),
        body: t("stu.dash.defenseBody", {
          date: fmtDate(d.date, true),
          room: d.room,
        }),
        cta: toProject,
      };
    }

    case "defended": {
      const grade = project?.defense?.grade;
      return {
        icon: Award,
        title: t("stu.dash.defendedTitle"),
        body:
          grade != null
            ? t("stu.dash.defendedGrade", { grade })
            : t("stu.dash.defendedNoGrade"),
        cta: toProject,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  needs your attention
// ─────────────────────────────────────────────────────────────

function AttentionBand({
  attention,
  count,
}: {
  attention: StudentDashboard["attention"];
  count: number;
}) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();

  return (
    <section className={`mb-5 p-5 ${CARD}`}>
      <header className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
        <span className="grid size-8 place-items-center rounded-xl bg-brick/10 text-brick">
          <AlertTriangle size={17} />
        </span>
        <h2 className="font-serif text-base font-bold text-forest">
          {t("stu.dash.needsAttention")}
        </h2>
        <span className="rounded-full bg-brick/10 px-2 py-0.5 text-[11px] font-bold text-brick tabular-nums">
          {count}
        </span>
      </header>

      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 md:grid-cols-2">
        <Bucket
          icon={AlertTriangle}
          tone="brick"
          title={t("stu.dash.overdueMilestones")}
          items={attention.overdueMilestones}
          render={(m) => (
            <Row
              key={m.id}
              to="project"
              title={m.title}
              meta={fmtDate(m.deadline)}
              badge={relative(m.deadline)}
              tone="brick"
            />
          )}
        />
        <Bucket
          icon={Clock}
          tone="gold"
          title={t("stu.dash.dueThisWeek")}
          items={attention.dueThisWeek}
          render={(m) => (
            <Row
              key={m.id}
              to="project"
              title={m.title}
              meta={fmtDate(m.deadline)}
              badge={relative(m.deadline)}
              tone="gold"
            />
          )}
        />
        <Bucket
          icon={XCircle}
          tone="brick"
          title={t("stu.dash.rejectedRequests")}
          items={attention.rejectedRequests}
          render={(r) => (
            <Row
              key={r.id}
              to="requests"
              title={r.topic.title}
              meta={r.rejectionReason || t("stu.dash.noReasonGiven")}
              badge={t("stu.reqStatus.rejected")}
              tone="brick"
            />
          )}
        />
      </div>
    </section>
  );
}

function Bucket<T>({
  icon: Icon,
  tone,
  title,
  items,
  render,
}: {
  icon: LucideIcon;
  tone: "brick" | "gold";
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p
        className={`mb-2 flex items-center gap-1.5 text-xs font-bold ${
          tone === "brick" ? "text-brick" : "text-gold"
        }`}
      >
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
  tone,
}: {
  to: string;
  title: string;
  meta: string;
  badge: string;
  tone: "brick" | "gold";
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-2.5 rounded-xl border border-forest/10 bg-cream-2/60 px-3 py-2 transition hover:border-gold/40 hover:bg-gold/5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-forest">
            {title}
          </span>
          <span className="block truncate text-[11px] text-clay">{meta}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            tone === "brick" ? "bg-brick/10 text-brick" : "bg-gold/15 text-gold"
          }`}
        >
          {badge}
        </span>
      </Link>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  with a project
// ─────────────────────────────────────────────────────────────

type ProjectTab = "info" | "progress";

/**
 * The project at a glance, in two views the student switches between:
 * who is on it (supervisor and team), and how far it has come (progress and
 * the timeline). Both used to be stacked in one narrow card, where neither
 * had room to be read.
 */
function ProjectPanel({
  project,
  myRegistration,
}: {
  project: StudentDashProject;
  myRegistration: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ProjectTab>("info");
  const tabsId = useId();

  const tabs: { key: ProjectTab; label: string; icon: LucideIcon }[] = [
    { key: "info", label: t("stu.dash.tabInfo"), icon: Info },
    { key: "progress", label: t("stu.dash.tabProgress"), icon: TrendingUp },
  ];

  return (
    <section className={`p-6 sm:p-7 ${CARD}`}>
      <PanelHeader
        icon={FolderKanban}
        tint="bg-gold/15 text-gold"
        title={t("stu.myProject")}
        to="project"
        linkLabel={t("stu.viewDetails")}
      />

      <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold">
        <Sparkles size={12} />
        {t("stu.graduationProject")}
      </p>
      <h3 className="mb-5 font-serif text-2xl leading-snug font-bold text-forest">
        {project.topic.title}
      </h3>

      {/* the two views */}
      <div
        role="tablist"
        aria-label={t("stu.myProject")}
        className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-cream-2 p-1.5 ring-1 ring-forest/8"
      >
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${key}`}
              aria-selected={active}
              aria-controls={`${tabsId}-panel-${key}`}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-gold text-forest-deep shadow-[0_4px_14px_rgba(193,150,90,0.3)]"
                  : "text-clay hover:bg-cream-card hover:text-forest"
              }`}
            >
              <Icon size={16} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-${tab}`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
      >
        {tab === "info" ? (
          <ProjectInfo project={project} myRegistration={myRegistration} />
        ) : (
          <ProjectProgress project={project} />
        )}
      </div>
    </section>
  );
}

/** Tab one: the supervisor, then the team. */
function ProjectInfo({
  project,
  myRegistration,
}: {
  project: StudentDashProject;
  myRegistration: string;
}) {
  const { t } = useTranslation();
  const prof = project.topic.professor?.user;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-linear-to-l from-gold/12 to-transparent p-5 ring-1 ring-gold/25">
        <UserAvatar user={prof} size={64} className="ring-2 ring-gold/60" />
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-clay">
            <GraduationCap size={13} className="text-gold" />
            {t("stu.academicSupervisor")}
          </p>
          <p className="truncate font-serif text-xl font-bold text-forest">
            {fullName(prof) || "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-forest">
          <Users size={16} className="text-sage" />
          {t("stu.teamMembers")}
          <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay">
            {t("pro.membersCount", { count: project.members.length })}
          </span>
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {project.members.map((m) => {
            const me = m.student.registrationNumber === myRegistration;
            return (
              <li
                key={m.id}
                className={`flex items-center gap-3.5 rounded-2xl p-4 ring-1 ${
                  m.isLeader
                    ? "bg-gold/8 ring-gold/30"
                    : "bg-cream-2/70 ring-forest/8"
                }`}
              >
                <UserAvatar
                  user={m.student.user}
                  size={52}
                  className={
                    m.isLeader ? "ring-2 ring-gold" : "ring-2 ring-forest/10"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-base font-bold text-forest">
                    {fullName(m.student.user) || m.student.registrationNumber}
                  </span>
                  <span
                    dir="ltr"
                    className="flex items-center gap-1 text-xs text-clay tabular-nums rtl:justify-end"
                  >
                    <IdCard size={12} />
                    {m.student.registrationNumber}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.isLeader && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                        <Crown size={10} />
                        {t("stu.dash.leader")}
                      </span>
                    )}
                    {me && (
                      <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-bold text-sage">
                        {t("stu.dash.you")}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Tab two: the progress summary, then the timeline in brief. */
function ProjectProgress({ project }: { project: StudentDashProject }) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();
  const { progress, milestones, nextMilestone } = project;
  const remaining = progress.total - progress.completed;

  return (
    <div className="space-y-6">
      {/* the progress summary */}
      <div className="rounded-2xl bg-cream-2/70 p-5 ring-1 ring-forest/8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-clay">{t("stu.progressSummary")}</p>
            <p className="mt-0.5 text-sm text-forest">
              {t("stu.milestonesCompleted", {
                done: progress.completed,
                total: progress.total,
              })}
            </p>
          </div>
          <p className="font-serif text-4xl leading-none font-bold text-gold tabular-nums">
            {progress.percent}%
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-forest/10">
          <div
            className={`h-full rounded-full bg-linear-to-l transition-all duration-700 ${
              progress.overdue > 0
                ? "from-brick to-brick/70"
                : "from-gold to-gold-soft"
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ProgressStat
            value={progress.completed}
            label={t("stu.dash.statCompleted")}
            tone="text-sage"
          />
          <ProgressStat
            value={progress.overdue}
            label={t("stu.dash.statOverdue")}
            tone={progress.overdue > 0 ? "text-brick" : "text-clay"}
          />
          <ProgressStat
            value={remaining}
            label={t("stu.dash.statRemaining")}
            tone="text-gold"
          />
        </div>
      </div>

      {/* the one date that matters next */}
      {nextMilestone && (
        <div className="flex items-center gap-3 rounded-2xl bg-gold/10 p-4 ring-1 ring-gold/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/20 text-gold">
            <CalendarClock size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-gold">
              {t("stu.proj.nextMilestone")}
            </p>
            <p className="truncate text-sm font-bold text-forest">
              {nextMilestone.title}
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-xs font-bold text-forest">
              {relative(nextMilestone.deadline)}
            </p>
            <p className="text-[11px] text-clay">
              {fmtDate(nextMilestone.deadline)}
            </p>
          </div>
        </div>
      )}

      {/* the timeline, in brief */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-forest">
          <CalendarClock size={16} className="text-gold" />
          {t("stu.projectTimeline")}
        </p>
        {milestones.length === 0 ? (
          <p className="rounded-2xl bg-cream-2/60 py-8 text-center text-sm text-clay">
            {t("stu.dash.noMilestonesBody")}
          </p>
        ) : (
          <ol className="relative space-y-2">
            {milestones.map((m, i) => {
              const done = m.status === "completed";
              const late =
                !done &&
                (m.status === "overdue" || new Date(m.deadline) < new Date());
              const next = nextMilestone?.id === m.id;
              const last = i === milestones.length - 1;
              return (
                <li key={m.id} className="relative flex items-stretch gap-3">
                  {/* the thread */}
                  {!last && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-8 -bottom-2 start-[13px] w-0.5 ${
                        done ? "bg-sage/50" : "bg-forest/10"
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 mt-2 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-sage text-cream-card"
                        : late
                          ? "bg-brick text-cream-card"
                          : next
                            ? "bg-gold text-forest-deep ring-4 ring-gold/20"
                            : "bg-cream-2 text-clay ring-1 ring-forest/10"
                    }`}
                  >
                    {done ? <Check size={14} /> : late ? <Clock size={13} /> : i + 1}
                  </span>
                  <div
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-2.5 ${
                      next
                        ? "bg-gold/8 ring-1 ring-gold/30"
                        : late
                          ? "bg-brick/5 ring-1 ring-brick/20"
                          : "bg-cream-2/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          done
                            ? "text-clay line-through decoration-clay/40"
                            : "text-forest"
                        }`}
                      >
                        {m.title}
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-clay">
                        {fmtDate(m.deadline)}
                        {m.submissions > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5"
                            title={t("stu.dash.submissions")}
                          >
                            <Paperclip size={10} />
                            {m.submissions}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        done
                          ? "bg-sage/15 text-sage"
                          : late
                            ? "bg-brick/10 text-brick"
                            : next
                              ? "bg-gold/15 text-gold"
                              : "bg-forest/8 text-clay"
                      }`}
                    >
                      {done ? t("status.completed") : relative(m.deadline)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function ProgressStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-cream-card px-3 py-2.5 text-center ring-1 ring-forest/8">
      <p className={`font-serif text-2xl font-bold tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="text-[11px] text-clay">{label}</p>
    </div>
  );
}

function DefensePanel({
  defense,
  stage,
}: {
  defense: StudentDashProject["defense"];
  stage: StudentStage;
}) {
  const { t } = useTranslation();
  const { fmtDate, daysFrom, relative } = useDates();

  const upcoming =
    defense?.status === "scheduled" && daysFrom(defense.date) >= 0;

  return (
    <section className={`p-5 ${CARD}`}>
      <PanelHeader
        icon={CalendarCheck}
        tint="bg-violet-500/15 text-violet-500"
        title={t("stu.defense")}
      />

      {!defense ? (
        <Empty
          icon={CalendarClock}
          text={t("stu.dash.noDefenseYet")}
          hint={
            stage === "in_progress" ? t("stu.dash.noDefenseHint") : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                defense.status === "completed"
                  ? "bg-sage/15 text-sage"
                  : defense.status === "cancelled"
                    ? "bg-brick/10 text-brick"
                    : "bg-violet-500/15 text-violet-500"
              }`}
            >
              {t(`stu.dash.defenseStatus.${defense.status}`)}
            </span>
            {upcoming && (
              <span className="text-xs font-bold text-forest">
                {relative(defense.date)}
              </span>
            )}
          </div>

          <InfoLine
            icon={CalendarClock}
            label={t("stu.dash.dateAndTime")}
            value={fmtDate(defense.date, true)}
          />
          <InfoLine
            icon={MapPin}
            label={t("stu.room")}
            value={defense.room || "—"}
          />

          {defense.status === "completed" && (
            <div className="flex items-center justify-between rounded-xl bg-sage/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-forest">
                <Award size={16} className="text-gold" />
                {t("stu.dash.finalGrade")}
              </span>
              <span className="font-serif text-xl font-bold text-forest tabular-nums">
                {defense.grade != null ? `${defense.grade}/20` : "—"}
              </span>
            </div>
          )}

          {defense.committee.length > 0 && (
            <div className="border-t border-forest/10 pt-3">
              <p className="mb-2 text-[11px] font-semibold text-clay">
                {t("stu.dash.committee")}
              </p>
              <ul className="space-y-2">
                {defense.committee.map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <UserAvatar user={c.professor?.user} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-forest">
                      {fullName(c.professor?.user) || "—"}
                    </span>
                    <span className="shrink-0 text-[11px] text-clay">
                      {t(`committeeRole.${c.role}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The official supervision-approval sheet. The student needs it on paper,
 * and until now the only way to learn whether it existed was to open it.
 */
function SupervisionPanel({
  document,
  onOpen,
}: {
  document: StudentDashProject["supervisionDocument"];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();

  return (
    <section className={`p-5 ${CARD}`}>
      <PanelHeader
        icon={FileCheck2}
        tint="bg-sage/15 text-sage"
        title={t("supervision.title")}
      />

      {document ? (
        <div className="mb-4 space-y-2">
          <span className="inline-flex rounded-full bg-sage/15 px-2.5 py-0.5 text-[11px] font-bold text-sage">
            {t("supervision.statusActive")}
          </span>
          <InfoLine
            icon={Hash}
            label={t("supervision.documentNumber")}
            value={document.documentNumber}
          />
          <InfoLine
            icon={CalendarClock}
            label={t("supervision.issuedAt")}
            value={fmtDate(document.createdAt)}
          />
        </div>
      ) : (
        <p className="mb-4 text-xs leading-relaxed text-clay">
          {t("stu.dash.noSupervisionDoc")}
        </p>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest hover:text-cream"
      >
        <FileCheck2 size={16} />
        {document ? t("stu.dash.openDocument") : t("supervision.issue")}
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  without a project yet
// ─────────────────────────────────────────────────────────────

function RequestsPanel({ requests }: { requests: StudentDashRequest[] }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();

  return (
    <section className={`p-5 ${CARD}`}>
      <PanelHeader
        icon={Inbox}
        tint="bg-forest/8 text-forest"
        title={t("stu.myRequestsTitle")}
        count={requests.length}
        to="requests"
        linkLabel={t("stu.viewAll")}
      />

      {requests.length === 0 ? (
        <Empty icon={Inbox} text={t("stu.noRequestsYet")} />
      ) : (
        <ul className="space-y-2">
          {requests.slice(0, 5).map((r) => {
            const prof = fullName(r.topic.professor?.user);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-forest/10 bg-cream-2/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-forest">
                      {r.topic.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-clay">
                      {[
                        prof && `${t("stu.supervisor")}: ${prof}`,
                        t("stu.dash.sentOn", { date: fmtDate(r.createdAt) }),
                        t("stu.priorityN", { n: r.priority }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-clay">
                      {r.isLeader
                        ? t("stu.dash.sentByYou")
                        : t("stu.dash.sentBy", {
                            name: fullName(r.leader?.user) || "—",
                          })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      REQ_BADGE[r.status] ?? "bg-forest/8 text-clay"
                    }`}
                  >
                    {t(`stu.reqStatus.${r.status}`, { defaultValue: r.status })}
                  </span>
                </div>
                {r.status === "rejected" && r.rejectionReason && (
                  <p className="mt-2 rounded-lg bg-brick/8 px-3 py-2 text-[11px] leading-relaxed text-brick">
                    <span className="font-bold">{t("stu.rejectionReason")}:</span>{" "}
                    {r.rejectionReason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AvailableTopicsPanel({
  count,
  specialization,
}: {
  count: number;
  specialization: string | null;
}) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();

  return (
    <section className={`p-5 ${CARD}`}>
      <PanelHeader
        icon={BookOpen}
        tint="bg-sage/15 text-sage"
        title={t("stu.dash.availableTopicsTitle")}
      />
      <div className="mb-4 text-center">
        <p className="font-serif text-4xl font-bold text-forest tabular-nums">
          {count}
        </p>
        <p className="mt-1 text-xs text-clay">
          {specialization
            ? t("stu.dash.availableIn", { spec: specialization })
            : t("stu.dash.availableInYourSpec")}
        </p>
      </div>
      <Link
        to={localePath(PATHS.topics)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
      >
        <Search size={16} />
        {t("stu.browseTopics")}
      </Link>
      {count > 0 && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-clay">
          {t("stu.dash.topicReservedHint")}
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  small pieces
// ─────────────────────────────────────────────────────────────

function PanelHeader({
  icon: Icon,
  tint,
  title,
  count,
  to,
  linkLabel,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  count?: number;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2 border-b border-forest/10 pb-3">
      <h2 className="flex items-center gap-2 font-serif text-base font-bold text-forest">
        <span className={`grid size-8 place-items-center rounded-xl ${tint}`}>
          <Icon size={17} />
        </span>
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {to && linkLabel && (
        <Link
          to={to}
          className="flex shrink-0 items-center gap-1 text-xs text-sage transition hover:text-forest"
        >
          {linkLabel}
          <ArrowLeft size={12} className="ltr:rotate-180" />
        </Link>
      )}
    </header>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="text-[11px] text-clay">{label}</p>
        <p className="truncate text-sm font-semibold text-forest">{value}</p>
      </div>
    </div>
  );
}

function Empty({
  icon: Icon,
  text,
  hint,
}: {
  icon: LucideIcon;
  text: string;
  hint?: string;
}) {
  return (
    <div className="grid place-items-center gap-2 py-6 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-forest/5 text-clay">
        <Icon size={18} />
      </span>
      <p className="text-xs font-medium text-forest">{text}</p>
      {hint && <p className="max-w-xs text-[11px] text-clay">{hint}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="font-body">
      <div className="mb-2 h-9 w-72 animate-pulse rounded-xl bg-forest/10" />
      <div className="mb-6 h-5 w-96 max-w-full animate-pulse rounded-lg bg-forest/5" />
      <div className="mb-5 h-56 animate-pulse rounded-2xl bg-forest/5" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-forest/5" />
        <div className="h-80 animate-pulse rounded-2xl bg-forest/5" />
      </div>
    </div>
  );
}
