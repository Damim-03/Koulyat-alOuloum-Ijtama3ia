/**
 * استيراد الأساتذة من Excel — بقاعدة نافذة «إضافة أستاذ» وخدمتها نفسها.
 *
 *   **البريد الجامعي** إلزاميّ، ونطاقه من النطاقات المسجَّلة، ولا يتكرّر.
 *   **الرقم الوظيفي** يُولَّد (EAN-13) إن تُرك، ويُقبل إن كُتب 13 رقماً.
 *   **القسم** إلزاميّ، والكلية تُشتقّ منه — والمكتوبة باليد تُقارن به.
 *   **والدفعة كلّها أو لا أحد**، والحساب يدخل بالبريد الجامعي وكلمته.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { PROFESSOR_COLUMNS, PROFESSOR_SPEC } from "../../src/modules/admin/professor-import/columns";
import { parseImportFile } from "../../src/modules/admin/import-kit/parser";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let student = "";
/**
 * نطاقٌ جامعيٌّ للاختبار. لاحقة `TEST_DOMAIN_SUFFIX` لا تصلح هنا: فيها شرطة،
 * وzod لا يقبل بريداً نطاقه الأعلى بغير الحروف — فيُنشأ هذا ويُحذف في الختام.
 */
const DOMAIN = `imp${Date.now().toString(36)}.test`;
let otherFaculty = { id: "", name: "" };

const auth = (r: request.Test, bearer = admin) => r.set("Authorization", `Bearer ${bearer}`);

let seq = 0;
const AR = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
const uniqueLast = () => {
  let n = ++seq + (Date.now() % 100000);
  let s = "";
  do {
    s = AR[n % AR.length] + s;
    n = Math.floor(n / AR.length);
  } while (n > 0);
  return `بلقاسم ${s}`;
};
const mail = () => `${TAG}.p${Date.now().toString(36)}${++seq}@${DOMAIN}`;
/** لقبٌ لاتينيّ لا يتكرّر بين التشغيلات — التكرار يُقارَن باللاتيني. */
const uniqueLatinLast = () => {
  let n = ++seq + (Date.now() % 100000);
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  } while (n > 0);
  return `BELKACEM ${s}`;
};

type Row = Partial<Record<(typeof PROFESSOR_COLUMNS)[number]["header"], ExcelJS.CellValue>>;

async function xlsx(rows: Row[], headers: string[] = PROFESSOR_COLUMNS.map((c) => c.header)) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الأساتذة");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => (r as Record<string, ExcelJS.CellValue>)[h] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const valid = (over: Row = {}): Row => ({
  "الاسم باللاتينية": "Karim",
  "اللقب باللاتينية": uniqueLatinLast(),
  "الاسم": "كريم",
  "اللقب": uniqueLast(),
  "البريد الجامعي": mail(),
  "القسم": f.department.name,
  ...over,
});

type Cell = { value: string; saved?: string; state: string; issues?: { level: string; message: string }[] };
type ReportRow = { row: number; cells: Record<string, Cell>; errors: number; warnings: number };
const rowOf = (res: request.Response, n: number) =>
  (res.body.report.rows as ReportRow[]).find((r) => r.row === n)!;
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

const upload = (path: string, buf: Buffer, name = "professors.xlsx") =>
  auth(request(app).post(`/api/admin/professors/import${path}`)).attach("file", buf, name);

