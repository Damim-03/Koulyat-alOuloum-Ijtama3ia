import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowDownUp,
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  usePublicTopics,
  usePublicDepartments,
  usePublicSpecializations,
  usePublicTopicFilters,
} from "../hooks/public-hook";
import type {
  PublicTopicsParams,
  PublicTopicsSort,
} from "../api/public.api";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import { PATHS } from "../../../routes/paths";
import type { PublicTopic } from "../../../types/public.types";
import { Select } from "../../../components/ui/select";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { STATUS_TONE } from "../../../lib/status-tone";
import { noneText } from "../../../lib/none-text";
import { ReservedTopicDialog } from "../components/reserved-topic";
import { personName } from "../../../lib/person-name";

const PAGE_SIZE = 9;
const FILTERS_OPEN_KEY = "topics.filtersOpen";
const SORTS: PublicTopicsSort[] = ["newest", "oldest", "title"];

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

const LEVEL_KEY: Record<string, string> = {
  licence: "stu.levelLicence",
  master: "stu.levelMaster",
  doctorate: "stu.levelDoctorate",
};

type Status = "" | "available" | "reserved";

interface Filters {
  q: string;
  dept: string;
  spec: string;
  prof: string;
  year: string;
  size: string;
  status: Status;
  sort: PublicTopicsSort;
  page: number;
}

const EMPTY: Filters = {
  q: "",
  dept: "",
  spec: "",
  prof: "",
  year: "",
  size: "",
  status: "",
  sort: "newest",
  page: 1,
};

/**
 * الفلاتر تسكن الرابط لا الذاكرة.
 *
 * كانت في `useState`: يفتح الطالب موضوعاً ثم يعود، فيجد الصفحة الأولى بلا
 * فلتر — وقد قضى دقيقةً يضيّقها. والرابط يحفظها عبر الرجوع والتحديث، ويُنسخ
 * فيصل زميلَه ما يراه هو بالضبط. وما يُقرأ منه يُتحقَّق منه: رابطٌ عُبث به
 * لا يُسقط الصفحة، إنّما يُهمَل ما لا يُفهم.
 */
