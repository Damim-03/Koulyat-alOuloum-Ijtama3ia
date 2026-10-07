import ExcelJS from "exceljs";
import { GROUP_LABEL, MAX_IMPORT_ROWS, type ImportColumn } from "./columns";

/**
 * أدوات نماذج الاستيراد المشتركة: ورقةٌ بشريط خطواتٍ وعناوين ملوّنةٍ بنوعها،
 * وقوائم منسدلة، وتلوينٌ أحمر لما يُخطئ — بالشكل نفسه للطلبة والأساتذة.
 *
 * والقوائم في ورقة «القوائم» المخفية، والقوائم التابعة كتلٌ متتالية بمفتاح:
 * «fac:كلية X» ثم أقسامها… فالقائمة المضيَّقة صفوفٌ متجاورة، يُشار إليها بـ
 * OFFSET من أوّل صفٍّ يطابق مفتاحها وبعدد ما يطابقه (يحسبهما «تصفية»).
 */

export const FIRST = 3; // row 1: the wizard's steps · row 2: headers
export const LAST = FIRST + MAX_IMPORT_ROWS - 1;
export const LISTS = "'القوائم'";
export const CALC = "'تصفية'";

export const C = {
  forest: "FF26423D",
  forestDeep: "FF1A312D",
  sage: "FF4A7066",
  gold: "FFC1965A",
  goldSoft: "FFE6C496",
  clay: "FF6B6357",
  auto: "FFEDE7DA",
  brickFill: "FFF6D5CC",
  brickText: "FF8A2E1C",
  white: "FFFFFFFF",
};
export const FONT = "Arial";

export const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
export const byAr = (a: string, b: string) => a.localeCompare(b, "ar");
export const unique = (xs: string[]) => [...new Set(xs)];

/** حروفٌ لاتينية (بمشكولها الفرنسي) ومسافةٌ وشرطةٌ وفاصلةٌ علوية — قاعدة الخادم. */
const LATIN_CHARS = "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿ '-";
const notLatinCount = (ref: string) =>
  `SUMPRODUCT(--ISERROR(SEARCH(MID(${ref},ROW(INDIRECT("1:60")),1),"${LATIN_CHARS}")))`;

export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة مذكرتي";
  wb.calcProperties = { fullCalcOnLoad: true };
  return wb;
}

/** كتابةٌ في ورقة القوائم: عمودٌ بعنوانه، أو كتلٌ بمفاتيحها. */
export function listsWriter(lists: ExcelJS.Worksheet) {
  const put = (col: string, row: number, value: string) => (lists.getCell(`${col}${row}`).value = value);
  return {
    put,
    /** عمودٌ بعنوانه وقيمه من الصفّ الثاني؛ يُعيد آخر صفّ (لا أقلّ من 2). */
    column(col: string, header: string, values: string[]) {
      put(col, 1, header);
      values.forEach((v, i) => put(col, i + 2, v));
      return Math.max(2, values.length + 1);
    },
    /** كتلٌ متتالية: [مفتاح، قيمة]… — والمفتاح الثاني اختياري. */
    blocks(
      keyCol: string,
      valCol: string,
      header: string,
      rows: { key: string; value: string; key2?: string }[],
      key2Col?: string,
    ) {
      put(keyCol, 1, "المفتاح");
      put(valCol, 1, header);
      if (key2Col) put(key2Col, 1, "المفتاح بالمستوى");
      rows.forEach((r, i) => {
        put(keyCol, i + 2, r.key);
        put(valCol, i + 2, r.value);
        if (key2Col) put(key2Col, i + 2, r.key2 ?? "");
      });
      return Math.max(2, rows.length + 1);
    },
  };
}

/**
 * ورقة الإدخال: شريط الخطوات (الشخصية ثم الجامعية أو المهنية)، وصفّ العناوين
 * ملوّناً بنوع العمود وعليه قاعدته ملاحظةً، وتصفيةٌ على العناوين.
 */
