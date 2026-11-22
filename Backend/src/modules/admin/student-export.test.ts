/**
 * تصدير قوائم الطلبة — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يصدّر تخصّصاً واحداً بطلبةٍ بأسمائهم كاملة. وهنا ما يحتاج
 * أكثر: تخصّصان بالاسم والمستوى نفسيهما في شعبتين (فاسما ورقتيهما يُميَّزان)،
 * ومستوىً لا تعرفه المنصّة (يُكتب كما هو ويأتي آخراً)، وطلبةٌ بلا اسمٍ
 * لاتينيّ أو بلا اسمٍ أصلاً أو بالاسم نفسه، وأكثر من حدّ التصدير.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: { student: { findMany: jest.fn() }, academicYear: { findUnique: jest.fn() } },
}));

import ExcelJS from "exceljs";

import { prisma } from "../../core/prisma/client";
import { tr } from "../../core/i18n";
import { exportStudentsService, studentsCount, type ExportStudentsQuery } from "./student-export.service";

describe("studentsCount — العدد والمعدود", () => {
  it.each([
    [0, "لا طلبة"],
    [1, "طالبٌ واحد"],
    [2, "طالبان"],
    [3, "3 طلاب"],
    [10, "10 طلاب"],
    [11, "11 طالباً"],
    [27, "27 طالباً"],
    [99, "99 طالباً"],
    [100, "100 طالب"],
    [103, "103 طلاب"],
    [120, "120 طالباً"],
  ])("%i ⇒ %s", (n, text) => {
    expect(studentsCount(n)).toBe(text);
  });
});

const db = prisma as unknown as { student: { findMany: jest.Mock } };

const place = (id: string, name: string, level: string, filiere: string) => ({
  id,
  name,
  level,
  filiere: { name: filiere, department: { name: "قسم علم النفس", faculty: { name: "كلية العلوم الاجتماعية" } } },
});
const CLIN_A = place("a", "علم النفس العيادي", "master", "شعبة أ");
const CLIN_B = place("b", "علم النفس العيادي", "master", "شعبة ب");
const DIGI = place("d", "إعلام رقمي", "bootcamp", "شعبة أ");

const student = (registrationNumber: string, specialization: ReturnType<typeof place>, user: Record<string, string> = {}) => ({
  registrationNumber,
  user: {
    firstName: null,
    lastName: null,
    firstNameLatin: null,
    lastNameLatin: null,
    gender: null,
    email: null,
    phone: null,
    ...user,
  },
  academicYear: { title: "2026/2027" },
  specialization,
});

async function exported(students: unknown[], q: Partial<ExportStudentsQuery> = {}) {
  db.student.findMany.mockResolvedValueOnce(students);
  const buf = await exportStudentsService({ layout: "bySpecialization", empty: "blank", ...q });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}
/** صفوف الطلبة في الورقة: ما بعد الرأس، وهو الصفّ الذي أوّله «#». */
function body(ws: ExcelJS.Worksheet): ExcelJS.Row[] {
  let header = 0;
  ws.eachRow((r, n) => {
    if (!header && r.getCell(1).value === "#") header = n;
  });
  return Array.from({ length: ws.rowCount - header }, (_, i) => ws.getRow(header + 1 + i));
}
const regs = (ws: ExcelJS.Worksheet) => body(ws).map((r) => r.getCell(2).value);

describe("exportStudentsService", () => {
  it("أكثر من حدّ التصدير ⇒ 400 قبل أن يُكتب شيء", async () => {
    db.student.findMany.mockResolvedValueOnce(Array.from({ length: 10_001 }, () => student("1", CLIN_A)));
    await expect(exportStudentsService({ layout: "single", empty: "none" })).rejects.toMatchObject({
      statusCode: 400,
      message: tr("export.tooMany", { max: 10_000 }),
    });
  });

  /**
   * ورقةٌ لكلّ تخصّص بترتيب الهرم: الشعبة، ثم المستوى — والمجهول آخراً. والاسم
   * المكرّر يُميَّز برقم، وكلّ ورقةٍ أفقيّة تسع أعمدتها.
   */
  it("ورقةٌ لكلّ تخصّص بترتيب الهرم، والاسم المكرّر يُميَّز برقم", async () => {
    // المجهول آخر ما يُضاف، فيُقارَن بما قبله من الطرفين.
    const wb = await exported([student("1", CLIN_B), student("3", CLIN_A), student("2", DIGI)]);

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "علم النفس العيادي - ماستر",
      "إعلام رقمي - bootcamp",
      "علم النفس العيادي - ماستر (2)",
    ]);
    expect(regs(wb.worksheets[2]!)).toEqual(["1"]);
    expect(wb.worksheets[1]!.getCell("A1").value).toBe("قائمة طلبة bootcamp — إعلام رقمي");
    expect(wb.worksheets.every((s) => s.pageSetup.orientation === "landscape")).toBe(true);
    // «#» ورقم التسجيل واللقب والاسم ثابتةٌ عند التمرير أفقياً، وبلا شبكة Excel.
    expect(wb.worksheets.every((s) => s.views[0]?.xSplit === 4 && s.views[0]?.showGridLines === false)).toBe(true);
  });

  /** وفي ورقةٍ واحدة: مستويان لا تعرفهما المنصّة يأتيان بعد المعروف، وبينهما بالاسم. */
  it("ورقةٌ واحدة: المستوى المجهول آخراً، والمجهولان بالاسم", async () => {
    const ART = place("e", "تصميم", "atelier", "شعبة أ");
    const wb = await exported([student("1", ART), student("2", DIGI), student("3", CLIN_A)], { layout: "single" });
    expect(regs(wb.getWorksheet("الطلبة")!)).toEqual(["3", "2", "1"]);
  });

  /**
   * بالاسم اللاتينيّ، وإلّا فالعربيّ، ومن لا اسم له أوّلاً؛ والاسم نفسه برقم
   * التسجيل. وما لا قيمة له يبقى فارغاً حين يُطلب ذلك.
   */
  it("الطلبة بأسمائهم، والاسم نفسه برقم التسجيل، والفارغ فارغ", async () => {
    const youcef = { lastNameLatin: "HAMADI", firstNameLatin: "Youcef" };
    const wb = await exported([
      student("3", CLIN_A, youcef),
      student("2", CLIN_A, { lastName: "بن علي", firstName: "أحمد" }),
      student("4", CLIN_A),
      student("1", CLIN_A, youcef),
    ]);
    const ws = wb.worksheets[0]!;

    expect(regs(ws)).toEqual(["4", "1", "3", "2"]);
    const [, latinOnly, , arabicOnly] = body(ws);
    expect([5, 6, 8].map((c) => latinOnly!.getCell(c).value)).toEqual([null, null, null]);
    expect([3, 4, 5].map((c) => arabicOnly!.getCell(c).value)).toEqual([null, null, "بن علي"]);
  });
});
