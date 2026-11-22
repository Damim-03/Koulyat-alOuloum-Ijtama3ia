import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, PencilLine, ScrollText, ShieldAlert, Users, Activity, type LucideIcon } from "lucide-react";
import type { AuditArea, AuditLogEntry, AuditLogKind, AuditRole, AuditVerb } from "../../../../types/admin";
import { useAuditLogs, useAuditSummary } from "../../hooks/admin-hook";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { AuditRow, CARD, type AuditFilterPatch } from "./audit-row";
import { AuditDisplay, AuditFilters } from "./audit-filters";
import { day, KINDS, PAGE_SIZES } from "./audit-catalog";

/**
 * The audit log: every change made on the platform — by the administration,
 * by professors, by students, by anyone in their own account — and every
 * sign-in and event that touches the safety of an account, newest first,
 * by day. Nothing on this page edits or deletes a row. Rows are kept for
 * good, except refused sign-ins and the sign-ins of students and professors:
 * the server deletes those after a while.
 */

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

/** The rows of a page, by the day they were written, in the order they came. */
function byDay(items: AuditLogEntry[]) {
  const days: { key: string; items: AuditLogEntry[] }[] = [];
  for (const e of items) {
    const key = dayOf(e.createdAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(e);
    else days.push({ key, items: [e] });
  }
  return days;
}

export function AdminAuditLogPage() {
  const { t, i18n } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) || undefined;
  const kind = (KINDS.some((k) => k.kind === sp.get("kind")) ? sp.get("kind") : "all") as AuditLogKind;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.get("per"))) ? Number(sp.get("per")) : 25;

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setSp(next, { replace: true });
  };

  /** A way in from a row: this person, this item, this address. */
  const narrow = (patch: AuditFilterPatch) => {
    set(patch);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const q = useAuditLogs({
    page,
    limit,
    kind,
    search: get("q"),
    area: get("area") as AuditArea | undefined,
    role: get("role") as AuditRole | undefined,
    verb: get("verb") as AuditVerb | undefined,
    action: get("op"),
    actorId: get("actor"),
    targetType: get("tt"),
    targetId: get("tid"),
    ip: get("ip"),
    country: get("country"),
    from: get("from"),
    to: get("to"),
    order: sp.get("order") === "asc" ? "asc" : undefined,
  });
  const summary = useAuditSummary();
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const today = day();
  const yesterday = day(-1);
  const longDay = new Intl.DateTimeFormat(i18n.language || "ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dayTitle = (key: string, sample: string) => {
    const date = longDay.format(new Date(sample));
    if (key === today) return `${t("admin.audit.day.today")} · ${date}`;
    if (key === yesterday) return `${t("admin.audit.day.yesterday")} · ${date}`;
    return date;
  };

  const stats: { key: keyof NonNullable<typeof summary.data>; icon: LucideIcon; tone: string }[] = [
    { key: "total", icon: Activity, tone: "text-forest" },
    { key: "changes", icon: PencilLine, tone: "text-sky-700 dark:text-sky-300" },
    { key: "failed", icon: ShieldAlert, tone: "text-rose-600 dark:text-rose-300" },
    { key: "people", icon: Users, tone: "text-gold" },
  ];

  return (
    <div className="font-body" data-testid="audit-log-page">
      <header className={`${CARD} relative mb-5 overflow-hidden p-6`}>
        <div className="pointer-events-none absolute -top-16 -start-10 size-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-forest to-forest-deep text-gold-soft shadow-[0_10px_24px_-12px_rgba(22,36,31,0.8)]">
            <ScrollText size={24} />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="font-serif text-[22px] font-bold text-forest">{t("admin.audit.title")}</h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-clay">{t("admin.audit.subtitle")}</p>
          </div>
          <span className="rounded-full bg-gold/15 px-3 py-1 text-[12px] font-bold text-forest">{t("admin.audit.count", { count: total })}</span>
        </div>
        {summary.data && (
          <div className="relative mt-5" data-testid="audit-summary">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-clay uppercase">{t("admin.audit.last24")}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map(({ key, icon: Icon, tone }) => (
                <div key={key} className="rounded-2xl border border-forest/8 bg-cream-2/70 px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11.5px] text-clay">
                    <Icon size={13} className={tone} />
                    {t(`admin.audit.stat.${key}`)}
                  </dt>
                  <dd className={`mt-0.5 font-serif text-[22px] font-bold tabular-nums ${tone}`}>{summary.data[key].toLocaleString(i18n.language)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </header>

      <AuditFilters sp={sp} set={set} />
      <AuditDisplay sp={sp} set={set} page={page} limit={limit} total={total} />

      {q.isLoading ? (
        <LoadingArea className="py-20" />
      ) : q.isError ? (
        <ErrorRetry onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <div className={`${CARD} py-16 text-center text-[13px] text-clay`}>{t("admin.audit.empty")}</div>
      ) : (
        <div className={`space-y-6 transition-opacity ${q.isFetching ? "opacity-70" : ""}`}>
          {byDay(q.data.items).map((d) => (
            <section key={d.key} aria-label={dayTitle(d.key, d.items[0]!.createdAt)} data-testid="audit-day">
              <h2 className="mb-2.5 flex items-center gap-3 px-1 text-[12.5px] font-bold text-forest">
                <span>{dayTitle(d.key, d.items[0]!.createdAt)}</span>
                <span className="h-px flex-1 bg-forest/10" />
                <span className="text-[11.5px] font-semibold text-clay">{t("admin.audit.dayCount", { count: d.items.length })}</span>
              </h2>
              <ol className="space-y-2.5">
                {d.items.map((e) => (
                  <AuditRow key={e.id} e={e} onFilter={narrow} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3 text-[12.5px]" aria-label={t("admin.audit.pages")}>
          <button type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label={t("admin.proj.prev")} className="grid size-9 place-items-center rounded-xl border border-forest/12 bg-cream-card text-forest disabled:opacity-40">
            <ChevronRight size={16} className="ltr:rotate-180" />
          </button>
          <span className="text-clay">{t("admin.audit.pageOf", { page, pages })}</span>
          <button type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} aria-label={t("admin.proj.next")} className="grid size-9 place-items-center rounded-xl border border-forest/12 bg-cream-card text-forest disabled:opacity-40">
            <ChevronLeft size={16} className="ltr:rotate-180" />
          </button>
        </nav>
      )}

      {/* DB-IP's licence (CC BY 4.0): where the places are shown, it is said whose they are. */}
      <p className="mt-6 text-center text-[11px] text-clay/80">
        {t("admin.audit.geoCredit")}{" "}
        <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="font-semibold underline-offset-2 hover:underline">
          {t("admin.audit.geoCreditBy")}
        </a>
      </p>
    </div>
  );
}
