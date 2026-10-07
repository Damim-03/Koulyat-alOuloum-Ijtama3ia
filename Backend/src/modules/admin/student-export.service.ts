import ExcelJS from "exceljs";

import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { LEVEL_LABEL } from "./student-import/columns";
import { studentAcademicWhere, type StudentAcademicFilter } from "./student-filters";

/**
 * قوائم الطلبة في ملفّ Excel — بالفلاتر نفسها التي في صفحة الطلبة.
 *
 * - `bySpecialization` (الأصل): ورقةٌ لكلّ تخصص، في رأسها اسمه وهرمه وسنته
 *   وعدد طلبته — قائمةٌ تُطبع وتُعلَّق كما هي.
 * - `single`: ورقةٌ واحدة بكلّ الطلبة، تُرشَّح وتُفرز في Excel.
 *
 * وفي الشكلين أعمدة الكلية والقسم والشعبة والمستوى والتخصص لكلّ طالب.
 *
 * والاسم واللقب باللاتينية أوّلاً — وهما الإلزاميان — ثم العربيّان. والترتيب
 * أبجديٌّ باللقب اللاتيني، كما تُكتب القوائم الرسمية.
 */

export interface ExportStudentsQuery extends StudentAcademicFilter {
  layout: "bySpecialization" | "single";
  /**
   * الخانة التي لا قيمة لها: «لا يوجد» (أوضح للقراءة والطباعة)، أو فارغةٌ
   * فعلاً — والتعبئة السريعة في Excel (Ctrl+E) لا تملأ إلّا الفارغ، فمن
   * سيُكمل الملف بها يختار الفارغة.
   */
  empty: "none" | "blank";
}

/** فوق هذا تصير قائمةً لا يقرؤها أحد — والفلاتر أولى. */
const MAX_ROWS = 10_000;

const BRAND = "FF26423D";
const GOLD = "FFC1965A";
const ZEBRA = "FFF4F1E8";
const LEVEL_ORDER: Record<string, number> = { licence: 0, master: 1, doctorate: 2 };

/**
 * ما يُكتب في خانةٍ لا قيمة لها (هاتف، بريد، اسمٌ عربيّ…): خانةٌ فارغة تُقرأ
 * سهواً أو نسياناً، و«لا يوجد» تقول إنّها فارغةٌ في المنصّة نفسها.
 *
 * ويُكتب في الملف وحده: لا يُحفظ في المنصّة شيء. فإذا أُضيف الهاتف أو البريد
 * إلى حساب الطالب، ظهر في أوّل تصديرٍ بعده.
 */
const NONE = "لا يوجد";
const MUTED = "FF9A9384";
const GENDER_AR: Record<string, string> = { male: "ذكر", female: "أنثى" };

type Row = Awaited<ReturnType<typeof loadStudents>>[number];

