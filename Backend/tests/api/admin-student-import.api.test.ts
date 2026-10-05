/**
 * استيراد الطلبة من Excel.
 *
 * ثلاثة أسئلة تحكم الوحدة:
 *
 *   **هل تقول المعاينة الحقيقة؟** — كلّ خطأٍ في صفّه وعموده، ولا كتابة.
 *   **هل الاستيراد كلّه أو لا شيء؟** — صفٌّ واحدٌ خاطئ ⇒ لا أحد يُنشأ.
 *   **وهل الحساب المستورَد حسابٌ حقيقي؟** — يدخل صاحبه بكلمة المرور
 *     المولَّدة، كما يدخل من أُنشئ باليد.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { IMPORT_COLUMNS, STUDENT_SPEC } from "../../src/modules/admin/student-import/columns";
import { parseImportFile } from "../../src/modules/admin/import-kit/parser";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let admin = "";
let student = "";

const auth = (r: request.Test, bearer = admin) => r.set("Authorization", `Bearer ${bearer}`);

/** أرقام تسجيلٍ فريدة لكلّ اختبار — أرقامٌ صرفة كما يشترط الاستيراد. */
let seq = 0;
const reg = () => `99${Date.now().toString().slice(-8)}${String(++seq).padStart(2, "0")}`;

/** ألقابٌ فريدة بحروفٍ عربية: الاسم المكرّر في الملف أو في المنصّة تنبيه. */
const AR = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
let nameSeq = 0;
const uniqueLast = () => {
  let n = ++nameSeq + Date.now() % 100000;
  let s = "";
  do {
    s = AR[n % AR.length] + s;
    n = Math.floor(n / AR.length);
  } while (n > 0);
  return `حمادي ${s}`;
};

type Row = Partial<Record<(typeof IMPORT_COLUMNS)[number]["header"], ExcelJS.CellValue>>;

