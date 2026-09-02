import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  GraduationCap,
  UserCog,
  FileText,
  ClipboardList,
  MessagesSquare,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
} from "lucide-react";
import { PageLoader } from "../../../../components/page-loader";
import type { TrendValue } from "../../../../types/admin";
import type { TopicStatus } from "../../../../types/enums";
import { useMe } from "../../../auth/hooks/use-me";
import { useAdminDashboard } from "../../hooks/admin-hook";
import * as React from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../../i18n/i18n";
/* ── admin route paths (adjust here if yours differ) ───────── */
const PATHS = {
  topics: "admin/topics",
  groupRequests: "admin/group-requests",
  applications: "admin/applications",
  students: "admin/students",
  defenses: "admin/defenses",
  professors: "admin/professors",
};

// Keys, not copy: this map is built once at import time.
const STATUS_META: Record<TopicStatus, { labelKey: string; color: string }> = {
  pending: { labelKey: "status.pending", color: "#C1965A" },
  approved: { labelKey: "status.accepted", color: "#26423D" },
  open: { labelKey: "admin.published", color: "#4A7066" },
  full: { labelKey: "status.full", color: "#8EB29E" },
  rejected: { labelKey: "status.rejected", color: "#b54a3f" },
  archived: { labelKey: "status.archived", color: "#bcae97" },
};

// Keys, not copy: built once at import time.
const REQUEST_STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: "status.pending", cls: "bg-amber-100 text-amber-700" },
  accepted: {
    labelKey: "status.accepted",
    cls: "bg-emerald-100 text-emerald-700",
  },
  rejected: { labelKey: "status.rejected", cls: "bg-red-100 text-red-700" },
};

const fullName = (u: { firstName: string | null; lastName: string | null }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || "\u2014";

const arDate = (iso: string) =>
  new Date(iso).toLocaleDateString(i18n.language);

const fmtMonth = (m: string) => {
  const [, mo] = m.split("-");
  return mo;
};

/* ── navigation hook (keeps :lang prefix) ──────────────────── */
function useGo() {
  const navigate = useNavigate();
  const { lang } = useParams();
  const prefix = lang ? `/${lang}` : "";
  return (path: string, query?: Record<string, string>) => {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    navigate(`${prefix}/${path}${qs}`);
  };
}

/* ── card shell ───────────────────────────────────────────── */
function Card({
                title,
                children,
                className = "",
                onMore,
              }: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onMore?: () => void;
}) {
  const { t } = useTranslation();
  return (
      <div
          className={`animate-slide-up rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(38,66,61,0.12)] ${className}`}
      >
        {title && (
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-forest">{title}</h3>
              {onMore && (
                  <button
                      onClick={onMore}
                      className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-clay transition hover:bg-forest/5 hover:text-forest"
                  >{t("pro.viewAll")}<ChevronLeft size={14} className="ltr:rotate-180" />
                  </button>
              )}
            </div>
        )}
        {children}
      </div>
  );
}

