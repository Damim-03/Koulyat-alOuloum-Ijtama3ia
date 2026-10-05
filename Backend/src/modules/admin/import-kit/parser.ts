import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS, columnLetter, normalizeHeader, type ImportSpec } from "./columns";

/**
 * خانةٌ كما قُرئت — نصّها، وما يخفيه Excel وراءه.
 *
 * ما يراه المسؤول في الخانة قد لا يكون ما فيها: رقم تسجيلٍ من 16 رقماً في خانةٍ
 * عددية قطع Excel آخره صفراً، وتاريخٌ يُعرض «2025/09/01» مخزَّنٌ عدداً، وصيغةٌ لم
 * تُحسب قطّ فارغةٌ في الملف وإن بدت ممتلئة. فتُحمل هذه مع النصّ ليُحكم عليها.
 */
export interface RawCell {
  /** النصّ بلا مسافاتٍ في طرفيه. */
  text: string;
  /** قبل القصّ — كلمة المرور وحدها يعنيها الفرق. */
  raw: string;
  /** القيمة ناتج صيغة، لا ما كُتب. */
  formula?: boolean;
  /** صيغةٌ لم تُحسب قطّ: لا نتيجة لها في الملف (صنعه برنامجٌ لا Excel). */
  pending?: boolean;
  /** خطأ Excel في الخانة (#N/A، #REF!…). */
  excelError?: string;
  /** عددٌ طويلٌ لا يحفظه Excel كاملاً (أكثر من 15 رقماً). */
  lossy?: boolean;
  /** Excel خزّنها تاريخاً. */
  date?: boolean;
}

export interface RawRow<K extends string = string> {
  /** رقم الصفّ في Excel — ما يراه المسؤول عند التصحيح. */
  row: number;
  /** مخفيٌّ في Excel (مُصفّى أو مطويّ): لا يراه المسؤول هناك، ويُستورد. */
  hidden: boolean;
  cells: Partial<Record<K, RawCell>>;
}

/** ما قُرئ من الملف وكيف — يُعرض في المعاينة كما هو. */
export interface FileInfo {
  sheetName: string;
  headerRow: number;
  /** أوراقٌ ظاهرة أخرى لم تُقرأ. */
  otherSheets: string[];
  /** حرف كلّ عمودٍ في الملف، أو null إن غاب. */
  columns: Partial<Record<string, string | null>>;
  /** أعمدةٌ لا تعرفها المنصّة، أُهملت. */
  ignored: { header: string; letter: string }[];
}

export interface ParsedFile<K extends string = string> {
  rows: RawRow<K>[];
  fileErrors: string[];
  fileWarnings: string[];
  info?: FileInfo;
  /** أين وُجدت الأعمدة — ليُعلَّم الخطأ في خانته من الملف الأصليّ نفسه. */
  layout?: ImportLayout;
}

export interface ImportLayout {
  sheetName: string;
  headerRow: number;
  columns: Partial<Record<string, number>>;
}

/** عمودٌ كتبه تقرير أخطاءٍ سابق — يُتجاهل بصمت. */
const ERRORS_HEADER = "الأخطاء";

/**
 * نصّ الخانة كما يراه المسؤول، أيّاً كان شكلها في الملف.
 *
 * Excel لا يحفظ ما كُتب بل ما فهمه منه: رقمٌ كُتب في خانةٍ عددية يصل عدداً،
 * والبريد رابطاً، والنصّ المنسّق قطعاً. فيُعاد كلٌّ منها إلى نصّه.
 */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number")
    // 202039012350 يبقى كما هو؛ والكبير جداً لا يصير 2.02E+11.
    return Number.isInteger(v)
      ? v.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 })
      : String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("formula" in v || "sharedFormula" in v)
      return cellText((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ("text" in v) return cellText((v as { text: ExcelJS.CellValue }).text);
    if ("error" in v) return "";
  }
  return String(v);
}

function readCell(v: ExcelJS.CellValue): RawCell {
  let value = v;
  let formula = false;
  let pending = false;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
    formula = true;
    const result = (value as { result?: ExcelJS.CellValue }).result;
    pending = result === undefined;
    value = result ?? null;
  }
  const out: RawCell = { text: "", raw: "" };
  if (formula) out.formula = true;
  if (pending) out.pending = true;
  if (value && typeof value === "object" && "error" in value) {
    out.excelError = String((value as { error: unknown }).error);
    return out;
  }
  out.raw = cellText(value);
  out.text = out.raw.trim();
  if (typeof value === "number" && Number.isInteger(value) && Math.abs(value) >= 1e15)
    out.lossy = true;
  if (value instanceof Date) out.date = true;
  return out;
}

/**
 * يقرأ الملف إلى صفوفٍ خام — بلا حكمٍ على قيمها؛ الحكم للخدمة.
 *
 * الأعمدة تُعرف بعناوينها لا بمواضعها: ملفٌّ أُعيد ترتيب أعمدته أو زيد فيه
 * عمودٌ للملاحظات يُقرأ كما هو. والأعمدة التلقائية (الكلية والمستوى…) تُقرأ
 * أيضاً: لا لتُحفظ — ما تُشتقّ منه وحده يُحفظ — بل ليُتحقّق من أنها توافقه.
 */
