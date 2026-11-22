import type { ProjectGroupListItem } from "../../../types/professor.types";
import { personName, type Named } from "../../../lib/person-name";
import { foldText, searchWords } from "../../../lib/search-text";

/**
 * لوحة المراحل عند الأستاذ: حال كلّ مذكرةٍ من مراحلها، والفلاتر والبحث
 * والترتيب عليها. منطقٌ بلا واجهة، فيُختبر وحده.
 *
 * والفلاتر في عنوان الصفحة (`?q=…&year=…`): تبقى حين يُفتح مشروعٌ ويُعاد
 * منه، وحين تُحدَّث الصفحة، ويُرسَل الرابط بها.
 */

/** «قريب»: موعدٌ في الأيام السبعة القادمة. */
export const SOON_DAYS = 7;
const DAY = 86_400_000;

export const HEALTHS = ["all", "late", "soon", "done", "empty"] as const;
export type Health = (typeof HEALTHS)[number];

export const DEFENSES = ["scheduled", "completed", "none"] as const;
export type DefenseFilter = (typeof DEFENSES)[number];

export const FILES = ["with", "without"] as const;
export type FilesFilter = (typeof FILES)[number];

/** أرباع الإنجاز؛ والمذكرة بلا مراحل ليست في أيٍّ منها. */
export const BANDS = ["q1", "q2", "q3", "q4"] as const;
export type Band = (typeof BANDS)[number];

export const SORTS = ["recent", "oldest", "deadline", "late", "progressDesc", "progressAsc", "title"] as const;
export type Sort = (typeof SORTS)[number];

/** البحث المفصّل: كلّ حقلٍ يبحث في نوعه وحده (رقم التسجيل في أرقام التسجيل…). */
export const FIELD_KEYS = ["title", "student", "registration", "milestone", "room"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
/** كلمات كلّ حقلٍ مفصّل، مطويّةً للبحث. */
export type FieldWords = Partial<Record<FieldKey, string[]>>;

export interface BoardFilters extends Record<FieldKey, string> {
  q: string;
  health: Health;
  year: string;
  spec: string;
  status: string;
  defense: DefenseFilter | "";
  files: FilesFilter | "";
  band: Band | "";
  size: string;
  sort: Sort;
}

export const DEFAULT_FILTERS: BoardFilters = {
  q: "",
  title: "",
  student: "",
  registration: "",
  milestone: "",
  room: "",
  health: "all",
  year: "",
  spec: "",
  status: "",
  defense: "",
  files: "",
  band: "",
  size: "",
  sort: "recent",
};

/** ما يُطوى في اللوحة — لا البحث العامّ ولا البطاقات ولا الترتيب. */
export const PANEL_KEYS = [...FIELD_KEYS, "year", "spec", "status", "defense", "files", "band", "size"] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];

const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T | ""): T | "" =>
  v && (list as readonly string[]).includes(v) ? (v as T) : fallback;

