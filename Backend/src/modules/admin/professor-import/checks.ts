import {
  ACADEMIC_RANKS,
  AUTO_UNKNOWN,
  PROFESSOR_COLUMNS,
  departmentLabels,
  type DepartmentForLabel,
  type ProfessorKey,
} from "./columns";
import type { RawRow } from "../import-kit/parser";
import { didYouMean, latinDigits, listOf, loose, plain } from "../import-kit/match";
import { REQUIRED, RowCheck, type ReportRow } from "../import-kit/report";
import {
  checkPerson,
  compactDigits,
  emailSchema,
  groupBy,
  oddChars,
  others,
  personContext,
  type PersonContext,
  type PersonFields,
} from "../import-kit/fields";

/**
 * الحكم على صفٍّ من ملفّ استيراد الأساتذة — خانةً خانة.
 *
 * الحقول الشخصية بقاعدة الاستيراد المشتركة، وما يخصّ الأستاذ هنا بقاعدة نافذة
 * «إضافة أستاذ» وخدمتها:
 *
 *   البريد الجامعي — إلزامي، به يدخل الأستاذ؛ ونطاقه من النطاقات الجامعية
 *     المسجَّلة في المنصّة (UniversityDomain)، ولا يتكرّر.
 *   الرقم الوظيفي — 13 رقماً إن كُتب، وإلّا ولّده النظام (EAN-13).
 *   القسم — إلزامي، والكلية تُشتقّ منه؛ فإن كُتبت بيدٍ قُورنت به.
 *   الرتبة والصفة — قوائم تُفصل بفاصلة؛ والرتبة من غير السلّم الرسميّ تنبيه.
 */

export interface ReadyProfessor extends PersonFields {
  universityEmail: string;
  /** ما كُتب في الملف؛ الغائب يُولَّد عند الإنشاء. */
  employeeNumber?: string;
  departmentId: string;
  grade: string[];
  tags: string[];
}

export interface Reference {
  faculties: { id: string; name: string }[];
  departments: DepartmentForLabel[];
  /** النطاقات الجامعية المسجَّلة، بحروفٍ صغيرة. */
  domains: string[];
}

/** ما سبق إلى المنصّة ممّا في الملف — يُجلب بنداءاتٍ قليلة قبل الحكم. */
export interface Taken {
  universityEmails: Map<string, { name: string }>;
  employeeNumbers: Map<string, { name: string }>;
  mails: Map<string, { role: string; name: string }>;
  /** أساتذةٌ مسجَّلون، بالصورة المجرّدة لاسمهم ولقبهم ← بريدهم الجامعي. */
  names: Map<string, string[]>;
}

const HEADER = Object.fromEntries(PROFESSOR_COLUMNS.map((c) => [c.key, c.header])) as Record<ProfessorKey, string>;
const RANK_BY_LOOSE = new Map(ACADEMIC_RANKS.map((r) => [loose(r), r]));

/** قائمةٌ في خانة: «أ، ب ,ج» ← [أ، ب، ج] بلا فراغٍ ولا تكرار. */
const splitList = (s: string) => [
  ...new Set(
    s
      .split(/[،,;؛\n]+/)
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  ),
];

/** كلّ ما يحتاجه الحكم على صفّ، مبنيّاً مرّةً للملف كلّه. */
export function buildContext(ref: Reference, rows: RawRow<ProfessorKey>[], taken: Taken) {
  const labels = departmentLabels(ref.departments);
  const labelOf = new Map([...labels].map(([label, d]) => [d.id, label]));
  const byLabel = new Map([...labels].map(([label, d]) => [plain(label), d]));
  const byName = groupBy(ref.departments, (d) => plain(d.name));
  const byLoose = new Map<string, DepartmentForLabel[]>();
  for (const [label, d] of labels)
    for (const k of new Set([loose(label), loose(d.name)]))
      byLoose.set(k, [...new Set([...(byLoose.get(k) ?? []), d])]);

  const person: PersonContext = { ...personContext(rows), takenMails: taken.mails };
  return {
    ref,
    taken,
    person,
    labelOf,
    byLabel,
    byName,
    byLoose,
    facultyByLoose: groupBy(ref.faculties, (f) => loose(f.name)),
    uniRows: groupBy(rows, (r) => (r.cells.universityEmail?.text ?? "").toLowerCase()),
    empRows: groupBy(rows, (r) => compactDigits(r.cells.employeeNumber?.text ?? "")),
  };
}
export type CheckContext = ReturnType<typeof buildContext>;

