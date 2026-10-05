import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleDot,
  Clock3,
  Crown,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  IdCard,
  Lock,
  Mail,
  MapPin,
  Paperclip,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMyProject } from "../hooks/Student-hook";
import { useDates } from "../../../hooks/use-dates";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import type {
  DefenseRef,
  GroupRequestMember,
  MyProject,
  StudentMilestone,
} from "../../../types/student.types";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { SupervisionDialog } from "../../supervision/components/supervision-dialog";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { personName } from "../../../lib/person-name";

/**
 * The student's project, in full.
 *
 * The dashboard says what to do next; this page is the project itself: what
 * it is, who is on it, how far it has come, every milestone with its files,
 * and the defense at the end. Read-only — the supervisor sets the milestones
 * and the administration schedules the defense.
 */

type Person = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null | undefined;

function fullName(u: Person) {
  return personName(u);
}

function memberName(m: GroupRequestMember) {
  return fullName(m.student?.user) || m.student?.registrationNumber || "—";
}

/** Late is derived, not only flagged: a missed deadline is late either way. */
function isLate(m: StudentMilestone) {
  return (
    m.status !== "completed" &&
    (m.status === "overdue" || new Date(m.deadline) < new Date())
  );
}

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

export function StudentMyProjectPage() {
  const { data: project, isLoading, isError, refetch } = useMyProject();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) return <ProjectSkeleton />;
  // انقطاعُ الاتّصال ليس «غير موجود»: يُقال ما جرى ويُعرض زرُّ إعادة.
  if (isError) return <ErrorRetry onRetry={() => refetch()} />;
  if (!project) return <NoProject />;

  const topicId = project.topic?.id ?? null;

  return (
    <div className="space-y-6 font-body">
      <ProjectHero
        project={project}
        onOpenSheet={topicId ? () => setSheetOpen(true) : undefined}
      />

      <TeamSection members={project.members ?? []} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Timeline milestones={project.milestones ?? []} />
        <div className="space-y-6">
          <DefenseCard defense={project.defense ?? null} />
          <SupervisorCard project={project} />
        </div>
      </div>

      {sheetOpen && topicId && (
        <SupervisionDialog
          topicId={topicId}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  hero
// ─────────────────────────────────────────────────────────────

function ProjectHero({
  project,
  onOpenSheet,
}: {
  project: MyProject;
  onOpenSheet?: () => void;
}) {
  const { t } = useTranslation();
  const { fmtDate, relative, daysFrom } = useDates();

  const milestones = project.milestones ?? [];
  const members = project.members ?? [];
  const prof = project.topic?.professor?.user;

  const completed = milestones.filter((m) => m.status === "completed").length;
  const total = milestones.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const late = milestones.filter(isLate).length;
  const next = [...milestones]
    .filter((m) => m.status !== "completed" && !isLate(m))
    .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0];

  const defense = project.defense;
  const defenseUpcoming =
    defense?.status !== "cancelled" && defense && daysFrom(defense.date) >= 0;

  return (
    <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
      <Ornament />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
        {/* what the project is */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-[var(--t-brand-deep)]">
              <Sparkles size={12} />
              {t("stu.graduationProject")}
            </span>
            {project.topic?.specialization?.name && (
              <HeroChip icon={BookOpen}>
                {project.topic.specialization.name}
              </HeroChip>
            )}
            {project.topic?.academicYear?.title && (
              <HeroChip icon={CalendarDays}>
                {project.topic.academicYear.title}
              </HeroChip>
            )}
          </div>

          <h1 className="font-serif text-3xl leading-tight font-bold text-cream lg:text-4xl">
            {project.topic?.title ?? "—"}
          </h1>
          {project.topic?.description && (
            <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-relaxed text-soft-sage">
              {project.topic.description}
            </p>
          )}

          {/* supervisor and team, side by side */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 ps-2 pe-4">
              <UserAvatar
                user={prof}
                size={42}
                tone="gold"
                className="text-[var(--t-brand-deep)]! ring-2 ring-gold/60"
              />
              <div className="min-w-0">
                <p className="text-[11px] text-soft-sage">
                  {t("stu.academicSupervisor")}
                </p>
                <p className="truncate text-sm font-bold text-cream">
                  {fullName(prof) || "—"}
                </p>
              </div>
            </div>

            {members.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 ps-2 pe-4">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {members.slice(0, 4).map((m) => (
                    <UserAvatar
                      key={m.id}
                      user={m.student?.user}
                      size={34}
                      className="ring-2 ring-[var(--t-brand-deep)]"
                    />
                  ))}
                </div>
                <div>
                  <p className="text-[11px] text-soft-sage">
                    {t("stu.teamMembers")}
                  </p>
                  <p className="text-sm font-bold text-cream">
                    {t("pro.membersCount", { count: members.length })}
                  </p>
                </div>
              </div>
            )}

            {onOpenSheet && (
              <button
                type="button"
                onClick={onOpenSheet}
                className="inline-flex items-center gap-2 rounded-2xl border border-gold/50 px-4 py-3 text-sm font-semibold text-gold-soft transition hover:bg-gold/15 active:scale-95"
              >
                <FileCheck2 size={17} />
                {t("supervision.open")}
              </button>
            )}
          </div>
        </div>

        {/* how far it has come */}
        <div className="flex shrink-0 flex-col items-center self-center">
          <ProgressRing percent={percent} />
          <p className="mt-2 text-xs text-soft-sage">
            {t("stu.milestonesCompleted", { done: completed, total })}
          </p>
        </div>
      </div>

      {/* three things that decide the next weeks */}
      <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HeroStat
          icon={CalendarClock}
          label={t("stu.proj.nextMilestone")}
          value={next ? next.title : t("stu.proj.noNext")}
          sub={next ? `${fmtDate(next.deadline)} · ${relative(next.deadline)}` : null}
          tone="text-gold-soft"
        />
        <HeroStat
          icon={AlertTriangle}
          label={t("stu.proj.lateMilestones")}
          value={
            late > 0
              ? t("pro.overdueCount", { count: late })
              : t("stu.proj.nothingLate")
          }
          tone={late > 0 ? "text-[#f0a48f]" : "text-soft-sage"}
          alarm={late > 0}
        />
        <HeroStat
          icon={CalendarCheck}
          label={t("stu.defense")}
          value={
            defense && defense.status !== "cancelled"
              ? fmtDate(defense.date, true)
              : t("stu.proj.notScheduled")
          }
          sub={
            defenseUpcoming
              ? `${relative(defense.date)}${defense.room ? ` · ${t("stu.room")} ${defense.room}` : ""}`
              : null
          }
          tone="text-gold-soft"
        />
      </div>
    </section>
  );
}

