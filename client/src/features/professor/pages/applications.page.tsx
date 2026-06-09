import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Inbox } from "lucide-react";
import { useApplications, useAcceptApplication, useRejectApplication } from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";

const FILTERS = ["all", "pending", "accepted", "rejected"] as const;

export function ProfessorApplicationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const { data: apps, isLoading } = useApplications(
    filter === "all" ? undefined : { status: filter },
  );
  const accept = useAcceptApplication();
  const reject = useRejectApplication();

  return (
    <div>
      <h2 className="mb-4 font-serif text-2xl font-bold text-forest">{t("dash.applications")}</h2>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
              filter === f
                ? "bg-forest text-cream"
                : "bg-forest/5 text-forest hover:bg-forest/10"
            }`}
          >
            {f === "all" ? t("pro.all") : t(`status.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-forest/5" />)}</div>
      ) : !apps || apps.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-16 text-center">
          <Inbox size={36} className="mb-2 text-forest/30" />
          <p className="text-sm text-clay">{t("pro.noApplications")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((app) => {
            const name =
              [app.student?.user?.firstName, app.student?.user?.lastName].filter(Boolean).join(" ") ||
              app.student?.registrationNumber || app.studentId;
            const pending = app.status === "pending";
            return (
              <div key={app.id} className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-cream-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-forest">{name}</p>
                  <p className="truncate text-[11px] text-clay">
                    {app.topic?.title ? `${app.topic.title} · ` : ""}{t("pro.priority")}: {app.priority}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={app.status} />
                  {pending && (
                    <>
                      <button onClick={() => accept.mutate(app.id)} disabled={accept.isPending} className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title={t("pro.accept")}>
                        <Check size={15} />
                      </button>
                      <button onClick={() => reject.mutate(app.id)} disabled={reject.isPending} className="grid size-8 place-items-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200" title={t("pro.reject")}>
                        <X size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}