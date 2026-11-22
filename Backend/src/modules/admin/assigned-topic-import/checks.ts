import { ASSIGNED_COLUMNS, STUDENT_KEYS, type AssignedKey, type StudentKey } from "./columns";
import type { RawRow } from "../import-kit/parser";
import { tr } from "../../../core/i18n";
import { latinDigits, sep } from "../import-kit/match";
import { RowCheck, type ReportRow } from "../import-kit/report";
import { compactDigits, oddChars } from "../import-kit/fields";
import { checkTopicFields, type CheckContext, type TopicFields } from "../topic-import/checks";

/**
 * الحكم على صفٍّ من ملفّ استيراد المواضيع المُسنَدة — خانات الموضوع بقاعدة
 * استيراد المواضيع نفسها (checkTopicFields)، ثم الطلبة بقاعدة نافذة «إنشاء
 * موضوع وإسناده» ومقاعدها:
 *
 *   يُقبل كلّ طالبٍ لا مذكرة له ولا طلب فريقٍ قائم (قيد الانتظار أو مقبول،
 *     يقوده أو عضوٌ فيه) — كمرشّح «unassigned» الذي تبحث به المقاعد.
 *   واختلاف التخصّص أو السنة تنبيهٌ لا منع: الخادم يقبله، والإدارة تقرّر.
 *   والطالب لا يتكرّر في الملف: في صفّه ولا في صفٍّ آخر.
 *   والطالب الأوّل إلزاميّ، وهو المرسِل باسم الفريق.
 *   وعدد الطلبة لا يتجاوز «عدد الطلبة» في الموضوع.
 */

/** طالبٌ في المنصّة كتب الملف رقمه — بما يُحكم به عليه. */
export interface RefStudent {
  id: string;
  userId: string;
  registrationNumber: string;
  name: string;
  suspended: boolean;
  specializationId: string;
  specialization: string;
  academicYearId: string;
  year: string;
  /** عنوان موضوع مذكرته، إن كانت له. */
  project?: string;
  /** عنوان الموضوع الذي عليه طلبه القائم، إن كان. */
  request?: string;
}

export interface ReadyAssigned extends TopicFields {
  /** الطلبة بترتيب مقاعدهم — والأوّل المرسِل. */
  members: { id: string; userId: string; name: string }[];
}

/** رقم التسجيل كما يُحفظ: أرقامٌ لاتينية بلا مسافاتٍ ولا شرطات. */
export const regOf = compactDigits;

/** ما يُضاف إلى سياق المواضيع: الطلبة، ومواضع كلّ رقمٍ في الملف. */
export function withStudents(ctx: CheckContext, rows: RawRow<AssignedKey>[], students: RefStudent[]) {
  const seats = new Map<string, { row: number; key: StudentKey }[]>();
  for (const r of rows)
    for (const key of STUDENT_KEYS) {
      const reg = regOf(r.cells[key]?.text ?? "");
      if (reg) seats.set(reg, [...(seats.get(reg) ?? []), { row: r.row, key }]);
    }
  return { ...ctx, students: new Map(students.map((s) => [s.registrationNumber, s])), seats };
}
export type AssignedContext = ReturnType<typeof withStudents>;

/** The seat as its column is headed in the file — the file's own words. */
const seatName = (key: StudentKey) => `الطالب ${STUDENT_KEYS.indexOf(key) + 1}`;

/** يحكم على صفٍّ واحد. `ready` حاضرٌ إن لم يكن فيه خطأ. */
export function checkRow(
  raw: RawRow<AssignedKey>,
  ctx: AssignedContext,
): { report: ReportRow<AssignedKey>; ready?: ReadyAssigned } {
  const r = new RowCheck(raw, ASSIGNED_COLUMNS);
  const { fields, spec } = checkTopicFields(r, raw, ctx);

  // ── الطلبة، بترتيب مقاعدهم ──
  const members: (RefStudent & { key: StudentKey })[] = [];
  for (const k of STUDENT_KEYS) {
    const v = r.value(k);
    if (r.blocked(k)) continue;
    if (!v) {
      if (k === "student1") r.error(k, tr("imp.as.student1Required"));
      continue;
    }
    const reg = regOf(v);
    // الرقم كما كُتب أوّلاً — كمقعد النافذة — ثم بلا مسافاتٍ ولا شرطات.
    const s = ctx.students.get(v.trim()) ?? ctx.students.get(reg);
    if (!s) {
      const odd = oddChars(latinDigits(v), /[\d\s\-.]/);
      if (odd) r.error(k, tr("imp.as.regDigits", { odd }));
      else if (!/^\d{6,20}$/.test(reg)) r.error(k, tr("imp.as.regLength", { length: reg.length }));
      else r.error(k, tr("imp.as.noStudent", { reg }));
      continue;
    }
    const elsewhere = (ctx.seats.get(reg) ?? []).filter((x) => x.row !== raw.row || x.key !== k);
    const here = elsewhere.filter((x) => x.row === raw.row);
    if (here.length) {
      r.error(k, tr("imp.as.dupInRow", { seat: seatName(here[0]!.key) }));
      continue;
    }
    if (elsewhere.length) {
      r.error(k, tr("imp.as.elsewhere", { rows: [...new Set(elsewhere.map((x) => x.row))].join(sep()) }));
      continue;
    }
    if (s.project) {
      r.error(k, tr("imp.as.hasProject", { name: s.name, project: s.project }));
      continue;
    }
    if (s.request) {
      r.error(k, tr("imp.as.hasRequest", { name: s.name, request: s.request }));
      continue;
    }
    r.save(k, `${s.registrationNumber} — ${s.name}`);
    if (/[٠-٩۰-۹]/.test(v)) r.info(k, tr("imp.arabicDigits"));
    if (spec && s.specializationId !== spec.id)
      r.warn(k, tr("imp.as.otherSpec", { spec: s.specialization, topicSpec: spec.name }));
    if (fields && s.academicYearId !== fields.academicYearId) r.warn(k, tr("imp.as.otherYear", { year: s.year }));
    if (s.suspended) r.warn(k, tr("imp.as.suspended"));
    members.push({ ...s, key: k });
  }

  // ── عددهم ──
  if (fields && members.length > fields.maxStudents)
    r.error("maxStudents", tr("imp.as.maxBelow", { count: members.length }));

  const report = r.finish();
  if (report.errors > 0 || !fields || !members.length) return { report };
  return {
    report,
    ready: { ...fields, members: members.map((m) => ({ id: m.id, userId: m.userId, name: m.name })) },
  };
}