/** A gold arc on a faint track, the percentage in the middle. */
function ProgressRing({ percent }: { percent: number }) {
  const { t } = useTranslation();
  const gid = useId();
  const r = 58;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative size-40">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6c496" />
            <stop offset="100%" stopColor="#c1965a" />
          </linearGradient>
        </defs>
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-serif text-4xl font-bold text-cream tabular-nums">
          {percent}%
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-gold-soft">
          {t("stu.proj.done")}
        </span>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  alarm,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string | null;
  tone: string;
  alarm?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        alarm ? "border-[#f0a48f]/40 bg-[#f0a48f]/10" : "border-white/10 bg-white/5"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-soft-sage">{label}</p>
        <p className="truncate text-sm font-bold text-cream">{value}</p>
        {sub && <p className="truncate text-[11px] text-soft-sage">{sub}</p>}
      </div>
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

/** The brand card's ornament, clipped by a layer of its own so the card
 *  never becomes a scroll container. */
function Ornament() {
  return (
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
  );
}

// ─────────────────────────────────────────────────────────────
//  team
// ─────────────────────────────────────────────────────────────

function TeamSection({ members }: { members: GroupRequestMember[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (members.length === 0) return null;

  return (
    <section className={`p-6 ${CARD}`}>
      <SectionHeader
        icon={Users}
        title={t("stu.teamMembers")}
        badge={t("pro.membersCount", { count: members.length })}
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((m) => {
          // The session's `id` for a student is the Student row, not the
          // User, so the registration number is what identifies "me" here.
          const me =
            !!user?.registrationNumber &&
            m.student?.registrationNumber === user.registrationNumber;
          return (
            <li
              key={m.id}
              className={`relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 ring-1 ${
                m.isLeader
                  ? "bg-gold/8 ring-gold/30"
                  : "bg-cream-2/70 ring-forest/8"
              }`}
            >
              <UserAvatar
                user={m.student?.user}
                size={56}
                className={m.isLeader ? "ring-2 ring-gold" : "ring-2 ring-forest/10"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base font-bold text-forest">
                  {memberName(m)}
                </p>
                {m.student?.registrationNumber && (
                  <p
                    dir="ltr"
                    className="flex items-center gap-1 text-xs text-clay tabular-nums rtl:justify-end"
                  >
                    <IdCard size={12} />
                    {m.student.registrationNumber}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  timeline
// ─────────────────────────────────────────────────────────────

const NODE: Record<
  "completed" | "late" | "next" | "in_progress" | "pending",
  { node: string; pill: string; icon: LucideIcon }
> = {
  completed: {
    node: "bg-sage text-cream-card",
    pill: "bg-sage/15 text-sage",
    icon: Check,
  },
  late: {
    node: "bg-brick text-cream-card",
    pill: "bg-brick/10 text-brick",
    icon: Clock3,
  },
  next: {
    node: "bg-gold text-[var(--t-brand-deep)] ring-4 ring-gold/25",
    pill: "bg-gold/15 text-gold",
    icon: CircleDot,
  },
  in_progress: {
    node: "bg-gold/80 text-[var(--t-brand-deep)]",
    pill: "bg-gold/15 text-gold",
    icon: CircleDot,
  },
  pending: {
    node: "bg-cream-2 text-clay ring-1 ring-forest/10",
    pill: "bg-forest/8 text-clay",
    icon: Lock,
  },
};

function Timeline({ milestones }: { milestones: StudentMilestone[] }) {
  const { t } = useTranslation();
  const { fmtDate, relative } = useDates();

  const completed = milestones.filter((m) => m.status === "completed").length;
  const nextId = useMemo(
    () =>
      [...milestones]
        .filter((m) => m.status !== "completed" && !isLate(m))
        .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0]?.id,
    [milestones],
  );

  return (
    <section className={`p-6 ${CARD}`}>
      <SectionHeader
        icon={CalendarClock}
        title={t("stu.projectTimeline")}
        badge={milestones.length ? `${completed}/${milestones.length}` : undefined}
        extra={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 px-3 py-1 text-[11px] font-medium text-clay ring-1 ring-forest/10">
            <Lock size={11} />
            {t("stu.readOnly")}
          </span>
        }
      />

      {milestones.length === 0 ? (
        <div className="grid place-items-center gap-3 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-gold/10 text-gold ring-8 ring-gold/5">
            <CalendarClock size={28} />
          </span>
          <p className="font-serif text-base font-bold text-forest">
            {t("stu.dash.noMilestonesTitle")}
          </p>
          <p className="max-w-sm text-sm text-clay">
            {t("stu.dash.noMilestonesBody")}
          </p>
        </div>
      ) : (
        <ol className="relative">
          {milestones.map((m, i) => {
            const kind =
              m.status === "completed"
                ? "completed"
                : isLate(m)
                  ? "late"
                  : m.id === nextId
                    ? "next"
                    : m.status === "in_progress"
                      ? "in_progress"
                      : "pending";
            const style = NODE[kind];
            const Icon = style.icon;
            const last = i === milestones.length - 1;
            const files = m.submissions ?? [];

            return (
              <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* the thread between nodes */}
                {!last && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-11 bottom-0 start-[21px] w-0.5 ${
                      kind === "completed" ? "bg-sage/50" : "bg-forest/10"
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full font-serif text-sm font-bold ${style.node}`}
                >
                  {kind === "pending" ? i + 1 : <Icon size={18} />}
                </span>

                <div
                  className={`min-w-0 flex-1 rounded-2xl p-4 ring-1 transition ${
                    kind === "next"
                      ? "bg-gold/8 ring-gold/40 shadow-[0_6px_24px_rgba(193,150,90,0.12)]"
                      : kind === "late"
                        ? "bg-brick/5 ring-brick/25"
                        : "bg-cream-2/70 ring-forest/8"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-serif text-base font-bold text-forest">
                      {m.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {kind === "next" && (
                        <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[var(--t-brand-deep)]">
                          {t("stu.proj.nextTag")}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.pill}`}
                      >
                        {kind === "late"
                          ? t("status.overdue")
                          : t(`status.${m.status}`, { defaultValue: m.status })}
                      </span>
                    </div>
                  </div>

                  {m.description && (
                    <p className="mb-2 text-sm leading-relaxed text-clay">
                      {m.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-clay">
                      <CalendarClock size={13} className="text-gold" />
                      {t("stu.deadline")}: {fmtDate(m.deadline)}
                    </span>
                    {kind !== "completed" && (
                      <span
                        className={`font-bold ${
                          kind === "late" ? "text-brick" : "text-forest"
                        }`}
                      >
                        {relative(m.deadline)}
                      </span>
                    )}
                  </div>

                  {files.length > 0 && (
                    <div className="mt-3 border-t border-forest/10 pt-3">
                      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-clay">
                        <Paperclip size={11} />
                        {t("stu.dash.submissions")} ({files.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {files.map((f) => (
                          <a
                            key={f.id}
                            href={f.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={fmtDate(f.createdAt)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-cream-card px-2.5 py-1 text-[11px] text-forest ring-1 ring-forest/10 transition hover:ring-gold/50"
                          >
                            <Paperclip size={11} className="shrink-0 text-gold" />
                            <span className="truncate">{f.fileName}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  side
// ─────────────────────────────────────────────────────────────

function DefenseCard({ defense }: { defense: DefenseRef | null }) {
  const { t, i18n } = useTranslation();
  const { fmtDate, daysFrom, relative } = useDates();

  const status = defense?.status ?? "scheduled";
  const upcoming =
    !!defense && status === "scheduled" && daysFrom(defense.date) >= 0;

  // A calendar leaf: the day large, the month and weekday beneath.
  const leaf = (() => {
    if (!defense) return null;
    try {
      const d = new Date(defense.date);
      const fmt = (o: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(i18n.language || "ar", o).format(d);
      return {
        day: fmt({ day: "numeric" }),
        month: fmt({ month: "long" }),
        weekday: fmt({ weekday: "long" }),
        time: fmt({ timeStyle: "short" }),
      };
    } catch {
      return null;
    }
  })();

  return (
    <section className={`p-6 ${CARD}`}>
      <SectionHeader icon={CalendarCheck} title={t("stu.defense")} tint="violet" />

      {!defense ? (
        <div className="grid place-items-center gap-2 py-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-violet-500/10 text-violet-500 ring-8 ring-violet-500/5">
            <CalendarClock size={24} />
          </span>
          <p className="text-sm font-bold text-forest">
            {t("stu.dash.noDefenseYet")}
          </p>
          <p className="max-w-xs text-xs text-clay">
            {t("stu.dash.noDefenseHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {leaf && (
              <div className="w-20 shrink-0 overflow-hidden rounded-2xl text-center ring-1 ring-violet-500/25">
                <p className="bg-violet-500 py-1 text-[11px] font-bold text-white">
                  {leaf.month}
                </p>
                <p className="bg-cream-2 py-1.5 font-serif text-3xl font-bold text-forest tabular-nums">
                  {leaf.day}
                </p>
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  status === "completed"
                    ? "bg-sage/15 text-sage"
                    : status === "cancelled"
                      ? "bg-brick/10 text-brick"
                      : "bg-violet-500/15 text-violet-500"
                }`}
              >
                {t(`stu.dash.defenseStatus.${status}`)}
              </span>
              {leaf && (
                <p className="text-sm font-bold text-forest">
                  {leaf.weekday} · {leaf.time}
                </p>
              )}
              {upcoming && (
                <p className="text-xs font-semibold text-violet-500">
                  {relative(defense.date)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <InfoTile
              icon={CalendarDays}
              label={t("stu.dash.dateAndTime")}
              value={fmtDate(defense.date, true)}
            />
            <InfoTile
              icon={MapPin}
              label={t("stu.room")}
              value={defense.room || "—"}
            />
          </div>

          {status === "completed" && (
            <div className="flex items-center justify-between rounded-2xl bg-linear-to-l from-gold/20 to-gold/5 px-4 py-3 ring-1 ring-gold/30">
              <span className="flex items-center gap-2 text-sm font-bold text-forest">
                <Award size={18} className="text-gold" />
                {t("stu.dash.finalGrade")}
              </span>
              <span className="font-serif text-2xl font-bold text-forest tabular-nums">
                {defense.grade != null ? `${defense.grade}/20` : "—"}
              </span>
            </div>
          )}

          {(defense.committee ?? []).length > 0 && (
            <div className="border-t border-forest/10 pt-4">
              <p className="mb-2.5 text-[11px] font-semibold text-clay">
                {t("stu.dash.committee")}
              </p>
              <ul className="space-y-2">
                {(defense.committee ?? []).map((c, i) => (
                  <li
                    key={c.professor?.id ?? i}
                    className="flex items-center gap-3 rounded-xl bg-cream-2/70 px-3 py-2 ring-1 ring-forest/5"
                  >
                    <UserAvatar user={c.professor?.user} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-forest">
                      {fullName(c.professor?.user) || "—"}
                    </span>
                    <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-500">
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
 * Who to ask. The old card here offered a "help centre" button that led
 * nowhere; the person who can actually answer a question about the project
 * is its supervisor.
 */
function SupervisorCard({ project }: { project: MyProject }) {
  const { t } = useTranslation();
  const prof = project.topic?.professor?.user;
  const email = prof?.email ?? null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-12 -top-16 size-48 rounded-full bg-gold/20 blur-3xl"
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <UserAvatar
            user={prof}
            size={56}
            tone="gold"
            className="text-[var(--t-brand-deep)]! ring-2 ring-gold/60"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-soft-sage">
              <GraduationCap size={12} className="text-gold-soft" />
              {t("stu.proj.yourSupervisor")}
            </p>
            <p className="truncate font-serif text-lg font-bold text-cream">
              {fullName(prof) || "—"}
            </p>
          </div>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-soft-sage">
          {t("stu.proj.supervisorBody")}
        </p>
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-bold text-[var(--t-brand-deep)] transition hover:bg-gold-soft active:scale-95"
          >
            <Mail size={16} />
            {t("stu.proj.emailSupervisor")}
          </a>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  small pieces
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  badge,
  extra,
  tint = "gold",
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  extra?: React.ReactNode;
  tint?: "gold" | "violet";
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-4">
      <h2 className="flex items-center gap-2.5 font-serif text-lg font-bold text-forest">
        <span
          className={`grid size-9 place-items-center rounded-xl ${
            tint === "violet"
              ? "bg-violet-500/15 text-violet-500"
              : "bg-gold/15 text-gold"
          }`}
        >
          <Icon size={18} />
        </span>
        {title}
        {badge && (
          <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-bold text-clay tabular-nums">
            {badge}
          </span>
        )}
      </h2>
      {extra}
    </header>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-cream-2/70 p-3 ring-1 ring-forest/5">
      <Icon size={15} className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="text-[11px] text-clay">{label}</p>
        <p className="truncate text-sm font-semibold text-forest">{value}</p>
      </div>
    </div>
  );
}

function NoProject() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  return (
    <div className={`${CARD} px-6 py-20 text-center`}>
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-linear-to-br from-gold/25 to-gold/5 text-gold ring-8 ring-gold/5">
        <FolderKanban size={34} />
      </div>
      <h2 className="font-serif text-xl font-bold text-forest">
        {t("stu.noProject")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-clay">
        {t("stu.noProjectDesc")}
      </p>
      <Link
        to={localePath(PATHS.topics)}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-95"
      >
        <Search size={16} />
        {t("stu.browseTopics")}
      </Link>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-6 font-body">
      <div className="h-80 animate-pulse rounded-3xl bg-forest/10" />
      <div className="h-36 animate-pulse rounded-3xl bg-forest/5" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="h-96 animate-pulse rounded-3xl bg-forest/5" />
        <div className="h-96 animate-pulse rounded-3xl bg-forest/5" />
      </div>
    </div>
  );
}