export function createImportSheet<K extends string>(wb: ExcelJS.Workbook, name: string, columns: ImportColumn<K>[]) {
  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: FIRST - 1, zoomScale: 110 }],
  });
  const col = new Map<K, number>();
  columns.forEach((c, i) => col.set(c.key, i + 1));
  const L = (k: K) => ws.getColumn(col.get(k)!).letter;
  const range = (k: K) => `${L(k)}${FIRST}:${L(k)}${LAST}`;

  // row 1 — the wizard's steps
  for (const group of [...new Set(columns.map((c) => c.group))]) {
    const idx = columns.map((c, i) => (c.group === group ? i + 1 : 0)).filter(Boolean);
    const from = Math.min(...idx);
    const to = Math.max(...idx);
    ws.mergeCells(1, from, 1, to);
    const cell = ws.getCell(1, from);
    cell.value = GROUP_LABEL[group];
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.goldSoft } };
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    for (let c = from; c <= to; c++) ws.getCell(1, c).fill = solid(C.forestDeep);
  }
  ws.getRow(1).height = 22;

  // row 2 — headers, coloured by kind, with the rule as a note
  const headRow = ws.getRow(FIRST - 1);
  headRow.height = 30;
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
    const cell = headRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: c.kind === "auto" ? C.forestDeep : C.white } };
    cell.fill = solid(c.kind === "req" ? C.forest : c.kind === "opt" ? C.sage : C.auto);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
    cell.border = { bottom: { style: "medium", color: { argb: C.gold } } };
    cell.note = { texts: [{ text: `${{ req: "إلزامي. ", opt: "اختياري. ", auto: "اختياري — " }[c.kind]}${c.note}` }] };
  });
  ws.autoFilter = { from: { row: FIRST - 1, column: 1 }, to: { row: FIRST - 1, column: columns.length } };

  return { ws, L, range, col };
}

/**
 * صفوف البيانات: خانات نصٍّ لما يُكتب أرقاماً (لئلّا يحذف Excel أصفاره)، وصيغُ
 * الأعمدة التلقائية بخلفيّتها الباهتة.
 */
export function formatDataRows<K extends string>(
  ws: ExcelJS.Worksheet,
  columns: ImportColumn<K>[],
  opts: { textKeys: K[]; autoFormula: (key: K, row: number) => string | undefined },
): void {
  for (let r = FIRST; r <= LAST; r++) {
    const row = ws.getRow(r);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
      const formula = c.kind === "auto" ? opts.autoFormula(c.key, r) : undefined;
      if (formula) {
        cell.value = { formula };
        cell.font = { name: FONT, size: 10, color: { argb: C.clay } };
        cell.fill = solid(C.auto);
      } else {
        cell.font = { name: FONT, size: 10, color: { argb: C.forestDeep } };
        if (opts.textKeys.includes(c.key)) cell.numFmt = "@";
      }
    });
  }
}

/**
 * قواعد التحقّق على نطاق العمود كلّه.
 *
 * `dataValidations.add(range, …)` موجودةٌ في exceljs منذ 4.3 لكنها غائبة عن
 * تعريفات أنواعه؛ والبديل الموثَّق خانةً خانة يكتب ألف قاعدةٍ لكلّ عمود.
 */
export function validator<K extends string>(ws: ExcelJS.Worksheet, range: (k: K) => string) {
  const validations = (
    ws as unknown as { dataValidations: { add(address: string, v: ExcelJS.DataValidation): void } }
  ).dataValidations;
  return (k: K, v: ExcelJS.DataValidation) =>
    validations.add(range(k), { allowBlank: true, showErrorMessage: true, showInputMessage: true, ...v });
}

/** قائمةٌ تبدأ من صفّ «تصفية» وتمتدّ بعدده — والعدد لا يقلّ عن واحد. */
export const dependentList = (valCol: string, start: string, count: string) =>
  `OFFSET(${LISTS}!$${valCol}$1,${CALC}!$${start}${FIRST}-1,0,MAX(1,${CALC}!$${count}${FIRST}),1)`;

type PersonKey = "firstNameLatin" | "lastNameLatin" | "gender" | "verified" | "email" | "phone" | "password";

