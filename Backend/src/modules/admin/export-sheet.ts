import type ExcelJS from "exceljs";
import JSZip from "jszip";

import { LEVEL_LABEL } from "./student-import/columns";

/**
 * ورقة Excel كما تُصدَّر قوائم الإدارة — تقريرٌ لا جدولٌ خام: شريط عنوانٍ
 * بلون المنصّة وخطٍّ ذهبيّ تحته، ثمّ رأسٌ مثبّت، ثمّ صفوفٌ متناوبة بخطوطٍ
 * رقيقة بلا شبكة Excel. من اليمين، بترشيحٍ وطباعةٍ على A4.
 *
 * قوائم الطلبة وقوائم المواضيع تُكتب بها، فتبدو ملفّات المنصّة كلّها واحدة.
 * ولا خانة مدموجة في جسم الورقة — الدمج يُعطّل الفرز والترشيح في Excel —
 * إلّا عمودٌ يطلبه صراحةً (`merge`): مشرف المواضيع، اسمُه مرّةً بجانب مواضيعه
 * المتتالية، كما في قائمة القسم.
 */

export const BRAND = "FF26423D";
const GOLD = "FFC1965A";
const GOLD_SOFT = "FFE9D3AE";
const INK = "FF1F2D2A";
const CREAM = "FFF7F3EA";
const ZEBRA = "FFF6F2E9";
const MUTED = "FF9A9384";
const FONT = "Arial";
/** خطوط الجسم: رقيقةٌ فاتحة تفصل ولا تزاحم. */
const LINE: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE4DCCB" } };
/** الفواصل بين خانات الرأس الداكن. */
const SEP: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF3E5F58" } };
const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/**
 * ما يُكتب في خانةٍ لا قيمة لها (هاتف، بريد، اسمٌ عربيّ…): خانةٌ فارغة تُقرأ
 * سهواً أو نسياناً، و«لا يوجد» تقول إنّها فارغةٌ في المنصّة نفسها.
 *
 * ويُكتب في الملف وحده: لا يُحفظ في المنصّة شيء. فإذا أُضيف الهاتف أو البريد
 * إلى حساب الطالب، ظهر في أوّل تصديرٍ بعده.
 */
export const NONE = "لا يوجد";

/**
 * The language a sheet is written in. Arabic reads from the right; English
 * and French from the left — the sheet turns with them, and its words too.
 */
export type SheetLang = "ar" | "en" | "fr";

/** «لا يوجد» in each language: a cell empty in the platform itself. */
export const NONE_IN: Record<SheetLang, string> = { ar: NONE, en: "None", fr: "Néant" };

/** The page's foot when printed: its date, and «page 2 of 5». */
const FOOTER_IN: Record<SheetLang, string> = {
  ar: "&L&D&Cصفحة &P من &N",
  en: "&L&D&CPage &P of &N",
  fr: "&L&D&CPage &P sur &N",
};

export interface Column<R> {
  header: string;
  width: number;
  value: (r: R, i: number) => string | number;
  ltr?: boolean;
  /**
   * خانةٌ بتنسيق «نص»: ما يُكتب فيها لاحقاً في Excel يبقى كما هو — هاتفٌ
   * يبدأ بصفر لا يفقده، ورقم تسجيلٍ لا يصير صيغةً علمية.
   */
  text?: boolean;
  /** عددٌ قصير (سعة، عدد): في وسط خانته. */
  center?: boolean;
  /** نصٌّ طويل أو بأسطر (عنوان، أسماء الطلبة): يلتفّ، ويطول صفّه ليُقرأ كاملاً. */
  wrap?: boolean;
  /** عمودٌ من مجموعةٍ تُميَّز (أماكن الطلبة): رأسه ذهبيّ. */
  accent?: boolean;
  /** لونُ قيمةٍ تقول حالاً (الحالة: مسند، منشور…) — بخطٍّ عريض. */
  tone?: (r: R) => string | undefined;
  /** خلفيّة الخانة بلون ما تقوله (نوع الموضوع) — تعلو تلوين الصفوف المتناوب. */
  fill?: (r: R) => string | undefined;
  /**
   * الصفوف المتتالية ذات المفتاح الواحد تُدمج خاناتها في هذا العمود: خانةٌ
   * واحدة كبيرة (المشرف بجانب مواضيعه).
   */
  merge?: (r: R) => string;
}

