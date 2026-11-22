import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CameraOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FilterX,
  GraduationCap,
  Loader2,
  Search,
  SearchX,
  ShieldAlert,
  ShieldX,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Select } from "../../../../components/ui/select";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { otherScriptName, personName } from "../../../../lib/person-name";
import { readRegistration, typedByHand } from "../../../../lib/read-registration";
import { useAcademicYears, useSpecializations } from "../../hooks/admin-hook";
import { DESK_STATES, useDeskStudents, type DeskSettings, type DeskState, type DeskStudentRow } from "../../api/activation.api";
import { QrCamera } from "./qr-camera";

export interface FinderFilters {
  q: string;
  state: DeskState;
  specializationId: string;
  academicYearId: string;
  page: number;
}

const PAGE_SIZE = 10;
/** Whether the filter bar was left open or folded — this browser's choice. */
const OPEN_KEY = "admin.activation.filtersOpen";
/** Inputs that take no text: a key pressed on them belongs to the scan field. */
const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"]);

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Private window or blocked storage: it opens unfolded next time.
  }
}

/** Something else is taking the keyboard: a text field, a list being chosen from, a dialog. */
function takesText(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NOT_TEXT.has(target.type);
  return !!target.closest('[role="listbox"], [role="menu"], [role="dialog"]');
}

/**
 * أعلى «الطلبة والمكتب»: حقلٌ واحد للاسم — بأيّ ترتيبٍ للكلمات، عربياً أو
 * لاتينياً — ولرقم التسجيل ولرابط البطاقة، وكاميرا تمسحها؛ وتحته فلترٌ يُطوى:
 * حال الطالب في المنصّة، وتخصّصه، وسنته.
 *
 * **والحقل يستقبل القارئ دائماً.** قارئ QR لوحةُ مفاتيحٍ تكتب بسرعة: فإن
 * ضغط المكتب زرّاً قبل المسح ذهب التركيز عن الحقل، وضاع ما كتبه القارئ. فكلّ
 * حرفٍ يُكتب في الصفحة — خارج حقلٍ آخر أو قائمةٍ أو نافذة — يبدأ بحثاً جديداً
 * في هذا الحقل.
 *
 * **ورقم التسجيل يفتح صاحبه دون Enter.** بعد وقفةٍ قصيرة يُسأل الخادم عنه؛
 * فإن وُجد فُتح ملفّه، وإلّا بقي بحثاً في القائمة. ورابط البطاقة يصير رقمها.
 */