/** ملفٌّ كما يصنعه المسؤول: صفّ عناوين ثم الطلبة. */
async function xlsx(
  rows: Row[],
  headers: string[] = IMPORT_COLUMNS.map((c) => c.header),
  opts: { hidden?: number[]; extraSheet?: string } = {},
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الطلبة");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => (r as Record<string, ExcelJS.CellValue>)[h] ?? null));
  for (const n of opts.hidden ?? []) ws.getRow(n).hidden = true;
  if (opts.extraSheet) wb.addWorksheet(opts.extraSheet).addRow(["ملاحظات"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const valid = (over: Row = {}): Row => ({
  "رقم التسجيل": reg(),
  "الاسم": "يوسف",
  "اللقب": uniqueLast(),
  "السنة الجامعية": f.academicYear.title,
  "التخصص": f.specialization.name,
  ...over,
});

type Cell = {
  value: string;
  saved?: string;
  state: string;
  issues?: { level: string; message: string }[];
};
type ReportRow = {
  row: number;
  cells: Record<string, Cell>;
  issues?: { level: string; message: string }[];
  errors: number;
  warnings: number;
};
const rowOf = (res: request.Response, n: number) =>
  (res.body.report.rows as ReportRow[]).find((r) => r.row === n)!;
/** مفاتيح الأعمدة التي فيها خطأ، مرتّبة. */
const errorKeys = (r: ReportRow) =>
  Object.entries(r.cells)
    .filter(([, c]) => c.state === "error")
    .map(([k]) => k)
    .sort();
const said = (c: Cell, level = "error") =>
  (c.issues ?? [])
    .filter((i) => i.level === level)
    .map((i) => i.message)
    .join(" | ");

/** نطاقات قواعد التحقّق في ورقة الطلبة، كما هي في XML الملف. */
async function sqrefs(buf: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip"); // تبعيّة exceljs نفسها
  const zip = await JSZip.loadAsync(buf);
  const xml: string = await zip.file("xl/worksheets/sheet1.xml").async("string");
  return [...xml.matchAll(/<dataValidation [^>]*sqref="([^"]+)"/g)].map((m) => m[1]!).sort();
}

/**
 * الملف كما يحفظه Excel: قاعدةُ تلوينٍ وقائمةٌ منسدلة تشيران إلى ورقةٍ أخرى،
 * في امتداد x14 آخر الورقة، بمعرّفات مراجعةٍ (xr:uid) كما يكتبها.
 */
async function withX14(buf: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(buf);
  const path = "xl/worksheets/sheet1.xml";
  const xml: string = await zip.file(path).async("string");
  const x14 = 'xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"';
  const xm = 'xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"';
  const xr = 'xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"';
  const ext =
    `<extLst>` +
    `<ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" ${x14}><x14:conditionalFormattings><x14:conditionalFormatting ${xm}>` +
    `<x14:cfRule type="expression" priority="90" id="{00000000-000E-0000-0000-00000A000000}"><xm:f>تصفية!$V3=TRUE</xm:f>` +
    `<x14:dxf><font><b/><color rgb="FF8A2E1C"/></font></x14:dxf></x14:cfRule><xm:sqref>L3:L1002</xm:sqref>` +
    `</x14:conditionalFormatting></x14:conditionalFormattings></ext>` +
    `<ext uri="{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}" ${x14} ${xr}><x14:dataValidations count="1" ${xm}>` +
    `<x14:dataValidation type="list" allowBlank="1" xr:uid="{00000000-0002-0000-0000-000003000000}">` +
    `<x14:formula1><xm:f>القوائم!$I$2:$I$3</xm:f></x14:formula1><xm:sqref>F3:F1002</xm:sqref>` +
    `</x14:dataValidation></x14:dataValidations></ext>` +
    `</extLst>`;
  zip.file(path, xml.replace("</worksheet>", `${ext}</worksheet>`));
  return zip.generateAsync({ type: "nodebuffer" });
}

/** نموذج المنصّة كما يُنزَّل. */
const template = async (): Promise<Buffer> =>
  (
    await auth(request(app).get("/api/admin/students/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200)
  ).body;

const upload = (path: string, buf: Buffer, name = "students.xlsx") =>
  auth(request(app).post(`/api/admin/students/import${path}`)).attach("file", buf, name);

beforeAll(async () => {
  await teardown();
  f = await seed(3);
  admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  student = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0]!.reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("النموذج", () => {
  /** يُولَّد من المنصّة: عناوينه هي ما يقرؤه المحلِّل، وقوائمه من القاعدة. */
  it("يُنزَّل xlsx بعناوين الاستيراد، وبقوائم المنصّة، وبلا طالبٍ واحد", async () => {
    const res = await auth(request(app).get("/api/admin/students/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet("الطلبة")!;
    expect((ws.getRow(2).values as unknown[]).slice(1)).toEqual(IMPORT_COLUMNS.map((c) => c.header));

    const lists = wb.getWorksheet("القوائم")!;
    expect(lists.state).toBe("hidden");
    expect(wb.getWorksheet("تصفية")!.state).toBe("hidden");
    const col = (c: string) => lists.getColumn(c).values.slice(2);
    expect(col("A")).toContain(f.specialization.name);
    expect(col("G")).toContain(f.academicYear.title);
    expect(col("L")).toContain(f.faculty.name);

    // المحلِّل يقرأ النموذج نفسه — فارغاً.
    const parsed = await parseImportFile(res.body, STUDENT_SPEC);
    expect(parsed.fileErrors).toEqual(["الملف لا يحتوي على أيّ طالب."]);
  });

  /**
   * الجامعية قوائم متسلسلة كنافذة الإضافة: الكلية قائمةٌ ثابتة، والقسم
   * والشعبة والتخصص قوائمُ تضيق بما اختير قبلها — كلٌّ كتلةٌ بمفتاحها.
   */
  it("والكلية والقسم والشعبة والمستوى والتخصص قوائمُ منسدلة، التابعة منها تضيق بما قبلها", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template());
    const ws = wb.getWorksheet("الطلبة")!;
    const dvAt = (k: string) =>
      ws.getRow(3).getCell(IMPORT_COLUMNS.findIndex((c) => c.key === k) + 1).dataValidation;
    for (const k of ["faculty", "department", "filiere", "level", "specialization"])
      expect(dvAt(k)?.type).toBe("list");
    for (const k of ["department", "filiere", "specialization"])
      expect(String(dvAt(k)?.formulae?.[0])).toContain("OFFSET(");

    // كتلة الكلية في قائمة الأقسام، وكتلة القسم في قائمة الشعب، وكتلة الشعبة
    // بمستواها في قائمة التخصصات.
    const lists = wb.getWorksheet("القوائم")!;
    const pairs = (keyCol: string, valCol: string) =>
      lists.getColumn(keyCol).values.map((k, i) => [k, lists.getColumn(valCol).values[i]]);
    expect(pairs("P", "Q")).toContainEqual([`fac:${f.faculty.name}`, f.department.name]);
    expect(pairs("S", "T")).toContainEqual([`dep:${f.department.name}`, f.filiere.name]);
    expect(pairs("W", "X")).toContainEqual([`fil:${f.filiere.name}|ماستر`, f.specialization.name]);
  });

  it("والكلية والقسم المختاران من القائمة يوافقان التخصص ⇒ صفٌّ سليم، والباقي يُملأ منه", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template());
    const ws = wb.getWorksheet("الطلبة")!;
    const at = (k: string) => IMPORT_COLUMNS.findIndex((c) => c.key === k) + 1;
    const row = ws.getRow(3);
    const v = valid();
    row.getCell(at("registrationNumber")).value = v["رقم التسجيل"] as string;
    row.getCell(at("firstName")).value = v["الاسم"] as string;
    row.getCell(at("lastName")).value = v["اللقب"] as string;
    row.getCell(at("academicYear")).value = f.academicYear.title;
    // الاختيار من القائمة يحلّ محلّ صيغة الخانة
    row.getCell(at("faculty")).value = f.faculty.name;
    row.getCell(at("department")).value = f.department.name;
    row.getCell(at("specialization")).value = f.specialization.name;

    const res = await upload("/preview", Buffer.from(await wb.xlsx.writeBuffer())).expect(200);
    const r = rowOf(res, 3);
    expect(r.errors).toBe(0);
    expect(r.cells.faculty).toMatchObject({ state: "ok", value: f.faculty.name });
    expect(r.cells.department).toMatchObject({ state: "ok" });
    expect(r.cells.filiere).toMatchObject({ state: "auto", saved: f.filiere.name });
    expect(r.cells.level).toMatchObject({ state: "auto", saved: "ماستر" });
  });
});

describe("المعاينة", () => {
  it("تحكم على كلّ صفّ ولا تكتب شيئاً", async () => {
    const a = valid();
    const b = valid({ "الاسم": "أمينة", "اللقب": "زروقي" });
    const res = await upload("/preview", await xlsx([a, b])).expect(200);

    expect(res.body.report.summary).toEqual({ total: 2, valid: 2, invalid: 0, warned: 0 });
    expect(
      await prisma.student.count({
        where: { registrationNumber: { in: [a["رقم التسجيل"], b["رقم التسجيل"]] as string[] } },
      }),
    ).toBe(0);
  });

  it("وكلّ خطأٍ في صفّه وعموده", async () => {
    const dup = reg();
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "رقم التسجيل": dup }), // صفّ 2
        valid({ "رقم التسجيل": dup }), // 3 — مكرّر
        valid({ "رقم التسجيل": f.students[1]!.reg.replace(/\D/g, "") || "123456" }), // 4
        valid({ "التخصص": "تخصص لا وجود له" }), // 5
        valid({ "الجنس": "ربما", "الاسم باللاتينية": "يوسف" }), // 6
        valid({ "اللقب": null, "السنة الجامعية": "1900/1901" }), // 7
      ]),
    ).expect(200);

    expect(errorKeys(rowOf(res, 2))).toEqual(["registrationNumber"]);
    expect(said(rowOf(res, 2).cells.registrationNumber!)).toContain("الصفّ 3");
    expect(said(rowOf(res, 3).cells.registrationNumber!)).toContain("الصفّ 2");
    expect(errorKeys(rowOf(res, 5))).toEqual(["specialization"]);
    expect(errorKeys(rowOf(res, 6))).toEqual(["firstNameLatin", "gender"]);
    expect(errorKeys(rowOf(res, 7))).toEqual(["academicYear", "lastName"]);
    expect(said(rowOf(res, 7).cells.lastName!)).toContain("إلزامي");
    expect(res.body.report.summary.invalid).toBeGreaterThanOrEqual(5);
  });

  /**
   * تقرير الأخطاء هو الملف نفسه مُعلَّماً: الخانة الخاطئة حمراء، وفي آخر
   * الصفّ ما فيها — فيُصحَّح في مكانه ويُرفع كما هو.
   */
  it("وتُعيد الملف نفسه مُعلَّماً بأخطائه، وقوائمه باقية", async () => {
    // نموذج المنصّة بقوائمه، ومعه صفّان: سليمٌ، وتخصّصه خاطئ.
    const tpl = await auth(request(app).get("/api/admin/students/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tpl.body);
    const ws = wb.getWorksheet("الطلبة")!;
    const colOf = (h: string) => IMPORT_COLUMNS.findIndex((c) => c.header === h) + 1;
    const put = (row: number, v: Row) =>
      Object.entries(v).forEach(([h, x]) => (ws.getRow(row).getCell(colOf(h)).value = x as ExcelJS.CellValue));
    put(3, valid());
    put(4, valid({ "التخصص": "تخصص لا وجود له" }));
    const filled = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await upload("/preview", filled).expect(200);
    expect(res.body.report.summary).toMatchObject({ valid: 1, invalid: 1 });

    const back = new ExcelJS.Workbook();
    await back.xlsx.load(Buffer.from(res.body.annotatedFile, "base64"));
    const out = back.getWorksheet("الطلبة")!;
    const errCol = (out.getRow(2).values as unknown[]).indexOf("الأخطاء");
    expect(errCol).toBeGreaterThan(0);
    expect(String(out.getRow(4).getCell(errCol).value)).toContain("✗ التخصص");
    expect(out.getRow(3).getCell(errCol).value).toBeNull();
    const specCell = out.getRow(4).getCell(colOf("التخصص"));
    expect((specCell.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFF6D5CC");
    // والقائمة المنسدلة ما زالت في خانة التخصص بعد التعليم.
    expect(out.getRow(4).getCell(colOf("التخصص")).dataValidation?.type).toBe("list");
    // وبنطاقاتها نفسها: exceljs يعيد كتابتها متداخلةً (A10:A1002 وA3:A1002)
    // بصيغٍ نسبيةٍ في غير صفوفها لولا restoreValidationRanges.
    expect(await sqrefs(Buffer.from(res.body.annotatedFile, "base64"))).toEqual(await sqrefs(tpl.body));
  });

  /**
   * Excel إذا حفظ النموذج نقل كلّ قاعدةٍ تشير إلى ورقةٍ أخرى إلى امتداد x14.
   * وexceljs يقرأ تلوينه بلا صيغ ثم يسقط عند الكتابة — فكانت المعاينة كلّها
   * تسقط بخطأ 500. الآن: تعمل، والملف المُعلَّم يحمل الامتداد كما هو.
   */
  it("وملفٌّ حفظه Excel بامتداد x14 ⇒ المعاينة تعمل، والملف المُعلَّم يحمل قوائمه وتلوينه", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template());
    const ws = wb.getWorksheet("الطلبة")!;
    const colOf = (h: string) => IMPORT_COLUMNS.findIndex((c) => c.header === h) + 1;
    const put = (row: number, v: Row) =>
      Object.entries(v).forEach(([h, x]) => (ws.getRow(row).getCell(colOf(h)).value = x as ExcelJS.CellValue));
    put(3, valid());
    put(4, valid({ "التخصص": "تخصص لا وجود له" }));
    const excelLike = await withX14(Buffer.from(await wb.xlsx.writeBuffer()));

    const res = await upload("/preview", excelLike).expect(200);
    expect(res.body.report.summary).toMatchObject({ valid: 1, invalid: 1 });
    expect(res.body.annotatedFile).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require("jszip");
    const zip = await JSZip.loadAsync(Buffer.from(res.body.annotatedFile, "base64"));
    const xml: string = await zip.file("xl/worksheets/sheet1.xml").async("string");
    expect(xml).toContain("<xm:f>تصفية!$V3=TRUE</xm:f>");
    expect(xml).toContain("<xm:f>القوائم!$I$2:$I$3</xm:f>");
    expect(xml).not.toMatch(/\sxr:uid=/);
    expect(xml.match(/<x14:cfRule /g)).toHaveLength(1);
  });

  it("وملفٌّ سليم ⇒ لا تقرير أخطاء", async () => {
    const res = await upload("/preview", await xlsx([valid()])).expect(200);
    expect(res.body.annotatedFile).toBeUndefined();
  });

  it("ورقمٌ مسجَّلٌ في المنصّة ⇒ «مسجَّلٌ مسبقاً»", async () => {
    const existing = reg();
    await upload("", await xlsx([valid({ "رقم التسجيل": existing })])).expect(201);

    const res = await upload("/preview", await xlsx([valid({ "رقم التسجيل": existing })])).expect(200);
    const cell = rowOf(res, 2).cells.registrationNumber!;
    expect(said(cell)).toContain("مسبقاً");
    // ومعه صاحبه وتخصّصه، ليعرف المسؤول أهو هو.
    expect(said(cell)).toContain(f.specialization.name);
  });

  it("وعمودٌ إلزاميّ ناقص ⇒ خطأ ملفّ، لا خطأ صفّ", async () => {
    const headers = IMPORT_COLUMNS.map((c) => c.header).filter((h) => h !== "التخصص");
    const res = await upload("/preview", await xlsx([valid()], headers)).expect(200);
    expect(res.body.report.fileErrors[0]).toContain("التخصص");
  });

  it("وملفٌّ ليس xlsx ⇒ 400، وبلا ملف ⇒ 400", async () => {
    await upload("/preview", Buffer.from("not,an,excel\n1,2,3"), "fake.xlsx").expect(400);
    await auth(request(app).post("/api/admin/students/import/preview")).expect(400);
  });

  it("والطالب ممنوع", async () => {
    const res = await auth(
      request(app).post("/api/admin/students/import/preview"),
      student,
    ).attach("file", await xlsx([valid()]), "s.xlsx");
    expect(res.status).toBe(403);
  });
});

/**
 * المعاينة تقول كلّ شيء: كلّ خانةٍ بقيمتها وما سيُحفظ منها وحالها. والجامعية
 * خاصّةً — التخصص وحده يُحفظ، فكلّ ما كُتب في الكلية والقسم والشعبة والمستوى
 * يُقارن به، ولا يُستورد طالبٌ في تخصّصٍ غير الذي ظنّه المسؤول.
 */
describe("دقّة المعاينة", () => {
  it("كلّ خانةٍ في التقرير: الفارغ الاختياريّ، والتلقائيّ من التخصص، وما سيُحفظ", async () => {
    const res = await upload(
      "/preview",
      await xlsx([valid({ "الاسم باللاتينية": "youcef", "اللقب باللاتينية": "hamadi", "رقم الهاتف": "0661 23 45 67" })]),
    ).expect(200);
    const { cells } = rowOf(res, 2);

    expect(Object.keys(cells).sort()).toEqual(IMPORT_COLUMNS.map((c) => c.key).sort());
    expect(cells.email).toMatchObject({ value: "", state: "empty" });
    expect(cells.verified).toMatchObject({ state: "empty", saved: "غير موثّق" });
    expect(cells.password).toMatchObject({ state: "auto", saved: "تُولَّد تلقائياً" });
    expect(cells.firstNameLatin).toMatchObject({ value: "youcef", saved: "Youcef", state: "ok" });
    expect(cells.lastNameLatin!.saved).toBe("HAMADI");
    expect(cells.phone).toMatchObject({ saved: "0661234567", state: "ok" });
    // الجامعية الفارغة تملؤها المنصّة من التخصص.
    expect(cells.faculty).toMatchObject({ state: "auto", saved: f.faculty.name });
    expect(cells.department).toMatchObject({ state: "auto", saved: f.department.name });
    expect(cells.filiere).toMatchObject({ state: "auto", saved: f.filiere.name });
    expect(cells.level).toMatchObject({ state: "auto", saved: "ماستر" });
    expect(res.body.report.columns.map((c: { key: string }) => c.key)).toEqual(IMPORT_COLUMNS.map((c) => c.key));
    expect(res.body.report.file).toMatchObject({ sheetName: "الطلبة", headerRow: 1 });
  });

  it("الكلية والقسم والشعبة والمستوى المكتوبة باليد تُقارن بالتخصص، وأيّ تعارضٍ خطأ", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        // 2 — كلّها توافق التخصص، ولو بمسافاتٍ زائدة وحروفٍ كبيرة
        valid({
          "الكلية": `  ${f.faculty.name.toUpperCase()} `,
          "القسم": f.department.name,
          "الشعبة": f.filiere.name,
          "المستوى": "Master",
        }),
        // 3 — كليةٌ لا وجود لها
        valid({ "الكلية": "كلية لا وجود لها" }),
        // 4 — مستوى لا يوافق التخصص (التخصص ماستر)
        valid({ "المستوى": "ليسانس" }),
        // 5 — ليس مستوى أصلاً
        valid({ "المستوى": "سنة ثالثة" }),
      ]),
    ).expect(200);

    expect(errorKeys(rowOf(res, 2))).toEqual([]);
    expect(rowOf(res, 2).cells.faculty).toMatchObject({ state: "ok", saved: f.faculty.name });
    expect(rowOf(res, 2).cells.level).toMatchObject({ state: "ok", saved: "ماستر" });

    expect(errorKeys(rowOf(res, 3))).toEqual(["faculty"]);
    expect(said(rowOf(res, 3).cells.faculty!)).toContain("ليست كليةً في المنصّة");
    expect(said(rowOf(res, 3).cells.faculty!)).toContain(f.faculty.name);

    expect(errorKeys(rowOf(res, 4))).toEqual(["level"]);
    expect(said(rowOf(res, 4).cells.level!)).toContain("مستواه في المنصّة «ماستر»");

    expect(said(rowOf(res, 5).cells.level!)).toContain("ليس مستوى");
    expect(res.body.report.summary).toMatchObject({ total: 4, valid: 1, invalid: 3 });
  });

  /**
   * صيغ النموذج نفسه ليست ما كتبه المسؤول: نموذجٌ نُزّل قبل تعديل الهيكل
   * يحمل اسماً قديماً — يُنبَّه عليه، ولا يُعدّ تعارضاً. وصيغةٌ في خانة إدخالٍ
   * لم تُحسب قطّ لا قيمة لها — خطأ.
   */
  it("وصيغة النموذج بقيمةٍ قديمة تنبيهٌ لا خطأ، وصيغةٌ بلا نتيجة خطأ", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "الكلية": { formula: "INDEX(A1:A2,1)", result: "كلية قديمة" } }), // 2
        valid({ "الكلية": { formula: "INDEX(A1:A2,1)", result: f.faculty.name } }), // 3
        valid({ "رقم التسجيل": { formula: "A1&B1" } as ExcelJS.CellFormulaValue }), // 4
      ]),
    ).expect(200);

    const stale = rowOf(res, 2).cells.faculty!;
    expect(stale).toMatchObject({ state: "warning", saved: f.faculty.name });
    expect(said(stale, "warning")).toContain("النموذج أقدم");
    expect(rowOf(res, 2).errors).toBe(0);
    expect(rowOf(res, 3).cells.faculty).toMatchObject({ state: "auto", saved: f.faculty.name });
    expect(said(rowOf(res, 4).cells.registrationNumber!)).toContain("لم تُحسب");
  });

  it("وقسمٌ من كليةٍ أخرى — والتخصص مجهول — يُكشف تسلسلُه", async () => {
    const other = await prisma.faculty.create({ data: { name: `${TAG} faculty B`, code: `${TAG}-FAC-B` } });
    try {
      const res = await upload(
        "/preview",
        await xlsx([valid({ "التخصص": "تخصص لا وجود له", "الكلية": other.name, "القسم": f.department.name })]),
      ).expect(200);
      const r = rowOf(res, 2);
      expect(errorKeys(r)).toEqual(["department", "specialization"]);
      expect(said(r.cells.department!)).toContain(`ليس من كلية «${other.name}»`);
      expect(r.cells.faculty).toMatchObject({ state: "ok" });
    } finally {
      await prisma.faculty.delete({ where: { id: other.id } });
    }
  });

  it("واسمٌ لتخصّصين يُحدّده «المستوى» إن كُتب، ويُردّ إن لم يُكتب", async () => {
    const twin = await prisma.specialization.create({
      data: { name: f.specialization.name, level: "licence", filiereId: f.filiere.id },
    });
    try {
      const res = await upload(
        "/preview",
        await xlsx([
          valid(), // 2 — الاسم وحده: لأيّهما؟
          valid({ "المستوى": "ماستر" }), // 3 — المستوى يحدّده
        ]),
      ).expect(200);
      expect(errorKeys(rowOf(res, 2))).toEqual(["specialization"]);
      expect(said(rowOf(res, 2).cells.specialization!)).toContain("اسمٌ لـ2 تخصّصات");

      expect(errorKeys(rowOf(res, 3))).toEqual([]);
      expect(said(rowOf(res, 3).cells.specialization!, "info")).toContain("«المستوى»");

      // والاستيراد يضعه في تخصّص الماستر لا في توأمه.
      const good = valid({ "المستوى": "ماستر" });
      await upload("", await xlsx([good])).expect(201);
      const s = await prisma.student.findUniqueOrThrow({
        where: { registrationNumber: good["رقم التسجيل"] as string },
      });
      expect(s.specializationId).toBe(f.specialization.id);
    } finally {
      await prisma.specialization.delete({ where: { id: twin.id } });
    }
  });

  it("والتخصص بإملاءٍ قريب يُقبل بتنبيه، والبعيد يُقترح له الأقرب", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "التخصص": "TEST-spec" }), // 2 — بلا الشرطات السفلية
        valid({ "التخصص": `${TAG} spek` }), // 3 — حرفٌ خطأ
      ]),
    ).expect(200);
    const near = rowOf(res, 2).cells.specialization!;
    expect(near).toMatchObject({ state: "warning", saved: f.specialization.name });
    expect(said(near, "warning")).toContain("بفرقٍ في الإملاء");
    expect(errorKeys(rowOf(res, 2))).toEqual([]);

    expect(said(rowOf(res, 3).cells.specialization!)).toContain(`هل تقصد «${f.specialization.name}»؟`);
  });

  it("وما يخفيه Excel: رقمٌ قُطع، وتاريخٌ، وخطأ صيغة، وصفٌّ مخفيّ", async () => {
    const res = await upload(
      "/preview",
      await xlsx(
        [
          valid({ "رقم التسجيل": 1234567890123456 }), // 2 — 16 رقماً في خانةٍ عددية
          valid({ "السنة الجامعية": new Date("2025-09-01") }), // 3
          valid({ "الاسم": { error: "#N/A" } as ExcelJS.CellErrorValue }), // 4
          valid(), // 5 — مخفيّ
        ],
        undefined,
        { hidden: [5] },
      ),
    ).expect(200);

    expect(said(rowOf(res, 2).cells.registrationNumber!)).toContain("15 خانة");
    expect(said(rowOf(res, 3).cells.academicYear!)).toContain("تاريخاً");
    expect(rowOf(res, 4).cells.firstName).toMatchObject({ value: "#N/A", state: "error" });
    const hidden = rowOf(res, 5);
    expect(hidden.errors).toBe(0);
    expect(hidden.warnings).toBe(1);
    expect(hidden.issues![0]!.message).toContain("مخفيٌّ في Excel");
  });

  it("وأسماءٌ فيها أرقام، وبريدٌ مكرّر وخطأٌ شائع في نطاقه، وكلمة مرورٍ لا تُعاد", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "الاسم": "يوسف2" }), // 2
        valid({ "البريد الشخصي": `${TAG}.dup@test.local` }), // 3
        valid({ "البريد الشخصي": `${TAG}.DUP@test.local` }), // 4 — هو نفسه بحروفٍ كبيرة
        valid({ "البريد الشخصي": `${TAG}.x@gmial.com`, "كلمة المرور": "Sirr@2026x" }), // 5
      ]),
    ).expect(200);

    expect(said(rowOf(res, 2).cells.firstName!)).toContain("أرقام");
    expect(said(rowOf(res, 3).cells.email!)).toContain("الصفّ 4");
    expect(said(rowOf(res, 4).cells.email!)).toContain("الصفّ 3");
    expect(said(rowOf(res, 5).cells.email!, "warning")).toContain("gmail.com");
    expect(rowOf(res, 5).cells.password).toMatchObject({ value: "••••••••••", state: "ok" });
    expect(JSON.stringify(res.body)).not.toContain("Sirr@2026x");
  });

  it("وطالبٌ بالاسم نفسه في المنصّة، وسنةٌ غير الجارية: تنبيهان لا يمنعان", async () => {
    const first = valid();
    await upload("", await xlsx([first])).expect(201);
    const active = await prisma.academicYear.create({ data: { title: `${TAG} 2098/2099`, isActive: true } });
    try {
      const again = valid({ "اللقب": first["اللقب"] });
      const res = await upload("/preview", await xlsx([again])).expect(200);
      const r = rowOf(res, 2);
      expect(r.errors).toBe(0);
      expect(said(r.cells.firstName!, "warning")).toContain(first["رقم التسجيل"] as string);
      expect(said(r.cells.academicYear!, "warning")).toContain(active.title);
      expect(res.body.report.summary).toMatchObject({ valid: 1, invalid: 0, warned: 1 });
      // وملفّه المُعلَّم يحمل التنبيه، بلونه الكهرماني لا الأحمر.
      const back = new ExcelJS.Workbook();
      await back.xlsx.load(Buffer.from(res.body.annotatedFile, "base64"));
      const ws = back.getWorksheet("الطلبة")!;
      const yearCol = IMPORT_COLUMNS.findIndex((c) => c.key === "academicYear") + 1;
      expect((ws.getRow(2).getCell(yearCol).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFBE9C6");
    } finally {
      await prisma.academicYear.delete({ where: { id: active.id } });
    }
  });

  it("وعلى مستوى الملف: عمودٌ مكرّر يمنع، وعمودٌ مجهولٌ وورقةٌ أخرى وعمودٌ اختياريٌّ غائب يُنبَّه عليها", async () => {
    const all = IMPORT_COLUMNS.map((c) => c.header);
    const dup = await upload("/preview", await xlsx([valid()], [...all, "التخصص"])).expect(200);
    expect(dup.body.report.fileErrors[0]).toContain("مكرّر");

    const headers = [...all.filter((h) => h !== "الجنس"), "ملاحظات"];
    const res = await upload(
      "/preview",
      await xlsx([valid()], headers, { extraSheet: "مسودّة" }),
    ).expect(200);
    const warnings = res.body.report.fileWarnings.join(" | ");
    expect(warnings).toContain("«الجنس»");
    expect(warnings).toContain("«ملاحظات»");
    expect(warnings).toContain("«مسودّة»");
    expect(res.body.report.columns.find((c: { key: string }) => c.key === "gender").letter).toBeNull();
    expect(res.body.report.file.ignored[0]).toMatchObject({ header: "ملاحظات" });
    expect(res.body.report.summary.valid).toBe(1);
  });
});