/** الفلاتر من العنوان؛ وقيمةٌ لا تُعرف تعود إلى أصلها. */
export function readFilters(sp: URLSearchParams): BoardFilters {
  return {
    q: sp.get("q") ?? "",
    ...(Object.fromEntries(FIELD_KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<FieldKey, string>),
    health: oneOf(HEALTHS, sp.get("health"), "all") as Health,
    year: sp.get("year") ?? "",
    spec: sp.get("spec") ?? "",
    status: sp.get("status") ?? "",
    defense: oneOf(DEFENSES, sp.get("defense"), ""),
    files: oneOf(FILES, sp.get("files"), ""),
    band: oneOf(BANDS, sp.get("band"), ""),
    size: /^\d+$/.test(sp.get("size") ?? "") ? sp.get("size")! : "",
    sort: oneOf(SORTS, sp.get("sort"), "recent") as Sort,
  };
}

/**
 * الفلاتر في العنوان: ما خالف الأصل وحده، وما سواها من المعاملات باقٍ.
 * والنصّ يُكتب كما هو (الفراغ في آخره هو ما بين كلمتين تُكتبان)، ويُحذف
 * إن لم يكن فيه غير الفراغ.
 */
export function writeFilters(sp: URLSearchParams, f: BoardFilters): URLSearchParams {
  const out = new URLSearchParams(sp);
  for (const k of Object.keys(DEFAULT_FILTERS) as (keyof BoardFilters)[]) {
    const v = f[k];
    if (v.trim() && v !== DEFAULT_FILTERS[k]) out.set(k, v);
    else out.delete(k);
  }
  return out;
}

export const fieldWords = (f: BoardFilters): FieldWords =>
  Object.fromEntries(FIELD_KEYS.map((k) => [k, searchWords(f[k])]));

// ─────────────────────────────────────────────────────────────
//  حال المذكرة
// ─────────────────────────────────────────────────────────────

type Ms = NonNullable<ProjectGroupListItem["milestones"]>[number];

export interface Row {
  g: ProjectGroupListItem;
  total: number;
  completed: number;
  late: number;
  soon: number;
  percent: number;
  files: number;
  /** أقرب مرحلةٍ لم تُنجز ولم يفت موعدها. */
  next: Ms | null;
  /** أقدم موعدٍ فائت لمرحلةٍ لم تُنجز — للترتيب «الأكثر تأخّراً». */
  oldestLate: number | null;
  defense: DefenseFilter;
  size: number;
}

export function isLate(m: Pick<Ms, "status" | "deadline">, now: number) {
  return m.status !== "completed" && (m.status === "overdue" || Date.parse(m.deadline) < now);
}

export function deriveRow(g: ProjectGroupListItem, now: number): Row {
  const ms = g.milestones ?? [];
  const completed = ms.filter((m) => m.status === "completed").length;
  const late = ms.filter((m) => isLate(m, now));
  const ahead = ms
    .filter((m) => m.status !== "completed" && !isLate(m, now))
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  const d = g.defense;
  return {
    g,
    total: ms.length,
    completed,
    late: late.length,
    soon: ahead.filter((m) => Date.parse(m.deadline) - now <= SOON_DAYS * DAY).length,
    percent: ms.length ? Math.round((completed / ms.length) * 100) : 0,
    files: ms.reduce((n, m) => n + (m._count?.submissions ?? 0), 0),
    next: ahead[0] ?? null,
    oldestLate: late.length ? Math.min(...late.map((m) => Date.parse(m.deadline))) : null,
    defense: !d || d.status === "cancelled" ? "none" : d.status === "completed" ? "completed" : "scheduled",
    size: g.members?.length ?? 0,
  };
}

export function healthOf(r: Row, h: Health): boolean {
  switch (h) {
    case "late":
      return r.late > 0;
    case "soon":
      return r.soon > 0;
    case "done":
      return r.total > 0 && r.completed === r.total;
    case "empty":
      return r.total === 0;
    default:
      return true;
  }
}

export function bandOf(r: Row): Band | null {
  if (r.total === 0) return null;
  return r.percent < 25 ? "q1" : r.percent < 50 ? "q2" : r.percent < 75 ? "q3" : "q4";
}

// ─────────────────────────────────────────────────────────────
//  البحث
// ─────────────────────────────────────────────────────────────

/** أين وقعت كلمات البحث، غير العنوان: يُقال على البطاقة لماذا جاءت. */
export interface Hit {
  kind: "student" | "registration" | "milestone" | "specialization" | "year" | "room";
  text: string;
}

type Field = { kind: Hit["kind"] | "title"; text: string; shown: string };

/** الحقول التي يُبحث فيها، كلٌّ بنوعه وبما يُعرض منه. */
function fields(g: ProjectGroupListItem): Field[] {
  const f = (kind: Field["kind"], text: string, shown = text): Field => ({ kind, text, shown });
  const out = [f("title", g.topic?.title ?? "")];
  for (const m of g.members ?? []) {
    const u = m.student?.user as Named;
    // يُبحث بالاسم بالحرفين، ويُعرض كما تقرؤه لغة الواجهة.
    const names = [u?.firstName, u?.lastName, u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ");
    if (names) out.push(f("student", names, personName(u)));
    if (m.student?.registrationNumber) out.push(f("registration", m.student.registrationNumber));
  }
  for (const m of g.milestones ?? []) out.push(f("milestone", m.title));
  if (g.topic?.specialization?.name) out.push(f("specialization", g.topic.specialization.name));
  if (g.topic?.academicYear?.title) out.push(f("year", g.topic.academicYear.title));
  if (g.defense?.room) out.push(f("room", g.defense.room));
  return out;
}

/**
 * البحث العامّ: كلّ كلمةٍ في حقلٍ ما (لا يلزم أن تجتمع في حقلٍ واحد):
 * «أحمد الاستمارة» تجد مذكرة أحمد التي فيها مرحلة «الاستمارة».
 *
 * والمفصّل (`by`): كلمات الحقل كلّها في عنصرٍ واحدٍ من نوعه — «أحمد قاسمي»
 * في اسم طالبٍ واحد، لا «أحمد» في طالبٍ و«قاسمي» في آخر.
 *
 * `null` إن لم تطابق؛ وإلّا ما طابق خارج العنوان، بلا تكرار.
 */
export function searchHits(g: ProjectGroupListItem, words: string[], by: FieldWords = {}): Hit[] | null {
  const asked = FIELD_KEYS.filter((k) => by[k]?.length);
  if (!words.length && !asked.length) return [];
  const all = fields(g).map((x) => ({ ...x, folded: foldText(x.text) }));
  if (!words.every((w) => all.some((x) => x.folded.includes(w)))) return null;
  const own = new Set<(typeof all)[number]>();
  for (const k of asked) {
    const mine = all.filter((x) => x.kind === k && by[k]!.every((w) => x.folded.includes(w)));
    if (!mine.length) return null;
    for (const x of mine) own.add(x);
  }
  const hits: Hit[] = [];
  for (const x of all) {
    if (x.kind === "title" || (!own.has(x) && !words.some((w) => x.folded.includes(w)))) continue;
    if (!hits.some((h) => h.kind === x.kind && h.text === x.shown)) hits.push({ kind: x.kind, text: x.shown });
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────
//  الفلترة والترتيب والأوجه
// ─────────────────────────────────────────────────────────────

export function passes(r: Row, f: BoardFilters, except?: keyof BoardFilters): boolean {
  const t = r.g.topic;
  if (except !== "health" && !healthOf(r, f.health)) return false;
  if (except !== "year" && f.year && t?.academicYear?.id !== f.year) return false;
  if (except !== "spec" && f.spec && t?.specialization?.id !== f.spec) return false;
  if (except !== "status" && f.status && t?.status !== f.status) return false;
  if (except !== "defense" && f.defense && r.defense !== f.defense) return false;
  if (except !== "files" && f.files && (f.files === "with") !== r.files > 0) return false;
  if (except !== "band" && f.band && bandOf(r) !== f.band) return false;
  if (except !== "size" && f.size && r.size !== Number(f.size)) return false;
  return true;
}

const BY: Record<Sort, (a: Row, b: Row, lang: string) => number> = {
  recent: (a, b) => Date.parse(b.g.createdAt) - Date.parse(a.g.createdAt),
  oldest: (a, b) => Date.parse(a.g.createdAt) - Date.parse(b.g.createdAt),
  // بلا موعدٍ قادم: في الآخر.
  deadline: (a, b) => (a.next ? Date.parse(a.next.deadline) : Infinity) - (b.next ? Date.parse(b.next.deadline) : Infinity),
  late: (a, b) => b.late - a.late || (a.oldestLate ?? Infinity) - (b.oldestLate ?? Infinity),
  progressDesc: (a, b) => b.percent - a.percent || b.total - a.total,
  progressAsc: (a, b) => a.percent - b.percent || b.total - a.total,
  title: (a, b, lang) => (a.g.topic?.title ?? "").localeCompare(b.g.topic?.title ?? "", lang),
};

/** مرتّبةً؛ والمتساويات على أحدثها، فلا يتبدّل ترتيبها بين رسمٍ وآخر. */
export function sortRows(rows: Row[], sort: Sort, lang: string): Row[] {
  return [...rows].sort((a, b) => {
    const d = BY[sort](a, b, lang);
    // `Infinity - Infinity` ليس رقماً: كلاهما بلا موعد.
    return (Number.isNaN(d) ? 0 : d) || BY.recent(a, b, lang) || a.g.id.localeCompare(b.g.id);
  });
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

/**
 * خيارات كلّ فلترٍ من المذكرات نفسها، وعددُ كلٍّ منها مع بقيّة الفلاتر
 * المطبّقة (لا مع فلتره هو): يُرى كم يبقى إن اختير.
 */
export function facets(rows: Row[], f: BoardFilters, words: string[], by: FieldWords = {}) {
  const searched = rows.filter((r) => searchHits(r.g, words, by) !== null);
  const count = (key: keyof BoardFilters, pick: (r: Row) => string | null | undefined, label: (r: Row) => string) => {
    const map = new Map<string, Facet>();
    for (const r of searched) {
      const v = pick(r);
      if (!v) continue;
      const e = map.get(v) ?? { value: v, label: label(r), count: 0 };
      if (passes(r, f, key)) e.count++;
      map.set(v, e);
    }
    return [...map.values()];
  };
  const t = (r: Row) => r.g.topic;
  return {
    health: Object.fromEntries(HEALTHS.map((h) => [h, searched.filter((r) => passes(r, f, "health") && healthOf(r, h)).length])) as Record<Health, number>,
    years: count("year", (r) => t(r)?.academicYear?.id, (r) => t(r)!.academicYear!.title).sort((a, b) => b.label.localeCompare(a.label)),
    specs: count("spec", (r) => t(r)?.specialization?.id, (r) => t(r)!.specialization!.name).sort((a, b) => a.label.localeCompare(b.label, "ar")),
    statuses: count("status", (r) => t(r)?.status, (r) => t(r)!.status!),
    defense: count("defense", (r) => r.defense, (r) => r.defense),
    files: count("files", (r) => (r.files > 0 ? "with" : "without"), (r) => (r.files > 0 ? "with" : "without")),
    bands: count("band", bandOf, (r) => bandOf(r)!),
    sizes: count("size", (r) => String(r.size), (r) => String(r.size)).sort((a, b) => Number(a.value) - Number(b.value)),
  };
}

/** عدد ما طُبّق من فلاتر اللوحة. */
export const panelCount = (f: BoardFilters) => PANEL_KEYS.filter((k) => !!f[k].trim()).length;
