import { AUTO_UNKNOWN, IMPORT_COLUMNS, LEVEL_LABEL, specLabels, type ColumnKey, type SpecForLabel } from "./columns";
import type { RawRow } from "../import-kit/parser";
import { didYouMean, latinDigits, listOf, loose, plain } from "../import-kit/match";
import { REQUIRED, RowCheck, type ReportRow } from "../import-kit/report";
import {
  checkPerson,
  compactDigits,
  groupBy,
  oddChars,
  others,
  personContext,
  type PersonContext,
} from "../import-kit/fields";

export { fullNameKey } from "../import-kit/fields";

/**
 * الحكم على صفٍّ من ملفّ استيراد الطلبة — خانةً خانة.
 *
 * الحقول الشخصية بقاعدة الاستيراد المشتركة (import-kit/fields)، وما يخصّ
 * الطالب هنا: رقم التسجيل، والسنة الجامعية، والبيانات الجامعية — والتخصص وحده
 * يُحفظ، والكلية والقسم والشعبة والمستوى تُشتقّ منه. فإن كتبها المسؤول بيده
 * قُورنت به، وأيّ تعارضٍ خطأ — لا يُحفظ طالبٌ في تخصّصٍ غير الذي ظنّه.
 */

export interface ReadyStudent {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  firstNameLatin?: string;
  lastNameLatin?: string;
  gender?: "male" | "female";
  isVerified: boolean;
  email?: string;
  phone?: string;
  /** ما كُتب في الملف؛ الغائب يُولَّد عند الإنشاء. */
  password?: string;
  specializationId: string;
  academicYearId: string;
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
export interface Reference {
  specs: RefSpec[];
  years: { id: string; title: string; isActive: boolean; archivedAt?: Date | null }[];
  faculties: { id: string; name: string }[];
  departments: { id: string; name: string; facultyId: string }[];
  filieres: { id: string; name: string; departmentId: string }[];
}

/** ما سبق إلى المنصّة ممّا في الملف — يُجلب بنداءاتٍ قليلة قبل الحكم. */
export interface Taken {
  regs: Map<string, { name: string; specialization: string }>;
  mails: Map<string, { role: string; name: string }>;
  /** طلبةٌ مسجَّلون، بالصورة المجرّدة لاسمهم ولقبهم. */
  names: Map<string, { registrationNumber: string }[]>;
}

const HEADER = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.header])) as Record<
  ColumnKey,
  string
>;

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

/** رقم التسجيل كما يُحفظ: أرقامٌ لاتينية بلا مسافاتٍ ولا شرطات. */
export const regDigits = compactDigits;

type HierKey = "faculty" | "department" | "filiere" | "level";
const HIER: HierKey[] = ["faculty", "department", "filiere", "level"];
const HIER_OF: Record<HierKey, string> = {
  faculty: "كليته",
  department: "قسمه",
  filiere: "شعبته",
  level: "مستواه",
};
const NOT_IN_PLATFORM: Record<Exclude<HierKey, "level">, string> = {
  faculty: "ليست كليةً في المنصّة",
  department: "ليس قسماً في المنصّة",
  filiere: "ليست شعبةً في المنصّة",
};

const specPart = (s: RefSpec, k: HierKey) =>
  k === "faculty"
    ? s.filiere.department.faculty.name
    : k === "department"
      ? s.filiere.department.name
      : k === "filiere"
        ? s.filiere.name
        : (LEVEL_LABEL[s.level] ?? s.level);

const describeSpec = (s: RefSpec) =>
  `${s.name} — ${LEVEL_LABEL[s.level] ?? s.level}، شعبة ${s.filiere.name}`;

