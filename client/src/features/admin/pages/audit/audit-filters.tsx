import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownUp,
  ArrowLeft,
  CalendarDays,
  Globe,
  Layers,
  MapPin,
  PencilLine,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AuditLogKind } from "../../../../types/admin";
import { Select, type SelectOption } from "../../../../components/ui/select";
import { useAuditActors, useAuditCountries } from "../../hooks/admin-hook";
import { ADVANCED, AREAS, countryName, day, KINDS, opTitle, operationOptions, PAGE_SIZES } from "./audit-catalog";
import { CARD } from "./audit-row";

/**
 * The audit log's filters, all of them kept in the address (so a view can be
 * sent, and survives a reload), each in its place:
 *
 * 1. the four kinds, as tabs — and the fold of the advanced filters;
 * 2. a search, and a period: today, a week, a month a click away, or any two days;
 * 3. folded, the advanced filters in three groups — who (role, person),
 *    what (area, operation, kind of act), where from (country, address);
 * 4. every filter that applies, as a chip that removes it — one item's
 *    history too, which is set from a row rather than here.
 *
 * How the results are shown (order, page size) is not a filter: it sits
 * above the results (`AuditDisplay`).
 */

const INPUT =
  "h-11 w-full rounded-xl border border-forest/12 bg-cream-2 px-3 text-[13px] text-forest outline-none transition focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15";
/** A day inside the period box: no frame of its own. */
const DATE = "min-w-0 flex-1 bg-transparent text-[12.5px] text-forest outline-none sm:w-[8.5rem] sm:flex-none";

