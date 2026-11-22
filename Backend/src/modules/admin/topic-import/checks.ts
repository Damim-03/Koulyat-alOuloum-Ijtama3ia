import { fits, levelName, readTeamSizes, type Level } from "../../../core/academic/team-size";
import {
  AUTO_UNKNOWN,
  LIMITS,
  STATUS_LABEL,
  TOPIC_COLUMNS,
  professorLabels,
  type ImportStatus,
  type ProfessorForLabel,
  type TopicKey,
} from "./columns";
import type { RawRow } from "../import-kit/parser";
import type { TopicStatus } from "../../../generated/prisma";
import { tr } from "../../../core/i18n";
import { didYouMean, latinDigits, listOf, loose, plain, sep } from "../import-kit/match";
import { required, RowCheck, type ReportRow } from "../import-kit/report";
import { compactDigits, groupBy, others } from "../import-kit/fields";
import {
  academicContext,
  checkAcademicYear,
  checkPlacement,
  type AcademicReference,
  type RefSpec,
} from "../import-kit/academic";

/**
 * الحكم على صفٍّ من ملفّ استيراد المواضيع — خانةً خانة، بقاعدة نافذة «إنشاء
 * موضوع» وخدمتها:
 *
 *   الأستاذ — من القائمة، أو بريده الجامعي، أو رقمه الوظيفي.
 *   العنوان والوصف — إلزاميان، بحدّ ما يحفظه عموداهما.
 *   الأهداف والمتطلّبات — قوائم، عنصرٌ في كلّ سطر.
 *   المراجع — عنوانٌ ورابط http(s) في كلّ سطر.
 *   السنة والتخصص — بقاعدة الاستيراد المشتركة (import-kit/academic)؛ والسنة
 *     الفارغة هي الجارية.
 *   الحالة — إلزامية، بأسمائها في الموقع: قيد الانتظار أو تمت الموافقة أو منشور.
 *
 * وموضوعٌ بالعنوان نفسه للأستاذ نفسه في السنة نفسها خطأ — في الملف أو في
 * المنصّة: هكذا لا يُنشئ ملفٌّ رُفع مرّتين كلّ مواضيعه مرّتين.
 */

export interface RefProfessor extends ProfessorForLabel {
  employeeNumber: string;
  departmentId: string;
  department: { name: string };
  user: ProfessorForLabel["user"] & { status: string };
}

export interface Reference extends AcademicReference {
  professors: RefProfessor[];
}

/** مواضيع في المنصّة لأساتذة الملف أو بعناوينه — يُجلب بنداءٍ واحد قبل الحكم. */
export interface ExistingTopic {
  title: string;
  status: TopicStatus;
  professorId: string;
  academicYearId: string;
  professorName: string;
  yearTitle: string;
}

/**
 * خانات الموضوع نفسه — كلّ ما في نافذة «إنشاء موضوع» — يشترك فيها الاستيرادان:
 * المواضيع (ومعها الحالة)، والمواضيع المُسنَدة (ومعها الطلبة).
 */
export type TopicFieldKey = Exclude<TopicKey, "status">;

/** موضوعٌ سلمت خاناته، قبل ما يخصّ كلّ استيراد. */
export type TopicFields = Omit<ReadyTopic, "status">;

export interface ReadyTopic {
  professorId: string;
  title: string;
  description: string;
  objectives: string[];
  requirements: string[];
  references: { title: string; url: string }[];
  maxStudents: number;
  maxRequests: number | null;
  specializationId: string;
  academicYearId: string;
  status: ImportStatus;
}

const STATUS_BY_LOOSE = new Map<string, ImportStatus>(
  (
    [
      ["تمت الموافقة", "approved"],
      ["تمت الموافقة عليه", "approved"],
      ["موافق عليه", "approved"],
      ["مقبول", "approved"],
      ["معتمد", "approved"],
      ["approved", "approved"],
      ["accepted", "approved"],
      ["accepté", "approved"],
      ["approuvé", "approved"],
      ["validé", "approved"],
      ["منشور", "open"],
      ["ينشر", "open"],
      ["نشر", "open"],
      ["مفتوح", "open"],
      ["open", "open"],
      ["published", "open"],
      ["publié", "open"],
      ["قيد الانتظار", "pending"],
      ["قيد المراجعة", "pending"],
      ["قيد الدراسة", "pending"],
      ["pending", "pending"],
      ["en attente", "pending"],
    ] as const
  ).map(([k, v]) => [loose(k), v]),
);

