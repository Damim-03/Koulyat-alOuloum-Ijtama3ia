import { prisma } from "../../../core/prisma/client";
import type { RawRow } from "./parser";
import { tr } from "../../../core/i18n";
import { didYouMean, latinDigits, listOf, loose, plain } from "./match";
import { required, type RowCheck } from "./report";
import { groupBy } from "./fields";

/**
 * البيانات الجامعية في ملفّات الاستيراد — السنة، والتخصص وما فوقه — لكلّ ما
 * يُستورد في تخصّص: الطلبة والمواضيع.
 *
 * التخصص وحده يُحفظ، والكلية والقسم والشعبة والمستوى تُشتقّ منه. فإن كتبها
 * المسؤول بيده قُورنت به، وأيّ تعارضٍ خطأ — لا يُحفظ شيءٌ في تخصّصٍ غير الذي
 * ظنّه. وإن لم يكن تخصّص، تُحقَّق وحدها: وجودُها، وتسلسلُها فيما بينها.
 */

export type AcademicKey = "academicYear" | "faculty" | "department" | "filiere" | "level" | "specialization";

export const LEVEL_LABEL: Record<string, string> = {
  licence: "ليسانس",
  master: "ماستر",
  doctorate: "دكتوراه",
};

export interface SpecForLabel {
  id: string;
  name: string;
  level: string;
  filiere: {
    name: string;
    department: { name: string; faculty: { name: string } };
  };
}

/**
 * اسم التخصص كما يظهر في القائمة المنسدلة — ويجب أن يدلّ على تخصّصٍ واحد.
 *
 * الاسم وحده ما لم يتكرّر؛ فإن تكرّر بين مستويين أُضيف المستوى، وإن تكرّر في
 * المستوى نفسه بين شعبتين أُضيفت الشعبة. والمستوى له عموده، فلا يُكرَّر في
 * الاسم بلا حاجة.
 */
export function specLabels<S extends SpecForLabel>(specs: S[]): Map<string, S> {
  const byName = new Map<string, number>();
  const byNameLevel = new Map<string, number>();
  for (const s of specs) {
    byName.set(s.name, (byName.get(s.name) ?? 0) + 1);
    const k = `${s.name}\u0000${s.level}`;
    byNameLevel.set(k, (byNameLevel.get(k) ?? 0) + 1);
  }
  // عُدّ كلّ تخصّصٍ أعلاه، فلكلّ اسمٍ ومستوىً عددُه.
  const out = new Map<string, S>();
  for (const s of specs) {
    let label = s.name;
    if (byName.get(s.name)! > 1) label += ` — ${LEVEL_LABEL[s.level] ?? s.level}`;
    if (byNameLevel.get(`${s.name}\u0000${s.level}`)! > 1)
      label += ` (${s.filiere.name})`;
    out.set(label, s);
  }
  return out;
}

// ── reference data ──

type Level = "licence" | "master" | "doctorate";
export interface RefSpec extends SpecForLabel {
  id: string;
  level: string;
  filiere: {
    id: string;
    name: string;
    department: { id: string; name: string; faculty: { id: string; name: string } };
  };
}
export interface AcademicReference {
  specs: RefSpec[];
  /** With its rules of students per topic, by level, when the administration set them (core/academic/team-size). */
  years: { id: string; title: string; isActive: boolean; archivedAt?: Date | null; teamSizes?: unknown }[];
  faculties: { id: string; name: string }[];
  departments: { id: string; name: string; facultyId: string }[];
  filieres: { id: string; name: string; departmentId: string }[];
}