export function AuditFilters({
  sp,
  set,
}: {
  sp: URLSearchParams;
  set: (patch: Record<string, string | null>) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "ar";
  const get = (k: string) => sp.get(k) ?? "";
  const kind = (KINDS.some((k) => k.kind === get("kind")) ? get("kind") : "all") as AuditLogKind;
  const advancedSet = ADVANCED.filter((k) => get(k)).length;
  const [open, setOpen] = useState(advancedSet > 0);
  // One more set from a row (this person, this address): the fold opens on it.
  const [seen, setSeen] = useState(advancedSet);
  if (seen !== advancedSet) {
    setSeen(advancedSet);
    if (advancedSet > seen) setOpen(true);
  }
  const [search, setSearch] = useState(get("q"));
  const [ip, setIp] = useState(get("ip"));
  const from = get("from");
  const to = get("to");

  // What the boxes last wrote into the address: its echo is not written back.
  const typed = useRef({ q: get("q"), ip: get("ip") });

  // Typing settles for a moment before it is looked up — both boxes in one change of the address.
  useEffect(() => {
    const id = setTimeout(() => {
      const patch: Record<string, string | null> = {};
      if (get("q") !== search.trim()) patch.q = search.trim() || null;
      if (get("ip") !== ip.trim()) patch.ip = ip.trim() || null;
      typed.current = { q: search.trim(), ip: ip.trim() };
      if (Object.keys(patch).length) set(patch);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, ip]);

  // A filter set from a row (an address) or removed by its chip shows in its
  // box. Only then: what the box wrote itself is not written back into it, or
  // the space just typed between two words would be trimmed away.
  const urlQ = get("q");
  const urlIp = get("ip");
  useEffect(() => {
    if (urlQ !== typed.current.q) {
      typed.current.q = urlQ;
      setSearch(urlQ);
    }
  }, [urlQ]);
  useEffect(() => {
    if (urlIp !== typed.current.ip) {
      typed.current.ip = urlIp;
      setIp(urlIp);
    }
  }, [urlIp]);

  const actors = useAuditActors();
  const actorOptions = useMemo<SelectOption[]>(() => {
    const list = (actors.data ?? []).map((a) => ({
      value: a.id,
      label: a.label ?? a.id,
      hint: a.role ? t(`admin.audit.role.${a.role}`, { defaultValue: a.role }) : undefined,
      count: a.count,
    }));
    const current = sp.get("actor");
    if (current && !list.some((a) => a.value === current)) list.unshift({ value: current, label: sp.get("who") || current, hint: undefined, count: 0 });
    return [{ value: "", label: t("admin.audit.filters.anyActor") }, ...list];
  }, [actors.data, sp, t]);

  const countries = useAuditCountries();
  const countryOptions = useMemo<SelectOption[]>(() => {
    const list = (countries.data ?? []).map((c) => ({ value: c.country, label: countryName(lang, c.country), count: c.count }));
    const current = sp.get("country");
    if (current && !list.some((c) => c.value === current)) list.unshift({ value: current, label: countryName(lang, current), count: 0 });
    return [{ value: "", label: t("admin.audit.filters.anyCountry") }, ...list];
  }, [countries.data, sp, lang, t]);

  const preset = (fromDay: string, toDay: string) => set({ from: fromDay, to: toDay });
  const dateOf = (d: string) => new Date(`${d}T12:00:00`);
  const dates = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  const period =
    from && to
      ? from === to && to === day()
        ? t("admin.audit.filters.today")
        : from === to
          ? dates.format(dateOf(from))
          : dates.formatRange(dateOf(from), dateOf(to))
      : from
        ? t("admin.audit.filters.since", { date: dates.format(dateOf(from)) })
        : to
          ? t("admin.audit.filters.until", { date: dates.format(dateOf(to)) })
          : "";
  const presets = [
    { key: "today", from: day(), to: day() },
    { key: "week", from: day(-6), to: day() },
    { key: "month", from: day(-29), to: day() },
  ];

  // Every filter that applies, as a chip that removes it.
  const chips: { key: string; label: string; icon: LucideIcon; clear: Record<string, null> }[] = [];
  if (get("q")) chips.push({ key: "q", label: `«${get("q")}»`, icon: Search, clear: { q: null } });
  if (get("area")) chips.push({ key: "area", label: t(`admin.audit.area.${get("area")}`), icon: Layers, clear: { area: null } });
  if (get("role")) chips.push({ key: "role", label: t(`admin.audit.role.${get("role")}`), icon: Users, clear: { role: null } });
  if (get("actor")) {
    const name = actorOptions.find((a) => a.value === get("actor"))?.label ?? get("who");
    chips.push({ key: "actor", label: name || get("actor"), icon: UserRound, clear: { actor: null, who: null } });
  }
  if (get("op")) chips.push({ key: "op", label: opTitle(t, get("op")), icon: Sparkles, clear: { op: null } });
  if (get("verb")) chips.push({ key: "verb", label: t(`admin.audit.verbs.${get("verb")}`), icon: PencilLine, clear: { verb: null } });
  if (get("tid"))
    chips.push({ key: "target", label: t("admin.audit.filters.target", { name: get("tname") || get("tid") }), icon: Target, clear: { tt: null, tid: null, tname: null } });
  if (get("ip")) chips.push({ key: "ip", label: t("admin.audit.filters.ipChip", { ip: get("ip") }), icon: Globe, clear: { ip: null } });
  if (get("country")) chips.push({ key: "country", label: countryName(lang, get("country")), icon: MapPin, clear: { country: null } });
  if (period) chips.push({ key: "dates", label: period, icon: CalendarDays, clear: { from: null, to: null } });
  // The filters, not how the results are shown.
  const clearAll = () =>
    set(Object.fromEntries(["q", "area", "role", "actor", "who", "op", "verb", "tt", "tid", "tname", "ip", "country", "from", "to", "kind"].map((k) => [k, null])));

  return (
    <div className={`${CARD} mb-4 overflow-hidden`} data-testid="audit-filters">
      {/* 1. The kinds, and the fold. */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
          <div className="inline-flex gap-1 rounded-2xl bg-forest/5 p-1">
            {KINDS.map(({ kind: k, icon: Icon }) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === kind}
                onClick={() => set({ kind: k === "all" ? null : k })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition ${
                  k === kind ? "bg-forest text-cream shadow-sm" : "text-forest/80 hover:bg-forest/8 hover:text-forest"
                }`}
              >
                <Icon size={14} />
                {t(`admin.audit.kind.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-semibold transition ${
            open || advancedSet ? "border-gold/50 bg-gold/10 text-forest" : "border-forest/12 text-forest hover:bg-forest/5"
          }`}
        >
          <SlidersHorizontal size={14} />
          {t("admin.audit.filters.advanced")}
          {advancedSet > 0 && <span className="grid size-5 place-items-center rounded-full bg-gold text-[10.5px] font-bold text-forest-deep">{advancedSet}</span>}
        </button>
      </div>

      {/* 2. A search, and a period. */}
      <div className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("admin.audit.search")}</span>
          <Search size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-clay" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.audit.search")} className={`${INPUT} pe-9`} />
        </label>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("admin.audit.filters.dates")}>
          <div className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-xl bg-forest/5 p-1">
            {presets.map((p) => {
              const on = from === p.from && to === p.to;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => preset(p.from, p.to)}
                  aria-pressed={on}
                  className={`h-9 rounded-lg px-3 text-[12px] font-semibold transition ${on ? "bg-forest text-cream shadow-sm" : "text-forest/80 hover:bg-forest/8 hover:text-forest"}`}
                >
                  {t(`admin.audit.filters.${p.key}`)}
                </button>
              );
            })}
          </div>
          {/* On a phone, a line of its own: the two days share it. */}
          <div className="flex h-11 min-w-0 flex-1 basis-full items-center gap-1.5 rounded-xl border border-forest/12 bg-cream-2 px-2.5 transition focus-within:border-gold focus-within:ring-4 focus-within:ring-gold/15 sm:flex-none sm:basis-auto">
            <CalendarDays size={15} className="shrink-0 text-clay" />
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => set({ from: e.target.value || null })}
              aria-label={t("admin.audit.from")}
              className={DATE}
            />
            <ArrowLeft size={14} className="shrink-0 text-clay ltr:rotate-180" />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => set({ to: e.target.value || null })}
              aria-label={t("admin.audit.to")}
              className={DATE}
            />
          </div>
        </div>
      </div>

      {/* 3. The advanced filters: who, what, where from. */}
      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-forest/8 bg-forest/[0.02] p-4 md:grid-cols-2 xl:grid-cols-[1fr_1.35fr_1fr]" data-testid="audit-advanced">
          <Group icon={UserRound} title={t("admin.audit.filters.groupWho")}>
            <Field label={t("admin.audit.filters.role")}>
              <Select
                filter
                icon={Users}
                aria-label={t("admin.audit.filters.role")}
                value={get("role")}
                onChange={(v) => set({ role: v || null })}
                options={[
                  { value: "", label: t("admin.audit.filters.anyRole") },
                  ...["admin", "professor", "student", "none"].map((r) => ({ value: r, label: t(`admin.audit.role.${r}`) })),
                ]}
              />
            </Field>
            <Field label={t("admin.audit.filters.actor")}>
              <Select
                filter
                icon={UserRound}
                aria-label={t("admin.audit.filters.actor")}
                value={get("actor")}
                onChange={(v) => set({ actor: v || null, who: v ? (actorOptions.find((a) => a.value === v)?.label ?? null) : null })}
                options={actorOptions}
              />
            </Field>
          </Group>

          <Group icon={Sparkles} title={t("admin.audit.filters.groupWhat")}>
            <Field label={t("admin.audit.filters.op")}>
              <Select
                filter
                icon={Sparkles}
                aria-label={t("admin.audit.filters.op")}
                value={get("op")}
                onChange={(v) => set({ op: v || null })}
                options={[{ value: "", label: t("admin.audit.filters.anyOp") }, ...operationOptions(t)]}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("admin.audit.filters.area")}>
                <Select
                  filter
                  icon={Layers}
                  aria-label={t("admin.audit.filters.area")}
                  value={get("area")}
                  onChange={(v) => set({ area: v || null })}
                  options={[{ value: "", label: t("admin.audit.filters.anyArea") }, ...AREAS.map((a) => ({ value: a, label: t(`admin.audit.area.${a}`) }))]}
                />
              </Field>
              <Field label={t("admin.audit.filters.verb")}>
                <Select
                  filter
                  icon={PencilLine}
                  aria-label={t("admin.audit.filters.verb")}
                  value={get("verb")}
                  onChange={(v) => set({ verb: v || null })}
                  options={[
                    { value: "", label: t("admin.audit.filters.anyVerb") },
                    ...["create", "update", "delete"].map((v) => ({ value: v, label: t(`admin.audit.verbs.${v}`) })),
                  ]}
                />
              </Field>
            </div>
          </Group>

          <Group icon={MapPin} title={t("admin.audit.filters.groupWhere")}>
            <Field label={t("admin.audit.filters.country")}>
              <Select
                filter
                icon={MapPin}
                aria-label={t("admin.audit.filters.country")}
                value={get("country")}
                onChange={(v) => set({ country: v || null })}
                options={countryOptions}
              />
            </Field>
            <Field label={t("admin.audit.filters.ip")}>
              <label className="relative block">
                {/* An address reads left to right in any language: the box, its icon and its room for it all on the left. */}
                <Globe size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-clay" />
                <input
                  dir="ltr"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder={t("admin.audit.filters.ipPlaceholder")}
                  aria-label={t("admin.audit.filters.ip")}
                  className={`${INPUT} pl-9 text-left`}
                />
              </label>
            </Field>
          </Group>
        </div>
      )}

      {/* 4. What applies. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-forest/8 px-4 py-3" aria-label={t("admin.audit.filters.active")} data-testid="audit-chips">
          <span className="text-[11.5px] font-semibold text-clay">{t("admin.audit.filters.active")}:</span>
          {chips.map((c) => (
            <span key={c.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 py-1 ps-2.5 pe-1 text-[12px] font-semibold text-forest">
              <c.icon size={12} className="shrink-0 text-gold" />
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                onClick={() => set(c.clear)}
                aria-label={`${t("admin.audit.filters.remove")}: ${c.label}`}
                className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-gold/25"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearAll} className="ms-auto inline-flex items-center gap-1 text-[12px] font-semibold text-clay hover:text-forest">
            <X size={13} />
            {t("admin.audit.filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * How the results are shown — which ones, in what order, how many to a page:
 * above the results, not among the filters.
 */
export function AuditDisplay({
  sp,
  set,
  page,
  limit,
  total,
}: {
  sp: URLSearchParams;
  set: (patch: Record<string, string | null>) => void;
  page: number;
  limit: number;
  total: number;
}) {
  const { t } = useTranslation();
  const first = total ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, total);
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1" data-testid="audit-display">
      <p className="text-[12.5px] text-clay">
        <bdi>{t("admin.audit.range", { first, last, total })}</bdi>
      </p>
      <div className="flex items-center gap-2">
        <Select
          className="w-44"
          icon={ArrowDownUp}
          aria-label={t("admin.audit.filters.order")}
          value={sp.get("order") || "desc"}
          onChange={(v) => set({ order: v === "desc" ? null : v })}
          options={[
            { value: "desc", label: t("admin.audit.filters.newest") },
            { value: "asc", label: t("admin.audit.filters.oldest") },
          ]}
        />
        <Select
          className="w-28"
          icon={Rows3}
          aria-label={t("admin.audit.filters.perPage")}
          value={sp.get("per") || "25"}
          onChange={(v) => set({ per: v === "25" ? null : v })}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
        />
      </div>
    </div>
  );
}

function Group({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-forest/8 bg-cream-card p-3.5">
      <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-forest">
        <span className="grid size-6 place-items-center rounded-lg bg-gold/12 text-gold">
          <Icon size={13} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11.5px] font-semibold text-clay">{label}</span>
      {children}
    </div>
  );
}
