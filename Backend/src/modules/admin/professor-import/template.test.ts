import ExcelJS from "exceljs";

import { buildProfessorImportTemplate } from "./template";

/**
 * نموذج الأساتذة: قائمة أقسامه مرتّبةٌ بالكلية ثمّ بالاسم — وهي ما تقرؤه صيغة
 * «الكلية» — ونموذجٌ لمنصّةٍ بلا نطاقاتٍ جامعية يقول ذلك ولا يكتب قائمةً فارغة.
 */

const fac = (id: string, name: string) => ({ id, name });
const SOC = fac("f1", "كلية العلوم الاجتماعية");
const HUM = fac("f2", "كلية العلوم الإنسانية");
const dep = (id: string, name: string, f: { id: string; name: string }) => ({ id, name, facultyId: f.id, faculty: f });

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

/** عمودٌ من ورقة القوائم، بعنوانه في الصفّ الأوّل. */
function listColumn(wb: ExcelJS.Workbook, header: string): string[] {
  const ws = wb.getWorksheet("القوائم")!;
  for (let c = 1; c <= ws.columnCount; c++) {
    if (ws.getCell(1, c).text === header) {
      const out: string[] = [];
      for (let r = 2; ws.getCell(r, c).text; r++) out.push(ws.getCell(r, c).text);
      return out;
    }
  }
  throw new Error(`no column ${header}`);
}

describe("buildProfessorImportTemplate", () => {
  it("الأقسام بالكلية ثمّ بالاسم، وكلٌّ بجانب كليّته", async () => {
    const wb = await load(
      await buildProfessorImportTemplate({
        departments: [dep("d3", "قسم علم النفس", SOC), dep("d1", "قسم التاريخ", HUM), dep("d2", "قسم الديموغرافيا", SOC)],
        domains: ["univ-eloued.dz"],
      }),
    );
    // الأوّل في الصفّ نفسه: عمودا «القسم» و«الكلية» متجاوران في القائمة.
    const ws = wb.getWorksheet("القوائم")!;
    let labelCol = 0;
    for (let c = 1; c <= ws.columnCount; c++) if (ws.getCell(1, c).text === "القسم") labelCol ||= c;
    const pairs = [2, 3, 4].map((r) => [ws.getCell(r, labelCol).text, ws.getCell(r, labelCol + 1).text]);
    expect(pairs).toEqual([
      ["قسم الديموغرافيا", SOC.name],
      ["قسم علم النفس", SOC.name],
      ["قسم التاريخ", HUM.name],
    ]);
    expect(listColumn(wb, "النطاق الجامعي")).toEqual(["univ-eloued.dz"]);
  });

  it("الكلية وحدها تُملأ تلقائيّاً: من القسم في الصفّ نفسه، بقائمة الأقسام", async () => {
    const wb = await load(await buildProfessorImportTemplate({ departments: [dep("d1", "قسم التاريخ", HUM)], domains: [] }));
    const ws = wb.getWorksheet("الأساتذة")!;
    const letter = (header: string) => {
      for (let c = 1; c <= ws.columnCount; c++) if (ws.getCell(2, c).text === header) return ws.getColumn(c).letter;
      throw new Error(`no column ${header}`);
    };
    const withFormula = (r: number) =>
      Array.from({ length: ws.columnCount }, (_, i) => ws.getCell(r, i + 1))
        .filter((cell) => cell.formula)
        .map((cell) => ({ col: ws.getColumn(Number(cell.col)).letter, formula: cell.formula }));

    const dep7 = `$${letter("القسم")}7`;
    expect(withFormula(7)).toEqual([{ col: letter("الكلية"), formula: expect.stringContaining(`MATCH(${dep7},`) }]);
    expect(withFormula(7)[0]!.formula.startsWith(`IF(${dep7}="","",`)).toBe(true);
  });

  it("ومنصّةٌ بلا نطاقات: التحقّق والتلميح يقولان ذلك", async () => {
    const wb = await load(await buildProfessorImportTemplate({ departments: [dep("d1", "قسم التاريخ", HUM)], domains: [] }));
    const ws = wb.getWorksheet("الأساتذة")!;
    const rules = Object.values((ws as unknown as { dataValidations: { model: Record<string, ExcelJS.DataValidation> } }).dataValidations.model);
    const university = rules.find((v) => v.errorTitle === "بريد جامعي غير صالح")!;
    expect(university.error).toContain("لا نطاقات مسجَّلة");
    expect(university.prompt).toMatch(/النطاقات: —$/);
  });
});
