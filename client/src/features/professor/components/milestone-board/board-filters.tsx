import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownUp,
  BookOpenText,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  DoorOpen,
  Gauge,
  IdCard,
  Layers,
  Milestone,
  Paperclip,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  TextSearch,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Select } from "../../../../components/ui/select";
import {
  BANDS,
  DEFAULT_FILTERS,
  DEFENSES,
  FIELD_KEYS,
  FILES,
  SORTS,
  panelCount,
  type BoardFilters,
  type Facet,
  type FieldKey,
  type facets as facetsOf,
} from "../../lib/milestone-board";

type Facets = ReturnType<typeof facetsOf>;

const FIELD_ICON: Record<FieldKey, LucideIcon> = {
  title: BookOpenText,
  student: UserRound,
  registration: IdCard,
  milestone: Milestone,
  room: DoorOpen,
};

const CARD = "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

/**
 * البحث والترتيب في سطر، وتحته لوحةٌ تُطوى (ويُذكر طيّها): بحثٌ مفصّل —
 * حقلٌ لكلّ نوع — ثمّ الفلاتر. وما طُبّق شاراتٌ تُزال واحدةً واحدة أو معاً.
 *
 * كلّ خيارٍ بعدد ما يبقى إن اختير مع بقيّة الفلاتر، فلا يُختار ما يُفرغ
 * القائمة على غير علم.
 */