/**
 * اسم الحالة في رسالة، بلغة الطلب — «موجودٌ مسبقاً (حالته)». كلّ حالةٍ
 * بنوعها: حالةٌ تُضاف إلى المخطّط ولا مفتاح لها هنا لا تُبنى، بدل أن تظهر
 * باسمها الداخليّ في رسالة المسؤول.
 */
const statusWord = (s: TopicStatus) => tr(`imp.status.${s}`);
/** الحالات التي يقبلها الاستيراد، كما تُذكر في رسالة: «قيد الانتظار» أو «تمت الموافقة» أو «منشور». */
const statusOptions = () =>
  (Object.keys(STATUS_LABEL) as ImportStatus[]).map((s) => `«${statusWord(s)}»`).join(tr("imp.or"));

/** نقطةٌ أو رقمٌ أو شرطةٌ في أوّل البند: «- …»، «• …»، «1. …»، «٢) …». */
const BULLET = /^\s*(?:[-–—•·*▪◦]+|[\d٠-٩]{1,2}\s*[.)\-–]|\(\s*[\d٠-٩]{1,2}\s*\))\s*/;

/** خانةٌ فيها قائمة: بندٌ في كلّ سطرٍ أو بين فاصلتين منقوطتين، بلا نقاطٍ ولا أرقام. */
export const splitItems = (s: string) => [
  ...new Set(
    s
      .split(/\r?\n|[;؛]/)
      .map((x) => x.replace(BULLET, "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  ),
];

const URL_IN = /https?:\/\/[^\s<>"«»]+/i;

/**
 * مرجعٌ في سطر: «عنوانه — رابطه»، أو «رابطه» وحده فيُسمّى بموقعه. ويُعاد
 * سببُ رفضه إن لم يكن فيه رابط.
 */
export function parseReference(line: string): { title: string; url: string } | { problem: string } {
  const text = line.replace(BULLET, "").trim();
  const m = URL_IN.exec(text);
  if (!m) {
    if (/\bwww\.\S+/i.test(text)) return { problem: tr("imp.ref.www", { text }) };
    return { problem: tr("imp.ref.noLink", { text }) };
  }
  let url = m[0];
  // ترقيمٌ لصق الرابطَ في آخر الجملة ليس منه — إلّا قوساً فُتح فيه (روابط ويكيبيديا).
  while (/[.,;:،؛»\])]$/.test(url)) {
    // ينتهي بـ«)» هنا، فقوسُ الإغلاق موجودٌ مرّةً على الأقلّ.
    if (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) >= url.match(/\)/g)!.length) break;
    url = url.slice(0, -1);
  }
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { problem: tr("imp.ref.badUrl", { url }) };
  }
  if (url.length > LIMITS.url) return { problem: tr("imp.ref.urlTooLong", { max: LIMITS.url }) };
  const title = text
    .replace(m[0], " ")
    .replace(/^[\s:：\-–—|،,()[\]]+|[\s:：\-–—|،,()[\]]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title: (title || host).slice(0, LIMITS.item), url };
}

/** عددٌ صحيحٌ بين حدّين، أو سبب رفضه. */
function wholeNumber(v: string, min: number, max: number): number | string {
  const t = latinDigits(v).replace(/\s+/g, "");
  if (!/^\d+(\.0+)?$/.test(t)) return tr("imp.num.whole", { min, max, value: v });
  const n = Number(t);
  if (n < min || n > max) return tr("imp.num.range", { min, max, value: n });
  return n;
}

