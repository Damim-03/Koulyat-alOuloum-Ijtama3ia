/**
 * أدوات الاستيراد المشتركة — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI تمرّ بالملفّ السليم والمعطوب. وما يبقى خارجها حالاتٌ لا
 * يصنعها ملفّ اختبارٍ بتخصّصٍ واحد ولا مسؤولٌ يعمل كما ينبغي: نموذجٌ لعدّة
 * تخصّصاتٍ ومستوياتٍ (فترتيبها يُرى)، وخانةٌ صيغتُها في الملف، وأرشيفٌ يبدو
 * xlsx وليس كذلك، ونموذجٌ يتعذّر بناؤه، وملفّ تعليقاتٍ يسقط فلا يُسقط المعاينة.
 */
jest.mock("../../../core/prisma/client", () => ({
  prisma: { user: { findMany: jest.fn() } },
}));
jest.mock("./files", () => ({
  ...jest.requireActual("./files"),
  annotateImportFile: jest.fn(),
}));

import ExcelJS from "exceljs";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../../core/prisma/client";
import { tr } from "../../../core/i18n";
import { RowCheck } from "./report";
import { importControllers } from "./controller";
import { annotatedBase64, fullName, loadTakenMails } from "./pipeline";
import { annotateImportFile } from "./files";
import { buildImportTemplate } from "../student-import/template";
import type { ImportColumn } from "./columns";
import type { ParsedFile } from "./parser";
import type { ImportReport } from "./report";

const findMany = (prisma as unknown as { user: { findMany: jest.Mock } }).user.findMany;

//
// ═══ نموذج الهيكل الجامعي ═══
//

