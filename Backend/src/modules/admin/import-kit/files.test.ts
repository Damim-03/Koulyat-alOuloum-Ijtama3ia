/**
 * الملف المُعلَّم بالأخطاء — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يُعلِّم ملفّاً رُفع أوّل مرّة، وملفّاً حفظه Excel بامتداد x14.
 * وهنا ما بعد ذلك: قواعد تحقّقٍ تُجمع نطاقاتٍ أو تسقط، وتقريرٌ سابقٌ يُرفع
 * ثانيةً فتُمحى أخطاؤه القديمة وتلوينه، وما يُقال عن الصفّ كلّه، وامتداد
 * Excel في ملفّاتٍ لم يكتبها Excel كما يكتبها — مسارٌ مطلق، واسمٌ بمراجع
 * عددية، وامتداداتٌ متداخلة أو مجهولة، وملفّاتٌ لا تُعرف فيها الورقة.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";

import type { ImportColumn } from "./columns";
import { annotateImportFile, carryExtensions, restoreValidationRanges } from "./files";

//
// ═══ قواعد التحقّق ═══
//

describe("restoreValidationRanges", () => {
  type Model = Record<string, object | undefined>;
  const dvs = (ws: ExcelJS.Worksheet) =>
    (ws as unknown as { dataValidations: { add(a: string, v: object): void; remove(a: string): void; model: Model } })
      .dataValidations;
  const list = (f: string) => ({ type: "list", allowBlank: true, formulae: [f] });

  /**
   * الخانات المقروءة من قاعدةٍ واحدة تتشارك كائنها: المستطيل يعود نطاقاً واحداً،
   * والخانة الواحدة بعنوانها، والنطاق المكتوب بمفتاحه يبقى. وما ليس مستطيلاً يسقط،
   * والمحذوفة لا تُكتب.
   */
  it("المستطيل نطاقٌ واحد، والمفردة بعنوانها، وما ليس مستطيلاً يسقط", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("المواضيع");
    const [rect, lone, ell, range, gone] = ["أ", "ب", "ج", "د", "هـ"].map((x) => list(`"${x}"`));
    for (const a of ["A3", "A4", "B3", "B4"]) dvs(ws).add(a, rect!);
    dvs(ws).add("D7", lone!);
    for (const a of ["E3", "E4", "F4"]) dvs(ws).add(a, ell!);
    dvs(ws).add("G3:G9", range!);
    dvs(ws).add("H3", gone!);
    dvs(ws).remove("H3");

    restoreValidationRanges(ws);

    expect(dvs(ws).model).toEqual({ "G3:G9": range, "A3:B4": rect, D7: lone });
  });
});

//
// ═══ التقرير على الملف نفسه ═══
//