/** كلّ ما يحتاجه الحكم على صفّ، مبنيّاً مرّةً للملف كلّه. */
export function buildContext(ref: Reference, rows: RawRow<ColumnKey>[], taken: Taken) {
  const labels = specLabels(ref.specs);
  const labelOf = new Map([...labels].map(([label, s]) => [s.id, label]));
  const byLabel = new Map([...labels].map(([label, s]) => [plain(label), s]));
  const byName = groupBy(ref.specs, (s) => plain(s.name));
  const byLoose = new Map<string, RefSpec[]>();
  for (const [label, s] of labels)
    for (const k of new Set([loose(label), loose(s.name)]))
      byLoose.set(k, [...new Set([...(byLoose.get(k) ?? []), s])]);

  const regRows = groupBy(rows, (r) => regDigits(r.cells.registrationNumber?.text ?? ""));

  // طول رقم التسجيل الغالب: إن اتّفق عليه أغلب الملف فالشاذّ عنه يُنبَّه عليه.
  const lengths = [...regRows.keys()].filter((k) => /^\d{6,20}$/.test(k)).map((k) => k.length);
  let regLength: number | undefined;
  if (lengths.length >= 5) {
    const counts = groupBy(lengths, String);
    const [len, list] = [...counts].sort((a, b) => b[1].length - a[1].length)[0]!;
    if (list.length / lengths.length >= 0.8) regLength = Number(len);
  }

  const person: PersonContext = { ...personContext(rows), takenMails: taken.mails };
  return {
    ref,
    taken,
    person,
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
    regRows,
    regLength,
  };
}
export type CheckContext = ReturnType<typeof buildContext>;

const entityNames = (ctx: CheckContext, k: Exclude<HierKey, "level">): string[] =>
  (k === "faculty"
    ? ctx.ref.faculties
    : k === "department"
      ? ctx.ref.departments
      : ctx.ref.filieres
  ).map((x: { name: string }) => x.name);