describe("academicTemplate — قائمة التخصصات في النموذج", () => {
  const spec = (name: string, level: string, fac: string, dep: string, fil: string) => ({
    id: name,
    name,
    level,
    filiere: { name: fil, department: { name: dep, faculty: { name: fac } } },
  });

  /**
   * القائمة المنسدلة بترتيب الهيكل: الكلية ثم القسم ثم الشعبة أبجدياً، ثم
   * المستوى (ليسانس، ماستر، دكتوراه). ومستوىً لا يعرفه النموذج يُكتب كما هو
   * ويأتي آخر شعبته — لا يسقط ولا يُخترع له اسم.
   */
  it("مرتّبةٌ بالهيكل ثم بالمستوى، والمستوى المجهول يُكتب كما هو وآخراً", async () => {
    const buf = await buildImportTemplate({
      specs: [
        spec("تخصص م", "master", "كلية ب", "قسم ب", "شعبة ب"),
        spec("تخصص د", "doctorate", "كلية أ", "قسم أ", "شعبة أ"),
        spec("تخصص س", "bootcamp", "كلية أ", "قسم أ", "شعبة أ"),
        spec("تخصص ل", "licence", "كلية أ", "قسم أ", "شعبة أ"),
      ],
      years: [{ title: "2026/2027", isActive: true }],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const lists = wb.getWorksheet("القوائم")!;
    const column = (c: string) =>
      [2, 3, 4, 5].map((r) => lists.getCell(`${c}${r}`).value);

    expect(column("A")).toEqual(["تخصص ل", "تخصص د", "تخصص س", "تخصص م"]);
    expect(column("E")).toEqual(["ليسانس", "دكتوراه", "bootcamp", "ماستر"]);
  });

  /** وتخصّصان بالمستوى نفسه في الشعبة نفسها: بالاسم — في جدول التخصصات وفي كلّ قائمةٍ تضيّقها. */
  it("وتخصّصان بالمستوى نفسه في الشعبة نفسها ⇒ أبجدياً في كلّ قائمة", async () => {
    const buf = await buildImportTemplate({
      specs: [
        spec("تخصص ي", "master", "كلية أ", "قسم أ", "شعبة أ"),
        spec("تخصص ب", "master", "كلية أ", "قسم أ", "شعبة أ"),
      ],
      years: [{ title: "2026/2027", isActive: true }],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const byColumn = new Map<number, string[]>();
    wb.getWorksheet("القوائم")!.eachRow((r) =>
      r.eachCell((c, n) => {
        if (c.value === "تخصص ب" || c.value === "تخصص ي") byColumn.set(n, [...(byColumn.get(n) ?? []), c.value]);
      }),
    );

    expect(byColumn.size).toBeGreaterThan(1);
    for (const names of byColumn.values()) expect(names.join(" ")).toMatch(/^(تخصص ب تخصص ي ?)+$/);
  });
});

//
// ═══ خانات الصفّ ═══
//

describe("RowCheck", () => {
  const columns = [
    { key: "a", header: "أ", kind: "req", width: 10, note: "", group: "personal" },
    { key: "b", header: "ب", kind: "opt", width: 10, note: "", group: "personal" },
  ] as ImportColumn<"a" | "b">[];

  it("قيمةٌ هي ناتج صيغةٍ في الملف ⇒ يُقال ذلك، لا خطأ", () => {
    const r = new RowCheck({ row: 2, hidden: false, cells: { a: { text: "42", raw: "42", formula: true } } }, columns);
    expect(r.cells.a.state).toBe("ok");
    expect(r.cells.a.issues).toEqual([{ level: "info", message: "القيمة ناتج صيغةٍ في الملف." }]);
  });

  it("وصيغةٌ فارغة الناتج لا يُقال عنها شيء", () => {
    const r = new RowCheck({ row: 2, hidden: false, cells: { a: { text: "", raw: "", formula: true } } }, columns);
    expect(r.cells.a.issues).toBeUndefined();
  });

  /** ما تملؤه المنصّة لا يمحو خطأً أو تنبيهاً قيل في الخانة قبله. */
  it("الملء التلقائيّ يُذكر، ولا يغطّي خطأً ولا تنبيهاً", () => {
    const r = new RowCheck({ row: 2, hidden: false, cells: {} }, columns);
    r.error("a", "خطأ");
    r.warn("b", "تنبيه");
    r.auto("a", "قيمة");
    r.auto("b", "قيمة");
    expect([r.cells.a.state, r.cells.b.state]).toEqual(["error", "warning"]);
    expect(r.cells.a.saved).toBe("قيمة");
  });
});

//
// ═══ وحدة التحكّم المشتركة ═══
//

describe("importControllers", () => {
  const fakeRes = () => {
    const res = { status: jest.fn(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn() };
    res.status.mockReturnValue(res);
    return res as unknown as Response & { status: jest.Mock };
  };
  const make = (over: Partial<Parameters<typeof importControllers>[0]> = {}) =>
    importControllers({
      fileName: "t.xlsx",
      template: async () => Buffer.from("x"),
      validate: jest.fn(),
      run: jest.fn(),
      ...over,
    });

  /** يبدأ كأرشيف ZIP، ولا فهرس فيه يُقرأ: يُردّ قبل أن يصل ExcelJS. */
  it("ملفٌّ يبدو xlsx ولا يُفكّ ⇒ 400 قبل أيّ قراءة", async () => {
    const validate = jest.fn();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;
    const req = { file: { buffer: Buffer.from("PK\x03\x04 — not really an archive") } } as unknown as Request;

    await make({ validate }).preview(req, fakeRes(), next);

    expect(validate).not.toHaveBeenCalled();
    expect(next.mock.calls[0]![0]).toMatchObject({ statusCode: 400, message: tr("upload.xlsxUnsafe") });
  });

  it("ونموذجٌ يتعذّر بناؤه ⇒ يصل معالج الأخطاء، ولا يُرسل نصف ملف", async () => {
    const down = new Error("database connection lost");
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await make({ template: async () => Promise.reject(down) }).template({} as Request, res, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.status).not.toHaveBeenCalled();
  });
});

//
// ═══ الخطوات المشتركة ═══
//

describe("pipeline", () => {
  it("fullName: بالعربية أوّلاً، وباللاتينية حين لا عربيّ", () => {
    expect(fullName({ firstName: "يوسف", lastName: "حمادي", firstNameLatin: "Youcef", lastNameLatin: "HAMADI" })).toBe("يوسف حمادي");
    expect(fullName({ firstName: null, lastName: null, firstNameLatin: "Youcef", lastNameLatin: "HAMADI" })).toBe("Youcef HAMADI");
  });

  it("loadTakenMails: البريد بحروفٍ صغيرة مفتاحاً، ومن يملكه", async () => {
    findMany.mockResolvedValueOnce([
      { email: "Y.Hamadi@Univ.dz", role: "professor", firstName: "يوسف", lastName: "حمادي" },
      { email: null, role: "student", firstName: null, lastName: null },
    ]);
    const taken = await loadTakenMails(["y.hamadi@univ.DZ", "Y.HAMADI@univ.dz"]);

    // يُسأل عنه مرّةً واحدة مهما تكرّر في الملف.
    expect(findMany.mock.calls[0]![0].where).toEqual({ email: { in: ["y.hamadi@univ.dz"] } });
    expect(taken.get("y.hamadi@univ.dz")).toEqual({ role: "professor", name: "يوسف حمادي" });
  });

  /** الملف المُعلَّم إضافةٌ للتقرير لا شرطٌ له: يسقط فتبقى المعاينة كاملةً بدونه. */
  it("annotatedBase64: ملفُّ التعليقات يسقط ⇒ يُسجَّل، والمعاينة بلا ملف", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (annotateImportFile as jest.Mock).mockRejectedValueOnce(new Error("bad sheet"));
    const parsed = { layout: { sheet: "x" } } as unknown as ParsedFile;
    const report = { summary: { invalid: 1, warned: 0 }, rows: [] } as unknown as ImportReport;

    expect(await annotatedBase64(Buffer.from("x"), parsed, report, [], "student-import")).toBeUndefined();
    expect(logged).toHaveBeenCalledWith("[student-import] annotated file failed:", expect.any(Error));
    logged.mockRestore();
  });
});