/** موضعٌ في الهرم: التخصص، وشعبته، وقسمها، وكليته. */
export interface SpecPlace {
  name: string;
  level: string;
  filiere: { name: string; department: { name: string; faculty: { name: string } } };
}

const LEVEL_ORDER: Record<string, number> = { licence: 0, master: 1, doctorate: 2 };

const LEVEL_IN: Record<"en" | "fr", Record<string, string>> = {
  en: { licence: "Bachelor's", master: "Master's", doctorate: "Doctorate" },
  fr: { licence: "Licence", master: "Master", doctorate: "Doctorat" },
};

export const levelOf = (l: string, lang: SheetLang = "ar") => (lang === "ar" ? LEVEL_LABEL[l] : LEVEL_IN[lang][l]) ?? l;

/** بترتيب الهرم: الكلية، القسم، الشعبة، المستوى، التخصص. */
export const byPlace = (a: { specialization: SpecPlace }, b: { specialization: SpecPlace }) => {
  const sa = a.specialization;
  const sb = b.specialization;
  return (
    sa.filiere.department.faculty.name.localeCompare(sb.filiere.department.faculty.name, "ar") ||
    sa.filiere.department.name.localeCompare(sb.filiere.department.name, "ar") ||
    sa.filiere.name.localeCompare(sb.filiere.name, "ar") ||
    (LEVEL_ORDER[sa.level] ?? 9) - (LEVEL_ORDER[sb.level] ?? 9) ||
    sa.name.localeCompare(sb.name, "ar")
  );
};

/** The hierarchy's columns, by key — each sheet picks those it shows. */
export type PlaceKey = "faculty" | "department" | "filiere" | "level" | "specialization";
const PLACE_HEADERS: Record<SheetLang, Record<PlaceKey | "year", string>> = {
  ar: { faculty: "الكلية", department: "القسم", filiere: "الشعبة", level: "المستوى", specialization: "التخصص", year: "السنة الجامعية" },
  en: { faculty: "Faculty", department: "Department", filiere: "Field", level: "Level", specialization: "Specialty", year: "Academic year" },
  fr: { faculty: "Faculté", department: "Département", filiere: "Filière", level: "Niveau", specialization: "Spécialité", year: "Année universitaire" },
};

/** أعمدة الهرم، بترتيبه — بلغة الورقة. */
export function placeColumns(lang: SheetLang = "ar", keys?: PlaceKey[]): Column<{ specialization: SpecPlace }>[] {
  const h = PLACE_HEADERS[lang];
  const all: [PlaceKey, Column<{ specialization: SpecPlace }>][] = [
    ["faculty", { header: h.faculty, width: 30, value: (r) => r.specialization.filiere.department.faculty.name }],
    ["department", { header: h.department, width: 24, value: (r) => r.specialization.filiere.department.name }],
    ["filiere", { header: h.filiere, width: 20, value: (r) => r.specialization.filiere.name }],
    ["level", { header: h.level, width: 12, value: (r) => levelOf(r.specialization.level, lang) }],
    ["specialization", { header: h.specialization, width: 26, value: (r) => r.specialization.name }],
  ];
  return all.filter(([k]) => !keys || keys.includes(k)).map(([, c]) => c);
}

/** أعمدة الهرم، بترتيبه. */
export const PLACE = placeColumns("ar");

export const yearColumn = (lang: SheetLang = "ar"): Column<{ academicYear: { title: string } }> => ({
  header: PLACE_HEADERS[lang].year,
  width: 15,
  value: (r) => r.academicYear.title,
  ltr: true,
});