/** يحكم على صفٍّ واحد. `ready` حاضرٌ إن لم يكن فيه خطأ. */
export function checkRow(
  raw: RawRow<ColumnKey>,
  ctx: CheckContext,
): { report: ReportRow<ColumnKey>; ready?: ReadyStudent } {
  const r = new RowCheck(raw, IMPORT_COLUMNS);
  const cells = r.cells;
  const error = (k: ColumnKey, m: string) => r.error(k, m);
  const warn = (k: ColumnKey, m: string) => r.warn(k, m);
  const info = (k: ColumnKey, m: string) => r.info(k, m);
  const save = (k: ColumnKey, v: string) => r.save(k, v);
  const auto = (k: ColumnKey, v: string) => r.auto(k, v);
  const blocked = (k: ColumnKey) => r.blocked(k);

  // ── رقم التسجيل ──
  let reg = "";
  {
    const k = "registrationNumber";
    const v = cells[k].value;
    if (!blocked(k)) {
      if (!v) error(k, REQUIRED);
      else {
        const digits = regDigits(v);
        const odd = oddChars(latinDigits(v), /[\d\s\-.]/);
        if (odd) error(k, `أرقامٌ فقط — فيه «${odd}».`);
        else if (!/^\d{6,20}$/.test(digits))
          error(k, `فيه ${digits.length} أرقام، والمقبول من 6 إلى 20.`);
        else {
          reg = digits;
          save(k, digits);
          if (/[٠-٩۰-۹]/.test(v)) info(k, "حُوِّلت الأرقام العربية إلى لاتينية.");
          if (/[\s\-.]/.test(v)) info(k, "حُذفت المسافات والشرطات.");
          const dup = others(ctx.regRows.get(digits), raw.row);
          const taken = ctx.taken.regs.get(digits);
          if (dup.length) error(k, `مكرّر في الملف — في الصفّ ${dup.join("، ")} أيضاً.`);
          else if (taken)
            error(k, `مسجَّلٌ في المنصّة مسبقاً: ${taken.name || "طالب"} — ${taken.specialization}.`);
          else if (ctx.regLength && digits.length !== ctx.regLength)
            warn(k, `فيه ${digits.length} أرقام، وأغلب أرقام الملف ${ctx.regLength} — تأكّد منه.`);
        }
      }
    }
  }

  // ── الحقول الشخصية — بقاعدة الاستيراد المشتركة ──
  const person = checkPerson(r, ctx.person, {
    headers: { firstNameLatin: HEADER.firstNameLatin, lastNameLatin: HEADER.lastNameLatin },
    namesakes: (key) =>
      (ctx.taken.names.get(key) ?? [])
        .filter((s) => s.registrationNumber !== reg)
        .map((s) => `رقم ${s.registrationNumber}`),
    noun: "طالبٌ",
    pair: "طالبان",
    identifier: { value: reg, label: "رقم التسجيل" },
  });

  // ── السنة الجامعية ──
  let academicYearId = "";
  {
    const k = "academicYear";
    const v = cells[k].value;
    if (!blocked(k)) {
      if (!v) error(k, "إلزامية — الخانة فارغة.");
      else {
        const y = ctx.yearByLoose.get(loose(v));
        const titles = ctx.ref.years.map((x) => x.title);
        if (!y)
          error(
            k,
            /^\d{4}$/.test(latinDigits(v))
              ? `اكتبها كاملة، مثل ${v}/${Number(latinDigits(v)) + 1}.${didYouMean(v, titles)}`
              : `«${v}» ليست سنةً في المنصّة.${didYouMean(v, titles)} السنوات فيها: ${listOf(titles)}.`,
          );
        else if (y.archivedAt)
          error(k, `السنة ${y.title} مغلقةٌ ومحفوظة في الأرشيف — لا يُضاف إليها طلبة.`);
        else {
          academicYearId = y.id;
          save(k, y.title);
          if (ctx.activeYear && ctx.activeYear.id !== y.id)
            warn(k, `ليست السنة الجامعية الجارية (${ctx.activeYear.title}).`);
        }
      }
    }
  }

  // ── البيانات الجامعية: التخصص، وما يوافقه ──
  const hint = (k: HierKey) => {
    const rc = raw.cells[k];
    if (!rc || rc.excelError || !rc.text || rc.text === AUTO_UNKNOWN) return undefined;
    return { key: k, text: rc.text, formula: !!rc.formula };
  };
  const hints = HIER.map(hint).filter((h) => !!h);
  const fits = (s: RefSpec, h: { key: HierKey; text: string }) =>
    h.key === "level" ? parseLevel(h.text) === s.level : loose(h.text) === loose(specPart(s, h.key));

  let spec: RefSpec | undefined;
  {
    const k = "specialization";
    const v = cells[k].value;
    if (!blocked(k)) {
      if (!v) error(k, REQUIRED);
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
            info(
              k,
              `الاسم لأكثر من تخصّص، وحدّده ما في ${hints.map((h) => `«${HEADER[h.key]}»`).join(" و")}.`,
            );
          } else {
            const pool = narrowed.length ? narrowed : cands;
            error(
              k,
              `«${v}» اسمٌ لـ${pool.length} تخصّصات: ${listOf(pool.map(describeSpec))}. اختره من القائمة بمستواه، أو املأ «المستوى» أو «الشعبة».`,
            );
          }
        } else {
          // ليس في المنصّة: يُقترح الأقرب — من نطاق ما كُتب في الأعمدة الأخرى إن دلّ.
          const typedHints = hints.filter((h) => !h.formula);
          const scoped = typedHints.length
            ? ctx.ref.specs.filter((s) => typedHints.every((h) => fits(s, h)))
            : [];
          const pool = scoped.length ? scoped : ctx.ref.specs;
          let m = `«${v}» ليس تخصّصاً في المنصّة.${didYouMean(v, pool.map((s) => ctx.labelOf.get(s.id)!))}`;
          if (scoped.length)
            m += ` التخصصات فيما كُتب من الكلية والقسم والشعبة والمستوى: ${listOf(scoped.map((s) => ctx.labelOf.get(s.id)!))}.`;
          error(k, m);
        }
        if (spec) {
          const label = ctx.labelOf.get(spec.id)!;
          save(k, plain(v) === plain(label) ? label : spec.name);
          if (!exact && !named.length)
            warn(k, `كُتب بفرقٍ في الإملاء (همزة، تاء مربوطة، مسافة…) — المقصود «${spec.name}».`);
        }
      }
    }
  }

  if (spec) {
    // كلّ ما كُتب في الأعمدة الأخرى يُقارن بالتخصص؛ والفارغ تملؤه المنصّة منه.
    for (const k of HIER) {
      const platform = specPart(spec, k);
      const h = hint(k);
      if (!h) {
        auto(k, platform);
        continue;
      }
      if (fits(spec, h)) {
        if (h.formula) auto(k, platform);
        else save(k, platform);
        continue;
      }
      if (h.formula) {
        // صيغة النموذج نفسه، وقوائمه أقدم من المنصّة: لا ذنب للمسؤول فيها.
        auto(k, platform);
        warn(k, `النموذج أقدم من المنصّة: فيه «${h.text}»، وفي المنصّة «${platform}» — يُعتمد ما في المنصّة.`);
        continue;
      }
      if (k === "level")
        error(
          k,
          parseLevel(h.text)
            ? `لا يوافق التخصص «${spec.name}» — مستواه في المنصّة «${platform}».`
            : `«${h.text}» ليس مستوى — ليسانس أو ماستر أو دكتوراه. ومستوى التخصص «${platform}».`,
        );
      else {
        const exists = entityNames(ctx, k).some((n) => loose(n) === loose(h.text));
        error(
          k,
          exists
            ? `لا يوافق التخصص «${spec.name}» — ${HIER_OF[k]} في المنصّة «${platform}».`
            : `«${h.text}» ${NOT_IN_PLATFORM[k]}.${didYouMean(h.text, entityNames(ctx, k))} و${HIER_OF[k]} التخصص «${spec.name}»: «${platform}».`,
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
      error(k, `«${text}» ${NOT_IN_PLATFORM[k]}.${didYouMean(text, entityNames(ctx, k))}`);

    let facultyId: string | undefined;
    const fac = typed("faculty");
    if (fac) {
      const found = ctx.entities.faculty.get(loose(fac)) ?? [];
      if (!found.length) missing("faculty", fac);
      else {
        facultyId = found[0]!.id;
        save("faculty", found[0]!.name);
      }
    }
    let departmentId: string | undefined;
    const dep = typed("department");
    if (dep) {
      const found = ctx.entities.department.get(loose(dep)) ?? [];
      const inFac = facultyId ? found.filter((d) => d.facultyId === facultyId) : found;
      if (!found.length) missing("department", dep);
      else if (!inFac.length)
        error(
          "department",
          `ليس من كلية «${nameOf.get(facultyId!)}» — هو في «${nameOf.get(found[0]!.facultyId)}».`,
        );
      else {
        departmentId = inFac[0]!.id;
        save("department", inFac[0]!.name);
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
        error(
          "filiere",
          `ليست من ${departmentId ? `قسم «${nameOf.get(departmentId)}»` : `كلية «${nameOf.get(facultyId!)}»`} — هي في قسم «${nameOf.get(found[0]!.departmentId)}».`,
        );
      else save("filiere", inParent[0]!.name);
    }
    const lh = hint("level");
    if (lh && !lh.formula) {
      const lv = parseLevel(lh.text);
      if (lv) save("level", LEVEL_LABEL[lv]!);
      else error("level", `«${lh.text}» ليس مستوى — ليسانس أو ماستر أو دكتوراه.`);
    } else if (cells.level.value) cells.level.state = "auto";
  }

  const report = r.finish();
  if (report.errors > 0 || !spec) return { report };
  return {
    report,
    ready: {
      registrationNumber: reg,
      ...person,
      specializationId: spec.id,
      academicYearId,
    },
  };
}
