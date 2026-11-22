/**
 * قراءة ملفّ الاستيراد — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI ترفع النموذج وملفّاتٍ تبنيها كما يبنيها المسؤول. وهنا ما لا
 * يأتي منها: ملفٌّ ليس Excel، وأوراقٌ مخفيّة كلّها، وملفٌّ بلا صفّ عناوين،
 * وعناوين بصيغةٍ أو نصٍّ منسّق أو خطأ، وقيمٌ منطقية وكسور، وصفوفٌ لا يُبقيها
 * إلا خطأٌ في عمودٍ تلقائيّ، وملفٌّ فوق الحدّ.
 */
import ExcelJS from "exceljs";

import { MAX_IMPORT_ROWS, columnLetter } from "./columns";
import { parseImportFile } from "./parser";
import { TOPIC_COLUMNS, TOPIC_SPEC, type TopicKey } from "../topic-import/columns";

const HEADERS = TOPIC_COLUMNS.map((c) => c.header);
const col = (k: TopicKey) => TOPIC_COLUMNS.findIndex((c) => c.key === k) + 1;

async function xlsx(fill: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  fill(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
/** ورقة المواضيع بعناوينها في الصفّ الأوّل. */
const sheet = (wb: ExcelJS.Workbook) => {
  const ws = wb.addWorksheet("المواضيع");
  ws.addRow(HEADERS);
  return ws;
};
const parse = (buf: Buffer) => parseImportFile(buf, TOPIC_SPEC);

describe("parseImportFile — ملفٌّ لا يُقرأ", () => {
  it("ليس ملفّ Excel ⇒ يُقال ذلك وحده", async () => {
    expect((await parse(Buffer.from("ليس ملفّاً"))).fileErrors).toEqual(["الملف ليس ملفّ Excel صالحاً (xlsx)."]);
  });

  it("أوراقه كلّها مخفيّة، ولا ورقة باسمها ⇒ لا ورقة تُقرأ", async () => {
    const buf = await xlsx((wb) => wb.addWorksheet("مخفيّة", { state: "hidden" }).addRow(HEADERS));
    expect((await parse(buf)).fileErrors).toEqual(["الملف لا يحتوي على ورقة «المواضيع»."]);
  });

  it("لا عنوان «عنوان الموضوع» في الصفوف العشرة الأولى ⇒ لا صفّ عناوين", async () => {
    const buf = await xlsx((wb) => {
      const ws = wb.addWorksheet("المواضيع");
      ws.addRow(["قائمة المواضيع"]);
      ws.addRow(["الاسم", "اللقب"]);
    });
    expect((await parse(buf)).fileErrors).toEqual([
      "لم يُعثر على صفّ العناوين (عمود «عنوان الموضوع»). استعمل النموذج من المنصّة.",
    ]);
  });

  it("وأكثر من الحدّ في الملف الواحد ⇒ يُقسَّم", async () => {
    const buf = await xlsx((wb) => {
      const ws = sheet(wb);
      for (let i = 0; i <= MAX_IMPORT_ROWS; i++) ws.getCell(i + 2, col("title")).value = `موضوع ${i}`;
    });
    expect((await parse(buf)).fileErrors).toEqual([
      // بصيغة العدد: «1001 موضوع» (كما «1200 طالب»)، لا «موضوعاً» لكلّ عدد.
      `الملف فيه ${MAX_IMPORT_ROWS + 1} موضوع، والحدّ ${MAX_IMPORT_ROWS} في الملف الواحد. قسّمه.`,
    ]);
  });
});

describe("parseImportFile — العناوين والخانات", () => {
  /**
   * عنوانٌ بصيغةٍ يُقرأ بنتيجتها، والمنسّق بنصّه. وخانةٌ لا نصّ فيها — مسافةٌ،
   * أو خطأ Excel، أو صيغةٌ لم تُحسب — ليست عموداً. وعمود «الأخطاء» من تقريرٍ
   * سابق لا يُعدّ عموداً مجهولاً.
   */
  it("عناوين بصيغةٍ أو نصٍّ منسّق تُعرف، وما لا نصّ فيه يُتخطّى، والمجهول وحده يُذكر", async () => {
    const extra = HEADERS.length + 1;
    const buf = await xlsx((wb) => {
      const ws = sheet(wb);
      const head = ws.getRow(1);
      head.getCell(col("title")).value = { formula: '"عنوان الموضوع"', result: "عنوان الموضوع" };
      head.getCell(col("description")).value = { richText: [{ text: "الو" }, { text: "صف" }] };
      head.getCell(extra).value = " ";
      head.getCell(extra + 1).value = { error: "#REF!" };
      head.getCell(extra + 2).value = { formula: "Z1" } as ExcelJS.CellFormulaValue;
      head.getCell(extra + 3).value = "الأخطاء";
      head.getCell(extra + 4).value = "ملاحظات";
      ws.getCell(2, col("title")).value = "موضوع";
    });

    const parsed = await parse(buf);
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.info!.columns).toMatchObject({ title: columnLetter(col("title")), description: columnLetter(col("description")) });
    expect(parsed.info!.ignored).toEqual([{ header: "ملاحظات", letter: columnLetter(extra + 4) }]);
  });

  it("قيمةٌ منطقية وكسرٌ ونصٌّ منسّق ⇒ تُقرأ نصّاً", async () => {
    const buf = await xlsx((wb) => {
      const ws = sheet(wb);
      ws.getCell(2, col("title")).value = { richText: [{ text: "موضوعٌ " }, { text: "منسّق" }] };
      ws.getCell(2, col("maxStudents")).value = 2.5;
      ws.getCell(2, col("description")).value = true;
      ws.getCell(2, col("requirements")).value = false;
    });
    const { cells } = (await parse(buf)).rows[0]!;
    expect([cells.title!.text, cells.maxStudents!.text, cells.description!.text, cells.requirements!.text]).toEqual([
      "موضوعٌ منسّق",
      "2.5",
      "TRUE",
      "FALSE",
    ]);
  });

  /**
   * صفٌّ لا شيء فيه إلا خطأ Excel في عمودٍ تلقائيّ يُقرأ — ليُقال خطؤه. وصفٌّ لا
   * شيء فيه إلا صيغةٌ ناتجها مسافات ليس صفّاً. (والناتج الفارغ تماماً يقرؤه
   * exceljs صيغةً لم تُحسب، فيُقال عنها ذلك.)
   */
  it("خطأ Excel وحده في عمودٍ تلقائيّ يُبقي الصفّ، وصيغةٌ ناتجها مسافاتٌ وحدها لا تُبقيه", async () => {
    const buf = await xlsx((wb) => {
      const ws = sheet(wb);
      ws.getCell(2, col("faculty")).value = { error: "#N/A" };
      ws.getCell(3, col("title")).value = { formula: 'IF(1," "," ")', result: " " };
      ws.getCell(4, col("title")).value = "موضوع";
    });
    const { rows } = await parse(buf);
    expect(rows.map((r) => r.row)).toEqual([2, 4]);
    expect(rows[0]!.cells.faculty).toMatchObject({ excelError: "#N/A" });
  });
});