export function DeskFilterBar({
  filters,
  onFilters,
  counts,
  selectedId,
  onTyped,
  onScan,
}: {
  filters: FinderFilters;
  onFilters: (next: Partial<FinderFilters>) => void;
  counts?: DeskSettings["counts"];
  selectedId: string | null;
  /** A registration number (or a card's link): opens that student. False when the text holds none. */
  onTyped: (text: string) => boolean;
  onScan: (text: string) => void;
}) {
  const { t } = useTranslation();
  const bodyId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(filters.q);
  const [camera, setCamera] = useState(false);
  const [open, setOpen] = useState(readOpen);
  const [focused, setFocused] = useState(false);
  // The number already asked for: a second pause on it does not ask again.
  const asked = useRef(readRegistration(filters.q));
  const specs = useSpecializations().data as { id: string; name: string; level: string }[] | undefined;
  const years = useAcademicYears().data as { id: string; title: string }[] | undefined;
  const spec = specs?.find((s) => s.id === filters.specializationId);
  const year = years?.find((y) => y.id === filters.academicYearId);
  const active = Number(filters.state !== "all") + Number(!!filters.specializationId) + Number(!!filters.academicYearId);
  const filtered = active > 0 || !!filters.q;

  // The counts are over every student: shown only while nothing else narrows the list.
  const n = !filters.q && !filters.specializationId && !filters.academicYearId ? counts : undefined;
  const stateCount: Partial<Record<DeskState, number>> = n
    ? {
        all: n.students,
        notActivated: n.notActivated,
        activated: n.students - n.notActivated,
        verified: n.verified,
        unverified: n.students - n.verified,
        requested: n.pendingRequests,
        suspended: n.suspended,
      }
    : {};

  // After a pause: the list follows what was typed, and a registration number opens its student.
  const settle = useEffectEvent((text: string) => {
    const reg = readRegistration(text);
    const want = reg ?? text;
    if (want !== filters.q) onFilters({ q: want, page: 1 });
    if (!reg) {
      asked.current = null;
      return;
    }
    if (reg !== text && !typedByHand(text)) setTyped(reg);
    if (asked.current !== reg) {
      asked.current = reg;
      onTyped(text);
    }
  });
  useEffect(() => {
    const timer = setTimeout(() => settle(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  // A key pressed anywhere else on the page starts a new search here.
  const grab = useEffectEvent((e: KeyboardEvent) => {
    const el = input.current;
    if (!el || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key.length !== 1 || e.key === " " || e.target === el || takesText(e.target)) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    e.preventDefault();
    el.focus();
    setTyped(e.key);
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => grab(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // A student opened from the field: its text is selected, so the next card replaces it.
  useEffect(() => {
    const el = input.current;
    if (el && document.activeElement === el) el.select();
  }, [selectedId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    const reg = readRegistration(text);
    asked.current = reg;
    if (reg && reg !== text && !typedByHand(text)) setTyped(reg);
    if (!onTyped(text)) onFilters({ q: text, page: 1 });
  };

  const clearText = () => {
    setTyped("");
    asked.current = null;
    onFilters({ q: "", page: 1 });
    input.current?.focus();
  };

  const toggle = () => {
    setOpen(!open);
    saveOpen(!open);
  };

  return (
    <section
      className="relative overflow-clip rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]"
      data-testid="desk-filter"
    >
      <div className="pointer-events-none absolute -top-24 -end-10 size-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 start-1/4 size-56 rounded-full bg-forest/[0.04] blur-3xl" />

      <div className="relative flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        <form className="relative min-w-0 flex-1" onSubmit={submit}>
          <Search size={19} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
          <input
            ref={input}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={t("admin.activation.finder.placeholder")}
            aria-label={t("admin.activation.finder.placeholder")}
            data-testid="desk-input"
            className="h-14 w-full rounded-2xl border border-forest/15 bg-cream-2 ps-12 pe-24 text-[15px] text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15"
          />
          <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {typed && (
              <button
                type="button"
                onClick={clearText}
                aria-label={t("admin.activation.finder.clear")}
                className="grid size-10 place-items-center rounded-xl text-clay transition hover:bg-forest/5 hover:text-forest"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCamera((c) => !c)}
              aria-pressed={camera}
              title={t(camera ? "admin.activation.camera.stop" : "admin.activation.camera.start")}
              aria-label={t(camera ? "admin.activation.camera.stop" : "admin.activation.camera.start")}
              data-testid="desk-camera-toggle"
              className={`grid size-10 place-items-center rounded-xl transition ${camera ? "bg-forest text-gold-soft" : "bg-gold/12 text-gold hover:bg-gold/20"}`}
            >
              {camera ? <CameraOff size={17} /> : <Camera size={17} />}
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          data-testid="desk-filter-toggle"
          className={`inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border px-5 text-[13.5px] font-bold transition ${
            open
              ? "border-forest/15 bg-linear-to-l from-forest to-forest-soft text-cream shadow-[0_10px_24px_-14px_rgba(38,66,61,0.9)]"
              : "border-forest/12 bg-cream-2 text-forest hover:border-gold/40 hover:bg-gold/10"
          }`}
        >
          <SlidersHorizontal size={16} className={open ? "text-gold-soft" : "text-gold"} />
          {t("admin.activation.finder.filters")}
          {active > 0 && (
            <span
              aria-label={t("admin.activation.finder.activeFilters", { count: active })}
              className="grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold tabular-nums text-[#1a312d]"
            >
              {active}
            </span>
          )}
          <ChevronDown size={16} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="relative -mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-4 text-[11.5px] sm:px-5">
        <span
          data-testid="desk-listening"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ring-1 ring-inset ${
            focused ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" : "bg-gold/10 text-gold ring-gold/25"
          }`}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
          {t(focused ? "admin.activation.finder.ready" : "admin.activation.finder.listening")}
        </span>
        <span className="leading-relaxed text-clay">{t("admin.activation.finder.hint")}</span>
      </div>

      {camera && (
        <div className="relative px-4 pb-4 sm:px-5">
          <div className="mx-auto max-w-xl">
            <QrCamera
              onRead={(text) => {
                setCamera(false);
                const reg = readRegistration(text);
                if (reg) {
                  asked.current = reg;
                  setTyped(reg);
                }
                onScan(text);
              }}
            />
          </div>
        </div>
      )}

      {/* Folds away; what stays applied is listed under the field while folded. */}
      <div
        id={bodyId}
        inert={!open}
        className={`relative grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 gap-2.5 border-t border-forest/8 bg-forest/[0.015] px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <Select
              icon={UserCheck}
              value={filters.state}
              onChange={(v) => onFilters({ state: v as DeskState, page: 1 })}
              aria-label={t("admin.activation.finder.stateLabel")}
              options={DESK_STATES.map((s) => ({
                value: s,
                label: s === "all" ? t("admin.activation.finder.allStates") : t(`admin.activation.finder.state.${s}`),
                count: stateCount[s],
              }))}
            />
            <Select
              filter
              icon={GraduationCap}
              value={filters.specializationId}
              onChange={(v) => onFilters({ specializationId: v, page: 1 })}
              aria-label={t("admin.activation.finder.specialization")}
              options={[
                { value: "", label: t("admin.activation.finder.allSpecs") },
                ...(specs ?? []).map((s) => ({ value: s.id, label: s.name, hint: t(`admin.proj.level.${s.level}`) })),
              ]}
            />
            <Select
              filter
              icon={CalendarDays}
              value={filters.academicYearId}
              onChange={(v) => onFilters({ academicYearId: v, page: 1 })}
              aria-label={t("admin.activation.finder.year")}
              options={[{ value: "", label: t("admin.activation.finder.allYears") }, ...(years ?? []).map((y) => ({ value: y.id, label: y.title }))]}
            />
            <button
              type="button"
              disabled={!filtered}
              onClick={() => {
                setTyped("");
                asked.current = null;
                onFilters({ q: "", state: "all", specializationId: "", academicYearId: "", page: 1 });
              }}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[12.5px] font-bold text-gold transition hover:bg-gold/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <FilterX size={15} />
              {t("admin.activation.finder.reset")}
            </button>
          </div>
        </div>
      </div>

      {!open && active > 0 && (
        <div className="relative flex flex-wrap gap-1.5 border-t border-forest/8 px-4 py-3 sm:px-5" data-testid="desk-filter-chips">
          {filters.state !== "all" && (
            <Chip icon={UserCheck} label={t(`admin.activation.finder.state.${filters.state}`)} onRemove={() => onFilters({ state: "all", page: 1 })} />
          )}
          {filters.specializationId && (
            <Chip icon={GraduationCap} label={spec?.name ?? "…"} onRemove={() => onFilters({ specializationId: "", page: 1 })} />
          )}
          {filters.academicYearId && (
            <Chip icon={CalendarDays} label={year?.title ?? "…"} onRemove={() => onFilters({ academicYearId: "", page: 1 })} />
          )}
        </div>
      )}
    </section>
  );
}

function Chip({ icon: Icon, label, onRemove }: { icon: typeof Clock; label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/12 py-1 ps-3 pe-1 text-[12px] font-bold text-forest ring-1 ring-inset ring-gold/25">
      <Icon size={13} className="text-gold" />
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${t("admin.activation.finder.removeFilter")}: ${label}`}
        className="grid size-5 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest"
      >
        <X size={12} />
      </button>
    </span>
  );
}

/**
 * The rows' columns when the list has the width for them: the student, the
 * number, the specialization, the year, where they stand — and the way in.
 * Narrower (a file open beside it, or a phone), each row is a compact line.
 * Which, the list's own width says (a container query), so a row takes its
 * shape as the list narrows or widens, not at the end of it.
 */
const COLUMNS =
  "@3xl:grid @3xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_1.25rem] @3xl:gap-4";

/** The students the filter lets through, a page at a time; one click opens a file. */
export function StudentList({
  filters,
  onFilters,
  selectedId,
  onSelect,
  wide = false,
}: {
  filters: FinderFilters;
  onFilters: (next: Partial<FinderFilters>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The whole width, no file open: a word on what a click does. */
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const q = useDeskStudents({
    q: filters.q || undefined,
    state: filters.state,
    specializationId: filters.specializationId || undefined,
    academicYearId: filters.academicYearId || undefined,
    page: filters.page,
    limit: PAGE_SIZE,
  });
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section
      className="@container relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_40px_-26px_rgba(38,66,61,0.5)]"
      data-testid="student-finder"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/55 to-transparent" />
      <header className="flex items-center justify-between gap-3 border-b border-forest/8 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold ring-1 ring-gold/20">
            <Users size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-[15.5px] leading-tight font-bold text-forest">{t("admin.activation.finder.listTitle")}</h2>
            {wide && <p className="desk-row-in truncate text-[11.5px] text-clay">{t("admin.activation.finder.pick")}</p>}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-gold/25 bg-gold/[0.07] px-2.5 py-1 text-[11.5px] font-bold text-forest" data-testid="finder-count">
          {q.isFetching && !q.data ? <Loader2 size={13} className="animate-spin" /> : t("admin.activation.finder.results", { count: total })}
        </span>
      </header>

      <div className={`p-3 transition-opacity ${q.isFetching ? "opacity-70" : ""}`}>
        {/* The columns' names, as the students' page has them — when the list has columns. */}
        {!!q.data?.items.length && (
          <div
            aria-hidden
            className={`mb-1.5 hidden items-center rounded-xl bg-forest px-4 py-2.5 text-[11.5px] font-semibold text-cream/85 ${COLUMNS}`}
          >
            <span>{t("admin.activation.finder.columns.student")}</span>
            <span>{t("admin.activation.student.reg")}</span>
            <span>{t("admin.activation.profile.specialization")}</span>
            <span>{t("admin.academicYear")}</span>
            <span>{t("admin.activation.finder.columns.state")}</span>
            <span />
          </div>
        )}
        {/* Shaped anew — wide, or narrow beside a file — the rows fall into place one after another. */}
        <ul key={wide ? "wide" : "narrow"} className="space-y-1.5" data-testid="finder-results">
          {q.data?.items.map((s, i) => (
            <Row key={s.id} s={s} at={i} selected={s.id === selectedId} onSelect={() => onSelect(s.id)} />
          ))}
          {q.data && !q.data.items.length && (
            <li className="grid place-items-center gap-1 px-4 py-10 text-center text-clay">
              <SearchX size={28} className="text-forest/25" />
              <p className="text-[13px] font-semibold text-forest/80">{t("admin.activation.finder.none")}</p>
            </li>
          )}
        </ul>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 border-t border-forest/8 px-5 py-3 text-[12px]" aria-label={t("admin.activation.finder.pages")}>
          <button
            type="button"
            disabled={filters.page <= 1}
            onClick={() => onFilters({ page: filters.page - 1 })}
            aria-label={t("admin.proj.prev")}
            className="grid size-8 place-items-center rounded-lg border border-forest/12 text-forest transition hover:border-gold/40 disabled:opacity-40"
          >
            <ChevronRight size={15} className="ltr:rotate-180" />
          </button>
          <span className="font-semibold tabular-nums text-forest">
            {filters.page} / {pages}
          </span>
          <button
            type="button"
            disabled={filters.page >= pages}
            onClick={() => onFilters({ page: filters.page + 1 })}
            aria-label={t("admin.proj.next")}
            className="grid size-8 place-items-center rounded-lg border border-forest/12 text-forest transition hover:border-gold/40 disabled:opacity-40"
          >
            <ChevronLeft size={15} className="ltr:rotate-180" />
          </button>
        </nav>
      )}
    </section>
  );
}

function Row({ s, at, selected, onSelect }: { s: DeskStudentRow; at: number; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const other = otherScriptName(s);
  return (
    <li className="desk-row-in" style={{ animationDelay: `${Math.min(at, 12) * 35}ms` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        data-testid="finder-row"
        className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-start transition duration-200 @3xl:px-4 @3xl:py-3 ${COLUMNS} ${
          selected
            ? "border-gold/50 bg-linear-to-l from-gold/15 via-gold/[0.06] to-transparent shadow-[0_8px_22px_-14px_rgba(193,150,90,0.9)]"
            : "border-transparent hover:border-gold/25 hover:bg-gold/[0.045] @3xl:border-forest/[0.07] @3xl:bg-cream-2/50 @3xl:hover:-translate-y-px @3xl:hover:shadow-[0_10px_26px_-18px_rgba(38,66,61,0.6)]"
        }`}
      >
        {selected && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-gold" />}

        {/* Who — and, narrow, the number and specialization under the name. */}
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar user={s} size={40} radius="rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-bold text-forest" dir="auto">
              {personName(s)}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-clay @3xl:hidden">
              <bdi dir="ltr" className="font-mono">
                {s.registrationNumber}
              </bdi>
              <span className="truncate">· {s.specialization.name}</span>
            </span>
            {other && (
              <span className="mt-0.5 hidden truncate text-[11.5px] font-semibold text-clay @3xl:block">
                <bdi>{other}</bdi>
              </span>
            )}
          </span>
        </span>

        {/* Wide: a column each. */}
        <bdi dir="ltr" className="hidden font-mono text-[12.5px] font-semibold text-forest/85 @3xl:block">
          {s.registrationNumber}
        </bdi>
        <span className="hidden min-w-0 @3xl:block">
          <span className="block truncate text-[12.5px] font-semibold text-forest">{s.specialization.name}</span>
          <span className="mt-0.5 block text-[11px] text-clay">{t(`admin.proj.level.${s.specialization.level}`)}</span>
        </span>
        <span className="hidden text-[12px] text-clay tabular-nums @3xl:block">{s.academicYear}</span>

        {/* Where they stand: marks, narrow; said in words, wide. */}
        <span className="flex shrink-0 items-center gap-1 @3xl:hidden">
          {s.status !== "active" ? (
            <Mark icon={ShieldX} tone="text-rose-500" label={t("admin.activation.student.suspended")} />
          ) : !s.activated ? (
            <Mark icon={ShieldAlert} tone="text-amber-500" label={t("admin.activation.student.notActivated")} />
          ) : null}
          {s.verified && <Mark icon={BadgeCheck} tone="text-emerald-500" label={t("admin.struct.spec.verified")} />}
          {s.pendingRequest && <Mark icon={Clock} tone="text-sky-500" label={t("admin.activation.finder.state.requested")} />}
        </span>
        <span className="hidden flex-wrap items-center gap-1 @3xl:flex">
          {s.status !== "active" ? (
            <Badge tone="rose" icon={ShieldX}>
              {t("admin.activation.student.suspended")}
            </Badge>
          ) : !s.activated ? (
            <Badge tone="amber" icon={ShieldAlert}>
              {t("admin.activation.student.notActivated")}
            </Badge>
          ) : !s.verified ? (
            <Badge tone="teal" icon={UserCheck}>
              {t("admin.activation.student.activated")}
            </Badge>
          ) : null}
          {s.verified && (
            <Badge tone="emerald" icon={BadgeCheck}>
              {t("admin.struct.spec.verified")}
            </Badge>
          )}
          {s.pendingRequest && (
            <Badge tone="sky" icon={Clock}>
              {t("admin.activation.finder.badge.requested")}
            </Badge>
          )}
        </span>

        <ChevronLeft
          size={16}
          aria-hidden
          className="hidden text-forest/35 transition group-hover:-translate-x-0.5 group-hover:text-gold @3xl:block ltr:rotate-180 ltr:group-hover:translate-x-0.5"
        />
      </button>
    </li>
  );
}

const BADGE = {
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  amber: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  teal: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300",
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  sky: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
};

/** Where a student stands, in words — when the list has room for them. */
function Badge({ tone, icon: Icon, children }: { tone: keyof typeof BADGE; icon: typeof Clock; children: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ring-1 ring-inset ${BADGE[tone]}`}>
      <Icon size={12} className="shrink-0" />
      {children}
    </span>
  );
}

function Mark({ icon: Icon, tone, label }: { icon: typeof Clock; tone: string; label: string }) {
  return (
    <span title={label} aria-label={label} className={`grid size-6 place-items-center rounded-lg bg-forest/[0.04] ${tone}`}>
      <Icon size={14} />
    </span>
  );
}