describe("الاستيراد", () => {
  it("يُنشئ الدفعة، ويولّد ما لم يُكتب، والحساب يدخل بكلمته", async () => {
    const withPass = valid({
      "كلمة المرور": "Talib@2026A",
      "الاسم باللاتينية": "nour el houda",
      "اللقب باللاتينية": "ben ali",
      "الجنس": "أنثى",
      "حالة التوثيق": "موثّق",
      // خانةٌ عددية حذفت الصفر الأوّل، وبريدٌ صار رابطاً في Excel
      "رقم الهاتف": 550000004,
      "البريد الشخصي": { text: `${TAG}.imp1@test.local`, hyperlink: `mailto:${TAG}.imp1@test.local` },
    });
    const generated = valid({ "رقم التسجيل": Number(reg()) }); // رقمٌ لا نصّ

    const res = await upload("", await xlsx([withPass, generated])).expect(201);
    expect(res.body.created).toBe(2);

    const [a, b] = res.body.accounts as { registrationNumber: string; password: string | null }[];
    expect(a!.password).toBeNull(); // كُتبت في الملف
    expect(b!.password).toMatch(/^[A-Za-z0-9]{12}$/);

    const s = await prisma.student.findUniqueOrThrow({
      where: { registrationNumber: withPass["رقم التسجيل"] as string },
      include: { user: true },
    });
    expect(s.specializationId).toBe(f.specialization.id);
    expect(s.academicYearId).toBe(f.academicYear.id);
    expect(s.user.firstNameLatin).toBe("Nour El Houda");
    expect(s.user.lastNameLatin).toBe("BEN ALI");
    expect(s.user.gender).toBe("female");
    expect(s.user.isVerified).toBe(true);
    expect(s.user.phone).toBe("0550000004");
    expect(s.user.email).toBe(`${TAG}.imp1@test.local`);

    // وملفّ الحسابات يحمل المولَّدة، ولا يكرّر ما كتبه المسؤول بنفسه.
    const acc = new ExcelJS.Workbook();
    await acc.xlsx.load(Buffer.from(res.body.accountsFile, "base64"));
    const sheet = acc.getWorksheet("الحسابات")!;
    expect(sheet.getRow(2).getCell(1).value).toBe(a!.registrationNumber);
    expect(sheet.getRow(2).getCell(4).value).toBe("كما في الملف المرفوع");
    expect(sheet.getRow(3).getCell(4).value).toBe(b!.password);

    // كلا الحسابين يدخل: بما كُتب، وبما وُلِّد.
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: a!.registrationNumber, password: "Talib@2026A" })
      .expect(200);
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: b!.registrationNumber, password: b!.password })
      .expect(200);
  });

  /** كلّها أو لا شيء: نصف دفعةٍ يصطدم بنفسه عند إعادة الرفع. */
  it("وصفٌّ خاطئٌ واحد ⇒ 400 بتقريره، ولا يُنشأ أحد", async () => {
    const good = valid();
    const res = await upload("", await xlsx([good, valid({ "التخصص": "لا شيء" })])).expect(400);

    expect(res.body.report.summary).toMatchObject({ total: 2, invalid: 1 });
    expect(
      await prisma.student.count({ where: { registrationNumber: good["رقم التسجيل"] as string } }),
    ).toBe(0);
  });
});