const template = async (): Promise<Buffer> =>
  (
    await auth(request(app).get("/api/admin/professors/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200)
  ).body;

beforeAll(async () => {
  await teardown();
  f = await seed(2);
  await prisma.universityDomain.create({ data: { domain: DOMAIN } });
  otherFaculty = await prisma.faculty.create({
    data: { name: `${TAG} faculty P`, code: `${TAG}-FAC-P` },
    select: { id: true, name: true },
  });
  admin = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
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
  await prisma.universityDomain.deleteMany({ where: { domain: DOMAIN } });
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("نموذج الأساتذة", () => {
  it("يُنزَّل بعناوين الاستيراد، وبالكليات والأقسام والنطاقات والرتب، وقوائمه منسدلة", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template());
    const ws = wb.getWorksheet("الأساتذة")!;
    expect((ws.getRow(2).values as unknown[]).slice(1)).toEqual(PROFESSOR_COLUMNS.map((c) => c.header));

    const lists = wb.getWorksheet("القوائم")!;
    expect(lists.state).toBe("hidden");
    expect(wb.getWorksheet("تصفية")!.state).toBe("hidden");
    const col = (c: string) => lists.getColumn(c).values.slice(2);
    expect(col("A")).toContain(f.department.name);
    expect(col("D")).toContain(DOMAIN);
    expect(col("I")).toContain(f.faculty.name);
    expect(col("K")).toContain("أستاذ محاضر أ");

    const dvAt = (k: string) => ws.getRow(3).getCell(PROFESSOR_COLUMNS.findIndex((c) => c.key === k) + 1).dataValidation;
    for (const k of ["faculty", "department", "grade", "gender", "verified"]) expect(dvAt(k)?.type).toBe("list");
    expect(String(dvAt("department")?.formulae?.[0])).toContain("OFFSET(");
    expect(dvAt("grade")?.errorStyle).toBe("warning"); // الرتبة تقترح ولا تفرض

    const parsed = await parseImportFile(await template(), PROFESSOR_SPEC);
    expect(parsed.fileErrors).toEqual(["الملف لا يحتوي على أيّ أستاذ."]);
  });
});

describe("معاينة الأساتذة", () => {
  it("تحكم على كلّ صفّ ولا تكتب شيئاً، والكلية والرقم الوظيفي يُملآن", async () => {
    const a = valid({ "الرتبة": "استاذ محاضر ا", "الصفة": "رئيس قسم ، مسؤول ماستر" });
    const res = await upload("/preview", await xlsx([a, valid()])).expect(200);
    expect(res.body.report.summary).toEqual({ total: 2, valid: 2, invalid: 0, warned: 0 });

    const { cells } = rowOf(res, 2);
    expect(cells.faculty).toMatchObject({ state: "auto", saved: f.faculty.name });
    expect(cells.employeeNumber).toMatchObject({ state: "auto", saved: "يُولَّد تلقائياً" });
    expect(cells.grade!.saved).toBe("أستاذ محاضر أ"); // إملاءٌ قريب ← الرتبة الرسمية
    expect(cells.tags!.saved).toBe("رئيس قسم، مسؤول ماستر");
    expect(
      await prisma.professor.count({ where: { universityEmail: a["البريد الجامعي"] as string } }),
    ).toBe(0);
  });

  it("والبريد الجامعي: إلزاميّ، بنطاقٍ مسجَّل، لا يتكرّر", async () => {
    const dup = mail();
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "البريد الجامعي": null }), // 2
        valid({ "البريد الجامعي": `${TAG}.x@gmail.com` }), // 3 — ليس نطاقاً جامعياً
        valid({ "البريد الجامعي": dup }), // 4
        valid({ "البريد الجامعي": dup.toUpperCase() }), // 5 — هو نفسه
      ]),
    ).expect(200);
    expect(said(rowOf(res, 2).cells.universityEmail!)).toContain("إلزامي");
    expect(said(rowOf(res, 3).cells.universityEmail!)).toContain(`@${DOMAIN}`);
    expect(said(rowOf(res, 4).cells.universityEmail!)).toContain("الصفّ 5");
    expect(said(rowOf(res, 5).cells.universityEmail!)).toContain("الصفّ 4");
  });

  it("والرقم الوظيفي 13 رقماً، والقسم من المنصّة، والكلية المكتوبة توافقه", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "الرقم الوظيفي": "12345" }), // 2
        valid({ "القسم": "قسم لا وجود له" }), // 3
        valid({ "القسم": null }), // 4
        valid({ "الكلية": otherFaculty.name }), // 5 — كليةٌ أخرى
        valid({ "الكلية": `  ${f.faculty.name.toUpperCase()} ` }), // 6 — توافق، بحروفٍ كبيرة
        valid({ "الرتبة": "أستاذ زائر" }), // 7 — ليست من السلّم الرسميّ
      ]),
    ).expect(200);

    expect(said(rowOf(res, 2).cells.employeeNumber!)).toContain("13 رقماً");
    expect(said(rowOf(res, 3).cells.department!)).toContain("ليس قسماً في المنصّة");
    expect(said(rowOf(res, 4).cells.department!)).toContain("إلزامي");
    expect(errorKeys(rowOf(res, 5))).toEqual(["faculty"]);
    expect(said(rowOf(res, 5).cells.faculty!)).toContain(`كليته في المنصّة «${f.faculty.name}»`);
    expect(rowOf(res, 6).cells.faculty).toMatchObject({ state: "ok", saved: f.faculty.name });
    expect(rowOf(res, 7).errors).toBe(0);
    expect(said(rowOf(res, 7).cells.grade!, "warning")).toContain("السلّم الرسميّ");
  });

  it("وكلمة المرور التي هي لقب صاحبها تنبيه", async () => {
    const res = await upload(
      "/preview",
      await xlsx([valid({ "اللقب باللاتينية": "BENAMEUR", "الاسم باللاتينية": "Karim", "كلمة المرور": "BENAMEUR" })]),
    ).expect(200);
    expect(said(rowOf(res, 2).cells.password!, "warning")).toContain("اسم صاحبها أو لقبه");
    // ولا تُعاد إلى المتصفّح: نجومٌ بطولها.
    expect(rowOf(res, 2).cells.password!.value).toBe("••••••••");
  });

  it("والطالب ممنوع", async () => {
    await auth(request(app).post("/api/admin/professors/import/preview"), student)
      .attach("file", await xlsx([valid()]), "p.xlsx")
      .expect(403);
  });
});

