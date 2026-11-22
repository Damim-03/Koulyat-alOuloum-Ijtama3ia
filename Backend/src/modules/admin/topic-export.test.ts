/**
 * تصدير المواضيع — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يصدّر مواضيع الاختبار بشرط القائمة الحقيقيّ. وهنا ما يحتاج
 * أكثر: الترتيب (الهرم ثمّ المشرف ثمّ العنوان)، والمشرف أوّلاً في خانةٍ
 * واحدة بجانب مواضيعه، ورمز النوع ولونه، والطلبة سطراً سطراً وأرقامهم
 * بجانبهم والمرسِل يُسمّى في الفريق وحده، وموضوعٌ بلا طلبة، وسطر النطاق
 * بكلّ فلتر، وأكثر من حدّ التصدير.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: {
    graduationTopic: { findMany: jest.fn() },
    academicYear: { findUnique: jest.fn() },
    specialization: { findUnique: jest.fn() },
    filiere: { findUnique: jest.fn() },
    department: { findUnique: jest.fn() },
    faculty: { findUnique: jest.fn() },
    professor: { findUnique: jest.fn() },
  },
}));

import ExcelJS from "exceljs";
import JSZip from "jszip";

import { prisma } from "../../core/prisma/client";
import { tr } from "../../core/i18n";
import { exportTopicsService, inkOf, previewTopicsService, topicsCount, type ExportTopicsQuery } from "./topic-export.service";

const db = prisma as unknown as Record<string, { findMany?: jest.Mock; findUnique?: jest.Mock }>;
const findMany = db.graduationTopic!.findMany!;

describe("topicsCount — العدد والمعدود", () => {
  it.each([
    [0, "لا مواضيع"],
    [1, "موضوعٌ واحد"],
    [2, "موضوعان"],
    [7, "7 مواضيع"],
    [11, "11 موضوعاً"],
    [100, "100 موضوع"],
  ])("%i ⇒ %s", (n, text) => {
    expect(topicsCount(n)).toBe(text);
  });
});

const spec = (name: string, level: string, filiere = "شعبة علم النفس") => ({
  name,
  level,
  filiere: { name: filiere, department: { name: "قسم علم النفس", faculty: { name: "كلية العلوم الاجتماعية" } } },
});
const CLIN = spec("علم النفس العيادي", "master");
const WORK = spec("علم النفس العمل", "licence");

const who = (first: string, last: string, latin?: [string, string]) => ({
  firstName: latin ? null : first,
  lastName: latin ? null : last,
  firstNameLatin: latin?.[0] ?? null,
  lastNameLatin: latin?.[1] ?? null,
});
const member = (reg: string, name: [string, string], isLeader = false) => ({
  isLeader,
  student: { registrationNumber: reg, user: who(...name) },
});
type TypeRow = { id: string; name: string; code: string; color: string };
const topic = (
  title: string,
  specialization: ReturnType<typeof spec>,
  supervisor: ReturnType<typeof who>,
  over: {
    status?: string;
    maxStudents?: number;
    members?: ReturnType<typeof member>[];
    summary?: string;
    co?: ReturnType<typeof who>;
    type?: TypeRow;
  } = {},
) => ({
  title,
  status: over.status ?? "open",
  maxStudents: over.maxStudents ?? 3,
  summary: over.summary ?? null,
  academicYear: { title: "2026/2027" },
  // One professor per person: the id follows the name.
  professorId: `p-${supervisor.lastName ?? supervisor.lastNameLatin}`,
  professor: { user: supervisor },
  coSupervisor: over.co ? { user: over.co } : null,
  type: over.type ?? null,
  specialization,
  projectGroup: over.members ? { members: over.members } : null,
});

const KHALED = who("خالد", "مرابط");
const CHIRAZ = who("", "", ["Chiraz", "KAHLA"]);

/** The whole file: a sheet for each level among its topics. */
async function workbook(topics: unknown[], q: Partial<ExportTopicsQuery> = {}) {
  findMany.mockResolvedValueOnce(topics);
  const buf = await exportTopicsService({ students: "without", ...q });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}