const loadStudents = (q: StudentAcademicFilter) =>
  prisma.student.findMany({
    where: studentAcademicWhere(q),
    take: MAX_ROWS + 1,
    select: {
      registrationNumber: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          firstNameLatin: true,
          lastNameLatin: true,
          gender: true,
          email: true,
          phone: true,
        },
      },
      academicYear: { select: { title: true } },
      specialization: {
        select: {
          id: true,
          name: true,
          level: true,
          filiere: {
            select: {
              name: true,
              department: { select: { name: true, faculty: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

/** باللقب اللاتيني ثم الاسم — وبالعربيّ لمن لا لاتينيّ له. */
const byName = (a: Row, b: Row) => {
  const key = (r: Row) =>
    [r.user.lastNameLatin || r.user.lastName || "", r.user.firstNameLatin || r.user.firstName || ""].join(" ");
  return key(a).localeCompare(key(b), "fr", { sensitivity: "base" }) || a.registrationNumber.localeCompare(b.registrationNumber);
};

/** بترتيب الهرم: الكلية، القسم، الشعبة، المستوى، التخصص. */
const byPlace = (a: Row, b: Row) => {
  const sa = a.specialization;
  const sb = b.specialization;
  return (
    sa.filiere.department.faculty.name.localeCompare(sb.filiere.department.faculty.name, "ar") ||
    sa.filiere.department.name.localeCompare(sb.filiere.department.name, "ar") ||
    sa.filiere.name.localeCompare(sb.filiere.name, "ar") ||
    (LEVEL_ORDER[sa.level] ?? 9) - (LEVEL_ORDER[sb.level] ?? 9) ||
    sa.name.localeCompare(sb.name, "ar")
  );
};

const levelOf = (l: string) => LEVEL_LABEL[l] ?? l;

/** العدد والمعدود كما تقولهما العربية: طالبٌ واحد، طالبان، ٥ طلاب، ٢٠ طالباً. */
export function studentsCount(n: number): string {
  if (n === 0) return "لا طلبة";
  if (n === 1) return "طالبٌ واحد";
  if (n === 2) return "طالبان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} طلاب`;
  if (r >= 11) return `${n} طالباً`;
  return `${n} طالب`;
}

interface Column {
  header: string;
  width: number;
  value: (r: Row, i: number) => string | number;
  ltr?: boolean;
  /**
   * خانةٌ بتنسيق «نص»: ما يُكتب فيها لاحقاً في Excel يبقى كما هو — هاتفٌ
   * يبدأ بصفر لا يفقده، ورقم تسجيلٍ لا يصير صيغةً علمية.
   */
  text?: boolean;
}

const PERSON: Column[] = [
  { header: "#", width: 6, value: (_r, i) => i + 1 },
  { header: "رقم التسجيل", width: 17, value: (r) => r.registrationNumber, ltr: true, text: true },
  { header: "اللقب (Nom)", width: 20, value: (r) => r.user.lastNameLatin ?? "", ltr: true },
  { header: "الاسم (Prénom)", width: 20, value: (r) => r.user.firstNameLatin ?? "", ltr: true },
  { header: "اللقب بالعربية", width: 16, value: (r) => r.user.lastName ?? "" },
  { header: "الاسم بالعربية", width: 16, value: (r) => r.user.firstName ?? "" },
  { header: "الجنس", width: 8, value: (r) => GENDER_AR[r.user.gender ?? ""] ?? "" },
  { header: "البريد الشخصي", width: 28, value: (r) => r.user.email ?? "", ltr: true, text: true },
  { header: "رقم الهاتف", width: 14, value: (r) => r.user.phone ?? "", ltr: true, text: true },
];

const PLACE: Column[] = [
  { header: "الكلية", width: 30, value: (r) => r.specialization.filiere.department.faculty.name },
  { header: "القسم", width: 24, value: (r) => r.specialization.filiere.department.name },
  { header: "الشعبة", width: 20, value: (r) => r.specialization.filiere.name },
  { header: "المستوى", width: 10, value: (r) => levelOf(r.specialization.level) },
  { header: "التخصص", width: 26, value: (r) => r.specialization.name },
];

const YEAR: Column = { header: "السنة الجامعية", width: 13, value: (r) => r.academicYear?.title ?? "", ltr: true };

/** اسم ورقةٍ يقبله Excel: 31 حرفاً، بلا []:*?/\، ولا يتكرّر. */
function sheetName(wanted: string, taken: Set<string>): string {
  const base = wanted.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "قائمة";
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(name.toLowerCase());
  return name;
}

/** ورقةٌ واحدة: سطور العنوان، ثمّ الرأس، ثمّ الطلبة — جاهزةٌ للطباعة. */
function writeSheet(
  wb: ExcelJS.Workbook,
  name: string,
  title: string[],
  columns: Column[],
  rows: Row[],
  /** «لا يوجد» في الخانة الفارغة — أو تبقى فارغة. */
  sayNone: boolean,
) {
  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: title.length + 2 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: columns.length > 10 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "&Cصفحة &P من &N" },
  });
  ws.columns = columns.map((c) => ({ width: c.width }));
  const last = columns.length;

  // ── العنوان ──
  title.forEach((text, i) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, last);
    const cell = row.getCell(1);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = i === 0
      ? { name: "Arial", size: 15, bold: true, color: { argb: BRAND } }
      : { name: "Arial", size: 11, color: { argb: "FF5B6B66" } };
    row.height = i === 0 ? 26 : 18;
  });
  ws.addRow([]);

  // ── الرأس ──
  const header = ws.addRow(columns.map((c) => c.header));
  header.height = 24;
  header.eachCell((c) => {
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = { bottom: { style: "medium", color: { argb: GOLD } } };
  });
  ws.pageSetup.printTitlesRow = `${header.number}:${header.number}`;

  // ── الطلبة ──
  rows.forEach((r, i) => {
    const values = columns.map((c) => c.value(r, i));
    const row = ws.addRow(values.map((v) => (v === "" ? (sayNone ? NONE : null) : v)));
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const spec = columns[col - 1]!;
      const missing = values[col - 1] === "";
      // الخطّ عاديٌّ دائماً؛ وبهتانُ «لا يوجد» قاعدةُ تنسيقٍ شرطيّ أدناه — فما
      // يُكتب مكانها في Excel يظهر بخطٍّ عاديّ لا باهتاً كأنّه ناقص.
      cell.font = { name: "Arial", size: 10.5 };
      if (spec.text) cell.numFmt = "@";
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 1 || missing ? "center" : spec.ltr ? "left" : "right",
        readingOrder: missing || !spec.ltr ? "rtl" : "ltr",
      };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD9D3C4" } } };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
  });

  // «لا يوجد» باهتةٌ مائلة ما دامت «لا يوجد»: تُميَّز من قيمةٍ حقيقيةٍ بنظرة،
  // وتعود الخانة عاديّةً حين يُكتب فيها غيرها.
  if (sayNone && rows.length > 0) {
    const first = header.number + 1;
    ws.addConditionalFormatting({
      ref: `A${first}:${ws.getColumn(last).letter}${first + rows.length - 1}`,
      rules: [
        {
          type: "cellIs",
          operator: "equal",
          formulae: [`"${NONE}"`],
          priority: 1,
          style: { font: { italic: true, color: { argb: MUTED } } },
        },
      ],
    });
  }

  ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: last } };
}

