import ExcelJS from "exceljs";

import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { studentAcademicWhere, type StudentAcademicFilter } from "./student-filters";
import { tr } from "../../core/i18n";
import { PLACE, YEAR, arabicCount, byPlace, finishWorkbook, levelOf, sheetName, writeSheet, type Column } from "./export-sheet";

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

const GENDER_AR: Record<string, string> = { male: "ذكر", female: "أنثى" };

/** «#» ورقم التسجيل واللقب والاسم: ما يُعرف به الطالب يبقى ظاهراً عند التمرير. */
const FREEZE = 4;

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

/** العدد والمعدود كما تقولهما العربية: طالبٌ واحد، طالبان، ٥ طلاب، ٢٠ طالباً. */
export const studentsCount = (n: number): string =>
  arabicCount(n, { none: "لا طلبة", one: "طالبٌ واحد", two: "طالبان", few: "طلاب", many: "طالباً", hundred: "طالب" });

const PERSON: Column<Row>[] = [
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

export async function exportStudentsService(q: ExportStudentsQuery): Promise<Buffer> {
  const [students, year] = await Promise.all([
    loadStudents(q),
    q.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: q.academicYearId }, select: { title: true } })
      : Promise.resolve(null),
  ]);
  if (students.length > MAX_ROWS)
    throw new BadRequestException(
      tr("export.tooMany", { max: MAX_ROWS }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const yearText = year ? `السنة الجامعية ${year.title}` : "كلّ السنوات الجامعية";
  // ما لم تُحصر السنة، فلكلّ طالبٍ سنته في عمود.
  const withYear = (cols: Column<Row>[]) => (year ? cols : [...cols, YEAR]);

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
      { sayNone: q.empty === "none", freeze: FREEZE },
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
        { sayNone: q.empty === "none", freeze: FREEZE },
      );
    }
  }

  return finishWorkbook(wb);
}
