import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  FileText,
  Filter,
  Globe,
  History,
  MapPin,
  Monitor,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { AuditLogEntry } from "../../../../types/admin";
import { deviceOf } from "../../../../lib/user-agent";
import { ago, countryName, describe, fieldLabel, ipKind, placeOf, sessionLength, TONES } from "./audit-catalog";
import { AuditValue } from "./audit-values";

/**
 * One row of the audit log.
 *
 * Folded, it reads as a sentence: what was done, to what (by name), by whom,
 * from where, and at what time — and, for a change, which fields changed.
 * Unfolded, everything the row holds, each thing in its place: the fields
 * that changed, from what to what; what was created or deleted; the other
 * items the operation named; the counts it answered; then who, on what,
 * from where and when — each a way into the rest of the log (everything this
 * person did, this item's history, everything from this address). What was
 * sent, as sent, last and folded.
 */

export type AuditFilterPatch =
  | { actor: string; who: string }
  | { tt: string; tid: string; tname: string }
  | { ip: string }
  | { country: string };

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

/** What the platform reads itself, apart from an event's own facts. */
const KNOWN = new Set(["body", "file", "changes", "created", "deleted", "refs", "result", "value"]);
const SUMMARY_FIELDS = 3;

const isChange = (c: unknown): c is Change => !!c && typeof c === "object" && "field" in c;
const asObject = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length ? (v as Record<string, unknown>) : null;

export const CARD = "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]";

export function AuditRow({ e, onFilter }: { e: AuditLogEntry; onFilter: (patch: AuditFilterPatch) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const d = describe(t, e);
  const details = e.details ?? {};
  const all = Array.isArray(details.changes) ? (details.changes as unknown[]) : [];
  const changes = all.filter(isChange);
  const device = deviceOf(e.userAgent);
  const time = new Intl.DateTimeFormat(i18n.language || "ar", { timeStyle: "short" }).format(new Date(e.createdAt));
  const shown = changes.slice(0, SUMMARY_FIELDS).map((c) => fieldLabel(t, c.field));
  const place = placeOf(i18n.language || "ar", e);

  return (
    <li className={`${CARD} overflow-hidden transition ${e.success ? "" : "border-rose-300/60 dark:border-rose-400/30"}`} data-testid="audit-row">
      <div className="flex items-start gap-3 p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[d.tone]}`}>
          <d.icon size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[14px] font-bold text-forest">{d.title}</p>
            {e.targetLabel && (
              <button
                type="button"
                onClick={() => e.targetType && e.targetId && onFilter({ tt: e.targetType, tid: e.targetId, tname: e.targetLabel! })}
                disabled={!e.targetType || !e.targetId}
                title={t("admin.audit.act.byTarget")}
                className="max-w-full truncate rounded-lg border border-gold/30 bg-gold/10 px-2 py-0.5 text-[12px] font-semibold text-forest transition enabled:hover:border-gold/60 enabled:hover:bg-gold/20"
              >
                {e.targetLabel}
              </button>
            )}
            {!e.success && (
              <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10.5px] font-bold text-rose-600 dark:text-rose-300">
                {t("admin.audit.failedBadge")}
              </span>
            )}
          </div>

          {changes.length > 0 && (
            <p className="mt-1 text-[12px] text-forest/75">
              {t("admin.audit.changedFields", { fields: shown.join(" · ") })}
              {changes.length > SUMMARY_FIELDS && (
                <span className="ms-1 rounded-full bg-forest/6 px-1.5 text-[11px] text-clay">
                  {t("admin.audit.more", { count: changes.length - SUMMARY_FIELDS })}
                </span>
              )}
            </p>
          )}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-clay">
            <span className="inline-flex items-center gap-1 font-semibold text-forest/85">
              <UserRound size={12} />
              {e.actorLabel ?? t("admin.audit.unknownActor")}
            </span>
            {e.actorRole && (
              <span className="rounded-full bg-forest/6 px-2 py-px text-[10.5px]">{t(`admin.audit.role.${e.actorRole}`, { defaultValue: e.actorRole })}</span>
            )}
            {e.ip && (
              <span className="inline-flex items-center gap-1">
                <Globe size={12} /> <bdi dir="ltr">{e.ip}</bdi>
              </span>
            )}
            {place && (
              <span className="inline-flex items-center gap-1" title={e.isp ?? undefined}>
                <MapPin size={12} /> {place}
              </span>
            )}
            {device && (
              <span className="inline-flex items-center gap-1">
                <Monitor size={12} /> {device}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <time dateTime={e.createdAt} className="text-[12px] font-semibold text-forest/80 tabular-nums">
            {time}
          </time>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={t("admin.audit.details")}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11.5px] font-semibold text-gold transition hover:bg-gold/10"
          >
            <span className="hidden sm:inline">{t("admin.audit.details")}</span>
            <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && <Details e={e} changes={changes} truncated={all.length - changes.length} onFilter={onFilter} device={device} />}
    </li>
  );
}