describe("استيراد الأساتذة", () => {
  it("يُنشئ الدفعة: رقمٌ وظيفيّ مولَّد أو مكتوب، ورتبٌ وصفات، والحساب يدخل ببريده الجامعي", async () => {
    const generated = valid({ "الرتبة": "أستاذ محاضر أ", "الصفة": "رئيس قسم", "الجنس": "ذكر", "حالة التوثيق": "موثّق" });
    const givenNumber = `6130199${String(Date.now()).slice(-6)}`;
    const given = valid({ "الرقم الوظيفي": givenNumber, "كلمة المرور": "Ostad@2026x" });

    const res = await upload("", await xlsx([generated, given])).expect(201);
    expect(res.body.created).toBe(2);
    const [a, b] = res.body.accounts as { employeeNumber: string; universityEmail: string; password: string | null }[];
    expect(a!.employeeNumber).toMatch(/^61301\d{8}$/); // EAN-13 بادئة المنصّة
    expect(a!.password).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(b!.employeeNumber).toBe(givenNumber);
    expect(b!.password).toBeNull();

    const p = await prisma.professor.findUniqueOrThrow({
      where: { universityEmail: (generated["البريد الجامعي"] as string).toLowerCase() },
      include: { user: true },
    });
    expect(p.departmentId).toBe(f.department.id);
    expect(p.grade).toEqual(["أستاذ محاضر أ"]);
    expect(p.tags).toEqual(["رئيس قسم"]);
    expect(p.user.role).toBe("professor");
    expect(p.user.gender).toBe("male");
    expect(p.user.isVerified).toBe(true);

    // ملفّ الحسابات: الرقم، والبريد (للدخول)، والاسم، وكلمة المرور.
    const acc = new ExcelJS.Workbook();
    await acc.xlsx.load(Buffer.from(res.body.accountsFile, "base64"));
    const sheet = acc.getWorksheet("الحسابات")!;
    expect(sheet.getRow(1).getCell(2).value).toBe("البريد الجامعي (للدخول)");
    expect(sheet.getRow(2).getCell(5).value).toBe(a!.password);
    expect(sheet.getRow(3).getCell(5).value).toBe("كما في الملف المرفوع");

    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: a!.universityEmail, password: a!.password })
      .expect(200);
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: b!.universityEmail, password: "Ostad@2026x" })
      .expect(200);

    // والمعاينة بعدها تقول «مسجَّلٌ» للبريد والرقم.
    const again = await upload(
      "/preview",
      await xlsx([valid({ "البريد الجامعي": b!.universityEmail, "الرقم الوظيفي": givenNumber })]),
    ).expect(200);
    expect(said(rowOf(again, 2).cells.universityEmail!)).toContain("مسجَّلٌ لأستاذٍ");
    expect(said(rowOf(again, 2).cells.employeeNumber!)).toContain("مسجَّلٌ لأستاذٍ");
  });

  it("وصفٌّ خاطئٌ واحد ⇒ 400 بتقريره، ولا يُنشأ أحد", async () => {
    const good = valid();
    const res = await upload("", await xlsx([good, valid({ "القسم": "لا شيء" })])).expect(400);
    expect(res.body.report.summary).toMatchObject({ total: 2, invalid: 1 });
    expect(res.body.annotatedFile).toBeDefined();
    expect(
      await prisma.professor.count({ where: { universityEmail: (good["البريد الجامعي"] as string).toLowerCase() } }),
    ).toBe(0);
  });
});

describe("الاسم واللقب باللاتينية", () => {
  it("إلزاميان، والعربيّان اختياريان", async () => {
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "اللقب باللاتينية": null }), // 2
        valid({ "الاسم": null, "اللقب": null }), // 3 — العربيّ اختياريّ
      ]),
    ).expect(200);

    expect(errorKeys(rowOf(res, 2))).toEqual(["lastNameLatin"]);
    expect(said(rowOf(res, 2).cells.lastNameLatin!)).toContain("إلزامي");
    expect(errorKeys(rowOf(res, 3))).toEqual([]);
  });
});
