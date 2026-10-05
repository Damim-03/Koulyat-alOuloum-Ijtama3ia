import ExcelJS from "exceljs";
import JSZip from "jszip";
import { columnLetter, normalizeHeader, type ImportColumn } from "./columns";
import type { ImportLayout } from "./parser";
import type { ReportCell, ReportRow } from "./report";

/**
 * الملفّان اللذان يُنزّلهما المسؤول بعد الرفع: تقرير الأخطاء وملفّ الحسابات.
 *
 * كلاهما xlsx لا CSV: Excel بواجهةٍ فرنسية أو عربية يفصل الأعمدة بفاصلةٍ
 * منقوطة، فيفتح ملفّ CSV عموداً واحداً، ويُفسد العربية إن غاب ترميزها.
 */

const BRICK_FILL = "FFF6D5CC";
const BRICK_TEXT = "FF8A2E1C";
const AMBER_FILL = "FFFBE9C6";
const AMBER_TEXT = "FF7A5212";
const ERRORS_HEADER = "الأخطاء";


const letterToCol = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/**
 * يُعيد قواعد التحقّق (القوائم المنسدلة) إلى نطاقاتها الأصلية قبل الحفظ.
 *
 * exceljs 4.4 يفكّ عند القراءة كلّ قاعدةٍ إلى نسخةٍ لكلّ خانة، ثم يجمعها عند
 * الحفظ بعد ترتيب العناوين ترتيباً نصّياً — «A10» قبل «A3» — فيكتب نطاقين
 * متداخلين (A10:A1002 وA3:A1002)، والثاني بصيغةٍ نسبية محسوبةٍ من A3:
 * قوائمُ تشير إلى صفوفٍ غير صفوفها، وملفٌّ قد يقول عنه Excel إنه تالف.
 *
 * والخانات التي قُرئت من قاعدةٍ واحدة تتشارك الكائن نفسه، فتُجمع به: كلّ
 * مجموعةٍ مستطيلة تعود نطاقاً واحداً بمفتاحه (exceljs يكتب المفتاح النطاقيّ
 * كما هو). وما ليس مستطيلاً يُسقط: صيغته النسبية لا تصحّ على أجزائه، وقائمةٌ
 * ناقصةٌ خيرٌ من قائمةٍ تشير إلى غير صفّها.
 */
export function restoreValidationRanges(ws: ExcelJS.Worksheet): void {
  const holder = ws as unknown as { dataValidations: { model: Record<string, object | undefined> } };
  const model = holder.dataValidations.model;
  const groups = new Map<object, { cells: number; r0: number; r1: number; c0: number; c1: number }>();
  const next: Record<string, object> = {};
  for (const [address, v] of Object.entries(model)) {
    if (!v) continue;
    const m = /^([A-Z]+)(\d+)$/.exec(address);
    if (!m) {
      next[address] = v; // نطاقٌ أُضيف بمفتاحه — يُكتب كما هو
      continue;
    }
    const col = letterToCol(m[1]!);
    const row = Number(m[2]);
    const g = groups.get(v);
    if (!g) groups.set(v, { cells: 1, r0: row, r1: row, c0: col, c1: col });
    else {
      g.cells++;
      g.r0 = Math.min(g.r0, row);
      g.r1 = Math.max(g.r1, row);
      g.c0 = Math.min(g.c0, col);
      g.c1 = Math.max(g.c1, col);
    }
  }
  for (const [v, g] of groups) {
    if (g.cells !== (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1)) continue;
    const from = `${columnLetter(g.c0)}${g.r0}`;
    const to = `${columnLetter(g.c1)}${g.r1}`;
    next[from === to ? from : `${from}:${to}`] = v;
  }
  holder.dataValidations.model = next;
}

/**
 * ملفٌّ حفظه Excel ينقل كلّ قاعدةٍ تشير إلى ورقةٍ أخرى — القوائم المنسدلة
 * المأخوذة من «القوائم»، والتلوين الأحمر المحسوب في «تصفية» — إلى امتداد
 * Excel 2010 (`<extLst>`)، فالصيغة القديمة لا تسمح بذلك.
 *
 * وexceljs لا يعرف من هذا الامتداد إلا بعضه: قواعد التحقّق يُهملها فتضيع
 * القوائم، وقواعد التلوين يقرؤها بلا صيغها ثم يسقط عند كتابتها
 * («Cannot read properties of undefined») — فتسقط المعاينة كلّها بخطأ 500.
 *
 * فتُحذف تلك القواعد الناقصة قبل الحفظ، ثم يُنقل الامتداد الأصليّ كما هو
 * إلى الملف الناتج: يعود كلّ ما كتبه Excel، بصيغه وتلوينه (x14 يحمل تنسيقه
 * في داخله، فلا يتعلّق بجدول الأنماط الذي أعاد exceljs ترتيبه).
 */