export function BoardFilterBar({
  filters,
  facets,
  open,
  onOpen,
  onChange,
  onReset,
}: {
  filters: BoardFilters;
  facets: Facets;
  open: boolean;
  onOpen: (open: boolean) => void;
  onChange: (patch: Partial<BoardFilters>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const tm = (k: string, o?: Record<string, unknown>) => t(`pro.ms.${k}`, o);
  const panelId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const inPanel = panelCount(filters);

  // «/» يأخذ إلى البحث من أيّ مكان، ما لم يكن التركيز في حقل.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const any = { value: "", label: tm("any") };
  const withCount = (list: Facet[], label: (f: Facet) => string) =>
    list.map((f) => ({ value: f.value, label: label(f), count: f.count }));

  // ما طُبّق — شارةٌ لكلّ فلتر، باسمه وقيمته.
  const find = (list: Facet[], v: string) => list.find((f) => f.value === v)?.label ?? v;
  const chips: { key: keyof BoardFilters; label: string; value: string }[] = [];
  if (filters.q.trim()) chips.push({ key: "q", label: tm("searchChip"), value: filters.q.trim() });
  for (const k of FIELD_KEYS) if (filters[k].trim()) chips.push({ key: k, label: tm(`field.${k}`), value: filters[k].trim() });
  if (filters.health !== "all") chips.push({ key: "health", label: tm("healthChip"), value: tm(`health.${filters.health}`) });
  if (filters.year) chips.push({ key: "year", label: tm("year"), value: find(facets.years, filters.year) });
  if (filters.spec) chips.push({ key: "spec", label: tm("spec"), value: find(facets.specs, filters.spec) });
  if (filters.status) chips.push({ key: "status", label: tm("topicStatus"), value: t(`status.${filters.status}`, { defaultValue: filters.status }) });
  if (filters.defense) chips.push({ key: "defense", label: tm("defense"), value: tm(`defenseOf.${filters.defense}`) });
  if (filters.files) chips.push({ key: "files", label: tm("files"), value: tm(`filesOf.${filters.files}`) });
  if (filters.band) chips.push({ key: "band", label: tm("band"), value: tm(`bandOf.${filters.band}`) });
  if (filters.size) chips.push({ key: "size", label: tm("size"), value: tm("students", { count: Number(filters.size) }) });

  return (
    <section className={CARD} aria-label={t("pro.filters")} data-testid="board-filters">
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={19} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-clay" />
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape" && filters.q) {
                e.preventDefault();
                onChange({ q: "" });
              }
            }}
            placeholder={tm("search")}
            aria-label={tm("searchLabel")}
            data-testid="board-search"
            className="w-full rounded-2xl border border-forest/15 bg-cream-2 py-3.5 ps-12 pe-14 text-sm text-forest outline-none transition placeholder:text-clay/80 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute inset-y-0 end-3 flex items-center">
            {filters.q ? (
              <button
                type="button"
                onClick={() => {
                  onChange({ q: "" });
                  searchRef.current?.focus();
                }}
                aria-label={tm("clearSearch")}
                className="grid size-8 place-items-center rounded-xl text-clay transition hover:bg-forest/8 hover:text-forest"
              >
                <X size={16} />
              </button>
            ) : (
              <kbd
                title={tm("searchShortcut")}
                className="hidden rounded-lg border border-forest/15 bg-cream-card px-2 py-0.5 font-sans text-[11px] font-bold text-clay sm:inline-block"
              >
                /
              </kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            icon={ArrowDownUp}
            aria-label={tm("sort")}
            value={filters.sort}
            onChange={(v) => onChange({ sort: v as BoardFilters["sort"] })}
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            options={SORTS.map((s) => ({ value: s, label: tm(`sortOf.${s}`) }))}
          />
          <button
            type="button"
            onClick={() => onOpen(!open)}
            aria-expanded={open}
            aria-controls={panelId}
            title={open ? tm("hideFilters") : tm("showFilters")}
            data-testid="board-filters-toggle"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition active:scale-95 ${
              open || inPanel > 0
                ? "border-gold/50 bg-gold/10 text-forest"
                : "border-forest/15 text-forest hover:border-gold/40 hover:bg-gold/5"
            }`}
          >
            <SlidersHorizontal size={17} className="text-gold" />
            {t("pro.filters")}
            {inPanel > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-[var(--t-brand-deep)]">
                {inPanel}
              </span>
            )}
            <ChevronDown size={16} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* اللوحة تُطوى بارتفاعٍ متحرّك؛ ومطويّةً تخرج من ترتيب Tab ومن قارئ الشاشة */}
      <div id={panelId} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open} aria-hidden={!open || undefined} data-testid="board-panel">
          <div className="space-y-5 border-t border-forest/10 p-4 sm:p-5">
            <Heading icon={TextSearch} title={tm("detailed")} hint={tm("detailedHint")} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="board-fields">
              {FIELD_KEYS.map((k) => (
                <Field key={k} icon={FIELD_ICON[k]} label={tm(`field.${k}`)}>
                  <TextField
                    value={filters[k]}
                    onChange={(v) => onChange({ [k]: v })}
                    label={tm(`field.${k}`)}
                    placeholder={tm(`fieldHint.${k}`)}
                    clearLabel={tm("clearField", { name: tm(`field.${k}`) })}
                  />
                </Field>
              ))}
            </div>

            <div className="border-t border-dashed border-forest/12 pt-5">
              <Heading icon={SlidersHorizontal} title={t("pro.filters")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field icon={CalendarDays} label={tm("year")}>
                <Select
                  filter
                  aria-label={tm("year")}
                  value={filters.year}
                  onChange={(v) => onChange({ year: v })}
                  options={[{ value: "", label: tm("allYears") }, ...withCount(facets.years, (f) => f.label)]}
                />
              </Field>
              <Field icon={Layers} label={tm("spec")}>
                <Select
                  filter
                  aria-label={tm("spec")}
                  value={filters.spec}
                  onChange={(v) => onChange({ spec: v })}
                  options={[{ value: "", label: tm("allSpecs") }, ...withCount(facets.specs, (f) => f.label)]}
                />
              </Field>
              <Field icon={Tag} label={tm("topicStatus")}>
                <Select
                  filter
                  aria-label={tm("topicStatus")}
                  value={filters.status}
                  onChange={(v) => onChange({ status: v })}
                  options={[
                    { value: "", label: tm("allStatuses") },
                    ...withCount(facets.statuses, (f) => t(`status.${f.value}`, { defaultValue: f.value })),
                  ]}
                />
              </Field>
              <Field icon={CalendarCheck} label={tm("defense")}>
                <Select
                  filter
                  aria-label={tm("defense")}
                  value={filters.defense}
                  onChange={(v) => onChange({ defense: v as BoardFilters["defense"] })}
                  options={[
                    any,
                    ...DEFENSES.map((d) => ({
                      value: d,
                      label: tm(`defenseOf.${d}`),
                      count: facets.defense.find((f) => f.value === d)?.count ?? 0,
                    })),
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
              <Field icon={Paperclip} label={tm("files")}>
                <Chips
                  value={filters.files}
                  onChange={(v) => onChange({ files: v as BoardFilters["files"] })}
                  options={FILES.map((f) => ({ value: f, label: tm(`filesOf.${f}`), count: count(facets.files, f) }))}
                  anyLabel={tm("any")}
                  label={tm("files")}
                />
              </Field>
              <Field icon={Gauge} label={tm("band")}>
                <Chips
                  value={filters.band}
                  onChange={(v) => onChange({ band: v as BoardFilters["band"] })}
                  options={BANDS.map((b) => ({ value: b, label: tm(`bandOf.${b}`), count: count(facets.bands, b) }))}
                  anyLabel={tm("any")}
                  label={tm("band")}
                />
              </Field>
              {/* عددٌ واحدٌ للطلبة في كلّ المذكرات لا يُفرّق بين شيء — فلا يُعرض */}
              {(facets.sizes.length > 1 || filters.size) && (
                <Field icon={Users} label={tm("size")}>
                  <Chips
                    value={filters.size}
                    onChange={(v) => onChange({ size: v })}
                    options={facets.sizes.map((s) => ({ value: s.value, label: tm("students", { count: Number(s.value) }), count: s.count }))}
                    anyLabel={tm("any")}
                    label={tm("size")}
                  />
                </Field>
              )}
            </div>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div data-testid="board-active" className="flex flex-wrap items-center gap-2 border-t border-forest/10 px-4 py-3 sm:px-5">
          <span className="text-[11px] font-semibold text-clay">{tm("active")}</span>
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 py-1 ps-3 pe-1 text-xs text-forest"
            >
              <span className="shrink-0 text-clay">{c.label}:</span>
              <span className="max-w-48 truncate font-semibold">{c.value}</span>
              <button
                type="button"
                onClick={() => onChange({ [c.key]: DEFAULT_FILTERS[c.key] })}
                aria-label={tm("remove", { name: c.label })}
                className="grid size-5 shrink-0 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <RotateCcw size={13} />
            {tm("clearAll")}
          </button>
        </div>
      )}
    </section>
  );
}

const count = (list: Facet[], v: string) => list.find((f) => f.value === v)?.count ?? 0;

function Heading({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h3 className="flex items-center gap-2 text-[13px] font-bold text-forest">
        <span className="grid size-6 place-items-center rounded-lg bg-gold/12 text-gold">
          <Icon size={14} />
        </span>
        {title}
      </h3>
      {hint && <p className="text-[11px] text-clay">{hint}</p>}
    </div>
  );
}

/** حقلٌ من البحث المفصّل: Escape يمسحه، وكذا زرّه. */
function TextField({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const set = !!value.trim();
  return (
    <div className="relative">
      <Search size={15} className={`pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 ${set ? "text-gold" : "text-clay"}`} />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        className={`w-full rounded-xl border py-2.5 ps-9 pe-9 text-sm text-forest outline-none transition placeholder:text-clay/75 focus:border-gold focus:ring-2 focus:ring-gold/30 [&::-webkit-search-cancel-button]:hidden ${
          set ? "border-gold/60 bg-gold/10 font-semibold" : "border-forest/15 bg-cream-2 hover:border-gold/50"
        }`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label={clearLabel}
          className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-clay transition hover:bg-forest/8 hover:text-forest"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-clay">
        <Icon size={13} className="text-gold" />
        {label}
      </p>
      {children}
    </div>
  );
}

/** خياراتٌ قليلة تُرى كلّها: «الكل» ثمّ كلّ خيارٍ بعدده؛ والنقرة على المختار تلغيه. */
function Chips({
  value,
  options,
  onChange,
  anyLabel,
  label,
}: {
  value: string;
  options: { value: string; label: string; count: number }[];
  onChange: (v: string) => void;
  anyLabel: string;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      <Chip active={!value} onClick={() => onChange("")}>
        {anyLabel}
      </Chip>
      {options.map((o) => (
        <Chip key={o.value} active={value === o.value} count={o.count} onClick={() => onChange(value === o.value ? "" : o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, count, onClick, children }: { active: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
        active
          ? "border-gold bg-gold/15 text-forest shadow-[0_0_0_1px_rgba(193,150,90,0.35)]"
          : "border-forest/15 text-clay hover:border-gold/40 hover:text-forest"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? "bg-gold text-[var(--t-brand-deep)]" : "bg-forest/8 text-clay"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
