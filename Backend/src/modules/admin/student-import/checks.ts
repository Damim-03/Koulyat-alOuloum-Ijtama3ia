import { AUTO_UNKNOWN, IMPORT_COLUMNS, type ColumnKey } from "./columns";
import type { RawRow } from "../import-kit/parser";
import { tr } from "../../../core/i18n";
import { latinDigits, sep } from "../import-kit/match";
import { required, RowCheck, type ReportRow } from "../import-kit/report";
import {
  checkPerson,
  compactDigits,
  groupBy,
  oddChars,
  others,
  personContext,
  type PersonContext,
} from "../import-kit/fields";
import {
  academicContext,
  checkAcademicYear,
  checkPlacement,
  type AcademicReference,
} from "../import-kit/academic";

export { fullNameKey } from "../import-kit/fields";
export type { RefSpec } from "../import-kit/academic";

/**
 * الحكم على صفٍّ من ملفّ استيراد الطلبة — خانةً خانة.
 *
 * الحقول الشخصية بقاعدة الاستيراد المشتركة (import-kit/fields)، والبيانات
 * الجامعية كذلك (import-kit/academic) — التخصص وحده يُحفظ، والكلية والقسم
 * والشعبة والمستوى تُشتقّ منه، وأيّ تعارضٍ معها خطأ. وما يخصّ الطالب هنا:
 * رقم التسجيل.
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

export type Reference = AcademicReference;

/** ما سبق إلى المنصّة ممّا في الملف — يُجلب بنداءاتٍ قليلة قبل الحكم. */
export interface Taken {
  regs: Map<string, { name: string; specialization: string }>;
  mails: Map<string, { role: string; name: string }>;
  /** طلبةٌ مسجَّلون، بالصورة المجرّدة لاسمهم ولقبهم باللاتينية. */
  names: Map<string, { registrationNumber: string }[]>;
}

const HEADER = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.header])) as Record<
  ColumnKey,
  string
>;

/** رقم التسجيل كما يُحفظ: أرقامٌ لاتينية بلا مسافاتٍ ولا شرطات. */
export const regDigits = compactDigits;

/** كلّ ما يحتاجه الحكم على صفّ، مبنيّاً مرّةً للملف كلّه. */
export function buildContext(ref: Reference, rows: RawRow<ColumnKey>[], taken: Taken) {
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
    academic: academicContext(ref),
    taken,
    person,
    regRows,
    regLength,
  };
}
export type CheckContext = ReturnType<typeof buildContext>;

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
  const blocked = (k: ColumnKey) => r.blocked(k);

  // ── رقم التسجيل ──
  let reg = "";
  {
    const k = "registrationNumber";
    const v = cells[k].value;
    if (!blocked(k)) {
      if (!v) error(k, required());
      else {
        const digits = regDigits(v);
        const odd = oddChars(latinDigits(v), /[\d\s\-.]/);
        if (odd) error(k, tr("imp.digitsOnly", { odd }));
        else if (!/^\d{6,20}$/.test(digits)) error(k, tr("imp.reg.length", { length: digits.length }));
        else {
          reg = digits;
          save(k, digits);
          if (/[٠-٩۰-۹]/.test(v)) info(k, tr("imp.arabicDigits"));
          if (/[\s\-.]/.test(v)) info(k, tr("imp.spacesRemoved"));
          const dup = others(ctx.regRows.get(digits), raw.row);
          const taken = ctx.taken.regs.get(digits);
          if (dup.length) error(k, tr("imp.duplicateInFile", { rows: dup.join(sep()) }));
          else if (taken) error(k, tr("imp.reg.taken", { name: taken.name, spec: taken.specialization }));
          else if (ctx.regLength && digits.length !== ctx.regLength)
            warn(k, tr("imp.reg.unusualLength", { length: digits.length, usual: ctx.regLength }));
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
        .map((s) => tr("imp.person.namesakeReg", { reg: s.registrationNumber })),
    noun: "student",
    identifier: { value: reg, kind: "registration" },
  });

  // ── السنة الجامعية، والتخصص وما يوافقه — بقاعدة الاستيراد المشتركة ──
  const academicYearId = checkAcademicYear(r, ctx.academic, { what: "students" });
  const spec = checkPlacement(r, raw, ctx.academic, AUTO_UNKNOWN);

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