export const YEAR = yearColumn("ar");

/** العدد والمعدود كما تقولهما العربية: واحد، اثنان، ٣–١٠ جمعاً، ١١–٩٩ تمييزاً منصوباً. */
export function arabicCount(
  n: number,
  w: { none: string; one: string; two: string; few: string; many: string; hundred: string },
): string {
  if (n === 0) return w.none;
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} ${w.few}`;
  if (r >= 11) return `${n} ${w.many}`;
  return `${n} ${w.hundred}`;
}

/**
 * الاسم كما يُقرأ في ملفٍّ بلغته: العربيّ في ملفٍّ عربيّ، وإلّا فاللاتينيّ؛
 * واللاتينيّ في ملفٍّ إنجليزيّ أو فرنسيّ، وإلّا فالعربيّ.
 */
export const displayName = (
  u: {
    firstName: string | null;
    lastName: string | null;
    firstNameLatin: string | null;
    lastNameLatin: string | null;
  },
  lang: SheetLang = "ar",
) => {
  const arabic = [u.firstName, u.lastName].filter(Boolean).join(" ");
  const latin = [u.firstNameLatin, u.lastNameLatin].filter(Boolean).join(" ");
  return lang === "ar" ? arabic || latin : latin || arabic;
};

/**
 * اسم ورقةٍ يقبله Excel: 31 حرفاً، بلا []:*?/\، ولا يتكرّر. (والمطلوب فيه
 * « - المستوى» دائماً، فلا يفرغ بعد التنظيف.)
 */
export function sheetName(wanted: string, taken: Set<string>): string {
  const base = wanted.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(name.toLowerCase());
  return name;
}

/**
 * كم سطراً تأخذ القيمة في عمودٍ بعرضه — تقديراً بعدد الحروف. فـExcel لا يحسب
 * ارتفاع الصفّ بنفسه لملفٍّ مولَّد: صفٌّ بلا ارتفاعٍ مكتوب يبقى سطراً واحداً،
 * ويُخفي ما التفّ تحته.
 */
const linesIn = (v: string, width: number) =>
  v.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / width)), 0);

export interface SheetOptions<R = unknown> {
  /** «لا يوجد» في الخانة الفارغة — أو تبقى فارغة. */
  sayNone: boolean;
  /** قيمٌ تقول حال الخانة لا محتواها («مكان شاغر»…): تُكتب باهتةً في وسطها، كـ«لا يوجد». */
  marks?: string[];
  /** كم عموداً من اليمين يبقى ظاهراً عند التمرير أفقياً — ما يُعرف به الصفّ. */
  freeze: number;
  /** سطرٌ صغير تحت شريط العنوان يشرح علامات الخانات. */
  note?: string;
  /**
   * التلوين المتناوب بالمجموعة لا بالصفّ: صفوف المفتاح الواحد المتتالية
   * (مواضيع المشرف الواحد) لونٌ واحد، فتُقرأ كتلةً بجانب خانته المدموجة.
   */
  group?: (r: R) => string;
  /** لغة الورقة: اتّجاهها، ومحاذاة خاناتها، وكلمة «لا يوجد»، وتذييل صفحاتها. العربية إن لم تُذكر. */
  lang?: SheetLang;
}

/** نطاقات أعمدة النصّ في كلّ ورقة — لتُعفى من تنبيه «رقمٌ مخزَّنٌ كنص» عند الإنهاء. */
const textRanges = new WeakMap<ExcelJS.Worksheet, string[]>();

/**
 * ورقةٌ واحدة: شريط العنوان (`title[0]` كبيراً، وما بعده سطور تعريفٍ تحته)،
 * ثمّ الرأس، ثمّ الصفوف — جاهزةٌ للقراءة على الشاشة وللطباعة.
 */
export function writeSheet<R>(
  wb: ExcelJS.Workbook,
  name: string,
  title: string[],
  columns: Column<R>[],
  rows: R[],
  { sayNone, marks = [], freeze, note, group, lang = "ar" }: SheetOptions<R>,
) {
  const rtl = lang === "ar";
  const none = NONE_IN[lang];
  const side = rtl ? "right" : "left";
  const reading = rtl ? "rtl" : "ltr";
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: GOLD } },
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape", // أكثر من عشرة أعمدة: لا تسعها صفحةٌ قائمة
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: FOOTER_IN[lang] },
  });
  ws.columns = columns.map((c) => ({ width: c.width }));
  const last = columns.length;

  /** سطرٌ بعرض الجدول كلّه. تُلوَّن خاناته كلّها قبل الدمج، فيمتدّ اللون والخطّ على عرضه. */
  const band = (text: string, height: number, style: Partial<ExcelJS.Style>) => {
    const row = ws.addRow([text]);
    row.height = height;
    for (let c = 1; c <= last; c++) {
      const cell = row.getCell(c);
      cell.style = { ...style, alignment: { horizontal: side, vertical: "middle", indent: 1, readingOrder: reading } };
    }
    ws.mergeCells(row.number, 1, row.number, last);
  };

  // ── شريط العنوان: العنوان، ثمّ سطور التعريف، وخطٌّ ذهبيّ تحت آخرها ──
  title.forEach((text, i) =>
    band(text, i === 0 ? 38 : 22, {
      fill: solid(BRAND),
      font: i === 0
        ? { name: FONT, size: 18, bold: true, color: { argb: "FFFFFFFF" } }
        : { name: FONT, size: 11, color: { argb: GOLD_SOFT } },
      ...(i === title.length - 1 ? { border: { bottom: { style: "medium", color: { argb: GOLD } } } } : {}),
    }),
  );
  if (note) band(note, 20, { fill: solid(CREAM), font: { name: FONT, size: 10, italic: true, color: { argb: MUTED } } });
  ws.addRow([]).height = 8;

  // ── الرأس: يلتفّ ما طال منه، فلا يغطّيه زرّ الترشيح ──
  const header = ws.addRow(columns.map((c) => c.header));
  const headerLines = Math.max(
    1,
    ...columns.map((c) => Math.ceil(c.header.length / Math.max(1, (c.width - 2.5) * 1.15))),
  );
  header.height = Math.max(30, 15 * headerLines + 10);
  header.eachCell((cell, col) => {
    const spec = columns[col - 1]!;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: spec.accent ? BRAND : "FFFFFFFF" } };
    cell.fill = solid(spec.accent ? GOLD : BRAND);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: reading };
    cell.border = { bottom: { style: "medium", color: { argb: spec.accent ? BRAND : GOLD } }, left: SEP, right: SEP };
  });
  ws.pageSetup.printTitlesRow = `${header.number}:${header.number}`;
  ws.views = [{ rightToLeft: rtl, state: "frozen", xSplit: freeze, ySplit: header.number, showGridLines: false }];

  // ── الصفوف ──
  // The band of each row: alternating by row, or by group when the sheet says so.
  let shade = -1;
  const bands = rows.map((r, i) => (group ? (i === 0 || group(r) !== group(rows[i - 1]!) ? ++shade : shade) : i));
  rows.forEach((r, i) => {
    const values = columns.map((c) => c.value(r, i));
    const row = ws.addRow(values.map((v) => (v === "" ? (sayNone ? none : null) : v)));
    const lines = Math.max(
      1,
      ...columns.map((c, k) => (c.wrap ? linesIn(String(values[k]), c.width) : 1)),
    );
    row.height = Math.max(22, 14 * lines + 8);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const spec = columns[col - 1]!;
      const value = values[col - 1];
      const missing = value === "" || marks.includes(String(value));
      const tone = missing ? undefined : spec.tone?.(r);
      // الخطّ عاديٌّ دائماً؛ وبهتانُ «لا يوجد» قاعدةُ تنسيقٍ شرطيّ أدناه — فما
      // يُكتب مكانها في Excel يظهر بخطٍّ عاديّ لا باهتاً كأنّه ناقص.
      cell.font = { name: FONT, size: 10.5, bold: !!tone, color: { argb: tone ?? (col === 1 ? MUTED : INK) } };
      if (spec.text) cell.numFmt = "@";
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 1 || missing || spec.center ? "center" : spec.ltr ? "left" : side,
        readingOrder: spec.ltr ? "ltr" : reading,
        ...(spec.wrap ? { wrapText: true } : {}),
      };
      cell.border = { bottom: LINE, left: LINE, right: LINE };
      const own = missing ? undefined : spec.fill?.(r);
      if (own) cell.fill = solid(own);
      else if (bands[i]! % 2 === 1) cell.fill = solid(ZEBRA);
    });
  });

  // ── الخانات المدموجة: كلّ تتابعٍ لمفتاحٍ واحد خانةٌ واحدة، باسمه في وسطها ──
  const firstRow = header.number + 1;
  columns.forEach((spec, k) => {
    if (!spec.merge) return;
    for (let i = 0; i < rows.length; ) {
      let j = i + 1;
      while (j < rows.length && spec.merge(rows[j]!) === spec.merge(rows[i]!)) j++;
      if (j - i > 1) {
        ws.mergeCells(firstRow + i, k + 1, firstRow + j - 1, k + 1);
        const top = ws.getCell(firstRow + i, k + 1);
        top.alignment = { ...top.alignment, vertical: "middle", wrapText: true };
      }
      i = j;
    }
  });

  if (rows.length > 0) {
    const first = header.number + 1;
    const end = first + rows.length - 1;
    const range = (k: number) => `${ws.getColumn(k).letter}${first}:${ws.getColumn(k).letter}${end}`;
    textRanges.set(ws, columns.flatMap((c, k) => (c.text ? [range(k + 1)] : [])));

    // «لا يوجد» (وكلّ علامةٍ مثلها) باهتةٌ مائلة ما دامت كذلك: تُميَّز من قيمةٍ
    // حقيقيةٍ بنظرة، وتعود الخانة عاديّةً حين يُكتب فيها غيرها.
    const muted = [...(sayNone ? [none] : []), ...marks];
    if (muted.length > 0)
      ws.addConditionalFormatting({
        ref: `A${first}:${ws.getColumn(last).letter}${end}`,
        rules: muted.map((text, i) => ({
          type: "cellIs" as const,
          operator: "equal" as const,
          formulae: [`"${text}"`],
          priority: i + 1,
          style: { font: { italic: true, bold: false, color: { argb: MUTED } } },
        })),
      });
  }

  ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: last } };
  return ws;
}

/**
 * الملف كاملاً — بلا مثلّث Excel الأخضر في زاوية كلّ رقم تسجيلٍ وهاتف.
 *
 * تلك أعمدة نصٍّ عمداً (ليبقى الصفر الأوّل، ولا يصير الرقم الطويل صيغةً
 * علمية)، وExcel يُنبّه على كلّ «رقمٍ مخزَّنٍ كنص» فيها — ضجيجٌ يبدو خطأً في
 * كلّ صفّ. والإعفاء منه `<ignoredErrors>` في XML الورقة، ولا يكتبه exceljs،
 * فيُضاف بعد الكتابة، في موضعه من ترتيب المخطّط: بعد `<headerFooter>`.
 */
export async function finishWorkbook(wb: ExcelJS.Workbook): Promise<Buffer> {
  const written = Buffer.from(await wb.xlsx.writeBuffer());
  const sheets = wb.worksheets.filter((ws) => textRanges.get(ws)?.length);
  if (sheets.length === 0) return written;

  const zip = await JSZip.loadAsync(written);
  for (const ws of sheets) {
    const path = `xl/worksheets/sheet${ws.id}.xml`;
    const xml = await zip.file(path)!.async("string");
    const ignored = `<ignoredErrors><ignoredError sqref="${textRanges.get(ws)!.join(" ")}" numberStoredAsText="1"/></ignoredErrors>`;
    zip.file(path, xml.replace("</headerFooter>", `</headerFooter>${ignored}`));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ─── المعاينة ─────────────────────────────────────────────────

/** A cell of the preview, as the file will draw it. Colours are CSS («#26423d»). */
export interface PreviewCell {
  v: string | number;
  /** Its own background (a topic's type); otherwise its row's band. */
  fill?: string;
  /** A coloured value (a status, a type's code) — in bold. */
  ink?: string;
  center?: boolean;
  /** «لا يوجد» and the like: pale and italic, as the file's conditional format draws them. */
  muted?: boolean;
  ltr?: boolean;
  wrap?: boolean;
  /** The first cell of a merged run spans this many rows; the cells it covers are left out. */
  rowSpan?: number;
  covered?: boolean;
}

/** The sheet as it will be written — its first rows — for the page to show before it is downloaded. */
export interface SheetPreview {
  name: string;
  rtl: boolean;
  title: string[];
  note?: string;
  columns: { header: string; accent: boolean; width: number }[];
  rows: { band: boolean; cells: PreviewCell[] }[];
  /** All the rows the file holds; the preview shows the first of them. */
  total: number;
  freeze: number;
  colors: { brand: string; gold: string; goldSoft: string; zebra: string; ink: string; muted: string; line: string };
}

const css = (argb: string) => `#${argb.slice(2).toLowerCase()}`;