function Details({
  e,
  changes,
  truncated,
  onFilter,
  device,
}: {
  e: AuditLogEntry;
  changes: Change[];
  truncated: number;
  onFilter: (patch: AuditFilterPatch) => void;
  device: string | null;
}) {
  const { t, i18n } = useTranslation();
  const details = e.details ?? {};
  const created = asObject(details.created);
  const deleted = asObject(details.deleted);
  const refs = asObject(details.refs);
  const result = asObject(details.result);
  const file = asObject(details.file);
  // An event's own facts — and, for a sign-out, how long the session lasted.
  const lasted = sessionLength(t, details.startedAt, e.createdAt);
  const info = asObject({
    ...Object.fromEntries(Object.entries(details).filter(([k]) => !KNOWN.has(k))),
    ...(lasted ? { duration: lasted } : {}),
  });
  const where = ipKind(e.ip);
  const moment = new Intl.DateTimeFormat(i18n.language || "ar", { dateStyle: "full", timeStyle: "medium" }).format(new Date(e.createdAt));
  const sent = details.body ?? details.value;

  return (
    <div className="space-y-4 border-t border-forest/8 bg-forest/[0.02] px-4 py-4" data-testid="audit-details">
      {changes.length > 0 && (
        <Section icon={History} title={t("admin.audit.sec.changes")}>
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card" role="table">
            <div role="row" className="hidden grid-cols-[minmax(110px,200px)_1fr_1fr] gap-3 border-b border-forest/8 bg-forest/[0.03] px-3 py-2 text-[11px] font-bold text-clay sm:grid">
              <span role="columnheader">{t("admin.audit.col.field")}</span>
              <span role="columnheader">{t("admin.audit.col.before")}</span>
              <span role="columnheader">{t("admin.audit.col.after")}</span>
            </div>
            {changes.map((c) => (
              <div
                key={c.field}
                role="row"
                data-testid="audit-change"
                className="grid grid-cols-1 gap-1.5 border-b border-forest/6 px-3 py-2.5 text-[12.5px] last:border-0 sm:grid-cols-[minmax(110px,200px)_1fr_1fr] sm:gap-3"
              >
                <span role="cell" className="font-semibold text-forest">
                  {fieldLabel(t, c.field)}
                </span>
                <span role="cell" className="rounded-lg bg-rose-500/[0.07] px-2 py-1 text-forest/70">
                  <span className="sr-only">{t("admin.audit.col.before")}: </span>
                  <AuditValue field={c.field} value={c.from} />
                </span>
                <span role="cell" className="flex items-start gap-1.5 rounded-lg bg-emerald-500/[0.08] px-2 py-1 text-forest">
                  <ArrowLeft size={13} className="mt-0.5 shrink-0 text-emerald-600 sm:hidden ltr:rotate-180" />
                  <span className="sr-only">{t("admin.audit.col.after")}: </span>
                  <AuditValue field={c.field} value={c.to} />
                </span>
              </div>
            ))}
          </div>
          {truncated > 0 && <p className="mt-1.5 text-[11.5px] text-clay">{t("admin.audit.truncated", { count: truncated })}</p>}
        </Section>
      )}
      {details.changes !== undefined && !changes.length && truncated === 0 && (
        <p className="text-[12px] text-clay">{t("admin.audit.noChange")}</p>
      )}

      {created && <Facts icon={History} title={t("admin.audit.sec.created")} facts={created} tone="emerald" />}
      {deleted && <Facts icon={History} title={t("admin.audit.sec.deleted")} facts={deleted} tone="rose" />}
      {refs && <Facts icon={Target} title={t("admin.audit.sec.refs")} facts={refs} />}
      {result && <Facts icon={History} title={t("admin.audit.sec.result")} facts={result} />}
      {info && <Facts icon={History} title={t("admin.audit.sec.info")} facts={info} />}
      {file && (
        <Section icon={FileText} title={t("admin.audit.sec.file")}>
          <p className="text-[12.5px] text-forest">
            <bdi>{String(file.name ?? "")}</bdi>
            {typeof file.size === "number" && <span className="ms-2 text-clay">({Math.max(1, Math.round(file.size / 1024))} KB)</span>}
          </p>
        </Section>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 ${e.targetType ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <Meta icon={UserRound} title={t("admin.audit.sec.who")}>
          <p className="font-semibold text-forest">{e.actorLabel ?? t("admin.audit.unknownActor")}</p>
          <p className="text-clay">{e.actorRole ? t(`admin.audit.role.${e.actorRole}`, { defaultValue: e.actorRole }) : t("admin.audit.noActorId")}</p>
          {e.actorId && <CopyId id={e.actorId} />}
          {e.actorId && (
            <FilterLink onClick={() => onFilter({ actor: e.actorId!, who: e.actorLabel ?? e.actorId! })}>{t("admin.audit.act.byActor")}</FilterLink>
          )}
        </Meta>
        {/* A sign-in, a password changed: done to one's own account — no other item to name. */}
        {e.targetType && (
          <Meta icon={Target} title={t("admin.audit.sec.target")}>
            <p className="text-clay">{t(`admin.audit.res.${e.targetType}`, { defaultValue: e.targetType })}</p>
            <p className="font-semibold text-forest">{e.targetLabel ?? "—"}</p>
            {e.targetId && <CopyId id={e.targetId} />}
            {e.targetId && (
              <FilterLink onClick={() => onFilter({ tt: e.targetType!, tid: e.targetId!, tname: e.targetLabel ?? e.targetId! })}>
                {t("admin.audit.act.byTarget")}
              </FilterLink>
            )}
          </Meta>
        )}
        <Meta icon={Globe} title={t("admin.audit.sec.where")}>
          <p className="font-semibold text-forest">
            <bdi dir="ltr">{e.ip ?? "—"}</bdi>
            {where && <span className="ms-2 rounded-full bg-forest/6 px-2 py-px text-[10.5px] font-normal text-clay">{t(`admin.audit.ip.${where}`)}</span>}
          </p>
          {e.country && (
            <dl className="space-y-0.5 py-1">
              <Place label={t("admin.audit.field.country")} value={countryName(i18n.language || "ar", e.country)} />
              {e.region && <Place label={t("admin.audit.field.region")} value={e.region} />}
              {e.city && <Place label={t("admin.audit.field.city")} value={e.city} />}
            </dl>
          )}
          {e.isp && <Place label={t("admin.audit.field.isp")} value={e.isp} />}
          {device && <p className="text-clay">{device}</p>}
          {e.userAgent && (
            <p dir="ltr" className="line-clamp-2 text-start font-mono text-[10px] break-all text-clay/80" title={e.userAgent}>
              {e.userAgent}
            </p>
          )}
          {e.ip && <FilterLink onClick={() => onFilter({ ip: e.ip! })}>{t("admin.audit.act.byIp")}</FilterLink>}
          {e.country && <FilterLink onClick={() => onFilter({ country: e.country! })}>{t("admin.audit.act.byCountry")}</FilterLink>}
        </Meta>
        <Meta icon={Clock3} title={t("admin.audit.sec.when")}>
          <p className="font-semibold text-forest">{moment}</p>
          <p className="text-clay">{ago(i18n.language || "ar", e.createdAt)}</p>
          <p className="pt-1 text-clay">{t("admin.audit.sec.id")}</p>
          <CopyId id={e.id} />
        </Meta>
      </div>

      {sent !== undefined && sent !== null && (
        <details className="group rounded-2xl border border-forest/10 bg-cream-card">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-semibold text-clay select-none hover:text-forest">
            <ChevronDown size={13} className="me-1 inline transition group-open:rotate-180" />
            {t("admin.audit.sec.raw")}
          </summary>
          <pre dir="ltr" className="max-h-72 overflow-auto border-t border-forest/8 p-3 text-start font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-forest/85">
            {JSON.stringify(sent, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-forest">
        <Icon size={14} className="text-gold" />
        {title}
      </h3>
      {children}
    </section>
  );
}

const FACT_TONE = {
  emerald: "border-emerald-500/20 bg-emerald-500/[0.04]",
  rose: "border-rose-500/20 bg-rose-500/[0.04]",
  plain: "border-forest/10 bg-cream-card",
} as const;

/** A list of fields and their values: what was created, deleted, named, counted. */
function Facts({ icon, title, facts, tone = "plain" }: { icon: LucideIcon; title: string; facts: Record<string, unknown>; tone?: keyof typeof FACT_TONE }) {
  const { t } = useTranslation();
  return (
    <Section icon={icon} title={title}>
      <dl className={`grid gap-x-4 gap-y-2 rounded-2xl border p-3 text-[12.5px] sm:grid-cols-2 ${FACT_TONE[tone]}`}>
        {Object.entries(facts).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] text-clay">{fieldLabel(t, k)}</dt>
            <dd className="text-forest">
              <AuditValue field={k} value={v} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Meta({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 rounded-2xl border border-forest/10 bg-cream-card p-3 text-[12px]">
      <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-clay uppercase">
        <Icon size={13} className="text-gold" />
        {title}
      </p>
      {children}
    </div>
  );
}

function Place({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-1.5">
      <dt className="text-clay">{label}:</dt>
      <dd dir="auto" className="font-medium text-forest">
        {value}
      </dd>
    </div>
  );
}

function FilterLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-gold hover:text-gold-soft">
      <Filter size={12} />
      {children}
    </button>
  );
}

function CopyId({ id }: { id: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(
          () => setDone(true),
          () => undefined,
        );
      }}
      title={t("admin.audit.act.copy")}
      className="group flex max-w-full items-center gap-1 font-mono text-[10.5px] text-clay/80 hover:text-forest"
    >
      <bdi dir="ltr" className="truncate">
        {id}
      </bdi>
      {done ? <Check size={11} className="shrink-0 text-emerald-600" aria-label={t("admin.audit.act.copied")} /> : <Copy size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />}
    </button>
  );
}