/** كلّ ما يحتاجه الحكم على صفّ، مبنيّاً مرّةً للملف كلّه. */
export function buildContext(ref: Reference, rows: RawRow<TopicFieldKey>[]) {
  const labels = professorLabels(ref.professors);
  const labelOf = new Map([...labels].map(([label, p]) => [p.id, label]));
  const byLabel = new Map([...labels].map(([label, p]) => [plain(label), p]));
  const byEmail = new Map(ref.professors.map((p) => [p.universityEmail.toLowerCase(), p]));
  const byNumber = new Map(ref.professors.map((p) => [p.employeeNumber, p]));
  // الاسم واللقب بأيّ ترتيب، باللاتينية أو بالعربية.
  const byName = new Map<string, RefProfessor[]>();
  for (const p of ref.professors) {
    const u = p.user;
    const keys = new Set(
      [
        [u.firstNameLatin, u.lastNameLatin],
        [u.firstName, u.lastName],
      ]
        .filter(([a, b]) => a && b)
        .flatMap(([a, b]) => [loose(`${a}${b}`), loose(`${b}${a}`)]),
    );
    for (const k of keys) byName.set(k, [...(byName.get(k) ?? []), p]);
  }

  return {
    ref,
    academic: academicContext(ref),
    labelOf,
    byLabel,
    byEmail,
    byNumber,
    byName,
    titleRows: groupBy(rows, (r) => loose(r.cells.title?.text ?? "")),
  };
}
export type BaseContext = ReturnType<typeof buildContext>;

export type ProfessorMatch =
  | { professor: RefProfessor; how: "label" | "email" | "number" | "name" }
  | { problem: string };

/** الأستاذ الذي تدلّ عليه الخانة — أو سبب ألّا يُعرف. */
export function matchProfessor(ctx: BaseContext, v: string): ProfessorMatch {
  const exact = ctx.byLabel.get(plain(v));
  if (exact) return { professor: exact, how: "label" };
  if (v.includes("@")) {
    const p = ctx.byEmail.get(v.trim().toLowerCase());
    if (p) return { professor: p, how: "email" };
    return {
      problem: tr("imp.prof.noEmail", { value: v, hint: didYouMean(v, ctx.ref.professors.map((x) => x.universityEmail)) }),
    };
  }
  const digits = compactDigits(v);
  const numbered = ctx.byNumber.get(v.trim()) ?? ctx.byNumber.get(digits);
  if (numbered) return { professor: numbered, how: "number" };
  if (/^\d+$/.test(digits)) return { problem: tr("imp.prof.noNumber", { value: digits }) };
  const named = ctx.byName.get(loose(v)) ?? [];
  if (named.length === 1) return { professor: named[0]!, how: "name" };
  if (named.length > 1)
    return {
      problem: tr("imp.prof.ambiguous", { value: v, count: named.length, list: listOf(named.map((p) => p.universityEmail)) }),
    };
  return {
    problem: tr("imp.prof.unknown", { value: v, hint: didYouMean(v, [...ctx.labelOf.values()]) }),
  };
}

/** صفّ الملف ← معرّف أستاذه، لكلّ صفٍّ عُرف أستاذه. */
export function professorsOf(base: BaseContext, rows: RawRow<TopicFieldKey>[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of rows) {
    const m = matchProfessor(base, r.cells.professor?.text ?? "");
    if ("professor" in m) out.set(r.row, m.professor.id);
  }
  return out;
}

/** ما بعد معرفة الأساتذة: المواضيع الموجودة، وتكرار الملف بالأستاذ والعنوان. */
export function withExisting(
  base: BaseContext,
  rows: RawRow<TopicFieldKey>[],
  profOf: Map<number, string>,
  existing: ExistingTopic[],
) {
  return {
    ...base,
    profOf,
    /** الأستاذ والعنوان ← صفوف الملف. */
    pairRows: groupBy(
      rows.filter((r) => profOf.has(r.row) && r.cells.title?.text),
      (r) => `${profOf.get(r.row)}|${loose(r.cells.title!.text)}`,
    ),
    existing: groupBy(existing, (t) => loose(t.title)),
  };
}
export type CheckContext = ReturnType<typeof withExisting>;

/**
 * يحكم على خانات الموضوع في صفّ — ويُعيدها إن سلمت. ولا يُنهي الصفّ: ما
 * بعدها (الحالة، أو الطلبة) لكلّ استيرادٍ وحده.
 */