describe("annotateImportFile", () => {
  const BRICK = "FFF6D5CC";
  const AMBER = "FFFBE9C6";
  const MINE = "FF00B050";
  const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const columns = [
    { key: "a", header: "أ", kind: "req", width: 10, note: "", group: "topic" },
    { key: "b", header: "ب", kind: "opt", width: 10, note: "", group: "topic" },
    { key: "c", header: "ج", kind: "opt", width: 10, note: "", group: "topic" },
  ] as ImportColumn[];

  /**
   * تقريرٌ سابقٌ رُفع ثانيةً: عمود «الأخطاء» نفسه يُعاد استعماله، وما كُتب فيه
   * يُمحى، وتلوين المنصّة يُزال — وما لوّنه المسؤول بيده يبقى. ثم يُكتب الجديد:
   * أخطاء الخانات، وما لا عمود له في الملف يُذكر ولا يُلوَّن، وما يُقال عن الصفّ
   * كلّه (إلا المعلومة).
   */
  it("تقريرٌ سابقٌ يُرفع ثانيةً ⇒ عموده نفسه، ويُمحى القديم، ويُكتب الجديد", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المواضيع");
    ws.addRow(["أ", "ب", "الأخطاء"]);
    ws.addRow(["x", "y", "✗ أ: خطأٌ قديم"]);
    ws.addRow(["z", "w"]);
    ws.getCell("A2").fill = fill(BRICK);
    ws.getCell("B2").fill = fill(AMBER);
    ws.getCell("B3").fill = fill(MINE);
    const before = Buffer.from(await wb.xlsx.writeBuffer());

    const out = await annotateImportFile(
      before,
      { sheetName: "المواضيع", headerRow: 1, columns: { a: 1, b: 2 } },
      [
        {
          row: 3,
          cells: {
            a: { value: "z", state: "error", issues: [{ level: "error", message: "خطأ" }] },
            c: { value: "", state: "warning", issues: [{ level: "warning", message: "تنبيه ج" }] },
          },
          issues: [
            { level: "info", message: "معلومة" },
            { level: "error", message: "خطأ الصفّ" },
            { level: "warning", message: "تنبيه الصفّ" },
          ],
        },
      ],
      columns,
    );

    const after = new ExcelJS.Workbook();
    await after.xlsx.load(out as unknown as ArrayBuffer);
    const sheet = after.getWorksheet("المواضيع")!;
    const argb = (a: string) => (sheet.getCell(a).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

    expect(sheet.getRow(1).cellCount).toBe(3); // لا عمود أخطاءٍ ثانٍ
    expect(sheet.getCell("C2").value).toBeNull();
    expect([argb("A2"), argb("B2"), argb("B3")]).toEqual([undefined, undefined, MINE]);
    expect(argb("A3")).toBe(BRICK);
    expect(sheet.getCell("C3").value).toBe(["✗ أ: خطأ", "⚠ ج: تنبيه ج", "✗ خطأ الصفّ", "⚠ تنبيه الصفّ"].join("\n"));
  });
});

//
// ═══ امتداد Excel (x14) ═══
//