/** The file's last sheet — its only one when its topics are of one level. */
async function exported(topics: unknown[], q: Partial<ExportTopicsQuery> = {}) {
  const wb = await workbook(topics, q);
  return wb.worksheets[wb.worksheets.length - 1]!;
}
/** الصفّ الذي أوّله «#» — رأس الجدول. */
const headerRow = (ws: ExcelJS.Worksheet) => {
  let n = 0;
  ws.eachRow((r, i) => {
    if (!n && r.getCell(1).value === "#") n = i;
  });
  return ws.getRow(n);
};
const headers = (ws: ExcelJS.Worksheet) => (headerRow(ws).values as unknown[]).slice(1);
const body = (ws: ExcelJS.Worksheet) => {
  const h = headerRow(ws).number;
  return Array.from({ length: ws.rowCount - h }, (_, i) => ws.getRow(h + 1 + i));
};
/** قيمة خانةٍ في صفٍّ بعنوان عمودها. */
const cell = (ws: ExcelJS.Worksheet, row: ExcelJS.Row, header: string) => row.getCell(headers(ws).indexOf(header) + 1);

describe("exportTopicsService", () => {
  it("أكثر من حدّ التصدير ⇒ 400 قبل أن يُكتب شيء", async () => {
    findMany.mockResolvedValueOnce(Array.from({ length: 10_001 }, () => topic("t", CLIN, KHALED)));
    await expect(exportTopicsService({ students: "without" })).rejects.toMatchObject({
      statusCode: 400,
      message: tr("export.tooManyTopics", { max: 10_000 }),
    });
  });

  it("لكلّ مستوى ورقته — الليسانس ثمّ الماستر — بعنوانها وعددها: مذكرات مستوى لا تُخلط بآخر", async () => {
    const wb = await workbook([
      topic("ب — الضغط المهني", CLIN, KHALED, { status: "full" }),
      topic("أ — القلق", CLIN, KHALED, { status: "pending" }),
      topic("التوجيه", WORK, KHALED),
      topic("الذاكرة", CLIN, CHIRAZ),
    ]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["المواضيع - ليسانس", "المواضيع - ماستر"]);
    const [licence, ws] = wb.worksheets as [ExcelJS.Worksheet, ExcelJS.Worksheet];
    expect(licence.getCell("A1").value).toBe("قائمة المواضيع — ليسانس");
    expect(licence.getCell("A2").value).toBe("كلّ السنوات الجامعية — موضوعٌ واحد");
    expect(body(licence).map((r) => cell(licence, r, "عنوان الموضوع").value)).toEqual(["التوجيه"]);
    expect(cell(licence, body(licence)[0]!, "المستوى").value).toBe("ليسانس");

    expect(ws.getCell("A1").value).toBe("قائمة المواضيع — ماستر");
    expect(ws.getCell("A2").value).toBe("كلّ السنوات الجامعية — 3 مواضيع");
    expect(headers(ws)).toEqual([
      "#",
      "الأستاذ المشرف",
      "المشرف المساعد",
      "عنوان الموضوع",
      "وصف مختصر",
      "نوع الموضوع",
      "السعة",
      "الحالة",
      "الكلية",
      "القسم",
      "الشعبة",
      "المستوى",
      "التخصص",
      "السنة الجامعية",
    ]);
    // في الماستر: خالد بعنوانيه بترتيبهما، ثمّ Chiraz KAHLA
    // (في الترتيب العربيّ يأتي الاسم العربيّ قبل اللاتينيّ).
    expect(body(ws).map((r) => cell(ws, r, "عنوان الموضوع").value)).toEqual(["أ — القلق", "ب — الضغط المهني", "الذاكرة"]);
    const [first, second, third] = body(ws);
    expect(cell(ws, first!, "الأستاذ المشرف").value).toBe("خالد مرابط");
    expect(cell(ws, third!, "الأستاذ المشرف").value).toBe("Chiraz KAHLA");
    expect([first, second].map((r) => cell(ws, r!, "الحالة").value)).toEqual(["قيد الانتظار", "مسند"]);
    expect(cell(ws, first!, "المستوى").value).toBe("ماستر");
    expect(cell(ws, first!, "السعة").value).toBe(3);
    expect(ws.views[0]).toMatchObject({ rightToLeft: true, state: "frozen" });
    expect(ws.autoFilter).toBeTruthy();
  });

  it("بالطلبة: كلّ طالبٍ في خانته ورقمه بجانبه، بعدد أكبر سعة — والأول هو المرسِل", async () => {
    const ws = await exported(
      [
        topic("فريق", CLIN, KHALED, {
          status: "full",
          // الاستعلام يرتّب المرسِل أوّلاً، والتصدير يأخذ الترتيب كما هو.
          members: [member("202039000001", ["سارة", "بلقاسم"], true), member("202039000002", ["يونس", "حمادي"])],
        }),
        topic("فردي", CLIN, KHALED, { maxStudents: 1, members: [member("202039000003", ["أمينة", "زروقي"], true)] }),
        topic("شاغر", CLIN, KHALED, { maxStudents: 2 }),
      ],
      { students: "with" },
    );

    expect(ws.getCell("A1").value).toBe("قائمة المواضيع وطلبتها — ماستر");
    // سطرٌ في رأس الورقة يشرح العلامتين.
    expect(ws.getCell("A3").value).toBe("«مكان شاغر»: يتّسع الموضوع لطالبٍ آخر  ·  «—»: خارج سعة الموضوع");
    expect(headers(ws).slice(0, 15)).toEqual([
      "#",
      "الأستاذ المشرف",
      "المشرف المساعد",
      "عنوان الموضوع",
      "وصف مختصر",
      "نوع الموضوع",
      "الطالب الأول (المرسِل)",
      "رقم تسجيل الأول",
      "الطالب الثاني",
      "رقم تسجيل الثاني",
      "الطالب الثالث",
      "رقم تسجيل الثالث",
      "المسنَدون",
      "السعة",
      "الحالة",
    ]);
    const [shaghir, fardi, fariq] = body(ws);
    const seats = (r: ExcelJS.Row) => headers(ws).slice(6, 12).map((h) => cell(ws, r, h).value);

    // فريقٌ من اثنين في موضوعٍ لثلاثة: مكانه الثالث شاغر، ولا رقم له.
    expect(seats(fariq!)).toEqual(["سارة بلقاسم", "202039000001", "يونس حمادي", "202039000002", "مكان شاغر", "—"]);
    expect(cell(ws, fariq!, "المسنَدون").value).toBe(2);
    expect(cell(ws, fariq!, "رقم تسجيل الأول").numFmt).toBe("@");
    // موضوعٌ لطالبٍ واحد: ما بعده خارج سعته.
    expect(seats(fardi!)).toEqual(["أمينة زروقي", "202039000003", "—", "—", "—", "—"]);
    // وموضوعٌ لاثنين بلا طلبة: مكانان شاغران، ثمّ خارج السعة.
    expect(seats(shaghir!)).toEqual(["مكان شاغر", "—", "مكان شاغر", "—", "—", "—"]);
    expect(cell(ws, shaghir!, "المسنَدون").value).toBe(0);

    // والعلامات في وسط خاناتها، باهتةٌ بالتنسيق الشرطيّ نفسه الذي لـ«لا يوجد».
    expect(cell(ws, shaghir!, "الطالب الأول (المرسِل)").alignment).toMatchObject({ horizontal: "center" });
    const rules = (ws as unknown as { conditionalFormattings: { rules: { formulae: string[] }[] }[] }).conditionalFormattings
      .flatMap((cf) => cf.rules)
      .map((r) => r.formulae[0]);
    expect(rules).toEqual(['"لا يوجد"', '"مكان شاغر"', '"—"']);
  });

  it("وما فوق العاشر يُرقَّم؛ وفريقٌ جاوز سعة موضوعه يُعرض كاملاً", async () => {
    const one = await exported([topic("شاغر", CLIN, KHALED, { maxStudents: 1 })], { students: "with" });
    expect(headers(one).slice(6, 9)).toEqual(["الطالب الأول (المرسِل)", "رقم تسجيل الأول", "المسنَدون"]);
    expect(cell(one, body(one)[0]!, "الطالب الأول (المرسِل)").value).toBe("مكان شاغر");

    // السعة عشرةٌ على الأكثر في كلّ نماذج الإنشاء — والملف لا ينكسر إن جاوزتها بيانات.
    const crowd = Array.from({ length: 11 }, (_, i) => member(`2020390000${String(i).padStart(2, "0")}`, ["طالب", `رقم ${i}`], i === 0));
    const ws = await exported([topic("كبير", CLIN, KHALED, { maxStudents: 3, members: crowd })], { students: "with" });
    expect(headers(ws)).toEqual(expect.arrayContaining(["الطالب العاشر", "رقم تسجيل العاشر", "الطالب 11", "رقم تسجيل 11"]));
    expect(cell(ws, body(ws)[0]!, "رقم تسجيل 11").value).toBe("202039000010");
  });

  /**
   * تقريرٌ لا جدولٌ خام: بلا شبكة Excel، والعنوان شريطٌ بلون المنصّة، ورؤوس
   * أماكن الطلبة ذهبية، والحالة بلونها؛ و«#» والعنوان والمشرف ثابتةٌ عند
   * التمرير أفقياً — وأعمدة أرقام التسجيل بلا مثلّث «رقمٌ مخزَّنٌ كنص».
   */
  it("المظهر: شريط العنوان، والرؤوس الذهبية، وألوان الحالة، والتثبيت، وبلا مثلّثات", async () => {
    findMany.mockResolvedValueOnce([
      topic("فريق", CLIN, KHALED, { status: "full", members: [member("202039000001", ["سارة", "بلقاسم"], true)] }),
      topic("منتظر", CLIN, KHALED, { status: "pending" }),
    ]);
    const buf = await exportTopicsService({ students: "with" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("المواضيع - ماستر")!;

    // «#», the supervisor, the co-supervisor and the title stay in view.
    expect(ws.views[0]).toMatchObject({ rightToLeft: true, state: "frozen", xSplit: 4, ySplit: headerRow(ws).number, showGridLines: false });
    // الشريط ممتدٌّ بلونه على عرض الجدول كلّه، لا في خانته الأولى وحدها.
    const banner = ws.getRow(1);
    expect([1, headers(ws).length].map((c) => (banner.getCell(c).fill as ExcelJS.FillPattern).fgColor?.argb)).toEqual(["FF26423D", "FF26423D"]);
    expect(banner.getCell(1).font).toMatchObject({ bold: true, size: 18 });

    const fill = (h: string) => (cell(ws, headerRow(ws), h).fill as ExcelJS.FillPattern).fgColor?.argb;
    expect([fill("الطالب الأول (المرسِل)"), fill("رقم تسجيل الأول"), fill("عنوان الموضوع")]).toEqual(["FFC1965A", "FFC1965A", "FF26423D"]);

    const [full, pending] = body(ws);
    expect(cell(ws, full!, "الحالة").font).toMatchObject({ bold: true, color: { argb: "FF2F7D4F" } });
    expect(cell(ws, pending!, "الحالة").font).toMatchObject({ bold: true, color: { argb: "FFB7791F" } });
    // والعلامة لا تُلوَّن ولا تُعرَّض: باهتةٌ بالتنسيق الشرطيّ وحده.
    expect(cell(ws, pending!, "الطالب الأول (المرسِل)").font.bold).toBeFalsy();

    const xml = await (await JSZip.loadAsync(buf)).file("xl/worksheets/sheet1.xml")!.async("string");
    const reg = ws.getColumn(headers(ws).indexOf("رقم تسجيل الأول") + 1).letter;
    const [first, last] = [full!.number, pending!.number];
    expect(xml).toContain(`<ignoredError sqref="${reg}${first}:${reg}${last}`);
    expect(xml).toMatch(/<\/headerFooter><ignoredErrors>/);
  });

  it("المشرف خانةٌ واحدة بجانب مواضيعه في تخصّصها، ولونٌ واحد لصفوفها؛ ورمز النوع ولونه", async () => {
    const AI: TypeRow = { id: "t-ai", name: "الذكاء الاصطناعي", code: "AI", color: "#dae3f3" };
    const IOT: TypeRow = { id: "t-iot", name: "إنترنت الأشياء", code: "IoT", color: "#e2efda" };
    const wb = await workbook([
      topic("أ — الشبكات", CLIN, KHALED, { type: IOT, summary: "وصفٌ قصير", co: CHIRAZ }),
      topic("ب — التعلّم", CLIN, KHALED, { type: AI }),
      topic("ج — الرؤية", CLIN, KHALED, { type: AI }),
      topic("الذاكرة", CLIN, CHIRAZ),
      // The same supervisor at another level: on that level's sheet.
      topic("التوجيه", WORK, KHALED, { type: AI }),
    ]);
    const [licence, ws] = wb.worksheets as [ExcelJS.Worksheet, ExcelJS.Worksheet];
    expect(body(licence).map((r) => [cell(licence, r, "#").value, cell(licence, r, "عنوان الموضوع").value])).toEqual([["AI01", "التوجيه"]]);

    const rows = body(ws);
    const sup = headers(ws).indexOf("الأستاذ المشرف") + 1;
    const merged = (r: ExcelJS.Row) => (ws.getCell(r.number, sup) as ExcelJS.Cell & { isMerged: boolean }).isMerged;

    // Khaled's three master topics in one cell, then Chiraz.
    expect(rows.map((r) => cell(ws, r, "عنوان الموضوع").value)).toEqual(["أ — الشبكات", "ب — التعلّم", "ج — الرؤية", "الذاكرة"]);
    expect([0, 1, 2].map((i) => merged(rows[i]!))).toEqual([true, true, true]);
    expect(ws.getCell(rows[0]!.number, sup).value).toBe("خالد مرابط");
    expect(ws.getCell(rows[0]!.number, sup).alignment).toMatchObject({ vertical: "middle" });
    expect(merged(rows[3]!)).toBe(false);

    // Codes count per specialization: the master's first AI is AI01 too.
    expect(rows.map((r) => cell(ws, r, "#").value)).toEqual(["IoT01", "AI01", "AI02", 4]);
    expect(cell(ws, rows[0]!, "#").font).toMatchObject({ bold: true, color: { argb: inkOf("#e2efda") } });
    expect(inkOf("#e2efda")).not.toBe(inkOf("#dae3f3"));
    // The type in its colour; none without one.
    expect((cell(ws, rows[0]!, "نوع الموضوع").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFE2EFDA");
    expect(cell(ws, rows[0]!, "نوع الموضوع").value).toBe("إنترنت الأشياء");
    expect(cell(ws, rows[3]!, "نوع الموضوع").value).toBe("لا يوجد");
    expect(cell(ws, rows[0]!, "المشرف المساعد").value).toBe("Chiraz KAHLA");
    expect(cell(ws, rows[0]!, "وصف مختصر").value).toBe("وصفٌ قصير");

    // One band per supervisor's run: Khaled's three rows share theirs, Chiraz takes the next.
    const shade = (r: ExcelJS.Row) => (cell(ws, r, "عنوان الموضوع").fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb ?? "none";
    expect(new Set([0, 1, 2].map((i) => shade(rows[i]!))).size).toBe(1);
    expect(shade(rows[2]!)).not.toBe(shade(rows[3]!));
  });

  it("بالإنجليزية: الورقة من اليسار، ورؤوسها وحالاتها ومستوياتها بالإنجليزية، والأسماء باللاتينية حيث عُرفت", async () => {
    findMany.mockResolvedValueOnce([
      topic("Q", CLIN, CHIRAZ, { status: "full", members: [member("202039000001", ["سارة", "بلقاسم"], true)] }),
      topic("R", CLIN, KHALED, { status: "pending" }),
    ]);
    const buf = await exportTopicsService({ students: "with", lang: "en" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Topics - Master's")!;
    expect(ws.getCell("A1").value).toBe("List of topics and their students — Master's");
    expect(ws.getCell("A3").value).toBe(`"Vacant seat": the topic has room for another student  ·  "—": beyond the topic's capacity`);
    expect(ws.getCell("A2").value).toBe("All academic years — 2 topics");
    expect(headers(ws).slice(0, 8)).toEqual([
      "#",
      "Supervisor",
      "Co-supervisor",
      "Topic title",
      "Short description",
      "Type of topic",
      "Student 1 (sender)",
      "Reg. no. 1",
    ]);
    expect(headers(ws)).toEqual(expect.arrayContaining(["Capacity", "Status", "Faculty", "Specialty", "Level", "Academic year"]));
    expect(ws.views[0]).toMatchObject({ rightToLeft: false });
    const [chiraz, khaled] = body(ws);
    expect(cell(ws, chiraz!, "Supervisor").value).toBe("Chiraz KAHLA");
    // No Latin name: the Arabic one, rather than nothing.
    expect(cell(ws, khaled!, "Supervisor").value).toBe("خالد مرابط");
    expect(cell(ws, chiraz!, "Status").value).toBe("Assigned");
    expect(cell(ws, khaled!, "Status").value).toBe("Pending");
    expect(cell(ws, chiraz!, "Level").value).toBe("Master's");
    expect(cell(ws, khaled!, "Student 1 (sender)").value).toBe("Vacant seat");
    expect(cell(ws, khaled!, "Co-supervisor").value).toBe("None");
    expect(cell(ws, khaled!, "Topic title").alignment).toMatchObject({ horizontal: "left", readingOrder: "ltr" });
  });

  it("وبالفرنسية", async () => {
    findMany.mockResolvedValueOnce([topic("S", WORK, KHALED, { status: "open" })]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportTopicsService({ students: "without", lang: "fr" })) as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet("Sujets - Licence")!;
    expect(sheet.getCell("A1").value).toBe("Liste des sujets — Licence");
    expect(sheet.getCell("A2").value).toBe("Toutes les années universitaires — 1 sujet");
    expect(headers(sheet).slice(0, 4)).toEqual(["#", "Encadrant", "Co-encadrant", "Intitulé du sujet"]);
    const [row] = body(sheet);
    expect(cell(sheet, row!, "Statut").value).toBe("Publié");
    expect(cell(sheet, row!, "Niveau").value).toBe("Licence");
  });

  it("الأعمدة المختارة وحدها — و«#» والعنوان دائماً، والتثبيت إلى العنوان", async () => {
    const ws = await exported([topic("T", CLIN, KHALED, { status: "open" })], { columns: ["status", "specialization"] });
    // The year was not chosen: no year column, though the list spans all years.
    expect(headers(ws)).toEqual(["#", "عنوان الموضوع", "الحالة", "التخصص"]);
    expect(ws.views[0]).toMatchObject({ xSplit: 2 });

    const withYear = await exported([topic("T", CLIN, KHALED)], { columns: ["year", "supervisor"] });
    expect(headers(withYear)).toEqual(["#", "الأستاذ المشرف", "عنوان الموضوع", "السنة الجامعية"]);
    expect(withYear.views[0]).toMatchObject({ xSplit: 3 });

    // The students, asked for apart, come whatever the columns.
    const students = await exported([topic("T", CLIN, KHALED, { maxStudents: 1 })], { students: "with", columns: [] });
    expect(headers(students)).toEqual(["#", "عنوان الموضوع", "الطالب الأول (المرسِل)", "رقم تسجيل الأول", "المسنَدون"]);
  });

  it("المعاينة كالملف: الرؤوس، والقيم، والخانة المدموجة، والألوان، و«لا يوجد» — لأوّل الصفوف، والعدد كلّه", async () => {
    const AI: TypeRow = { id: "t-ai", name: "AI", code: "AI", color: "#dae3f3" };
    const rows = [
      topic("أ", CLIN, KHALED, { type: AI }),
      topic("ب", CLIN, KHALED, { type: AI, co: CHIRAZ }),
      topic("ج", CLIN, CHIRAZ, { status: "pending" }),
    ];
    const file = await exported([...rows]);
    findMany.mockResolvedValueOnce(rows);
    const { sheets } = await previewTopicsService({ students: "without" });
    expect(sheets).toHaveLength(1);
    const preview = sheets[0]!;

    expect(preview.name).toBe("المواضيع - ماستر");
    expect(preview.rtl).toBe(true);
    expect(preview.title).toEqual(["قائمة المواضيع — ماستر", "كلّ السنوات الجامعية — 3 مواضيع"]);
    expect(preview.columns.map((c) => c.header)).toEqual(headers(file));
    expect(preview.total).toBe(3);
    // Each value as the file writes it.
    body(file).forEach((r, i) =>
      preview.columns.forEach((c, k) => {
        if (!preview.rows[i]!.cells[k]!.covered) expect(preview.rows[i]!.cells[k]!.v).toBe(cell(file, r, c.header).value);
      }),
    );
    const sup = preview.columns.findIndex((c) => c.header === "الأستاذ المشرف");
    expect(preview.rows[0]!.cells[sup]).toMatchObject({ v: "خالد مرابط", rowSpan: 2 });
    expect(preview.rows[1]!.cells[sup]!.covered).toBe(true);
    const type = preview.columns.findIndex((c) => c.header === "نوع الموضوع");
    expect(preview.rows[0]!.cells[type]).toMatchObject({ fill: "#dae3f3" });
    expect(preview.rows[0]!.cells[0]).toMatchObject({ v: "AI01", ink: `#${inkOf("#dae3f3").slice(2).toLowerCase()}` });
    const co = preview.columns.findIndex((c) => c.header === "المشرف المساعد");
    expect(preview.rows[0]!.cells[co]).toMatchObject({ v: "لا يوجد", muted: true });
    // One band per supervisor: Khaled's two rows share it.
    expect(preview.rows.map((r) => r.band)).toEqual([false, false, true]);

    findMany.mockResolvedValueOnce(Array.from({ length: 45 }, (_, i) => topic(`t${i}`, CLIN, KHALED)));
    const long = (await previewTopicsService({ students: "without", lang: "en" })).sheets[0]!;
    expect([long.rows.length, long.total, long.rtl]).toEqual([40, 45, false]);
  });

  it("والعنوان الطويل يلتفّ، ويطول صفّه ليُقرأ كاملاً", async () => {
    const long = "أثر الضغوط المهنية على الصحة النفسية لدى أساتذة التعليم الثانوي: دراسة ميدانية بولاية الوادي";
    const ws = await exported([topic(long, CLIN, KHALED), topic("قصير", CLIN, KHALED)]);
    const byTitle = (title: string) => body(ws).find((r) => cell(ws, r, "عنوان الموضوع").value === title)!;
    const [longRow, shortRow] = [byTitle(long), byTitle("قصير")];
    expect(cell(ws, longRow!, "عنوان الموضوع").alignment).toMatchObject({ wrapText: true });
    expect(shortRow!.height).toBe(22);
    expect(longRow!.height).toBeGreaterThan(22);
  });

  it("السنة المحصورة: في العنوان لا في عمود؛ وسطر النطاق يسمّي التخصص والحالة والمشرف والبحث", async () => {
    db.academicYear!.findUnique!.mockResolvedValueOnce({ title: "2026/2027" });
    db.specialization!.findUnique!.mockResolvedValueOnce({ name: "علم النفس العيادي", level: "master" });
    db.professor!.findUnique!.mockResolvedValueOnce({ user: KHALED });
    const ws = await exported([topic("القلق", CLIN, KHALED)], {
      academicYearId: "y1",
      specializationId: "s1",
      status: "open",
      professorId: "p1",
      search: "القلق",
    });

    expect(ws.getCell("A2").value).toBe("علم النفس العيادي — ماستر · الحالة: منشور · المشرف: خالد مرابط · البحث: «القلق»");
    expect(ws.getCell("A3").value).toBe("السنة الجامعية 2026/2027 — موضوعٌ واحد");
    expect(headers(ws)).not.toContain("السنة الجامعية");
    expect(findMany.mock.calls.at(-1)![0].where).toMatchObject({
      academicYearId: "y1",
      specializationId: "s1",
      status: "open",
      professorId: "p1",
    });
  });

  it.each([
    ["filiereId", "filiere", "شعبة علم النفس"],
    ["departmentId", "department", "قسم علم النفس"],
    ["facultyId", "faculty", "كلية العلوم الاجتماعية"],
  ] as const)("والهرم بأدقّ ما اختير منه: %s", async (key, model, name) => {
    db[model]!.findUnique!.mockResolvedValueOnce({ name });
    const ws = await exported([], { [key]: "x1" });
    expect(ws.getCell("A2").value).toBe(name);
    expect(ws.getCell("A3").value).toBe("كلّ السنوات الجامعية — لا مواضيع");
  });

  it("ومعرّفٌ لا وجود له لا يكتب نطاقاً", async () => {
    db.specialization!.findUnique!.mockResolvedValueOnce(null);
    db.filiere!.findUnique!.mockResolvedValueOnce(null);
    expect((await exported([], { specializationId: "gone" })).getCell("A2").value).toBe("كلّ السنوات الجامعية — لا مواضيع");
    expect((await exported([], { filiereId: "gone" })).getCell("A2").value).toBe("كلّ السنوات الجامعية — لا مواضيع");
  });
});