/** قواعد الحقول الشخصية المشتركة — كقاعدة الخادم، ما أمكن Excel أن يقولها. */
export function personalValidations<K extends string>(
  dv: (k: K | PersonKey, v: ExcelJS.DataValidation) => void,
  L: (k: K | PersonKey) => string,
  lists: { gender: string; verified: string },
  headers: Record<"firstNameLatin" | "lastNameLatin", string>,
  /** الطلبة والأساتذة: اللاتينيّ إلزاميّ. */
  latinRequired = false,
): void {
  for (const [k, example] of [["firstNameLatin", "Youcef"], ["lastNameLatin", "HAMADI"]] as const) {
    // الطول وحده قاعدةٌ مانعة؛ الحروف اللاتينية تلوينٌ لا منع (أدناه)،
    // والخادم هو من يفرضها.
    dv(k, {
      type: "textLength",
      operator: "lessThanOrEqual",
      formulae: [60],
      errorTitle: "اسمٌ طويل",
      error: "60 حرفاً على الأكثر.",
      promptTitle: headers[k],
      prompt: `${latinRequired ? "إلزامي" : "اختياري"}. بالحروف اللاتينية، مثل ${example}. الحرف العربي يُلوّن الخانة بالأحمر.`,
    });
  }
  dv("gender", {
    type: "list",
    formulae: [lists.gender],
    errorTitle: "قيمة غير مقبولة",
    error: "اختر «ذكر» أو «أنثى» من القائمة.",
    promptTitle: "الجنس",
    prompt: "اختر من القائمة.",
  });
  dv("verified", {
    type: "list",
    formulae: [lists.verified],
    errorTitle: "قيمة غير مقبولة",
    error: "اختر «موثّق» أو «غير موثّق» من القائمة.",
    promptTitle: "حالة التوثيق",
    prompt: "الفارغ يُعدّ «غير موثّق».",
  });
  const mail = L("email");
  dv("email", {
    type: "custom",
    formulae: [`AND(ISNUMBER(SEARCH("@",${mail}${FIRST})),ISNUMBER(SEARCH(".",${mail}${FIRST})),COUNTIF($${mail}$${FIRST}:$${mail}$${LAST},${mail}${FIRST})=1)`],
    errorTitle: "بريد غير صالح",
    error: "بريدٌ إلكتروني صحيح، ولا يتكرّر في الملف.",
    promptTitle: "البريد الشخصي",
    prompt: "اختياري.",
  });
  const phone = L("phone");
  dv("phone", {
    type: "custom",
    formulae: [`AND(ISNUMBER(--${phone}${FIRST}),LEN(${phone}${FIRST})>=9,LEN(${phone}${FIRST})<=13)`],
    errorTitle: "رقم هاتف غير صالح",
    error: "أرقام فقط (9 إلى 13 رقماً).",
    promptTitle: "رقم الهاتف",
    prompt: "اختياري، أرقام فقط.",
  });
  dv("password", {
    type: "textLength",
    operator: "between",
    formulae: [8, 72],
    errorTitle: "كلمة مرور غير صالحة",
    error: "من 8 إلى 72 حرفاً.",
    promptTitle: "كلمة المرور",
    prompt: "اختيارية. الفارغة يولّدها النظام.",
  });
}

const RED: Partial<ExcelJS.Style> = {
  fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.brickFill } },
  font: { color: { argb: C.brickText }, bold: true },
};
const CHOSEN: Partial<ExcelJS.Style> = { font: { color: { argb: C.forestDeep }, bold: true } };

/** التلوين الشرطيّ: الأحمر لما يُخطئ، والداكن لما اختير باليد في عمودٍ تلقائي. */
export function conditionalRules<K extends string>(
  ws: ExcelJS.Worksheet,
  columns: ImportColumn<K>[],
  L: (k: K) => string,
  range: (k: K) => string,
) {
  let priority = 1;
  const rule = (ref: string, formula: string, style: Partial<ExcelJS.Style> = RED) =>
    ws.addConditionalFormatting({
      ref,
      rules: [{ type: "expression", priority: priority++, formulae: [formula], style }],
    });
  return {
    rule,
    /**
     * إلزاميٌّ فارغٌ في صفٍّ بدأ. خانات الإدخال وحدها تُعدّ: صيغ الأعمدة
     * التلقائية «ممتلئة» دائماً، ولو عُدّت لبدا كلّ صفٍّ فارغٍ مبدوءاً فاحمرّ.
     */
    requiredEmpty() {
      const started =
        "(" +
        columns
          .filter((c) => c.kind !== "auto")
          .map((c) => `COUNTA($${L(c.key)}${FIRST})`)
          .join("+") +
        ")>0";
      for (const c of columns.filter((x) => x.kind === "req"))
        rule(range(c.key), `AND(${started},LEN(TRIM(${L(c.key)}${FIRST}))=0)`);
    },
    duplicates(keys: K[]) {
      for (const k of keys)
        rule(range(k), `AND(LEN(${L(k)}${FIRST})>0,COUNTIF($${L(k)}$${FIRST}:$${L(k)}$${LAST},${L(k)}${FIRST})>1)`);
    },
    latin(keys: K[]) {
      for (const k of keys) rule(range(k), `AND(LEN(${L(k)}${FIRST})>0,${notLatinCount(`${L(k)}${FIRST}`)}>0)`);
    },
    /** تعارضٌ تحسبه ورقة «تصفية» في عمودها `flag`. */
    conflict(k: K, flag: string) {
      rule(range(k), `${CALC}!$${flag}${FIRST}=TRUE`);
    },
    /** ما اختير باليد يُكتب داكناً عريضاً، والمشتقّ يبقى باهتاً. */
    chosen(k: K) {
      rule(range(k), `AND(${L(k)}${FIRST}<>"",NOT(_xlfn.ISFORMULA(${L(k)}${FIRST})))`, CHOSEN);
    },
  };
}
