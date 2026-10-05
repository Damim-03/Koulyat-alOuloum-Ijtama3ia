import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  DoorOpen,
  FileText,
  Gavel,
  GraduationCap,
  Hourglass,
  Inbox,
  LayoutDashboard,
  Minus,
  PieChart,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageLoader } from "../../../../components/page-loader";
import type { MonthlyGrowthItem, TopicBreakdownItem, TrendValue } from "../../../../types/admin";
import type { TopicStatus } from "../../../../types/enums";
import { useMe } from "../../../auth/hooks/use-me";
import { useAuthStore } from "../../../../store/auth.store";
import { useAdminDashboard } from "../../hooks/admin-hook";
import { statusChip } from "../../utils/status-styles";
import { relative } from "../projects/project-utils";
import i18n from "../../../../i18n/i18n";
import { givenName, personName } from "../../../../lib/person-name";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/**
 * The administration's home.
 *
 * What it opens on: the platform's figures, each one a door to its list and
 * each with this month against the last; then what is waiting for a decision,
 * gathered in one place; then how the year is moving — growth, topics by
 * status, students by specialization, accounts; and the lists to act on, each
 * row opening the very item rather than a list to look it up in.
 */

/** Topic statuses with their colour in both themes — stroke, dot, link filter. */
const STATUS: { key: TopicStatus; label: string; stroke: string; dot: string }[] = [
  { key: "pending", label: "status.pending", stroke: "stroke-amber-500", dot: "bg-amber-500" },
  { key: "approved", label: "status.approved", stroke: "stroke-emerald-500", dot: "bg-emerald-500" },
  { key: "open", label: "admin.published", stroke: "stroke-sky-500", dot: "bg-sky-500" },
  { key: "full", label: "status.full", stroke: "stroke-violet-500", dot: "bg-violet-500" },
  { key: "rejected", label: "status.rejected", stroke: "stroke-rose-500", dot: "bg-rose-500" },
  { key: "archived", label: "status.archived", stroke: "stroke-gray-400", dot: "bg-gray-400" },
];

const STALE_DAYS = 3;
const CARD = "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]";

