import { useTranslation } from "react-i18next";
import { useAdminTopics } from "../../hooks/admin-hook";

const SEGMENTS: { status: string; color: string; labelKey: string }[] = [
  { status: "approved", color: "#26423D", labelKey: "status.approved" },
  { status: "pending", color: "#C1965A", labelKey: "status.pending" },
  { status: "open", color: "#4A7066", labelKey: "status.open" },
  { status: "rejected", color: "#b54a3f", labelKey: "status.rejected" },
  { status: "full", color: "#8EB29E", labelKey: "status.full" },
  { status: "archived", color: "#bcae97", labelKey: "status.archived" },
];

export function TopicsDonut() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminTopics({ limit: 100 });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const counts: Record<string, number> = {};
  for (const tpc of items) counts[tpc.status] = (counts[tpc.status] ?? 0) + 1;

  const present = SEGMENTS.filter((s) => (counts[s.status] ?? 0) > 0);
  const sum = present.reduce((acc, s) => acc + (counts[s.status] ?? 0), 0) || 1;

  let offset: number = 0;
  const ring = present.map((s) => {
    const pct = ((counts[s.status] ?? 0) / sum) * 100;
    const seg = { ...s, pct, dash: `${pct} ${100 - pct}`, dashoffset: -offset };
    offset += pct;
    return seg;
  });

  return (
    <div className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <h3 className="mb-6 font-serif text-lg font-bold text-forest">
        {t("admin.topicsByStatus")}
      </h3>

      <div className="flex flex-col items-center">
        <div className="relative mb-6 size-48">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f5edda" strokeWidth="3.5" />
            {ring.map((s) => (
              <circle
                key={s.status}
                cx="18" cy="18" r="15.915"
                fill="transparent"
                stroke={s.color}
                strokeWidth="3.5"
                strokeDasharray={s.dash}
                strokeDashoffset={s.dashoffset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-2xl font-bold text-forest">
              {isLoading ? "…" : total}
            </span>
            <span className="text-[10px] text-clay">{t("admin.totalTopics")}</span>
          </div>
        </div>

        <div className="w-full space-y-2.5">
          {present.length === 0 && !isLoading && (
            <p className="text-center text-sm text-clay">{t("admin.noTopics")}</p>
          )}
          {ring.map((s) => (
            <div key={s.status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-forest">{t(s.labelKey, { defaultValue: s.status })}</span>
              </div>
              <span className="text-xs font-bold text-forest">{Math.round(s.pct)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}