/** الهيكل الجامعي والسنوات كما هي في المنصّة الآن — بخمسة نداءات. */
export async function loadAcademicReference(): Promise<AcademicReference> {
  const [specs, years, faculties, departments, filieres] = await Promise.all([
    prisma.specialization.findMany({
      select: {
        id: true,
        name: true,
        level: true,
        filiere: {
          select: {
            id: true,
            name: true,
            department: {
              select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      select: { id: true, title: true, isActive: true, archivedAt: true, teamSizes: true },
      orderBy: { title: "desc" },
    }),
    prisma.faculty.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, facultyId: true } }),
    prisma.filiere.findMany({ select: { id: true, name: true, departmentId: true } }),
  ]);
  return { specs: specs as RefSpec[], years, faculties, departments, filieres };
}

const LEVELS: Record<string, Level> = Object.fromEntries(
  (
    [
      ["ليسانس", "licence"],
      ["licence", "licence"],
      ["license", "licence"],
      ["l", "licence"],
      ["ماستر", "master"],
      ["master", "master"],
      ["m", "master"],
      ["دكتوراه", "doctorate"],
      ["دكتوراة", "doctorate"],
      ["doctorat", "doctorate"],
      ["doctorate", "doctorate"],
      ["d", "doctorate"],
    ] as const
  ).map(([k, v]) => [loose(k), v]),
);
const parseLevel = (s: string): Level | undefined => LEVELS[loose(s)];

type HierKey = "faculty" | "department" | "filiere" | "level";
const HIER: HierKey[] = ["faculty", "department", "filiere", "level"];

/**
 * The level as a message names it, in the request's language («Master»). The
 * cell itself keeps the file's word («ماستر», `LEVEL_LABEL`): it is what the
 * template's list holds.
 */
const levelName = (level: string) =>
  level in LEVEL_LABEL ? tr(`imp.level.${level as Level}`) : level;

const specPart = (s: RefSpec, k: HierKey) =>
  k === "faculty"
    ? s.filiere.department.faculty.name
    : k === "department"
      ? s.filiere.department.name
      : k === "filiere"
        ? s.filiere.name
        : (LEVEL_LABEL[s.level] ?? s.level);

const describeSpec = (s: RefSpec) =>
  tr("imp.spec.describe", { name: s.name, level: levelName(s.level), filiere: s.filiere.name });

/** ما يحتاجه الحكم على البيانات الجامعية، مبنيّاً مرّةً للملف كلّه. */
export function academicContext(ref: AcademicReference) {
  const labels = specLabels(ref.specs);
  const labelOf = new Map([...labels].map(([label, s]) => [s.id, label]));
  const byLabel = new Map([...labels].map(([label, s]) => [plain(label), s]));
  const byName = groupBy(ref.specs, (s) => plain(s.name));
  const byLoose = new Map<string, RefSpec[]>();
  for (const [label, s] of labels)
    for (const k of new Set([loose(label), loose(s.name)]))
      byLoose.set(k, [...new Set([...(byLoose.get(k) ?? []), s])]);

  return {
    ref,
    labelOf,
    byLabel,
    byName,
    byLoose,
    yearByLoose: new Map(ref.years.map((y) => [loose(y.title), y])),
    activeYear: ref.years.find((y) => y.isActive),
    entities: {
      faculty: groupBy(ref.faculties, (x) => loose(x.name)),
      department: groupBy(ref.departments, (x) => loose(x.name)),
      filiere: groupBy(ref.filieres, (x) => loose(x.name)),
    },
  };
}
export type AcademicContext = ReturnType<typeof academicContext>;

const entityNames = (ctx: AcademicContext, k: Exclude<HierKey, "level">): string[] =>
  (k === "faculty"
    ? ctx.ref.faculties
    : k === "department"
      ? ctx.ref.departments
      : ctx.ref.filieres
  ).map((x: { name: string }) => x.name);

/**
 * السنة الجامعية. ويُعاد معرّفها، أو "" إن لم تُقبل.
 *
 * `emptyIsActive`: الفارغة هي السنة الجارية (تملؤها المنصّة) — وإلّا فهي
 * إلزامية. و`what` لرسالة السنة المؤرشفة: «لا يُضاف إليها طلبة».
 */
export function checkAcademicYear<K extends string>(
  r: RowCheck<K | "academicYear">,
  ctx: AcademicContext,
  opts: { what: "students" | "topics"; emptyIsActive?: boolean },
): string {
  const k = "academicYear";
  const v = r.value(k);
  if (r.blocked(k)) return "";
  if (!v) {
    if (!opts.emptyIsActive) r.error(k, tr("imp.requiredF"));
    else if (!ctx.activeYear) r.error(k, tr("imp.year.noActive"));
    else if (ctx.activeYear.archivedAt)
      r.error(k, tr("imp.year.activeArchived", { year: ctx.activeYear.title, what: opts.what }));
    else {
      r.auto(k, ctx.activeYear.title);
      return ctx.activeYear.id;
    }
    return "";
  }
  const y = ctx.yearByLoose.get(loose(v));
  const titles = ctx.ref.years.map((x) => x.title);
  if (!y)
    r.error(
      k,
      /^\d{4}$/.test(latinDigits(v))
        ? tr("imp.year.writeFull", { example: `${v}/${Number(latinDigits(v)) + 1}` }) + didYouMean(v, titles)
        : tr("imp.year.unknown", { value: v, hint: didYouMean(v, titles), list: listOf(titles) }),
    );
  else if (y.archivedAt) r.error(k, tr("imp.year.archived", { year: y.title, what: opts.what }));
  else {
    r.save(k, y.title);
    if (ctx.activeYear && ctx.activeYear.id !== y.id)
      r.warn(k, tr("imp.year.notCurrent", { year: ctx.activeYear.title }));
    return y.id;
  }
  return "";
}

/**
 * التخصص، والكلية والقسم والشعبة والمستوى التي توافقه. ويُعاد التخصص إن
 * عُرف — وما كُتب في الأعمدة الأخرى يُقارن به، والفارغ تملؤه المنصّة منه.
 *
 * `autoUnknown`: ما تكتبه صيغ النموذج حين لا تجد التخصص — ليس قيمةً كتبها
 * المسؤول.
 */
export function checkPlacement<K extends string>(
  r: RowCheck<K | Exclude<AcademicKey, "academicYear">>,
  raw: RawRow<K | Exclude<AcademicKey, "academicYear">>,
  ctx: AcademicContext,
  autoUnknown: string,
): RefSpec | undefined {
  const cells = r.cells;
  // في أعمدة كلّ استيرادٍ يُحكم فيه على التخصص الكليةُ والقسم والشعبة والمستوى.
  const header = (k: HierKey) => r.columns.find((c) => c.key === k)!.header;
  const hint = (k: HierKey) => {
    const rc = raw.cells[k];
    if (!rc || rc.excelError || !rc.text || rc.text === autoUnknown) return undefined;
    return { key: k, text: rc.text, formula: !!rc.formula };
  };
  const hints = HIER.map(hint).filter((h) => !!h);
  const fits = (s: RefSpec, h: { key: HierKey; text: string }) =>
    h.key === "level" ? parseLevel(h.text) === s.level : loose(h.text) === loose(specPart(s, h.key));

  let spec: RefSpec | undefined;
  {
    const k = "specialization";
    const v = cells[k].value;
    if (!r.blocked(k)) {
      if (!v) r.error(k, required());
      else {
        const exact = ctx.byLabel.get(plain(v));
        const named = ctx.byName.get(plain(v)) ?? [];
        const fuzzy = ctx.byLoose.get(loose(v)) ?? [];
        const cands = exact ? [exact] : named.length ? named : fuzzy;
        if (cands.length === 1) spec = cands[0];
        else if (cands.length > 1) {
          const narrowed = cands.filter((s) => hints.every((h) => fits(s, h)));
          if (narrowed.length === 1) {
            spec = narrowed[0];
            r.info(
              k,
              tr("imp.spec.narrowedBy", { columns: hints.map((h) => `«${header(h.key)}»`).join(tr("imp.and")) }),
            );
          } else {
            const pool = narrowed.length ? narrowed : cands;
            r.error(k, tr("imp.spec.ambiguous", { value: v, count: pool.length, list: listOf(pool.map(describeSpec)) }));
          }
        } else {
          // ليس في المنصّة: يُقترح الأقرب — من نطاق ما كُتب في الأعمدة الأخرى إن دلّ.
          const typedHints = hints.filter((h) => !h.formula);
          const scoped = typedHints.length
            ? ctx.ref.specs.filter((s) => typedHints.every((h) => fits(s, h)))
            : [];
          const pool = scoped.length ? scoped : ctx.ref.specs;
          let m = tr("imp.spec.unknown", { value: v, hint: didYouMean(v, pool.map((s) => ctx.labelOf.get(s.id)!)) });
          if (scoped.length) m += tr("imp.spec.scoped", { list: listOf(scoped.map((s) => ctx.labelOf.get(s.id)!)) });
          r.error(k, m);
        }
        if (spec) {
          const label = ctx.labelOf.get(spec.id)!;
          r.save(k, plain(v) === plain(label) ? label : spec.name);
          if (!exact && !named.length)
            r.warn(k, tr("imp.spec.spelling", { name: spec.name }));
        }
      }
    }
  }

  if (spec) {
    // كلّ ما كُتب في الأعمدة الأخرى يُقارن بالتخصص؛ والفارغ تملؤه المنصّة منه.
    for (const k of HIER) {
      const platform = specPart(spec, k);
      // In a message the level is named in the request's language.
      const shown = k === "level" ? levelName(spec.level) : platform;
      const h = hint(k);
      if (!h) {
        r.auto(k, platform);
        continue;
      }
      if (fits(spec, h)) {
        if (h.formula) r.auto(k, platform);
        else r.save(k, platform);
        continue;
      }
      if (h.formula) {
        // صيغة النموذج نفسه، وقوائمه أقدم من المنصّة: لا ذنب للمسؤول فيها.
        r.auto(k, platform);
        r.warn(k, tr("imp.spec.templateOld", { file: h.text, platform: shown }));
        continue;
      }
      if (k === "level")
        r.error(
          k,
          parseLevel(h.text)
            ? tr("imp.spec.levelMismatch", { spec: spec.name, platform: shown })
            : tr("imp.spec.notALevel", { value: h.text, platform: shown }),
        );
      else {
        const exists = entityNames(ctx, k).some((n) => loose(n) === loose(h.text));
        r.error(
          k,
          exists
            ? tr("imp.spec.partMismatch", { spec: spec.name, part: tr(`imp.part.${k}`), platform })
            : tr(`imp.notIn.${k}`, { value: h.text, hint: didYouMean(h.text, entityNames(ctx, k)) }) +
                tr("imp.spec.ofSpec", { part: tr(`imp.of.${k}`), spec: spec.name, platform }),
        );
      }
    }
  } else {
    // لا تخصّص يُقارن به: ما كُتب يُتحقّق من وجوده، ومن تسلسله فيما بينه.
    const nameOf = new Map(
      [...ctx.ref.faculties, ...ctx.ref.departments, ...ctx.ref.filieres].map((x) => [x.id, x.name]),
    );
    const facOfDep = new Map(ctx.ref.departments.map((d) => [d.id, d.facultyId]));
    /** ما كُتب بيدٍ في العمود، أو لا شيء (فارغٌ أو صيغة النموذج). */
    const typed = (k: Exclude<HierKey, "level">) => {
      const h = hint(k);
      if (!h || h.formula) {
        if (cells[k].value) cells[k].state = "auto";
        return undefined;
      }
      return h.text;
    };
    const missing = (k: Exclude<HierKey, "level">, text: string) =>
      r.error(k, tr(`imp.notIn.${k}`, { value: text, hint: didYouMean(text, entityNames(ctx, k)) }));

    let facultyId: string | undefined;
    const fac = typed("faculty");
    if (fac) {
      const found = ctx.entities.faculty.get(loose(fac)) ?? [];
      if (!found.length) missing("faculty", fac);
      else {
        facultyId = found[0]!.id;
        r.save("faculty", found[0]!.name);
      }
    }
    let departmentId: string | undefined;
    const dep = typed("department");
    if (dep) {
      const found = ctx.entities.department.get(loose(dep)) ?? [];
      const inFac = facultyId ? found.filter((d) => d.facultyId === facultyId) : found;
      if (!found.length) missing("department", dep);
      else if (!inFac.length)
        r.error(
          "department",
          tr("imp.dep.notInFaculty", { faculty: nameOf.get(facultyId!)!, actual: nameOf.get(found[0]!.facultyId)! }),
        );
      else {
        departmentId = inFac[0]!.id;
        r.save("department", inFac[0]!.name);
      }
    }
    const fil = typed("filiere");
    if (fil) {
      const found = ctx.entities.filiere.get(loose(fil)) ?? [];
      const inParent = departmentId
        ? found.filter((x) => x.departmentId === departmentId)
        : facultyId
          ? found.filter((x) => facOfDep.get(x.departmentId) === facultyId)
          : found;
      if (!found.length) missing("filiere", fil);
      else if (!inParent.length)
        r.error(
          "filiere",
          departmentId
            ? tr("imp.fil.notInDepartment", { parent: nameOf.get(departmentId)!, actual: nameOf.get(found[0]!.departmentId)! })
            : tr("imp.fil.notInFaculty", { parent: nameOf.get(facultyId!)!, actual: nameOf.get(found[0]!.departmentId)! }),
        );
      else r.save("filiere", inParent[0]!.name);
    }
    const lh = hint("level");
    if (lh && !lh.formula) {
      const lv = parseLevel(lh.text);
      if (lv) r.save("level", LEVEL_LABEL[lv]!);
      else r.error("level", tr("imp.notALevel", { value: lh.text }));
    } else if (cells.level.value) cells.level.state = "auto";
  }

  return spec;
}