/** يحكم على صفٍّ واحد. `ready` حاضرٌ إن لم يكن فيه خطأ. */
export function checkRow(
  raw: RawRow<ProfessorKey>,
  ctx: CheckContext,
): { report: ReportRow<ProfessorKey>; ready?: ReadyProfessor } {
  const r = new RowCheck(raw, PROFESSOR_COLUMNS);
  const row = raw.row;

  // ── البريد الجامعي — به يدخل الأستاذ ──
  let universityEmail = "";
  {
    const k = "universityEmail";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, REQUIRED);
      else {
        const lower = v.toLowerCase();
        const domain = lower.split("@")[1] ?? "";
        const dup = others(ctx.uniRows.get(lower), row);
        const taken = ctx.taken.universityEmails.get(lower);
        const domains = ctx.ref.domains.map((d) => `@${d}`);
        if (/\s/.test(v)) r.error(k, "فيه مسافة.");
        else if (/[^\x21-\x7e]/.test(v)) r.error(k, `فيه حروفٌ لا تكون في البريد: «${oddChars(v, /[\x21-\x7e]/)}».`);
        else if (!emailSchema.safeParse(lower).success)
          r.error(k, `صيغة بريدٍ غير صحيحة، مثل name${domains[0] ?? "@univ.dz"}.`);
        else if (!ctx.ref.domains.length)
          r.error(k, "لا نطاقات جامعية مسجَّلة في المنصّة — أضِفها من الإعدادات أوّلاً.");
        else if (!ctx.ref.domains.includes(domain))
          r.error(
            k,
            `«@${domain}» ليس نطاقاً جامعياً مسجَّلاً.${didYouMean(domain, ctx.ref.domains)} النطاقات: ${domains.join("، ")}.`,
          );
        else if (dup.length) r.error(k, `مكرّر في الملف — في الصفّ ${dup.join("، ")} أيضاً.`);
        else if (taken) r.error(k, `مسجَّلٌ لأستاذٍ في المنصّة مسبقاً: ${taken.name || "—"}.`);
        if (!r.blocked(k)) {
          universityEmail = lower;
          r.save(k, lower);
        }
      }
    }
  }

  // ── الرقم الوظيفي — يُولَّد إن تُرك ──
  let employeeNumber: string | undefined;
  {
    const k = "employeeNumber";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.auto(k, "يُولَّد تلقائياً");
      else {
        const digits = compactDigits(v);
        const odd = oddChars(latinDigits(v), /[\d\s\-.]/);
        if (odd) r.error(k, `أرقامٌ فقط — فيه «${odd}».`);
        else if (digits.length !== 13) r.error(k, `13 رقماً بالضبط — فيه ${digits.length}. أو اتركه يُولَّد تلقائياً.`);
        else {
          const dup = others(ctx.empRows.get(digits), row);
          const taken = ctx.taken.employeeNumbers.get(digits);
          if (dup.length) r.error(k, `مكرّر في الملف — في الصفّ ${dup.join("، ")} أيضاً.`);
          else if (taken) r.error(k, `مسجَّلٌ لأستاذٍ في المنصّة مسبقاً: ${taken.name || "—"}.`);
          else {
            employeeNumber = digits;
            r.save(k, digits);
            if (/[٠-٩۰-۹]/.test(v)) r.info(k, "حُوِّلت الأرقام العربية إلى لاتينية.");
          }
        }
      }
    }
  }

  // ── الحقول الشخصية — بقاعدة الاستيراد المشتركة ──
  const person = checkPerson(r, ctx.person, {
    headers: { firstNameLatin: HEADER.firstNameLatin, lastNameLatin: HEADER.lastNameLatin },
    namesakes: (key) =>
      (ctx.taken.names.get(key) ?? []).filter((e) => e !== universityEmail).map((e) => `البريد ${e}`),
    noun: "أستاذٌ",
    pair: "أستاذان",
    identifier: employeeNumber ? { value: employeeNumber, label: "الرقم الوظيفي" } : undefined,
  });

  // ── القسم، والكلية التي توافقه ──
  const facHint = (() => {
    const rc = raw.cells.faculty;
    if (!rc || rc.excelError || !rc.text || rc.text === AUTO_UNKNOWN) return undefined;
    return { text: rc.text, formula: !!rc.formula };
  })();
  const facultyNames = ctx.ref.faculties.map((f) => f.name);
  const describe = (d: DepartmentForLabel) => `${d.name} (${d.faculty.name})`;

  let department: DepartmentForLabel | undefined;
  {
    const k = "department";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, REQUIRED);
      else {
        const exact = ctx.byLabel.get(plain(v));
        const named = ctx.byName.get(plain(v)) ?? [];
        const fuzzy = ctx.byLoose.get(loose(v)) ?? [];
        const cands = exact ? [exact] : named.length ? named : fuzzy;
        if (cands.length === 1) department = cands[0];
        else if (cands.length > 1) {
          const narrowed = facHint ? cands.filter((d) => loose(d.faculty.name) === loose(facHint.text)) : [];
          if (narrowed.length === 1) {
            department = narrowed[0];
            r.info(k, "الاسم لأكثر من قسم، وحدّدته «الكلية».");
          } else
            r.error(k, `«${v}» اسمٌ لـ${cands.length} أقسام: ${listOf(cands.map(describe))}. اختره من القائمة، أو املأ «الكلية».`);
        } else {
          const inFaculty =
            facHint && !facHint.formula
              ? ctx.ref.departments.filter((d) => loose(d.faculty.name) === loose(facHint.text))
              : [];
          const pool = inFaculty.length ? inFaculty : ctx.ref.departments;
          let m = `«${v}» ليس قسماً في المنصّة.${didYouMean(v, pool.map((d) => ctx.labelOf.get(d.id)!))}`;
          if (inFaculty.length) m += ` أقسام «${inFaculty[0]!.faculty.name}»: ${listOf(inFaculty.map((d) => d.name))}.`;
          r.error(k, m);
        }
        if (department) {
          const label = ctx.labelOf.get(department.id)!;
          r.save(k, plain(v) === plain(label) ? label : department.name);
          if (!exact && !named.length)
            r.warn(k, `كُتب بفرقٍ في الإملاء (همزة، تاء مربوطة، مسافة…) — المقصود «${department.name}».`);
        }
      }
    }
  }

  {
    const k = "faculty";
    if (department) {
      const platform = department.faculty.name;
      if (!facHint) r.auto(k, platform);
      else if (loose(facHint.text) === loose(platform)) {
        if (facHint.formula) r.auto(k, platform);
        else r.save(k, platform);
      } else if (facHint.formula) {
        // صيغة النموذج نفسه، وقوائمه أقدم من المنصّة: لا ذنب للمسؤول فيها.
        r.auto(k, platform);
        r.warn(k, `النموذج أقدم من المنصّة: فيه «${facHint.text}»، وفي المنصّة «${platform}» — يُعتمد ما في المنصّة.`);
      } else {
        const exists = facultyNames.some((n) => loose(n) === loose(facHint.text));
        r.error(
          k,
          exists
            ? `لا يوافق القسم «${department.name}» — كليته في المنصّة «${platform}».`
            : `«${facHint.text}» ليست كليةً في المنصّة.${didYouMean(facHint.text, facultyNames)} وكلية القسم «${department.name}»: «${platform}».`,
        );
      }
    } else if (facHint && !facHint.formula) {
      const found = ctx.facultyByLoose.get(loose(facHint.text)) ?? [];
      if (!found.length) r.error(k, `«${facHint.text}» ليست كليةً في المنصّة.${didYouMean(facHint.text, facultyNames)}`);
      else r.save(k, found[0]!.name);
    } else if (r.value(k)) r.cells.faculty.state = "auto";
  }

  // ── الرتبة — من السلّم الرسميّ أو غيره ──
  let grade: string[] = [];
  {
    const k = "grade";
    const v = r.value(k);
    if (v && !r.blocked(k)) {
      const items = splitList(v).map((g) => RANK_BY_LOOSE.get(loose(g)) ?? g);
      const unofficial = items.filter((g) => !ACADEMIC_RANKS.includes(g));
      if (items.length > 20) r.error(k, `${items.length} رتبة، والحدّ 20.`);
      else if (items.some((g) => g.length > 100)) r.error(k, "رتبةٌ أطول من 100 حرف — لعلّها ليست رتبة؟");
      else {
        grade = items;
        r.save(k, items.join("، "));
        if (unofficial.length)
          r.warn(
            k,
            `${listOf(unofficial)} ليست من السلّم الرسميّ (${ACADEMIC_RANKS.join("، ")}) — تُحفظ كما كُتبت.`,
          );
      }
    }
  }

  // ── الصفة — قائمةٌ حرّة ──
  let tags: string[] = [];
  {
    const k = "tags";
    const v = r.value(k);
    if (v && !r.blocked(k)) {
      const items = splitList(v);
      if (items.length > 20) r.error(k, `${items.length} صفة، والحدّ 20.`);
      else if (items.some((t) => t.length > 60)) r.error(k, "صفةٌ أطول من 60 حرفاً — افصل الصفات بفاصلة.");
      else {
        tags = items;
        r.save(k, items.join("، "));
      }
    }
  }

  const report = r.finish();
  if (report.errors > 0 || !department) return { report };
  return {
    report,
    ready: { ...person, universityEmail, employeeNumber, departmentId: department.id, grade, tags },
  };
}