/**
 * The preview of a sheet: what `writeSheet` would write, by its rules — the
 * empty cell's word, the marks pale, a tone in bold, a cell's own colour over
 * its band, the bands by group, the merged runs — for its first `limit` rows.
 */
export function previewSheet<R>(
  name: string,
  title: string[],
  columns: Column<R>[],
  rows: R[],
  { sayNone, marks = [], freeze, note, group, lang = "ar" }: SheetOptions<R>,
  limit = 40,
): SheetPreview {
  const none = NONE_IN[lang];
  const shown = rows.slice(0, limit);
  let shade = -1;
  const bands = shown.map((r, i) => (group ? (i === 0 || group(r) !== group(shown[i - 1]!) ? ++shade : shade) : i));
  const out = shown.map((r, i) => ({
    band: bands[i]! % 2 === 1,
    cells: columns.map((spec, k): PreviewCell => {
      const value = spec.value(r, i);
      const missing = value === "" || marks.includes(String(value));
      const tone = missing ? undefined : spec.tone?.(r);
      const fill = missing ? undefined : spec.fill?.(r);
      return {
        v: value === "" ? (sayNone ? none : "") : value,
        ...(fill ? { fill: css(fill) } : {}),
        ...(tone ? { ink: css(tone) } : {}),
        ...(k === 0 || missing || spec.center ? { center: true } : {}),
        ...(missing ? { muted: true } : {}),
        ...(spec.ltr ? { ltr: true } : {}),
        ...(spec.wrap ? { wrap: true } : {}),
      };
    }),
  }));
  columns.forEach((spec, k) => {
    if (!spec.merge) return;
    for (let i = 0; i < shown.length; ) {
      let j = i + 1;
      while (j < shown.length && spec.merge(shown[j]!) === spec.merge(shown[i]!)) j++;
      if (j - i > 1) {
        out[i]!.cells[k]!.rowSpan = j - i;
        for (let c = i + 1; c < j; c++) out[c]!.cells[k]!.covered = true;
      }
      i = j;
    }
  });
  return {
    name,
    rtl: lang === "ar",
    title,
    ...(note ? { note } : {}),
    columns: columns.map((c) => ({ header: c.header, accent: !!c.accent, width: c.width })),
    rows: out,
    total: rows.length,
    freeze,
    colors: { brand: css(BRAND), gold: css(GOLD), goldSoft: css(GOLD_SOFT), zebra: css(ZEBRA), ink: css(INK), muted: css(MUTED), line: "#e4dccb" },
  };
}