function readFilters(sp: URLSearchParams): Filters {
  const status = sp.get("status");
  const sort = sp.get("sort") as PublicTopicsSort | null;
  const size = sp.get("size") ?? "";
  const page = Number(sp.get("page"));
  return {
    q: (sp.get("q") ?? "").trim(),
    dept: sp.get("dept") ?? "",
    spec: sp.get("spec") ?? "",
    prof: sp.get("prof") ?? "",
    year: sp.get("year") ?? "",
    size: /^\d{1,2}$/.test(size) ? size : "",
    status: status === "available" || status === "reserved" ? status : "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** القيم الافتراضية لا تُكتب: يبقى الرابط قصيراً يُقرأ ويُشارَك. */
function writeFilters(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.dept) sp.set("dept", f.dept);
  if (f.spec) sp.set("spec", f.spec);
  if (f.prof) sp.set("prof", f.prof);
  if (f.year) sp.set("year", f.year);
  if (f.size) sp.set("size", f.size);
  if (f.status) sp.set("status", f.status);
  if (f.sort !== "newest") sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(FILTERS_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

type Person = { firstName?: string | null; lastName?: string | null } | null;
const nameOf = (u?: Person) =>
  personName(u);

export function PublicTopicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();
  const location = useLocation();
  const panelId = useId();

  // Topics are for LOGGED-IN users only. A visitor (not authenticated) is sent
  // to the login page, remembering this path so they return here afterwards.
  const { isAuthenticated, role } = useAuth();

  /**
   * المحجوز يُغلق على الطالب من غير فريقه: بطاقتُه تفتح نافذةً تقول ذلك،
   * والخادم يرفض صفحته لمن جاءها بالرابط. والأستاذ والمسؤول يفتحانه كما هو.
   */
  const [lockedTopic, setLockedTopic] = useState<PublicTopic | null>(null);
  const isLockedFor = (tp: PublicTopic) =>
    role === "student" && !!tp.isReserved && !tp.isMine;
  const { localePath } = useLanguage();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localePath(PATHS.login), {
        state: { from: location.pathname },
        replace: true,
      });
    }
  }, [isAuthenticated, navigate, localePath, location.pathname]);

  // ── الفلاتر: من الرابط وإليه ──
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  /** كلّ تغييرٍ يُعيد إلى الصفحة الأولى — إلّا تغيير الصفحة نفسها. */
  const update = useCallback(
    (patch: Partial<Filters>) =>
      setSearchParams(
        (prev) =>
          writeFilters({ ...readFilters(prev), ...patch, page: patch.page ?? 1 }),
        { replace: true },
      ),
    [setSearchParams],
  );

  /**
   * البحث فوريّ بلا زرّ «تصفية»: يُكتب في الحقل، ويصل الرابطَ حين يسكن.
   *
   * والحقلُ حالةٌ محلّية لا الرابطُ نفسه: لو كُتب في الرابط مع كلّ حرف لصار
   * كلّ حرفٍ طلباً.
   *
   * ويُقارَن الساكنُ بآخر ما كتبه **هذا الأثر** لا بما في الرابط. الرابط
   * يتحدّث في انتقالٍ (transition) بعد الحقل: فبعد «مسح الكلّ» يرى الأثرُ
   * حقلاً فارغاً ورابطاً ما يزال فيه البحث القديم، فيكتب «الفراغ» فوق
   * رابطٍ قديم — ويعود كلُّ فلترٍ مُسح. وآخرُ ما كُتب لا يتأخّر.
   */
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const pushedQ = useRef(filters.q);
  useEffect(() => {
    if (debouncedSearch === pushedQ.current) return;
    pushedQ.current = debouncedSearch;
    update({ q: debouncedSearch });
  }, [debouncedSearch, update]);

  /** يمحو الحقل والرابط معاً، ويُعلم الأثرَ أنّ الفراغ كُتب. */
  function clearSearch() {
    pushedQ.current = "";
    setSearchInput("");
    update({ q: "" });
  }

  function resetAll() {
    pushedQ.current = "";
    setSearchInput("");
    setSearchParams(writeFilters({ ...EMPTY, sort: filters.sort }), {
      replace: true,
    });
  }

  // ── الطيّ والفتح، ويُذكر بين الزيارات ──
  const [filtersOpen, setFiltersOpen] = useState(readOpen);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_OPEN_KEY, filtersOpen ? "1" : "0");
    } catch {
      /* خصوصيّةٌ أو تخزينٌ ممتلئ: تبقى اللوحة كما هي في هذه الزيارة */
    }
  }, [filtersOpen]);

  // «/» يأخذ إلى البحث من أيّ مكانٍ في الصفحة، ما لم يكن التركيز في حقل.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── البيانات ──
  const params: PublicTopicsParams = {
    page: filters.page,
    limit: PAGE_SIZE,
    sort: filters.sort,
    search: filters.q || undefined,
    departmentId: filters.dept || undefined,
    specializationId: filters.spec || undefined,
    professorId: filters.prof || undefined,
    academicYearId: filters.year || undefined,
    maxStudents: filters.size ? Number(filters.size) : undefined,
    availability: filters.status || undefined,
  };
  const topicsQ = usePublicTopics(params);
  const { data: departments } = usePublicDepartments();
  // Specializations are scoped to the chosen department (cascading filter).
  const { data: specializations } = usePublicSpecializations(
    filters.dept || undefined,
  );
  const { data: facets } = usePublicTopicFilters();

  const data = topicsQ.data;
  const topics = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const words = useMemo(
    () => filters.q.split(/\s+/).filter(Boolean),
    [filters.q],
  );

  // صفحةٌ بعد النهاية — رابطٌ قديم، أو فلترٌ ضيّق النتائج — تُعاد إلى آخرها.
  useEffect(() => {
    if (data && !topicsQ.isPlaceholderData && filters.page > totalPages)
      update({ page: totalPages });
  }, [data, topicsQ.isPlaceholderData, filters.page, totalPages, update]);

  // الانتقال بين الصفحات يُعيد إلى رأس النتائج لا إلى أسفل الشبكة.
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevPage = useRef(filters.page);
  useEffect(() => {
    if (prevPage.current === filters.page) return;
    prevPage.current = filters.page;
    resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [filters.page]);

  // ── «تخصّصي»: اختصارٌ للطالب، من الخادم لا من الحساب ──
  const mine = facets?.mine ?? null;
  const mySpecOn = !!mine && filters.spec === mine.specializationId;
  function toggleMine() {
    if (!mine) return;
    update(
      mySpecOn ? { spec: "" } : { spec: mine.specializationId, dept: "" },
    );
  }

  // ── الفلاتر المطبّقة: تبقى ظاهرةً واللوحة مطويّة ──
  const specName =
    specializations?.find((s) => s.id === filters.spec)?.name ??
    (mine?.specializationId === filters.spec
      ? mine.specializationName
      : undefined);
  const prof = facets?.professors.find((p) => p.id === filters.prof);
  const year = facets?.academicYears.find((y) => y.id === filters.year);
  const sizes = facets?.sizes ?? [];

  type ChipKey = "q" | "dept" | "spec" | "prof" | "year" | "size";
  const chips: { key: ChipKey; label: string; value: string }[] = [];
  if (filters.q)
    chips.push({
      key: "q",
      label: t("public.browse.search"),
      value: `«${filters.q}»`,
    });
  if (filters.dept)
    chips.push({
      key: "dept",
      label: t("public.browse.department"),
      value: departments?.find((d) => d.id === filters.dept)?.name ?? "…",
    });
  if (filters.spec)
    chips.push({
      key: "spec",
      label: t("public.browse.specialization"),
      value: specName ?? "…",
    });
  if (filters.prof)
    chips.push({
      key: "prof",
      label: t("public.browse.supervisor"),
      value: prof ? nameOf(prof.user) || noneText() : "…",
    });
  if (filters.year)
    chips.push({
      key: "year",
      label: t("public.browse.year"),
      value: year?.title ?? "…",
    });
  if (filters.size)
    chips.push({
      key: "size",
      label: t("public.browse.groupSize"),
      value: t("public.browse.seats", { count: Number(filters.size) }),
    });

  function removeChip(key: ChipKey) {
    if (key === "q") clearSearch();
    // التخصّص من القسم: يذهب معه.
    else if (key === "dept") update({ dept: "", spec: "" });
    else update({ [key]: "" });
  }

  /** ما في اللوحة وحدها — البحث والحالة ظاهران خارجها. */
  const panelCount = [
    filters.dept,
    filters.spec,
    filters.prof,
    filters.year,
    filters.size,
  ].filter(Boolean).length;
  const filtered = chips.length > 0 || !!filters.status;

  // Visitors are being redirected to login — render nothing to avoid a flash
  // of the topics page.
  if (!isAuthenticated) return null;

  const from = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(filters.page * PAGE_SIZE, total);

  return (
    <div className="font-body mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Hero
        counts={data?.counts}
        status={filters.status}
        onStatus={(s) => update({ status: s })}
      />

      {/* ══════════ البحث والفلاتر ══════════ */}
      <section className={CARD} aria-label={t("public.browse.filters")}>
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              size={19}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-clay"
            />
            <input
              ref={searchRef}
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchInput) {
                  e.preventDefault();
                  clearSearch();
                }
              }}
              placeholder={t("public.browse.searchPlaceholder")}
              aria-label={t("public.browse.search")}
              data-testid="topics-search"
              className="w-full rounded-2xl border border-forest/15 bg-cream-2 py-3.5 ps-12 pe-14 text-sm text-forest outline-none transition placeholder:text-clay/80 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15 [&::-webkit-search-cancel-button]:hidden"
            />
            <div className="absolute inset-y-0 end-3 flex items-center">
              {searchInput ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label={t("public.browse.clearSearch")}
                  className="grid size-8 place-items-center rounded-xl text-clay transition hover:bg-forest/8 hover:text-forest"
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd
                  title={t("public.browse.searchShortcut")}
                  className="hidden rounded-lg border border-forest/15 bg-cream-card px-2 py-0.5 font-sans text-[11px] font-bold text-clay sm:inline-block"
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mine && (
              <button
                type="button"
                onClick={toggleMine}
                aria-pressed={mySpecOn}
                title={t("public.browse.mySpecHint", {
                  name: mine.specializationName,
                })}
                data-testid="topics-my-spec"
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition active:scale-95 ${
                  mySpecOn
                    ? "border-gold bg-gold text-[var(--t-brand-deep)] shadow-[0_8px_20px_rgba(193,150,90,0.3)]"
                    : "border-forest/15 text-forest hover:border-gold/50 hover:bg-gold/5"
                }`}
              >
                <UserCheck size={17} />
                {t("public.browse.mySpec")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls={panelId}
              title={
                filtersOpen
                  ? t("public.browse.hideFilters")
                  : t("public.browse.showFilters")
              }
              data-testid="topics-filters-toggle"
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition active:scale-95 ${
                filtersOpen || panelCount > 0
                  ? "border-gold/50 bg-gold/10 text-forest"
                  : "border-forest/15 text-forest hover:border-gold/40 hover:bg-gold/5"
              }`}
            >
              <SlidersHorizontal size={17} className="text-gold" />
              {t("public.browse.filters")}
              {panelCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-[var(--t-brand-deep)]">
                  {panelCount}
                </span>
              )}
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* اللوحة تُطوى بارتفاعٍ متحرّك. و`inert` يُخرج ما فيها من ترتيب
            Tab وهي مطويّة — حقولٌ مخفيّةٌ يصلها المفتاح فخٌّ لمن لا يرى. */}
        <div
          id={panelId}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden" inert={!filtersOpen}>
            <div
              data-testid="topics-filters-panel"
              className="space-y-5 border-t border-forest/10 p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field icon={Building2} label={t("public.browse.department")}>
                  <Select
                    aria-label={t("public.browse.department")}
                    value={filters.dept}
                    onChange={(v) => update({ dept: v, spec: "" })}
                    options={[
                      { value: "", label: t("public.browse.allDepartments") },
                      ...(departments ?? []).map((d) => ({
                        value: d.id,
                        label: d.name,
                      })),
                    ]}
                  />
                </Field>

                <Field icon={Layers} label={t("public.browse.specialization")}>
                  <Select
                    aria-label={t("public.browse.specialization")}
                    value={filters.spec}
                    onChange={(v) => update({ spec: v })}
                    options={[
                      { value: "", label: t("public.browse.allSpecializations") },
                      ...(specializations ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                    ]}
                  />
                </Field>

                <Field icon={GraduationCap} label={t("public.browse.supervisor")}>
                  <Select
                    aria-label={t("public.browse.supervisor")}
                    value={filters.prof}
                    onChange={(v) => update({ prof: v })}
                    options={[
                      { value: "", label: t("public.browse.allProfessors") },
                      ...(facets?.professors ?? []).map((p) => ({
                        value: p.id,
                        label: `${nameOf(p.user) || noneText()} (${p.count})`,
                      })),
                    ]}
                  />
                </Field>

                <Field icon={CalendarDays} label={t("public.browse.year")}>
                  <Select
                    aria-label={t("public.browse.year")}
                    value={filters.year}
                    onChange={(v) => update({ year: v })}
                    options={[
                      { value: "", label: t("public.browse.allYears") },
                      ...(facets?.academicYears ?? []).map((y) => ({
                        value: y.id,
                        label: `${y.title}${
                          y.isActive ? ` · ${t("public.browse.activeYear")}` : ""
                        } (${y.count})`,
                      })),
                    ]}
                  />
                </Field>
              </div>

              {/* حجمٌ واحدٌ لكلّ المواضيع لا يُفرّق بين شيء — فلا يُعرض. */}
              {sizes.length > 1 && (
                <Field icon={Users} label={t("public.browse.groupSize")}>
                  <div className="flex flex-wrap gap-2">
                    <SizeChip
                      active={!filters.size}
                      onClick={() => update({ size: "" })}
                    >
                      {t("public.browse.anySize")}
                    </SizeChip>
                    {sizes.map((s) => {
                      const v = String(s.value);
                      return (
                        <SizeChip
                          key={v}
                          active={filters.size === v}
                          count={s.count}
                          onClick={() =>
                            update({ size: filters.size === v ? "" : v })
                          }
                        >
                          {t("public.browse.seats", { count: s.value })}
                        </SizeChip>
                      );
                    })}
                  </div>
                </Field>
              )}
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div
            data-testid="topics-active-filters"
            className="flex flex-wrap items-center gap-2 border-t border-forest/10 px-4 py-3 sm:px-5"
          >
            <span className="text-[11px] font-semibold text-clay">
              {t("public.browse.activeFilters")}
            </span>
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 py-1 ps-3 pe-1 text-xs text-forest"
              >
                <span className="shrink-0 text-clay">{c.label}:</span>
                <span className="max-w-48 truncate font-semibold">{c.value}</span>
                <button
                  type="button"
                  onClick={() => removeChip(c.key)}
                  aria-label={t("public.browse.removeFilter", {
                    name: c.label,
                  })}
                  className="grid size-5 shrink-0 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={resetAll}
              className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <RotateCcw size={13} />
              {t("public.browse.clearAll")}
            </button>
          </div>
        )}
      </section>

      {/* ══════════ شريط النتائج ══════════ */}
      <div
        ref={resultsRef}
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <p
          className="flex min-h-10 items-center gap-2.5 text-sm text-clay"
          aria-live="polite"
        >
          {/* «0–0 من 0» لا يقول شيئاً — والفراغ تحته يقوله. */}
          {data && total > 0 && (
            <span data-testid="topics-range">
              {t("public.browse.range", { from, to, total })}
            </span>
          )}
          {topicsQ.isFetching && data && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold">
              <Loader2 size={13} className="animate-spin" />
              {t("public.browse.updating")}
            </span>
          )}
        </p>
        <Select
          icon={ArrowDownUp}
          aria-label={t("public.browse.sort")}
          value={filters.sort}
          onChange={(v) => update({ sort: v as PublicTopicsSort })}
          className="w-full sm:w-52"
          options={[
            { value: "newest", label: t("public.browse.sortNewest") },
            { value: "oldest", label: t("public.browse.sortOldest") },
            { value: "title", label: t("public.browse.sortTitle") },
          ]}
        />
      </div>

      {/* ══════════ الشبكة ══════════ */}
      {topicsQ.isError && !data ? (
        <ErrorRetry onRetry={() => topicsQ.refetch()} />
      ) : !data ? (
        <SkeletonGrid />
      ) : topics.length === 0 ? (
        <EmptyState filtered={filtered} onReset={resetAll} />
      ) : (
        <ul
          data-testid="topics-grid"
          aria-busy={topicsQ.isFetching}
          className={`grid grid-cols-1 gap-6 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 ${
            topicsQ.isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          {topics.map((tp) => (
            <li key={tp.id}>
              <TopicCard
                topic={tp}
                words={words}
                to={`/${lang}/topics/${tp.id}`}
                // صفحة الموضوع تعود إلى القائمة بفلاترها، لا إلى أوّلها.
                state={{ listSearch: location.search }}
                onLocked={isLockedFor(tp) ? () => setLockedTopic(tp) : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      <ReservedTopicDialog
        topic={lockedTopic}
        onClose={() => setLockedTopic(null)}
        onBrowseAvailable={() => {
          setLockedTopic(null);
          update({ status: "available" });
        }}
        onBrowseSupervisor={
          lockedTopic?.professor?.id
            ? () => {
                const prof = lockedTopic.professor!.id;
                setLockedTopic(null);
                update({ prof, status: "available" });
              }
            : undefined
        }
      />

      {data && totalPages > 1 && (
        <Pagination
          page={Math.min(filters.page, totalPages)}
          totalPages={totalPages}
          onPage={(p) => update({ page: p })}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  الرأس: العنوان، والتبويبات الثلاثة بأعدادها
// ═══════════════════════════════════════════════════════════════

function Hero({
  counts,
  status,
  onStatus,
}: {
  counts?: { all: number; available: number; reserved: number };
  status: Status;
  onStatus: (s: Status) => void;
}) {
  const { t } = useTranslation();
  const tiles: { key: Status; label: string; count?: number; dot: string }[] = [
    { key: "", label: t("public.browse.statAll"), count: counts?.all, dot: "bg-gold" },
    {
      key: "available",
      label: t("public.browse.statAvailable"),
      count: counts?.available,
      dot: STATUS_TONE.open!.dot,
    },
    {
      key: "reserved",
      label: t("public.browse.statReserved"),
      count: counts?.reserved,
      dot: STATUS_TONE.full!.dot,
    },
  ];

  return (
    <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-9">
      {/* ornament, clipped by a layer of its own so the card never scrolls */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex items-start gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)]">
            <BookOpenText size={30} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold-soft">
              <Sparkles size={13} />
              {t("public.browse.kicker")}
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight font-bold text-cream sm:text-4xl">
              {t("public.topicsTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft-sage">
              {t("public.topicsSubtitle")}
            </p>
          </div>
        </div>

        {/* التبويبات أعدادٌ لا أسماء: يُرى كم في كلٍّ قبل الانتقال إليه. */}
        <div
          role="group"
          aria-label={t("public.allStatuses")}
          className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[31rem]"
        >
          {tiles.map((tile) => {
            const active = status === tile.key;
            return (
              <button
                key={tile.key || "all"}
                type="button"
                aria-pressed={active}
                data-testid={`topics-tab-${tile.key || "all"}`}
                onClick={() => onStatus(active ? "" : tile.key)}
                className={`rounded-2xl border px-3 py-3 text-start transition sm:px-4 sm:py-4 ${
                  active
                    ? "border-gold/70 bg-white/12 shadow-[0_0_0_1px_rgba(217,174,114,0.35)]"
                    : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
                }`}
              >
                {/* سطران لا قصّ: في الهاتف ثلاثة أعمدة ضيّقة، و«متاحة لل…»
                    لا تُقرأ. */}
                <span className="flex items-start gap-2 text-[11px] font-medium text-soft-sage sm:text-xs">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${tile.dot}`} />
                  <span className="line-clamp-2 leading-snug">{tile.label}</span>
                </span>
                <span className="mt-1.5 block font-serif text-2xl font-bold text-cream tabular-nums sm:text-3xl">
                  {tile.count ?? "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  البطاقة
// ═══════════════════════════════════════════════════════════════

/**
 * البطاقة كلّها رابطٌ واحد — إلّا المحجوزة لغير فريق القارئ.
 *
 * كان فيها ثلاثة أزرار — العنوان، و«عرض التفاصيل»، و«تقديم طلب» — وكلّها
 * تفتح الصفحة نفسها. والتقديم يجري هناك لا هنا، فزرٌّ يَعِد به في البطاقة
 * يَعِد بما لا يفعل.
 *
 * والمحجوزة لفريقٍ آخر زرٌّ لا رابط: يفتح نافذة «محجوز» فوق القائمة بدل
 * صفحةٍ يرفضها الخادم. وتبقى ظاهرةً كاملة — الطالب يرى ما أُخذ، فيعرف أين
 * يبحث — لكن بابها لا يُفتح.
 */
function TopicCard({
  topic,
  words,
  to,
  state,
  onLocked,
}: {
  topic: PublicTopic;
  words: string[];
  to: string;
  state: unknown;
  /** يُمرَّر للمحجوز لغير فريق القارئ: النقر يفتح النافذة لا الصفحة. */
  onLocked?: () => void;
}) {
  const { t } = useTranslation();
  const mine = !!topic.isReserved && !!topic.isMine;
  const tone = topic.isAvailable ? STATUS_TONE.open! : STATUS_TONE.full!;
  const prof = nameOf(topic.professor?.user) || noneText();
  const dept = topic.professor?.department?.name;
  const levelKey = topic.specialization?.level
    ? LEVEL_KEY[topic.specialization.level]
    : null;

  const cls =
    "group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card text-start shadow-[0_4px_24px_rgba(38,66,61,0.06)] outline-none transition duration-300 hover:-translate-y-1 hover:border-gold/45 hover:shadow-[0_22px_48px_-12px_rgba(38,66,61,0.28)] focus-visible:ring-4 focus-visible:ring-gold/30";

  const body = (
    <>
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] bg-linear-to-l from-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100 ${
          topic.isAvailable || mine ? "via-gold" : "via-clay/40"
        }`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -end-20 -top-20 size-48 rounded-full bg-gold/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          {mine ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/35">
              <Sparkles size={11} />
              {t("public.browse.reservedForYou")}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone.pill}`}
            >
              <span
                className={`size-1.5 rounded-full ${tone.dot} ${topic.isAvailable ? "animate-pulse" : ""}`}
              />
              {topic.isAvailable ? t("public.available") : t("public.reserved")}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/5 px-2.5 py-1 text-[11px] font-semibold text-forest ring-1 ring-forest/10">
            <Users size={12} className="text-gold" />
            {t("public.browse.seats", { count: topic.maxStudents })}
          </span>
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-snug font-bold break-words text-forest transition-colors group-hover:text-gold">
          <Highlight text={topic.title} words={words} />
        </h3>
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed break-words text-clay">
          <Highlight text={topic.description} words={words} />
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
          {topic.specialization?.name && (
            <Meta icon={Layers}>
              <Highlight text={topic.specialization.name} words={words} />
            </Meta>
          )}
          {levelKey && <Meta icon={GraduationCap}>{t(levelKey)}</Meta>}
          {topic.academicYear?.title && (
            <Meta icon={CalendarDays}>{topic.academicYear.title}</Meta>
          )}
        </div>
      </div>

      <div className="relative flex items-center gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-4">
        <span className="shrink-0 rounded-full bg-linear-to-br from-gold-soft via-gold to-gold-soft/30 p-[2px]">
          <UserAvatar
            user={topic.professor?.user}
            size={38}
            className="ring-2 ring-cream-card"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-forest">
            <Highlight text={prof} words={words} />
          </span>
          <span className="block truncate text-[11px] text-clay">
            {dept ?? t("public.supervisor")}
          </span>
        </span>
        {onLocked ? (
          <span
            title={t("public.browse.reservedNote")}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-forest/5 text-clay transition group-hover:bg-gold/15 group-hover:text-gold"
          >
            <Lock size={15} />
          </span>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold transition group-hover:bg-gold group-hover:text-[var(--t-brand-deep)]">
            <ChevronLeft
              size={18}
              className="transition-transform ltr:rotate-180 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5"
            />
          </span>
        )}
      </div>
    </>
  );

  return onLocked ? (
    <button
      type="button"
      onClick={onLocked}
      aria-haspopup="dialog"
      data-testid={`topic-card-${topic.id}`}
      data-locked="true"
      className={cls}
    >
      {body}
    </button>
  ) : (
    <Link
      to={to}
      state={state}
      data-testid={`topic-card-${topic.id}`}
      className={cls}
    >
      {body}
    </Link>
  );
}

/** كلماتُ البحث مُعلَّمةٌ حيث وقعت: يُرى لماذا جاء هذا الموضوع. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length || !text) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        // `split` بمجموعةٍ ماسكة يضع المطابقات في المواضع الفردية.
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-gold/25 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-soft-sage/20 px-2.5 py-1 text-[11px] font-medium text-forest">
      <Icon size={12} className="shrink-0 text-sage" />
      <span className="truncate">{children}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  أجزاء اللوحة
// ═══════════════════════════════════════════════════════════════

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
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

function SizeChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
        <span
          className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
            active ? "bg-gold text-[var(--t-brand-deep)]" : "bg-forest/8 text-clay"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  التحميل، والفراغ، والترقيم
// ═══════════════════════════════════════════════════════════════

/** هيكلٌ بشكل البطاقات لا دوّامة: الصفحة لا تقفز حين تصل البيانات. */
function SkeletonGrid() {
  return (
    <ul
      aria-hidden="true"
      data-testid="topics-skeleton"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className={`overflow-hidden ${CARD}`}>
          <div className="animate-pulse space-y-4 p-6">
            <div className="flex justify-between">
              <div className="h-6 w-20 rounded-full bg-forest/8" />
              <div className="h-6 w-16 rounded-full bg-forest/8" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-4/5 rounded-lg bg-forest/10" />
              <div className="h-6 w-3/5 rounded-lg bg-forest/10" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3.5 rounded bg-forest/6" />
              <div className="h-3.5 rounded bg-forest/6" />
              <div className="h-3.5 w-2/3 rounded bg-forest/6" />
            </div>
            <div className="flex gap-2 pt-3">
              <div className="h-6 w-24 rounded-lg bg-forest/8" />
              <div className="h-6 w-16 rounded-lg bg-forest/8" />
            </div>
          </div>
          <div className="flex animate-pulse items-center gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-4">
            <div className="size-10 rounded-full bg-forest/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-forest/10" />
              <div className="h-3 w-1/3 rounded bg-forest/6" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="topics-empty"
      className={`relative overflow-hidden px-6 py-16 text-center ${CARD}`}
    >
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-gold/10 ring-8 ring-gold/5">
        <SearchX size={34} className="text-gold" />
      </div>
      <h2 className="mt-5 font-serif text-xl font-bold text-forest">
        {filtered ? t("public.browse.noResults") : t("public.browse.noneYet")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-clay">
        {filtered
          ? t("public.browse.noResultsHint")
          : t("public.browse.noneYetHint")}
      </p>
      {filtered && (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-forest px-5 py-3 text-sm font-bold text-cream transition hover:bg-forest-deep active:scale-95"
        >
          <RotateCcw size={16} />
          {t("public.browse.resetFilters")}
        </button>
      )}
    </div>
  );
}

/** أرقامٌ مع «…»: الأولى والأخيرة دائماً، وجارتا الحالية. */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  const { t } = useTranslation();
  const btn =
    "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-bold transition";
  const edge = `${btn} border border-forest/15 text-forest hover:border-gold/50 hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-35`;

  return (
    <nav
      aria-label={t("public.browse.pagination")}
      data-testid="topics-pagination"
      className="flex flex-wrap items-center justify-center gap-1.5 pt-4"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={t("public.browse.prevPage")}
        className={edge}
      >
        <ChevronRight size={18} className="ltr:rotate-180" />
      </button>
      {pageList(page, totalPages).map((it, i) =>
        it === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-clay">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            onClick={() => onPage(it)}
            aria-current={it === page ? "page" : undefined}
            aria-label={t("public.browse.pageN", { n: it })}
            className={`${btn} tabular-nums ${
              it === page
                ? "bg-forest text-cream shadow-[0_6px_16px_rgba(26,49,45,0.25)]"
                : "text-forest hover:bg-forest/5"
            }`}
          >
            {it}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label={t("public.browse.nextPage")}
        className={edge}
      >
        <ChevronLeft size={18} className="ltr:rotate-180" />
      </button>
    </nav>
  );
}