export function checkTopicFields<K extends string>(
  r: RowCheck<K | TopicFieldKey>,
  raw: RawRow<K | TopicFieldKey>,
  ctx: CheckContext,
): { fields?: TopicFields; professor?: RefProfessor; spec?: RefSpec } {
  const row = raw.row;

  // ── الأستاذ ──
  let professor: RefProfessor | undefined;
  {
    const k = "professor";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, required());
      else {
        const m = matchProfessor(ctx, v);
        if ("problem" in m) r.error(k, m.problem);
        else {
          professor = m.professor;
          r.save(k, ctx.labelOf.get(professor.id)!);
          if (m.how === "email") r.info(k, tr("imp.prof.byEmail"));
          else if (m.how === "number") r.info(k, tr("imp.prof.byNumber"));
          if (professor.user.status === "suspended")
            r.warn(k, tr("imp.prof.suspended"));
        }
      }
    }
  }

  // ── العنوان ──
  let title = "";
  {
    const k = "title";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, required());
      else {
        const one = v.replace(/\s+/g, " ").trim();
        if (one.length > LIMITS.title)
          r.error(k, tr("imp.title.tooLong", { max: LIMITS.title, length: one.length }));
        else {
          title = one;
          r.save(k, one);
          if (/\n/.test(v)) r.info(k, tr("imp.title.joinedLines"));
          if (professor) {
            const dup = others(ctx.pairRows.get(`${professor.id}|${loose(one)}`), row);
            if (dup.length) r.error(k, tr("imp.title.dupSameProf", { rows: dup.join(sep()) }));
          }
          if (!r.blocked(k)) {
            // الصفّ نفسه في titleRows دائماً: «loose» تُسقط المسافات، فالعنوان المجموع مفتاحه مفتاح خانته.
            const sameTitle = ctx.titleRows.get(loose(one))!.filter(
              (x) => x.row !== row && ctx.profOf.get(x.row) !== professor?.id,
            );
            if (sameTitle.length)
              r.warn(k, tr("imp.title.otherProfInFile", { rows: sameTitle.map((x) => x.row).join(sep()) }));
          }
        }
      }
    }
  }

  // ── الوصف ──
  let description = "";
  {
    const k = "description";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, required());
      else if (v.length > LIMITS.description)
        r.error(k, tr("imp.desc.tooLong", { max: LIMITS.description, length: v.length }));
      else {
        description = v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
        if (description.length < 30) r.warn(k, tr("imp.desc.short"));
      }
    }
  }

  // ── الأهداف والمتطلّبات ──
  const list = (k: "objectives" | "requirements"): string[] => {
    const v = r.value(k);
    if (!v || r.blocked(k)) return [];
    const items = splitItems(v);
    if (items.length > LIMITS.items) r.error(k, tr("imp.items.tooMany", { count: items.length, max: LIMITS.items }));
    else if (items.some((x) => x.length > LIMITS.item))
      r.error(k, tr("imp.items.tooLong", { max: LIMITS.item }));
    else {
      r.save(k, items.map((x, i) => `${i + 1}. ${x}`).join("\n"));
      if (items.length === 1 && v.length > 150)
        r.warn(k, tr("imp.items.oneLong"));
      return items;
    }
    return [];
  };
  const objectives = list("objectives");
  const requirements = list("requirements");

  // ── المراجع ──
  const references: { title: string; url: string }[] = [];
  {
    const k = "references";
    const v = r.value(k);
    if (v && !r.blocked(k)) {
      const lines = v
        .split(/\r?\n|؛/)
        .map((x) => x.trim())
        .filter(Boolean);
      const problems: string[] = [];
      for (const line of lines) {
        const ref = parseReference(line);
        if ("problem" in ref) problems.push(ref.problem);
        else if (!references.some((x) => x.url === ref.url)) references.push(ref);
      }
      if (problems.length)
        r.error(k, problems.slice(0, 3).join(" · ") + (problems.length > 3 ? tr("imp.refs.more", { count: problems.length - 3 }) : ""));
      else if (references.length > LIMITS.references)
        r.error(k, tr("imp.refs.tooMany", { count: references.length, max: LIMITS.references }));
      else r.save(k, references.map((x) => (x.title === x.url ? x.url : `${x.title} — ${x.url}`)).join("\n"));
    }
  }

  // ── عدد الطلبة، وسقف الطلبات ──
  // Empty, it is the year's number when the administration set one — known once the year is read, below.
  let maxStudents = 0;
  let maxStudentsEmpty = false;
  {
    const k = "maxStudents";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) maxStudentsEmpty = true;
      else {
        const n = wholeNumber(v, 1, LIMITS.maxStudents);
        if (typeof n === "string") r.error(k, n);
        else {
          maxStudents = n;
          r.save(k, String(n));
        }
      }
    }
  }
  let maxRequests: number | null = null;
  {
    const k = "maxRequests";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.auto(k, tr("imp.noLimit"));
      else {
        const n = wholeNumber(v, 1, LIMITS.maxRequests);
        if (typeof n === "string") r.error(k, n);
        else {
          maxRequests = n;
          r.save(k, String(n));
        }
      }
    }
  }

  // ── السنة الجامعية، والتخصص وما يوافقه — بقاعدة الاستيراد المشتركة ──
  const academicYearId = checkAcademicYear(r, ctx.academic, { what: "topics", emptyIsActive: true });

  const spec = checkPlacement(r, raw, ctx.academic, AUTO_UNKNOWN);

  // ── وقاعدة السنة لمستوى التخصّص، إن قرّرتها الإدارة (core/academic/team-size) ──
  {
    const k = "maxStudents";
    const year = ctx.academic.ref.years.find((y) => y.id === academicYearId);
    const level = spec?.level as Level | undefined;
    const rule = year && level ? readTeamSizes(year.teamSizes)[level] : undefined;
    if (!r.blocked(k)) {
      const where = rule && { count: rule.n, max: rule.n, year: year!.title, level: levelName(level!) };
      if (maxStudentsEmpty) {
        if (rule) {
          maxStudents = rule.n;
          r.auto(k, String(rule.n));
          r.info(k, tr("imp.teamSize.auto", where!));
        } else r.error(k, required());
      } else if (rule && maxStudents && !fits(rule, maxStudents))
        r.error(k, tr(rule.mode === "exact" ? "imp.teamSize.mismatch" : "imp.teamSize.max", { ...where!, value: maxStudents }));
    }
  }
  if (spec && professor && spec.filiere.department.id !== professor.departmentId)
    r.info(
      "specialization",
      tr("imp.spec.otherDepartment", { spec: spec.filiere.department.name, professor: professor.department.name }),
    );

  // ── في المنصّة مسبقاً ──
  if (title && professor && academicYearId && !r.blocked("title")) {
    const same = ctx.existing.get(loose(title)) ?? [];
    const mine = same.filter((t) => t.professorId === professor!.id && t.academicYearId === academicYearId);
    const live = mine.filter((t) => t.status !== "rejected");
    if (live.length)
      r.error(
        "title",
        tr("imp.title.exists", { status: statusWord(live[0]!.status) }),
      );
    else {
      if (mine.length) r.warn("title", tr("imp.title.rejectedBefore"));
      const theirs = same.filter((t) => t.professorId !== professor!.id && t.academicYearId === academicYearId);
      if (theirs.length)
        r.warn("title", tr("imp.title.othersHave", { list: listOf(theirs.map((t) => t.professorName)) }));
      const before = same.filter((t) => t.professorId === professor!.id && t.academicYearId !== academicYearId);
      if (before.length) r.info("title", tr("imp.title.proposedBefore", { list: listOf(before.map((t) => t.yearTitle)) }));
    }
  }

  if (!professor || !spec) return { professor, spec };
  return {
    professor,
    spec,
    fields: {
      professorId: professor.id,
      title,
      description,
      objectives,
      requirements,
      references,
      maxStudents,
      maxRequests,
      specializationId: spec.id,
      academicYearId,
    },
  };
}