describe("carryExtensions", () => {
  const SHEET = "xl/worksheets/sheet1.xml";
  const DV = "{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}"; // x14:dataValidations
  const x14 = 'xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"';
  const kept = `<ext uri="${DV}" ${x14}><x14:dataValidations count="1"/></ext>`;
  const withUid = kept.replace(`${x14}>`, `${x14} xr:uid="{0001}">`);

  /** حزمة xlsx بأقلّ ما يلزم لتُعرف الورقة: المصنّف وعلاقاته وورقته. `null` يُسقط الملف. */
  async function pkg(o: {
    sheet?: string;
    workbook?: string | null;
    rels?: string | null;
    target?: string;
  } = {}): Promise<Buffer> {
    const z = new JSZip();
    if (o.workbook !== null)
      z.file(
        "xl/workbook.xml",
        o.workbook ??
          '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="المواضيع" sheetId="1" r:id="rId1"/></sheets></workbook>',
      );
    if (o.rels !== null)
      z.file(
        "xl/_rels/workbook.xml.rels",
        o.rels ?? `<Relationships><Relationship Id="rId1" Type="worksheet" Target="${o.target ?? "worksheets/sheet1.xml"}"/></Relationships>`,
      );
    z.file(SHEET, o.sheet ?? "<worksheet><sheetData/></worksheet>");
    return z.generateAsync({ type: "nodebuffer" });
  }
  const sheetOf = async (buf: Buffer) => (await JSZip.loadAsync(buf)).file(SHEET)!.async("string");

  /**
   * من امتداد الورقة الأصليّ ينتقل x14 وحده، بلا معرّفات المراجعة: لا المجهول
   * (ومعه ما تداخل فيه)، ولا الفارغ. ويحلّ محلّ امتدادٍ كتبه exceljs نفسه.
   */
  it("ينقل x14 وحده بلا xr، ويحلّ محلّ امتداد exceljs", async () => {
    const original = await pkg({
      sheet:
        "<worksheet><sheetData/><extLst>" +
        '<ext uri="{A8765BA9-456A-4dab-B4F3-ACF838C121DE}"><x:list><ext uri="{inner}"></ext></x:list></ext>' +
        `<ext uri="${DV}"/>` +
        "<x:note><extLst/></x:note>" +
        withUid +
        "</extLst></worksheet>",
    });
    const written = await pkg({ sheet: '<worksheet><sheetData/><extLst><ext uri="{exceljs}"/></extLst></worksheet>' });

    const out = await carryExtensions(original, written, ["المواضيع"]);

    expect(await sheetOf(out)).toBe(`<worksheet><sheetData/><extLst>${kept}</extLst></worksheet>`);
  });

  /** ملفّاتٌ لم يكتبها Excel: مسار الورقة مطلق، واسمها بمراجع عددية — كما يقرؤها exceljs. */
  it("ويعرف الورقة بمسارٍ مطلق وباسمٍ بمراجع عددية", async () => {
    const original = await pkg({
      workbook:
        '<workbook xmlns:r="r"><sheets><sheet name="&#x627;&#1604;مواضيع" sheetId="1" r:id="rId1"/></sheets></workbook>',
      target: "/xl/worksheets/sheet1.xml",
      sheet: `<worksheet><sheetData/><extLst>${kept}</extLst></worksheet>`,
    });

    const out = await carryExtensions(original, await pkg(), ["المواضيع"]);

    expect(await sheetOf(out)).toBe(`<worksheet><sheetData/><extLst>${kept}</extLst></worksheet>`);
  });

  /** ورقةٌ لا تُعرف في الأصل، أو لا امتداد لها يُنقل: يُعاد ما كتبه exceljs نفسه، بلا إعادة ضغط. */
  it.each<[string, Parameters<typeof pkg>[0]]>([
    ["بلا مصنّف", { workbook: null }],
    ["بلا علاقات", { rels: null }],
    ["ورقةٌ بلا اسم", { workbook: '<workbook><sheets><sheet sheetId="1" r:id="rId1"/></sheets></workbook>' }],
    ["ورقةٌ بلا معرّف", { workbook: '<workbook><sheets><sheet name="المواضيع" sheetId="1"/></sheets></workbook>' }],
    ["معرّفٌ بلا علاقة", { rels: '<Relationships><Relationship Id="rId9" Target="worksheets/sheet1.xml"/></Relationships>' }],
    ["علاقةٌ بلا مسار", { rels: '<Relationships><Relationship Id="rId1" Type="worksheet"/></Relationships>' }],
    ["مسارٌ إلى ورقةٍ غائبة", { target: "worksheets/sheet9.xml" }],
    ["ورقةٌ بلا امتداد", {}],
    ["بلا </worksheet>", { sheet: `<worksheet><extLst>${kept}</extLst>` }],
    ["امتدادٌ فارغٌ مغلقٌ بنفسه", { sheet: "<worksheet><extLst/></worksheet>" }],
    [
      "امتدادٌ داخل قاعدة تلوين، لا امتداد للورقة",
      { sheet: `<worksheet><conditionalFormatting><cfRule><extLst>${kept}</extLst></cfRule></conditionalFormatting></worksheet>` },
    ],
    ["إغلاقٌ بلا فتح", { sheet: "<worksheet></extLst></worksheet>" }],
  ])("%s ⇒ يُعاد ما كتبه exceljs", async (_, original) => {
    const written = await pkg();
    expect(await carryExtensions(await pkg(original), written, ["المواضيع"])).toBe(written);
  });

  it("وورقةٌ لا اسم لها في الملفّين ⇒ كذلك", async () => {
    const written = await pkg();
    expect(await carryExtensions(await pkg({ sheet: `<worksheet><extLst>${kept}</extLst></worksheet>` }), written, ["أخرى"])).toBe(written);
  });
});