const KEEP_EXT = [
  "{78C0D931-6437-407d-A8EE-F0AAD7539E65}", // x14:conditionalFormattings
  "{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}", // x14:dataValidations
];

function dropIncompleteRules(ws: ExcelJS.Worksheet): void {
  const holder = ws as unknown as {
    conditionalFormattings?: { ref: string; rules: { type: string; formulae?: unknown[] }[] }[];
  };
  if (!holder.conditionalFormattings) return;
  holder.conditionalFormattings = holder.conditionalFormattings
    .map((cf) => ({
      ...cf,
      rules: cf.rules.filter((r) => r.type !== "expression" || (r.formulae?.length ?? 0) > 0),
    }))
    .filter((cf) => cf.rules.length > 0);
}

/**
 * موضع `<extLst>` التابع للورقة نفسها — آخر أبنائها — لا ما يتداخل في
 * قاعدة تلوينٍ داخلها (Excel يضع هناك `<extLst>` صغيراً أيضاً).
 */
function sheetExtRange(xml: string): { start: number; end: number } | undefined {
  const close = xml.lastIndexOf("</worksheet>");
  const tokens = [...xml.matchAll(/<(\/?)extLst\b[^>]*?(\/?)>/g)];
  const last = tokens[tokens.length - 1];
  if (close < 0 || !last || last[1] !== "/") return undefined;
  const end = last.index! + last[0].length;
  if (xml.slice(end, close).trim()) return undefined;
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (t[2] === "/") continue;
    depth += t[1] === "/" ? 1 : -1;
    if (depth === 0) return { start: t.index!, end };
  }
  return undefined;
}

/** عناصر `<ext>` التي تُنقل، بلا سمات xr (معرّفات مراجعةٍ لا يعلنها الملف الناتج). */
function keptExtensions(xml: string): string {
  const range = sheetExtRange(xml);
  if (!range) return "";
  const inner = xml.slice(range.start, range.end).replace(/^<extLst\b[^>]*>/, "").replace(/<\/extLst>$/, "");
  const out: string[] = [];
  let depth = 0;
  let from = -1;
  for (const t of inner.matchAll(/<(\/?)ext\b[^>]*?(\/?)>/g)) {
    if (t[2] === "/") continue;
    if (t[1] !== "/") {
      if (depth++ === 0) from = t.index!;
    } else if (--depth === 0) {
      const ext = inner.slice(from, t.index! + t[0].length);
      const open = /^<ext\b[^>]*>/.exec(ext)?.[0] ?? "";
      if (KEEP_EXT.some((uri) => open.includes(`"${uri}"`)))
        out.push(ext.replace(/\s+xr\d*:\w+="[^"]*"/g, ""));
    }
  }
  return out.join("");
}

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** مسار XML الورقة داخل الملف، من اسمها. */
async function sheetPath(zip: JSZip, name: string): Promise<string | undefined> {
  const wb = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wb || !rels) return undefined;
  const tag = [...wb.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => m[0])
    .find((t) => unescapeXml(/\bname="([^"]*)"/.exec(t)?.[1] ?? "") === name);
  const rid = tag ? /\br:id="([^"]*)"/.exec(tag)?.[1] : undefined;
  if (!rid) return undefined;
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((r) => /\bId="([^"]*)"/.exec(r)?.[1] === rid);
  const target = rel ? /\bTarget="([^"]*)"/.exec(rel)?.[1] : undefined;
  if (!target) return undefined;
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
}

/** يُعيد امتداد Excel الأصليّ لكلّ ورقةٍ إلى الملف الذي كتبه exceljs. */
async function carryExtensions(original: Buffer, written: Buffer, sheets: string[]): Promise<Buffer> {
  const [src, dst] = await Promise.all([JSZip.loadAsync(original), JSZip.loadAsync(written)]);
  let changed = false;
  for (const name of sheets) {
    const [from, to] = await Promise.all([sheetPath(src, name), sheetPath(dst, name)]);
    const fromFile = from ? src.file(from) : null;
    const toFile = to ? dst.file(to) : null;
    if (!fromFile || !toFile) continue;
    const ext = keptExtensions(await fromFile.async("string"));
    if (!ext) continue;
    let xml = await toFile.async("string");
    const own = sheetExtRange(xml);
    if (own) xml = xml.slice(0, own.start) + xml.slice(own.end);
    const close = xml.lastIndexOf("</worksheet>");
    dst.file(to!, `${xml.slice(0, close)}<extLst>${ext}</extLst>${xml.slice(close)}`);
    changed = true;
  }
  return changed ? dst.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) : written;
}