export async function exportStudentsService(q: ExportStudentsQuery): Promise<Buffer> {
  const [students, year] = await Promise.all([
    loadStudents(q),
    q.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: q.academicYearId }, select: { title: true } })
      : Promise.resolve(null),
  ]);
  if (students.length > MAX_ROWS)
    throw new BadRequestException(
      `أكثر من ${MAX_ROWS} طالب — ضيّق الفلاتر (السنة أو الكلية أو التخصص).`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const yearText = year ? `السنة الجامعية ${year.title}` : "كلّ السنوات الجامعية";
  // ما لم تُحصر السنة، فلكلّ طالبٍ سنته في عمود.
  const withYear = (cols: Column[]) => (year ? cols : [...cols, YEAR]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mudhakkirati";
  wb.created = new Date();

  if (q.layout === "single" || students.length === 0) {
    const rows = [...students].sort((a, b) => byPlace(a, b) || byName(a, b));
    writeSheet(
      wb,
      "الطلبة",
      ["قائمة الطلبة", `${yearText} — ${studentsCount(rows.length)}`],
      withYear([...PERSON, ...PLACE]),
      rows,
      q.empty === "none",
    );
  } else {
    const groups = new Map<string, Row[]>();
    for (const s of students) groups.set(s.specialization.id, [...(groups.get(s.specialization.id) ?? []), s]);
    const ordered = [...groups.values()].sort((a, b) => byPlace(a[0]!, b[0]!));
    const taken = new Set<string>();
    for (const rows of ordered) {
      const sp = rows[0]!.specialization;
      writeSheet(
        wb,
        sheetName(`${sp.name} - ${levelOf(sp.level)}`, taken),
        [
          `قائمة طلبة ${levelOf(sp.level)} — ${sp.name}`,
          `${sp.filiere.department.faculty.name} · ${sp.filiere.department.name} · ${sp.filiere.name}`,
          `${yearText} — ${studentsCount(rows.length)}`,
        ],
        withYear([...PERSON, ...PLACE]),
        [...rows].sort(byName),
        q.empty === "none",
      );
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