const fullName = (u: { firstName: string | null; lastName: string | null }) => personName(u) || "—";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const { data, isError, refetch, isLoading } = useAdminDashboard();
  const { isLoading: meLoading } = useMe();
  const me = useAuthStore((s) => s.user);
  const [now] = useState(() => Date.now());
  const href = (p: string) => `/${lang}/${p}`;

  if (isLoading || meLoading) return <PageLoader />;
  if (isError || !data) return <ErrorRetry title={t("admin.dashboardLoadFailed")} onRetry={() => refetch()} />;

  const { stats, trends, academicYear, pendingProposals, recentRequests, upcomingDefenses, attention, topicBreakdown, studentsPerSpecialization, monthlyGrowth, systemHealth } = data;
  const stale = (iso: string) => now - new Date(iso).getTime() > STALE_DAYS * 86_400_000;

  const tiles: { icon: LucideIcon; label: string; value: number; to: string; trend?: TrendValue; warn?: boolean }[] = [
    { icon: GraduationCap, label: t("dash.students"), value: stats.students, to: "admin/students", trend: trends.students },
    { icon: UserCog, label: t("dash.professors"), value: stats.professors, to: "admin/professors" },
    { icon: FileText, label: t("admin.publishedTopics"), value: stats.openTopics, to: "admin/topics?status=open", trend: trends.topics },
    { icon: CheckCircle2, label: t("admin.completedTopics"), value: stats.fullTopics, to: "admin/topics?status=full" },
    { icon: Hourglass, label: t("admin.pendingProposals"), value: stats.pendingTopics, to: "admin/topics?status=pending", warn: stats.pendingTopics > 0 },
    { icon: ClipboardList, label: t("admin.pendingGroupRequests"), value: stats.pendingGroupRequests, to: "admin/group-requests?status=pending", trend: trends.requests, warn: stats.pendingGroupRequests > 0 },
    { icon: Gavel, label: t("admin.upcomingDefensesShort"), value: stats.upcomingDefenses, to: "admin/defenses" },
  ];

  const waiting: { icon: LucideIcon; label: string; count: number; to: string; tone: "danger" | "warn" | "info" }[] = [
    { icon: AlertTriangle, label: t("admin.home.attention.stale", { days: STALE_DAYS }), count: attention.staleProposals.length, to: "admin/topics?status=pending", tone: "danger" },
    { icon: Hourglass, label: t("admin.pendingProposals"), count: stats.pendingTopics, to: "admin/topics?status=pending", tone: "warn" },
    { icon: ClipboardList, label: t("admin.pendingGroupRequests"), count: stats.pendingGroupRequests, to: "admin/group-requests?status=pending", tone: "warn" },
    { icon: Inbox, label: t("admin.publishedTopicsNoApplications"), count: attention.openWithoutRequests.length, to: "admin/topics?status=open", tone: "info" },
    { icon: ShieldOff, label: t("admin.home.attention.suspended"), count: systemHealth.suspendedUsers, to: "admin/users", tone: "info" },
  ];
  const open = waiting.filter((w) => w.count > 0);
  const today = new Date(now).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6 font-body">
      {/* ── hero ── */}
      <section className="forest-glow relative overflow-hidden rounded-3xl px-6 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
                <LayoutDashboard size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {today}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">
                  {givenName(me) ? t("admin.home.greeting", { name: givenName(me) }) : t("admin.dashboardTitle")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.home.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {academicYear && (
                <Link
                  to={href(`admin/academic-years?year=${academicYear.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/15 px-3.5 py-2.5 text-sm font-semibold text-cream transition hover:bg-gold/25"
                >
                  <CalendarRange size={16} className="text-gold-soft" />
                  <span dir="ltr">{academicYear.title}</span>
                </Link>
              )}
              <Link
                to={href("admin/topics?status=pending")}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
              >
                <Hourglass size={16} />
                {t("admin.home.review")}
                {stats.pendingTopics > 0 && <span className="rounded-full bg-forest-deep/15 px-1.5 text-[11px] tabular-nums">{stats.pendingTopics}</span>}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7" data-testid="dash-tiles">
            {tiles.map((x) => (
              <Link
                key={x.label}
                to={href(x.to)}
                className={`group rounded-2xl border p-3.5 backdrop-blur-sm transition hover:-translate-y-0.5 ${
                  x.warn ? "border-amber-300/40 bg-amber-400/10 hover:bg-amber-400/15" : "border-white/10 bg-cream/5 hover:border-white/25 hover:bg-cream/10"
                }`}
              >
                <span className="mb-2 flex items-start gap-1.5 text-[11px] text-cream/70">
                  <x.icon size={14} className={`mt-px shrink-0 ${x.warn ? "text-amber-200" : "text-gold-soft"}`} />
                  <span className="leading-tight">{x.label}</span>
                </span>
                <b className={`block font-serif text-[26px] leading-none tabular-nums ${x.warn ? "text-amber-200" : "text-cream"}`}>{x.value}</b>
                {x.trend && <Trend trend={x.trend} />}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── what is waiting ── */}
      <section className={`${CARD} p-5`} data-testid="dash-attention">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Heading icon={AlertTriangle} title={t("admin.home.attention.title")} hint={t("admin.home.attention.hint")} />
          {open.length > 0 && <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">{t("admin.home.attention.count", { count: open.length })}</span>}
        </div>
        {open.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/8 px-4 py-4 text-[13px] text-forest">
            <ShieldCheck size={20} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
            {t("admin.home.attention.allClear")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            {waiting.map((w) => (
              <Link
                key={w.label}
                to={href(w.to)}
                aria-disabled={w.count === 0}
                className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                  w.count === 0
                    ? "pointer-events-none border-forest/8 opacity-50"
                    : w.tone === "danger"
                      ? "border-rose-400/40 bg-rose-500/8 hover:bg-rose-500/12"
                      : w.tone === "warn"
                        ? "border-amber-400/40 bg-amber-500/8 hover:bg-amber-500/12"
                        : "border-sky-400/30 bg-sky-500/6 hover:bg-sky-500/10"
                }`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    w.tone === "danger"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                      : w.tone === "warn"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                  }`}
                >
                  <w.icon size={18} />
                </span>
                <span className="min-w-0 flex-1 text-[12px] leading-snug font-semibold text-forest">{w.label}</span>
                <b className="font-serif text-[22px] leading-none text-forest tabular-nums">{w.count}</b>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── growth + topics ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className={`${CARD} p-5 xl:col-span-8`}>
          <Heading icon={BarChart3} title={t("admin.growthLastSixMonths")} hint={t("admin.home.growthHint")} />
          <Growth data={monthlyGrowth} />
        </section>
        <section className={`${CARD} p-5 xl:col-span-4`}>
          <Heading icon={PieChart} title={t("admin.topicsByStatus")} more={href("admin/topics")} />
          <TopicsDonut data={topicBreakdown} href={href} />
        </section>
      </div>

      {/* ── specializations + accounts ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className={`${CARD} p-5 xl:col-span-8`}>
          <Heading icon={GraduationCap} title={t("admin.studentsBySpecializationTop")} hint={t("admin.home.specsHint")} more={href("admin/specializations")} />
          {studentsPerSpecialization.length === 0 ? (
            <Empty text={t("admin.noDataYet")} />
          ) : (
            <ol className="space-y-2.5">
              {studentsPerSpecialization.map((s, i) => {
                const share = stats.students ? Math.round((s.count / stats.students) * 100) : 0;
                const top = Math.max(1, ...studentsPerSpecialization.map((x) => x.count));
                return (
                  <li key={s.id}>
                    <Link to={href(`admin/specializations/${s.id}`)} className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-gold/[0.06]">
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep" : "bg-forest/8 text-forest"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="truncate font-semibold text-forest transition group-hover:text-gold">{s.name}</span>
                          <span className="shrink-0 text-clay tabular-nums">
                            <b className="font-serif text-[15px] text-forest">{s.count}</b> · {share}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-forest/8">
                          <div className="h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-[width] duration-700" style={{ width: `${(s.count / top) * 100}%` }} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className={`${CARD} p-5 xl:col-span-4`}>
          <Heading icon={Activity} title={t("admin.systemHealth")} hint={t("admin.home.healthHint")} more={href("admin/users")} />
          <Health total={systemHealth.totalAccounts} active={systemHealth.activeUsers} suspended={systemHealth.suspendedUsers} />
        </section>
      </div>

      {/* ── defences + requests ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <Heading icon={Gavel} title={t("admin.upcomingDefenses")} more={href("admin/defenses")} />
          {upcomingDefenses.length === 0 ? (
            <Empty text={t("admin.noScheduledDefenses")} />
          ) : (
            <ul className="space-y-2" data-testid="dash-defenses">
              {upcomingDefenses.map((d) => {
                const date = new Date(d.date);
                return (
                  <li key={d.id}>
                    <Link to={href(`admin/defenses/${d.id}`)} className="group flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-2/40 p-2.5 transition hover:border-gold/35 hover:bg-gold/[0.05]">
                      <span className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-linear-to-br from-forest to-forest-deep py-2 text-cream dark:from-gold/15 dark:to-gold/5">
                        <span className="font-serif text-[22px] leading-none font-bold">{date.getDate()}</span>
                        <span className="mt-0.5 text-[10px] text-cream/75">{date.toLocaleDateString(i18n.language, { month: "short" })}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-forest transition group-hover:text-gold">{d.group.topic.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-clay">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} className="text-gold" />
                            {date.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <DoorOpen size={12} className="text-gold" />
                            {d.room}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock size={12} className="text-gold" />
                            {relative(d.date)}
                          </span>
                        </p>
                      </div>
                      <ChevronLeft size={16} className="shrink-0 text-clay/50 ltr:rotate-180" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${CARD} p-5`}>
          <Heading icon={ClipboardList} title={t("admin.latestGroupRequests")} more={href("admin/group-requests")} />
          {recentRequests.length === 0 ? (
            <Empty text={t("admin.noRecentRequests")} />
          ) : (
            <ul className="space-y-2">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <Link to={href(`admin/group-requests/${r.id}`)} className="group flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-2/40 p-3 transition hover:border-gold/35 hover:bg-gold/[0.05]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
                      <Users size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-forest transition group-hover:text-gold">{r.topic.title}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-clay">
                        {t("admin.leaderAndMembers", { name: fullName(r.leader.user), count: r.members.length })} · {relative(r.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusChip(r.status)}`}>{t(`status.${r.status}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── proposals + open topics without requests ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <Heading icon={Hourglass} title={t("admin.latestPendingProposals")} hint={t("admin.home.proposalsHint", { days: STALE_DAYS })} more={href("admin/topics?status=pending")} />
          {pendingProposals.length === 0 ? (
            <Empty text={t("admin.noPendingProposals")} ok />
          ) : (
            <ul className="space-y-2">
              {pendingProposals.map((p) => {
                const late = stale(p.createdAt);
                return (
                  <li key={p.id}>
                    <Link
                      to={href(`admin/topics/${p.id}`)}
                      className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:bg-gold/[0.05] ${late ? "border-rose-400/35 bg-rose-500/5" : "border-forest/8 bg-cream-2/40 hover:border-gold/35"}`}
                    >
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${late ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "bg-amber-500/12 text-amber-600 dark:text-amber-300"}`}>
                        <FileText size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-forest transition group-hover:text-gold">{p.title}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-clay">
                          {fullName(p.professor.user)} · {p.specialization.name}
                        </p>
                      </div>
                      <span className={`shrink-0 text-end text-[11px] ${late ? "font-semibold text-rose-600 dark:text-rose-300" : "text-clay"}`}>
                        {late && <span className="block text-[10px] font-bold">{t("admin.home.late")}</span>}
                        {relative(p.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${CARD} p-5`}>
          <Heading icon={Inbox} title={t("admin.publishedTopicsNoApplications")} hint={t("admin.home.noRequestsHint")} more={href("admin/topics?status=open")} />
          {attention.openWithoutRequests.length === 0 ? (
            <Empty text={t("admin.allPublishedHaveApplications")} ok />
          ) : (
            <ul className="space-y-2">
              {attention.openWithoutRequests.map((x) => (
                <li key={x.id}>
                  <Link to={href(`admin/topics/${x.id}`)} className="group flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-2/40 p-3 transition hover:border-gold/35 hover:bg-gold/[0.05]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-300">
                      <Inbox size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-forest transition group-hover:text-gold">{x.title}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-clay">{x.specialization.name}</p>
                    </div>
                    <ChevronLeft size={16} className="shrink-0 text-clay/50 ltr:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────── */

function Heading({ icon: Icon, title, hint, more }: { icon: LucideIcon; title: string; hint?: string; more?: string }) {
  const { t } = useTranslation();
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-linear-to-br from-gold/20 to-gold/5 text-gold">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-serif text-[16px] leading-tight font-bold text-forest">{title}</h2>
          {hint && <p className="mt-1 text-[12px] leading-relaxed text-clay">{hint}</p>}
        </div>
      </div>
      {more && (
        <Link to={more} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-gold transition hover:bg-gold/10">
          {t("pro.viewAll")}
          <ChevronLeft size={14} className="ltr:rotate-180" />
        </Link>
      )}
    </header>
  );
}

function Empty({ text, ok }: { text: string; ok?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-[13px] ${ok ? "border-emerald-400/30 text-forest" : "border-forest/15 text-clay"}`}>
      {ok && <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-300" />}
      {text}
    </div>
  );
}

/** This month against the last — what changed, not just how much. */
function Trend({ trend }: { trend: TrendValue }) {
  const { t } = useTranslation();
  const Icon = trend.delta > 0 ? ArrowUpRight : trend.delta < 0 ? ArrowDownRight : Minus;
  return (
    <span className="mt-2 flex items-center gap-1 text-[10.5px] text-cream/70" title={t("admin.home.trendTitle", { current: trend.current, previous: trend.previous })}>
      <Icon size={12} className={trend.delta > 0 ? "text-emerald-300" : trend.delta < 0 ? "text-cream/60" : "text-cream/50"} />
      <span>
        {t("admin.home.thisMonth", { n: trend.current })}
        <span className="text-cream/45"> · {t("admin.home.lastMonth", { n: trend.previous })}</span>
      </span>
    </span>
  );
}

const SERIES = [
  { key: "students", label: "dash.students", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  { key: "topics", label: "common.topics", bar: "bg-gold", dot: "bg-gold" },
  { key: "projects", label: "dash.myProject", bar: "bg-sky-500", dot: "bg-sky-500" },
] as const;

function Growth({ data }: { data: MonthlyGrowthItem[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.flatMap((d) => [d.students, d.topics, d.projects]));
  const step = Math.max(1, Math.ceil(max / 4));
  const ceil = step * 4;
  const ticks = [ceil, step * 3, step * 2, step, 0];
  const totals = Object.fromEntries(SERIES.map((s) => [s.key, data.reduce((n, d) => n + d[s.key], 0)]));
  const monthOf = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(i18n.language, { month: "short" });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-cream-2/50 px-3 py-1 text-[11.5px] text-forest">
            <span className={`size-2.5 rounded-full ${s.dot}`} />
            {t(s.label)}
            <b className="font-serif tabular-nums">{totals[s.key]}</b>
          </span>
        ))}
      </div>
      <div className="flex gap-2" dir="ltr">
        <div className="flex h-52 flex-col justify-between pb-6 text-[10px] text-clay tabular-nums">
          {ticks.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((v) => (
              <div key={v} className="h-px w-full bg-forest/8" />
            ))}
          </div>
          <div className="relative flex h-52 items-stretch justify-between gap-2">
            {data.map((d) => (
              <div key={d.month} className="group flex flex-1 flex-col items-center">
                <div className="relative flex w-full flex-1 items-end justify-center gap-1 rounded-t-xl transition group-hover:bg-forest/[0.03]">
                  {SERIES.map((s) => (
                    <div
                      key={s.key}
                      className={`w-3 rounded-t-md ${s.bar} transition-all duration-700 group-hover:brightness-110`}
                      style={{ height: `${(d[s.key] / ceil) * 100}%`, minHeight: d[s.key] > 0 ? 4 : 0 }}
                      title={`${t(s.label)}: ${d[s.key]}`}
                    />
                  ))}
                  <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-xl border border-forest/10 bg-cream-card px-3 py-2 text-[11px] whitespace-nowrap shadow-lg group-hover:block" dir="auto">
                    {SERIES.map((s) => (
                      <span key={s.key} className="flex items-center gap-1.5 text-forest">
                        <span className={`size-2 rounded-full ${s.dot}`} />
                        {t(s.label)}: <b className="tabular-nums">{d[s.key]}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="mt-1.5 h-4.5 text-[11px] text-clay">{monthOf(d.month)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicsDonut({ data, href }: { data: TopicBreakdownItem[]; href: (p: string) => string }) {
  const { t } = useTranslation();
  const total = data.reduce((n, d) => n + d.count, 0);
  const size = 176;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const present = STATUS.filter((s) => (data.find((d) => d.status === s.key)?.count ?? 0) > 0);
  const countOf = (k: string) => data.find((d) => d.status === k)?.count ?? 0;
  const gap = present.length > 1 ? 4 : 0;
  // Each segment starts where the ones before it end.
  const segs = present.map((s, i) => ({
    s,
    len: (c * countOf(s.key)) / (total || 1),
    start: present.slice(0, i).reduce((n, x) => n + (c * countOf(x.key)) / (total || 1), 0),
  }));

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-5" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={t("admin.topicsByStatus")}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-forest/8" strokeDasharray={total ? undefined : "6 7"} />
          {segs.map(({ s, len, start }) => (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
              strokeDashoffset={-start}
              className={`${s.stroke} transition-all duration-700`}
            >
              <title>{`${t(s.label)}: ${countOf(s.key)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <b className="block font-serif text-[34px] leading-none text-forest tabular-nums">{total}</b>
            <span className="mt-1 block text-[11px] text-clay">{t("admin.totalTopics")}</span>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1">
        {STATUS.map((s) => {
          const n = countOf(s.key);
          return (
            <li key={s.key}>
              <Link
                to={href(`admin/topics?status=${s.key}`)}
                aria-disabled={n === 0}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] transition hover:bg-forest/5 ${n === 0 ? "pointer-events-none opacity-45" : ""}`}
              >
                <span className={`size-2.5 rounded-full ${s.dot}`} />
                <span className="flex-1 text-forest">{t(s.label)}</span>
                <b className="text-forest tabular-nums">{n}</b>
                <span className="w-9 text-end text-[11px] text-clay tabular-nums">{total ? `${Math.round((n / total) * 100)}%` : "—"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Health({ total, active, suspended }: { total: number; active: number; suspended: number }) {
  const { t } = useTranslation();
  const pct = total ? Math.round((active / total) * 100) : 0;
  const rows: { icon: LucideIcon; label: string; value: number; cls: string; dot: string }[] = [
    { icon: Users, label: t("admin.totalAccounts"), value: total, cls: "text-forest", dot: "bg-forest/40" },
    { icon: ShieldCheck, label: t("admin.activeFem"), value: active, cls: "text-emerald-600 dark:text-emerald-300", dot: "bg-emerald-500" },
    { icon: ShieldOff, label: t("admin.suspendedFem"), value: suspended, cls: suspended ? "text-rose-600 dark:text-rose-300" : "text-clay", dot: "bg-rose-500" },
  ];
  return (
    <div>
      <div className="mb-4 rounded-2xl border border-forest/8 bg-cream-2/40 p-4">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-[12px] text-clay">{t("admin.home.activeShare")}</span>
          <b className="font-serif text-[28px] leading-none text-forest tabular-nums">{pct}%</b>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-forest/8">
          <span className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${pct}%` }} />
          {suspended > 0 && <span className="h-full bg-rose-500" style={{ width: `${100 - pct}%` }} />}
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 rounded-xl px-1 py-1">
            <span className={`size-2.5 rounded-full ${r.dot}`} />
            <r.icon size={15} className="text-clay" />
            <span className="flex-1 text-[13px] text-forest">{r.label}</span>
            <b className={`font-serif text-[18px] tabular-nums ${r.cls}`}>{r.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