/**
 * الملف نفسه الذي رُفع، وأخطاؤه عليه: كلّ خانةٍ خاطئةٍ حمراء، وما فيه تنبيهٌ
 * كهرمانية، وفي آخر الصفّ عمود «الأخطاء» يقول ما فيها. فيُصحَّح في مكانه
 * ويُرفع كما هو — لا يُنقل خطأٌ من قائمةٍ إلى ملفّ ويُبحث عن صفّه.
 *
 * ورفعُ ملفٍّ علّمه تقريرٌ سابق يُعيد استعمال عموده ويمحو ما صُحّح منه.
 */
export async function annotateImportFile(
  buffer: Buffer,
  layout: ImportLayout,
  rows: Pick<ReportRow, "row" | "cells" | "issues">[],
  columns: ImportColumn[],
): Promise<Buffer> {
  const HEADER = new Map(columns.map((c) => [c.key, c.header]));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  for (const sheet of wb.worksheets) {
    restoreValidationRanges(sheet);
    dropIncompleteRules(sheet);
  }
  const ws = wb.getWorksheet(layout.sheetName)!;
  const head = ws.getRow(layout.headerRow);

  let errCol = 0;
  head.eachCell((cell, c) => {
    if (normalizeHeader(String(cell.value ?? "")) === ERRORS_HEADER) errCol = c;
  });
  if (!errCol) errCol = Math.max(head.cellCount, ...Object.values(layout.columns).map(Number)) + 1;

  const h = head.getCell(errCol);
  h.value = ERRORS_HEADER;
  h.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRICK_TEXT } };
  h.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  ws.getColumn(errCol).width = 60;

  // تقريرٌ سابقٌ ربّما ترك أخطاءً صُحّحت — تُمحى قبل كتابة الجديدة: نصّه،
  // وتلوينه (بلونيه هو وحدهما؛ ما لوّنه المسؤول بيده يبقى).
  const cols = Object.values(layout.columns).map(Number);
  for (let r = layout.headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cell = row.getCell(errCol);
    if (cell.value) cell.value = null;
    for (const c of cols) {
      const fill = row.getCell(c).fill as ExcelJS.FillPattern | undefined;
      const argb = fill?.fgColor?.argb;
      if (argb === BRICK_FILL || argb === AMBER_FILL)
        row.getCell(c).fill = { type: "pattern", pattern: "none" };
    }
  }

  for (const row of rows) {
    const lines: string[] = [];
    let anyError = false;
    const excelRow = ws.getRow(row.row);
    for (const [key, cell] of Object.entries(row.cells) as [string, ReportCell][]) {
      const issues = (cell.issues ?? []).filter((i) => i.level !== "info");
      if (!issues.length) continue;
      const isError = issues.some((i) => i.level === "error");
      anyError ||= isError;
      for (const i of issues)
        lines.push(`${i.level === "error" ? "✗" : "⚠"} ${HEADER.get(key)}: ${i.message}`);
      const col = layout.columns[key];
      if (col)
        excelRow.getCell(col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isError ? BRICK_FILL : AMBER_FILL },
        };
    }
    for (const i of row.issues ?? []) {
      if (i.level === "info") continue;
      anyError ||= i.level === "error";
      lines.push(`${i.level === "error" ? "✗" : "⚠"} ${i.message}`);
    }
    if (!lines.length) continue;
    const note = excelRow.getCell(errCol);
    note.value = lines.join("\n");
    note.font = { name: "Arial", color: { argb: anyError ? BRICK_TEXT : AMBER_TEXT }, bold: true };
    note.alignment = { wrapText: true, vertical: "middle", readingOrder: "rtl" };
  }

  const written = Buffer.from(await wb.xlsx.writeBuffer());
  return carryExtensions(buffer, written, wb.worksheets.map((s) => s.name));
}

/**
 * الحسابات المستورَدة لتوزيعها — تُكتب مرّةً واحدة ولا تُحفظ في المنصّة.
 * كلمة المرور المكتوبة في الملف الأصليّ لا تُعاد: هي عند المسؤول أصلاً.
 *
 * `columns` أعمدة الورقة بترتيبها، وآخرها كلمة المرور؛ و`rows` قيمها بالترتيب
 * نفسه، وكلمة المرور null إن كانت ممّا كتبه المسؤول.
 */
export async function buildAccountsFile(
  columns: { header: string; width: number }[],
  rows: (string | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة مذكرتي";
  const ws = wb.addWorksheet("الحسابات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: { numFmt: "@" } }));
  const pw = columns.length;
  for (const r of rows) ws.addRow(r.map((v, i) => (i === pw - 1 ? (v ?? "كما في الملف المرفوع") : v)));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26423D" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: "Arial" };
    // كلمة المرور بخطٍّ ثابت العرض: «l» و«I» و«1» لا تلتبس عند النقل.
    row.getCell(pw).font = { name: "Consolas", bold: true };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
