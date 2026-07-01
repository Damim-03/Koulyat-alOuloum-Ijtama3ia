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
import { useAdminDashboard } from "../hooks/admin-hook";
import type { TopicStatus, TrendValue } from "../../../types/admin";
import { useMe } from "../../auth/hooks/use-me";
import { PageLoader } from "../../../components/page-loader";

/* ── admin route paths (adjust here if yours differ) ───────── */
const PATHS = {
  topics: "admin/topics",
  groupRequests: "admin/group-requests",
  applications: "admin/applications",
  students: "admin/students",
  defenses: "admin/defenses",
  professors: "admin/professors",
};

const STATUS_META: Record<TopicStatus, { label: string; color: string }> = {
  pending: { label: "معلّق", color: "#C1965A" },
  approved: { label: "مقبول", color: "#26423D" },
  open: { label: "منشور", color: "#4A7066" },
  full: { label: "مكتمل", color: "#8EB29E" },
  rejected: { label: "مرفوض", color: "#b54a3f" },
  archived: { label: "مؤرشف", color: "#bcae97" },
};

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "معلّق", cls: "bg-amber-100 text-amber-700" },
  accepted: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
};

const fullName = (u: { firstName: string | null; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "\u2014";

const arDate = (iso: string) => new Date(iso).toLocaleDateString("ar");

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
  return (
    <div
      className={`rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-forest">{title}</h3>
          {onMore && (
            <button
              onClick={onMore}
              className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              عرض الكل
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function TrendBadge({ trend }: { trend: TrendValue }) {
  const up = trend.delta > 0;
  const down = trend.delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const cls = up ? "text-emerald-600" : down ? "text-red-500" : "text-clay";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold ${cls}`}
    >
      <Icon size={12} />
      {Math.abs(trend.delta)} هذا الشهر
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
      className={`flex flex-col items-center rounded-2xl border border-forest/10 bg-cream-card p-5 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition ${
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_8px_28px_rgba(38,66,61,0.12)]"
          : "cursor-default"
      }`}
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
  const present = data.filter((d) => d.count > 0);
  const total = present.reduce((a, d) => a + d.count, 0);
  const sum = total || 1;

  let offset = 0;
  const ring = present.map((d) => {
    const pct = (d.count / sum) * 100;
    const seg = { ...d, pct, dash: `${pct} ${100 - pct}`, dashoffset: -offset };
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
              className="cursor-pointer transition-[stroke-width] duration-150 hover:[stroke-width:4.5]"
              onClick={() => onSlice(s.status)}
            >
              <title>{`${STATUS_META[s.status].label}: ${s.count} (${Math.round(s.pct)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold text-forest">
            {total}
          </span>
          <span className="text-[10px] text-clay">إجمالي المواضيع</span>
        </div>
      </div>
      <div className="w-full space-y-1">
        {present.length === 0 && <EmptyRow text="لا توجد مواضيع بعد" />}
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
                {STATUS_META[s.status].label}
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
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <EmptyRow text="لا توجد بيانات بعد" />;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onItem?.(i.id)}
          disabled={!onItem}
          className={`group block w-full text-right ${onItem ? "cursor-pointer" : "cursor-default"}`}
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
    { key: "students" as const, label: "الطلبة", color: "#26423D" },
    { key: "topics" as const, label: "المواضيع", color: "#C1965A" },
    { key: "projects" as const, label: "المشاريع", color: "#8EB29E" },
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
        <p className="text-clay">تعذّر تحميل لوحة التحكّم.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-xl bg-forest px-5 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          إعادة المحاولة
        </button>
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
    <div className="font-body space-y-6">
      {/* greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest lg:text-3xl">
            لوحة التحكّم
          </h1>
          <p className="mt-1.5 text-sm text-clay">
            نظرة عامة على منصّة إدارة مذكّرات التخرّج
          </p>
        </div>
        {academicYear && (
          <span className="rounded-full bg-linear-to-l from-gold to-gold-soft px-4 py-1.5 text-sm font-bold text-forest-deep">
            السنة الجامعية: {academicYear.title}
          </span>
        )}
      </div>

      {/* primary tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="الطلبة"
          value={stats.students}
          icon={GraduationCap}
          tint="bg-soft-sage/30 text-forest"
          trend={trends.students}
          onClick={() => go(PATHS.students)}
        />
        <StatTile
          label="الأساتذة"
          value={stats.professors}
          icon={UserCog}
          tint="bg-gold/15 text-gold"
          onClick={() => go(PATHS.professors)}
        />
        <StatTile
          label="مواضيع منشورة"
          value={stats.openTopics}
          icon={FileText}
          tint="bg-sage/20 text-sage"
          trend={trends.topics}
          onClick={() => go(PATHS.topics, { status: "open" })}
        />
        <StatTile
          label="طلبات معلّقة"
          value={stats.pendingRequests}
          icon={ClipboardList}
          tint="bg-clay/15 text-clay"
          trend={trends.requests}
          onClick={() => go(PATHS.groupRequests, { status: "pending" })}
        />
        <StatTile
          label="مناقشات قادمة"
          value={stats.upcomingDefenses}
          icon={MessagesSquare}
          tint="bg-forest/10 text-forest"
          onClick={() => go(PATHS.defenses)}
        />
      </div>

      {/* secondary tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="مقترحات معلّقة"
          value={stats.pendingTopics}
          icon={FileText}
          tint="bg-amber-100 text-amber-600"
          onClick={() => go(PATHS.topics, { status: "pending" })}
        />
        <StatTile
          label="مواضيع مكتملة"
          value={stats.fullTopics}
          icon={CheckCircle2}
          tint="bg-emerald-100 text-emerald-600"
          onClick={() => go(PATHS.topics, { status: "full" })}
        />
        <StatTile
          label="طلبات فردية معلّقة"
          value={stats.pendingApplications}
          icon={ClipboardList}
          tint="bg-sky-100 text-sky-600"
          onClick={() => go(PATHS.applications, { status: "pending" })}
        />
        <StatTile
          label="طلبات فرق معلّقة"
          value={stats.pendingGroupRequests}
          icon={MessagesSquare}
          tint="bg-violet-100 text-violet-600"
          onClick={() => go(PATHS.groupRequests, { status: "pending" })}
        />
      </div>

      {/* growth + breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card title="النموّ خلال آخر 6 أشهر" className="lg:col-span-8">
          <GrowthChart data={monthlyGrowth} />
        </Card>
        <Card
          title="المواضيع حسب الحالة"
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
      <Card title="الطلبة حسب التخصّص (الأعلى)">
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
        <Card title="آخر طلبات الفرق" onMore={() => go(PATHS.groupRequests)}>
          {recentRequests.length === 0 ? (
            <EmptyRow text="لا توجد طلبات حديثة" />
          ) : (
            <ul className="divide-y divide-forest/10">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => go(PATHS.groupRequests, { id: r.id })}
                    className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-3 text-right transition hover:bg-forest/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {r.topic.title}
                      </p>
                      <p className="text-xs text-clay">
                        القائد: {fullName(r.leader.user)} · {r.members.length}{" "}
                        عضو
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${REQUEST_STATUS[r.status]?.cls ?? ""}`}
                    >
                      {REQUEST_STATUS[r.status]?.label ?? r.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="المناقشات القادمة" onMore={() => go(PATHS.defenses)}>
          {upcomingDefenses.length === 0 ? (
            <EmptyRow text="لا مناقشات مجدولة" />
          ) : (
            <ul className="divide-y divide-forest/10">
              {upcomingDefenses.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => go(PATHS.defenses)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-right transition hover:bg-forest/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {d.group.topic.title}
                      </p>
                      <p className="text-xs text-clay">القاعة: {d.room}</p>
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
          title="مقترحات بانتظار المراجعة منذ مدّة"
          onMore={() => go(PATHS.topics, { status: "pending" })}
        >
          {attention.staleProposals.length === 0 ? (
            <EmptyRow text="لا يوجد ما يحتاج انتباهك" />
          ) : (
            <ul className="divide-y divide-forest/10">
              {attention.staleProposals.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => go(PATHS.topics, { status: "pending" })}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-right transition hover:bg-forest/[0.03]"
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
          title="مواضيع منشورة بلا طلبات"
          onMore={() => go(PATHS.topics, { status: "open" })}
        >
          {attention.openWithoutRequests.length === 0 ? (
            <EmptyRow text="كل المواضيع المنشورة عليها طلبات" />
          ) : (
            <ul className="divide-y divide-forest/10">
              {attention.openWithoutRequests.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => go(PATHS.topics, { status: "open" })}
                    className="block w-full rounded-lg px-1 py-3 text-right transition hover:bg-forest/[0.03]"
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
          title="أحدث مقترحات الأساتذة المعلّقة"
          className="lg:col-span-8"
          onMore={() => go(PATHS.topics, { status: "pending" })}
        >
          {pendingProposals.length === 0 ? (
            <EmptyRow text="لا مقترحات معلّقة" />
          ) : (
            <ul className="divide-y divide-forest/10">
              {pendingProposals.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => go(PATHS.topics, { status: "pending" })}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-right transition hover:bg-forest/[0.03]"
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

        <Card title="صحّة النظام" className="lg:col-span-4">
          <div className="space-y-3">
            <HealthRow
              label="إجمالي الحسابات"
              value={systemHealth.totalAccounts}
              color="#26423D"
            />
            <HealthRow
              label="نشطة"
              value={systemHealth.activeUsers}
              color="#10b981"
            />
            <HealthRow
              label="موقوفة"
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