/** يحكم على صفٍّ واحد. `ready` حاضرٌ إن لم يكن فيه خطأ. */
export function checkRow(
  raw: RawRow<TopicKey>,
  ctx: CheckContext,
): { report: ReportRow<TopicKey>; ready?: ReadyTopic } {
  const r = new RowCheck(raw, TOPIC_COLUMNS);
  const { fields } = checkTopicFields(r, raw, ctx);

  // ── الحالة — إلزامية، بأسمائها في الموقع ──
  let status: ImportStatus | undefined;
  {
    const k = "status";
    const v = r.value(k);
    if (!r.blocked(k)) {
      if (!v) r.error(k, tr("imp.status.required", { options: statusOptions() }));
      else {
        const s = STATUS_BY_LOOSE.get(loose(v));
        if (!s)
          r.error(
            k,
            tr("imp.status.unknown", {
              value: v,
              options: statusOptions(),
              hint: didYouMean(v, (Object.keys(STATUS_LABEL) as ImportStatus[]).map(statusWord)),
            }),
          );
        else {
          status = s;
          r.save(k, STATUS_LABEL[s]);
        }
      }
    }
  }

  const report = r.finish();
  if (report.errors > 0 || !fields || !status) return { report };
  return { report, ready: { ...fields, status } };
}