export async function parseImportFile<K extends string>(
  buffer: Buffer,
  spec: ImportSpec<K>,
): Promise<ParsedFile<K>> {
  const none = (fileErrors: string[]): ParsedFile<K> => ({ rows: [], fileErrors, fileWarnings: [] });
  const COLUMNS = spec.columns;
  const anchor = COLUMNS.find((c) => c.key === spec.anchor)!;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return none(["الملف ليس ملفّ Excel صالحاً (xlsx)."]);
  }

  const visible = wb.worksheets.filter((s) => s.state !== "hidden" && s.state !== "veryHidden");
  const ws = wb.getWorksheet(spec.sheetName) ?? visible[0];
  if (!ws) return none([`الملف لا يحتوي على ورقة «${spec.sheetName}».`]);

  // صفّ العناوين: أوّل صفٍّ فيه عنوان العمود الدالّ بين الصفوف العشرة الأولى —
  // النموذج يضع فوقه شريطَ الخطوات، وملفٌّ مكتوبٌ باليد قد لا يضعه.
  const want = new Map(COLUMNS.map((c) => [normalizeHeader(c.header), c.key]));
  let headerRow = 0;
  let found = new Map<K, number[]>();
  const ignored: FileInfo["ignored"] = [];
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    const here = new Map<K, number[]>();
    const other: FileInfo["ignored"] = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const title = normalizeHeader(cellText(cell.value));
      if (!title) return;
      const key = want.get(title);
      if (key) here.set(key, [...(here.get(key) ?? []), c]);
      else if (title !== ERRORS_HEADER) other.push({ header: title, letter: columnLetter(c) });
    });
    if (here.has(spec.anchor)) {
      headerRow = r;
      found = here;
      ignored.push(...other);
    }
  }
  if (!headerRow)
    return none([`لم يُعثر على صفّ العناوين (عمود «${anchor.header}»). استعمل النموذج من المنصّة.`]);

  const fileErrors: string[] = [];
  for (const c of COLUMNS) {
    const at = found.get(c.key) ?? [];
    if (at.length > 1)
      fileErrors.push(
        `عمود «${c.header}» مكرّر في الملف (${at.map(columnLetter).join(" و")}) — احذف أحدهما.`,
      );
    else if (at.length === 0 && c.kind === "req")
      fileErrors.push(`عمود «${c.header}» غير موجود في الملف.`);
  }
  if (fileErrors.length) return none(fileErrors);

  const colOf = new Map([...found].map(([k, at]) => [k, at[0]!]));
  const fileWarnings: string[] = [];
  const missingOpt = COLUMNS.filter((c) => c.kind === "opt" && !colOf.has(c.key));
  if (missingOpt.length)
    fileWarnings.push(
      `أعمدةٌ اختيارية غير موجودة في الملف، تُترك فارغةً في كلّ الصفوف: ${missingOpt.map((c) => `«${c.header}»`).join("، ")}.`,
    );
  if (ignored.length)
    fileWarnings.push(
      `أعمدةٌ لا تعرفها المنصّة، لم تُقرأ: ${ignored.map((c) => `«${c.header}» (${c.letter})`).join("، ")}.`,
    );
  const otherSheets = visible.filter((s) => s !== ws).map((s) => s.name);
  if (otherSheets.length)
    fileWarnings.push(
      `قُرئت ورقة «${ws.name}» وحدها؛ وفي الملف أوراقٌ أخرى لم تُقرأ: ${otherSheets.map((s) => `«${s}»`).join("، ")}.`,
    );

  const present = COLUMNS.filter((c) => colOf.has(c.key));
  const rows: RawRow<K>[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: RawRow<K>["cells"] = {};
    let any = false;
    for (const c of present) {
      const cell = readCell(row.getCell(colOf.get(c.key)!).value);
      const empty = !cell.text && !cell.excelError && !cell.formula;
      if (empty) continue;
      cells[c.key] = cell;
      // صيغ النموذج في الأعمدة التلقائية «ممتلئة» في كلّ صفّ؛ لو عُدّت لبدا
      // كلّ صفٍّ فارغٍ طالباً ناقصاً. ما كُتب فيها بيدٍ يُعدّ.
      if (c.kind === "auto") {
        if (!cell.formula && cell.text !== spec.autoUnknown && (cell.text || cell.excelError)) any = true;
      } else if (cell.text || cell.excelError || cell.pending) any = true;
    }
    // صفٌّ فارغٌ تماماً ليس صفّاً ناقصاً — النموذج فيه ألف صفٍّ مهيّأ.
    if (any) rows.push({ row: r, hidden: !!row.hidden, cells });
  }

  if (rows.length === 0) return none([`الملف لا يحتوي على أيّ ${spec.nounOne}.`]);
  if (rows.length > MAX_IMPORT_ROWS)
    return none([
      `الملف فيه ${rows.length} ${spec.nounCount}، والحدّ ${MAX_IMPORT_ROWS} في الملف الواحد. قسّمه.`,
    ]);

  const letters = Object.fromEntries(
    COLUMNS.map((c) => [c.key, colOf.has(c.key) ? columnLetter(colOf.get(c.key)!) : null]),
  ) as FileInfo["columns"];
  return {
    rows,
    fileErrors: [],
    fileWarnings,
    info: { sheetName: ws.name, headerRow, otherSheets, columns: letters, ignored },
    layout: { sheetName: ws.name, headerRow, columns: Object.fromEntries(colOf) },
  };
}