function TrendBadge({ trend }: { trend: TrendValue }) {
  const { t } = useTranslation();
  const up = trend.delta > 0;
  const down = trend.delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const cls = up ? "text-emerald-600" : down ? "text-red-500" : "text-clay";
  return (
      <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold ${cls}`}
      >
      <Icon size={12} />
        {Math.abs(trend.delta)} {t("admin.thisMonth")}
    </span>
  );
}

function StatTile({
                    label,
                    value,
                    icon: Icon,
                    tint,
                    trend,
                    onClick,
                  }: {
  label: string;
  value: number;
  icon: typeof GraduationCap;
  tint: string;
  trend?: TrendValue;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
      <button
          type="button"
          onClick={onClick}
          disabled={!clickable}
          className={`group animate-scale-in flex flex-col items-center rounded-2xl border border-forest/10 bg-cream-card
                  p-5 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition-all duration-300
                  hover:-translate-y-2 hover:scale-[1.03] hover:border-gold/40 hover:shadow-[0_15px_35px_rgba(38,66,61,.18)]
                  `}
      >
        <div
            className={`mb-3 grid size-12 place-items-center rounded-full ${tint}`}
        >
          <Icon size={22} />
        </div>
        <p className="font-serif text-2xl font-bold text-forest">{value}</p>
        <p className="mt-1 text-[11px] font-medium tracking-wider text-clay">
          {label}
        </p>
        {trend && (
            <div className="mt-1.5">
              <TrendBadge trend={trend} />
            </div>
        )}
      </button>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-clay">{text}</p>;
}

/* ── donut (clickable slices + legend) ────────────────────── */
function BreakdownDonut({
                          data,
                          onSlice,
                        }: {
  data: { status: TopicStatus; count: number }[];
  onSlice: (status: TopicStatus) => void;
}) {
  const { t } = useTranslation();
  const present = data.filter((d) => d.count > 0);
  const total = present.reduce((a, d) => a + d.count, 0);
  const sum = total || 1;

  let offset = 0;
  const ring = present.map((d) => {
    const pct = (d.count / sum) * 100;
    const seg = { ...d, pct, dash: `${pct} ${100 - pct}`, dashoffset: -offset };
    // eslint-disable-next-line react-hooks/immutability
    offset += pct;
    return seg;
  });

  return (
      <div className="flex flex-col items-center">
        <div className="relative mb-6 size-44">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="transparent"
                stroke="#f5edda"
                strokeWidth="3.5"
            />
            {ring.map((s) => (
                <circle
                    key={s.status}
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke={STATUS_META[s.status].color}
                    strokeWidth="3.5"
                    strokeDasharray={s.dash}
                    strokeDashoffset={s.dashoffset}
                    className="cursor-pointer transition-[stroke-width] duration-150 hover:stroke-[4.5]"
                    onClick={() => onSlice(s.status)}
                >
                  <title>{`${t(STATUS_META[s.status].labelKey)}: ${s.count} (${Math.round(s.pct)}%)`}</title>
                </circle>
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold text-forest">
            {total}
          </span>
            <span className="text-[10px] text-clay">{t("admin.totalTopics")}</span>
          </div>
        </div>
        <div className="w-full space-y-1">
          {present.length === 0 && <EmptyRow text={t("pro.noTopics")} />}
          {ring.map((s) => (
              <button
                  key={s.status}
                  onClick={() => onSlice(s.status)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 transition hover:bg-forest/5"
              >
                <div className="flex items-center gap-2">
              <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: STATUS_META[s.status].color }}
              />
                  <span className="text-xs text-forest">
                {t(STATUS_META[s.status].labelKey)}
              </span>
                </div>
                <span className="text-xs font-bold text-forest">
              {s.count}{" "}
                  <span className="text-clay">· {Math.round(s.pct)}%</span>
            </span>
              </button>
          ))}
        </div>
      </div>
  );
}

/* ── horizontal bars (clickable) ──────────────────────────── */
function BarList({
                   items,
                   color = "#C1965A",
                   onItem,
                 }: {
  items: { id: string; name: string; count: number }[];
  color?: string;
  onItem?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <EmptyRow text={t("admin.noDataYet")} />;
  return (
      <div className="space-y-3">
        {items.map((i) => (
            <button
                key={i.id}
                onClick={() => onItem?.(i.id)}
                disabled={!onItem}
                className={`group block w-full text-start ${onItem ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-forest group-hover:text-gold">{i.name}</span>
                <span className="font-bold text-clay">{i.count}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-cream-2">
                <div
                    className="h-full rounded-full transition-[filter] group-hover:brightness-95"
                    style={{
                      width: `${(i.count / max) * 100}%`,
                      backgroundColor: color,
                    }}
                />
              </div>
            </button>
        ))}
      </div>
  );
}

/* ── monthly growth (gridlines + axis + hover) ────────────── */
function GrowthChart({
                       data,
                     }: {
  data: { month: string; students: number; topics: number; projects: number }[];
}) {
  const { t } = useTranslation();
  const max = Math.max(
      1,
      ...data.flatMap((d) => [d.students, d.topics, d.projects]),
  );
  // round the axis ceiling up to a "nice" multiple of 4
  const ceil = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    return step * 4;
  }, [max]);
  const ticks = [ceil, (ceil * 3) / 4, ceil / 2, ceil / 4, 0];

  const series = [
    { key: "students" as const, label: t("dash.students"), color: "#26423D" },
    { key: "topics" as const, label: t("common.topics"), color: "#C1965A" },
    { key: "projects" as const, label: t("dash.myProject"), color: "#8EB29E" },
  ];

  return (
      <div>
        <div className="flex gap-2">
          {/* y axis */}
          <div className="flex h-44 flex-col justify-between py-1 text-[9px] text-clay">
            {ticks.map((t) => (
                <span key={t} dir="ltr">
              {t}
            </span>
            ))}
          </div>

          {/* plot */}
          <div className="relative flex-1">
            {/* gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between py-1">
              {ticks.map((t) => (
                  <div key={t} className="h-px w-full bg-forest/5" />
              ))}
            </div>

            {/* bars */}
            <div className="relative flex h-44 items-end justify-between gap-2 py-1">
              {data.map((d) => (
                  <div
                      key={d.month}
                      className="group flex flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex h-full w-full items-end justify-center gap-1">
                      {series.map((s) => (
                          <div
                              key={s.key}
                              className="relative w-2.5 rounded-t transition-[filter] group-hover:brightness-105"
                              style={{
                                height: `${(d[s.key] / ceil) * 100}%`,
                                backgroundColor: s.color,
                                minHeight: d[s.key] > 0 ? 3 : 0,
                              }}
                          >
                      <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-forest px-1.5 py-0.5 text-[9px] text-cream group-hover:block">
                        {s.label}: {d[s.key]}
                      </span>
                          </div>
                      ))}
                    </div>
                  </div>
              ))}
            </div>

            {/* x labels */}
            <div className="flex justify-between gap-2">
              {data.map((d) => (
                  <span
                      key={d.month}
                      className="flex-1 text-center text-[10px] text-clay"
                      dir="ltr"
                  >
                {fmtMonth(d.month)}
              </span>
              ))}
            </div>
          </div>
        </div>

        {/* legend */}
        <div className="mt-3 flex items-center justify-center gap-4">
          {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
            <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
            />
                <span className="text-[11px] text-clay">{s.label}</span>
              </div>
          ))}
        </div>
      </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export function AdminDashboardPage() {
  const { t } = useTranslation();
  const go = useGo();
  const {
    data,
    isError,
    refetch,
    isLoading: isDashboardLoading,
  } = useAdminDashboard();
  const { isLoading: isUserLoading } = useMe();

  if (isDashboardLoading || isUserLoading) return <PageLoader />;

  if (isError || !data)
    return (
        <Card className="text-center">
          <p className="text-clay">{t("admin.dashboardLoadFailed")}</p>
          <button
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-forest px-5 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >{t("admin.retry")}</button>
        </Card>
    );

  const {
    stats,
    trends,
    academicYear,
    pendingProposals,
    recentRequests,
    upcomingDefenses,
    attention,
    topicBreakdown,
    studentsPerSpecialization,
    monthlyGrowth,
    systemHealth,
  } = data;

  return (
      <div className="animate-[fadeIn_.5s_ease] font-body space-y-6">
        {/* greeting */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">{t("admin.dashboardTitle")}</h1>
            <p className="mt-1.5 text-sm text-clay">{t("admin.dashboardSubtitle")}</p>
          </div>
          {academicYear && (
              <span className="rounded-full bg-linear-to-l from-gold to-gold-soft px-4 py-1.5 text-sm font-bold text-forest-deep">
            {t("admin.academicYearColon", { value: academicYear.title })}
          </span>
          )}
        </div>

        {/* primary tiles */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
              label={t("dash.students")}
              value={stats.students}
              icon={GraduationCap}
              tint="bg-soft-sage/30 text-forest"
              trend={trends.students}
              onClick={() => go(PATHS.students)}
          />
          <StatTile
              label={t("dash.professors")}
              value={stats.professors}
              icon={UserCog}
              tint="bg-gold/15 text-gold"
              onClick={() => go(PATHS.professors)}
          />
          <StatTile
              label={t("admin.publishedTopics")}
              value={stats.openTopics}
              icon={FileText}
              tint="bg-sage/20 text-sage"
              trend={trends.topics}
              onClick={() => go(PATHS.topics, { status: "open" })}
          />
          <StatTile
              label={t("pro.pendingApplications")}
              value={stats.pendingRequests}
              icon={ClipboardList}
              tint="bg-clay/15 text-clay"
              trend={trends.requests}
              onClick={() => go(PATHS.groupRequests, { status: "pending" })}
          />
          <StatTile
              label={t("admin.upcomingDefensesShort")}
              value={stats.upcomingDefenses}
              icon={MessagesSquare}
              tint="bg-forest/10 text-forest"
              onClick={() => go(PATHS.defenses)}
          />
        </div>

        {/* secondary tiles */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile
              label={t("admin.pendingProposals")}
              value={stats.pendingTopics}
              icon={FileText}
              tint="bg-amber-100 text-amber-600"
              onClick={() => go(PATHS.topics, { status: "pending" })}
          />
          <StatTile
              label={t("admin.completedTopics")}
              value={stats.fullTopics}
              icon={CheckCircle2}
              tint="bg-emerald-100 text-emerald-600"
              onClick={() => go(PATHS.topics, { status: "full" })}
          />
          <StatTile
              label={t("admin.pendingIndividualRequests")}
              value={stats.pendingApplications}
              icon={ClipboardList}
              tint="bg-sky-100 text-sky-600"
              onClick={() => go(PATHS.applications, { status: "pending" })}
          />
          <StatTile
              label={t("admin.pendingGroupRequests")}
              value={stats.pendingGroupRequests}
              icon={MessagesSquare}
              tint="bg-violet-100 text-violet-600"
              onClick={() => go(PATHS.groupRequests, { status: "pending" })}
          />
        </div>

        {/* growth + breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card title={t("admin.growthLastSixMonths")} className="lg:col-span-8">
            <GrowthChart data={monthlyGrowth} />
          </Card>
          <Card
              title={t("admin.topicsByStatus")}
              className="lg:col-span-4"
              onMore={() => go(PATHS.topics)}
          >
            <BreakdownDonut
                data={topicBreakdown}
                onSlice={(status) => go(PATHS.topics, { status })}
            />
          </Card>
        </div>

        {/* specializations */}
        <Card title={t("admin.studentsBySpecializationTop")}>
          <BarList
              items={studentsPerSpecialization.map((s) => ({
                id: s.id,
                name: s.name,
                count: s.count,
              }))}
              onItem={(id) => go(PATHS.students, { specializationId: id })}
          />
        </Card>

        {/* recent requests + upcoming defenses */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t("admin.latestGroupRequests")} onMore={() => go(PATHS.groupRequests)}>
            {recentRequests.length === 0 ? (
                <EmptyRow text={t("admin.noRecentRequests")} />
            ) : (
                <ul className="divide-y divide-forest/10">
                  {recentRequests.map((r) => (
                      <li key={r.id}>
                        <button
                            onClick={() => go(PATHS.groupRequests, { id: r.id })}
                            className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-3 text-start transition hover:bg-forest/3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest">
                              {r.topic.title}
                            </p>
                            <p className="text-xs text-clay">
                              {t("admin.leaderAndMembers", {
                                name: fullName(r.leader.user),
                                count: r.members.length,
                              })}
                            </p>
                          </div>
                          <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${REQUEST_STATUS[r.status]?.cls ?? ""}`}
                          >
                      {REQUEST_STATUS[r.status]
                        ? t(REQUEST_STATUS[r.status].labelKey)
                        : r.status}
                    </span>
                        </button>
                      </li>
                  ))}
                </ul>
            )}
          </Card>

          <Card title={t("admin.upcomingDefenses")} onMore={() => go(PATHS.defenses)}>
            {upcomingDefenses.length === 0 ? (
                <EmptyRow text={t("admin.noScheduledDefenses")} />
            ) : (
                <ul className="divide-y divide-forest/10">
                  {upcomingDefenses.map((d) => (
                      <li key={d.id}>
                        <button
                            onClick={() => go(PATHS.defenses)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-start transition hover:bg-forest/3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest">
                              {d.group.topic.title}
                            </p>
                            <p className="text-xs text-clay">
                              {t("admin.roomColon", { value: d.room })}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-gold">
                      <CalendarClock size={13} />
                      <span dir="ltr">{arDate(d.date)}</span>
                    </span>
                        </button>
                      </li>
                  ))}
                </ul>
            )}
          </Card>
        </div>

        {/* attention */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
              title={t("admin.proposalsWaitingLong")}
              onMore={() => go(PATHS.topics, { status: "pending" })}
          >
            {attention.staleProposals.length === 0 ? (
                <EmptyRow text={t("admin.nothingNeedsAttention")} />
            ) : (
                <ul className="divide-y divide-forest/10">
                  {attention.staleProposals.map((p) => (
                      <li key={p.id}>
                        <button
                            onClick={() => go(PATHS.topics, { status: "pending" })}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-start transition hover:bg-forest/3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest">
                              {p.title}
                            </p>
                            <p className="text-xs text-clay">
                              {fullName(p.professor.user)}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-red-500">
                      <AlertTriangle size={12} />
                      <span dir="ltr">{arDate(p.createdAt)}</span>
                    </span>
                        </button>
                      </li>
                  ))}
                </ul>
            )}
          </Card>

          <Card
              title={t("admin.publishedTopicsNoApplications")}
              onMore={() => go(PATHS.topics, { status: "open" })}
          >
            {attention.openWithoutRequests.length === 0 ? (
                <EmptyRow text={t("admin.allPublishedHaveApplications")} />
            ) : (
                <ul className="divide-y divide-forest/10">
                  {attention.openWithoutRequests.map((t) => (
                      <li key={t.id}>
                        <button
                            onClick={() => go(PATHS.topics, { status: "open" })}
                            className="block w-full rounded-lg px-1 py-3 text-start transition hover:bg-forest/3"
                        >
                          <p className="truncate text-sm font-medium text-forest">
                            {t.title}
                          </p>
                          <p className="text-xs text-clay">{t.specialization.name}</p>
                        </button>
                      </li>
                  ))}
                </ul>
            )}
          </Card>
        </div>

        {/* pending proposals + system health */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card
              title={t("admin.latestPendingProposals")}
              className="lg:col-span-8"
              onMore={() => go(PATHS.topics, { status: "pending" })}
          >
            {pendingProposals.length === 0 ? (
                <EmptyRow text={t("admin.noPendingProposals")} />
            ) : (
                <ul className="divide-y divide-forest/10">
                  {pendingProposals.map((p) => (
                      <li key={p.id}>
                        <button
                            onClick={() => go(PATHS.topics, { status: "pending" })}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-start transition hover:bg-forest/3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest">
                              {p.title}
                            </p>
                            <p className="text-xs text-clay">
                              {fullName(p.professor.user)} · {p.specialization.name}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-clay" dir="ltr">
                      {arDate(p.createdAt)}
                    </span>
                        </button>
                      </li>
                  ))}
                </ul>
            )}
          </Card>

          <Card title={t("admin.systemHealth")} className="lg:col-span-4">
            <div className="space-y-3">
              <HealthRow
                  label={t("admin.totalAccounts")}
                  value={systemHealth.totalAccounts}
                  color="#26423D"
              />
              <HealthRow
                  label={t("admin.activeFem")}
                  value={systemHealth.activeUsers}
                  color="#10b981"
              />
              <HealthRow
                  label={t("admin.suspendedFem")}
                  value={systemHealth.suspendedUsers}
                  color="#ef4444"
                  onClick={() => go(PATHS.students)}
              />
            </div>
          </Card>
        </div>
      </div>
  );
}

function HealthRow({
                     label,
                     value,
                     color,
                     onClick,
                   }: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}) {
  const Cmp: React.ElementType = onClick ? "button" : "div";
  return (
      <Cmp
          onClick={onClick}
          className={`flex w-full items-center justify-between ${onClick ? "cursor-pointer rounded-lg px-1 py-0.5 hover:bg-forest/5" : ""}`}
      >
        <div className="flex items-center gap-2">
        <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: color }}
        />
          <span className="text-sm text-clay">{label}</span>
        </div>
        <span className="font-serif text-lg font-bold" style={{ color }}>
        {value}
      </span>
      </Cmp>
  );
}