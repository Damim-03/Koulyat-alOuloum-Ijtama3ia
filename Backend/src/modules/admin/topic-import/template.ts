import {
  AUTO_UNKNOWN,
  LIMITS,
  STATUS_LABEL,
  TOPIC_COLUMNS,
  TOPIC_SPEC,
  professorLabels,
  type ProfessorForLabel,
} from "./columns";
import type { TopicFieldKey } from "./checks";
import type { ImportColumn } from "../import-kit/columns";
import type { SpecForLabel } from "../import-kit/academic";
import { academicTemplate } from "../import-kit/academic-template";
import {
  FIRST,
  LAST,
  LISTS,
  byAr,
  conditionalRules,
  createImportSheet,
  formatDataRows,
  listsWriter,
  newWorkbook,
  validator,
} from "../import-kit/template-kit";

/**
 * نموذج استيراد المواضيع، مولَّداً من القاعدة لحظة التنزيل: الأساتذة
 * والتخصصات والسنوات كما هي الآن.
 *
 * الأستاذ من قائمةٍ بأسمائهم — ويُقبل بريده الجامعي أو رقمه الوظيفي بعد
 * تنبيه، لمن ينسخ من جدولٍ آخر. والبيانات الجامعية بقاعدة النماذج المشتركة:
 * من التخصص تُملأ الكلية والقسم والشعبة والمستوى، أو من الأعلى تضيق القوائم.
 *
 * وخانات الموضوع نفسه (topicSheet) يشترك فيها نموذجان: المواضيع ومعها
 * الحالة، والمواضيع المُسنَدة ومعها الطلبة.
 */

/** أعمدة ورقة «القوائم» الخاصّة بالمواضيع — بعد أعمدة الهيكل الجامعي. */
const COL = {
  professor: "Z",
  status: "AB",
} as const;

/** الخانات النصّية الطويلة: تلتفّ أسطرها، وتُقرأ من أعلاها. */
const LONG: TopicFieldKey[] = ["title", "description", "objectives", "requirements", "references"];

export interface TopicTemplateInput {
  specs: SpecForLabel[];
  years: { title: string; isActive: boolean }[];
  professors: ProfessorForLabel[];
}

/**
 * ورقة المواضيع بخاناتها المشتركة: الأستاذ والموضوع والبيانات الجامعية —
 * بقوائمها وقواعدها. ويُكمل كلّ نموذجٍ ما يخصّه، ثم يُنهيها بـ`finish`.
 */
export function topicSheet<K extends string>(
  input: TopicTemplateInput,
  sheet: string,
  columns: ImportColumn<K | TopicFieldKey>[],
  opts: { textKeys?: K[] } = {},
) {
  const wb = newWorkbook();
  const { ws, L, range, col } = createImportSheet(wb, sheet, columns);
  const lists = wb.addWorksheet("القوائم", { state: "hidden", views: [{ rightToLeft: true }] });
  const calc = wb.addWorksheet("تصفية", { state: "hidden", views: [{ rightToLeft: true }] });
  const { column } = listsWriter(lists);

  const academic = academicTemplate({
    sheet,
    lists,
    calc,
    L,
    specs: input.specs,
    years: input.years.map((y) => y.title),
    autoUnknown: AUTO_UNKNOWN,
  });
  const profEnd = column(
    COL.professor,
    "الأستاذ",
    [...professorLabels(input.professors).keys()].sort(byAr),
  );
  lists.getColumn(COL.professor).width = 40;

  // ── data rows ──
  formatDataRows(ws, columns, { textKeys: opts.textKeys ?? [], autoFormula: academic.autoFormula });
  for (let r = FIRST; r <= LAST; r++)
    for (const k of LONG)
      ws.getRow(r).getCell(col.get(k)!).alignment = { horizontal: "right", vertical: "top", wrapText: true, readingOrder: "rtl" };

  // ── validation on entry ──
  const dv = validator(ws, range);
  dv("professor", {
    type: "list",
    formulae: [`${LISTS}!$${COL.professor}$2:$${COL.professor}$${profEnd}`],
    // تنبيهٌ لا منع: البريد الجامعي والرقم الوظيفي يُقبلان أيضاً.
    errorStyle: "warning",
    errorTitle: "ليس من القائمة",
    error: "يُقبل البريد الجامعي للأستاذ أو رقمه الوظيفي — «نعم» لإبقائه. وإلّا فاختره من القائمة.",
    promptTitle: "الأستاذ",
    prompt: "إلزامي. من القائمة — أو بريده الجامعي، أو رقمه الوظيفي.",
  });
  dv("title", {
    type: "textLength",
    operator: "lessThanOrEqual",
    formulae: [LIMITS.title],
    errorTitle: "عنوانٌ طويل",
    error: `${LIMITS.title} حرفاً على الأكثر — والتفصيل في «الوصف».`,
    promptTitle: "عنوان الموضوع",
    prompt: `إلزامي. حتى ${LIMITS.title} حرفاً.`,
  });
  dv("description", {
    type: "textLength",
    operator: "lessThanOrEqual",
    formulae: [LIMITS.description],
    errorTitle: "وصفٌ طويل",
    error: `${LIMITS.description} حرف على الأكثر.`,
    promptTitle: "الوصف",
    prompt: "إلزامي. ما يُنجز في المذكّرة — يقرؤه الطلبة ليختاروا.",
  });
  for (const [k, what] of [
    ["objectives", "هدفٌ"],
    ["requirements", "متطلَّبٌ"],
  ] as const)
    dv(k, {
      type: "textLength",
      operator: "lessThanOrEqual",
      formulae: [LIMITS.description],
      errorTitle: "خانةٌ طويلة",
      error: `${LIMITS.description} حرف على الأكثر.`,
      promptTitle: k === "objectives" ? "الأهداف" : "المتطلّبات",
      prompt: `اختيارية. ${what} في كلّ سطر (Alt+Enter)، أو تُفصل بـ«؛».`,
    });
  dv("references", {
    type: "textLength",
    operator: "lessThanOrEqual",
    formulae: [LIMITS.description],
    errorTitle: "خانةٌ طويلة",
    error: `${LIMITS.description} حرف على الأكثر.`,
    promptTitle: "المراجع",
    prompt: "اختيارية. مرجعٌ في كلّ سطر (Alt+Enter): عنوانه ثم رابطه https://…",
  });
  dv("maxStudents", {
    type: "whole",
    operator: "between",
    formulae: [1, LIMITS.maxStudents],
    errorTitle: "عددٌ غير مقبول",
    error: `عددٌ صحيح من 1 إلى ${LIMITS.maxStudents}.`,
    promptTitle: "عدد الطلبة",
    prompt: `إلزامي. من 1 إلى ${LIMITS.maxStudents}.`,
  });
  dv("maxRequests", {
    type: "whole",
    operator: "between",
    formulae: [1, LIMITS.maxRequests],
    errorTitle: "عددٌ غير مقبول",
    error: `عددٌ صحيح من 1 إلى ${LIMITS.maxRequests} — أو اتركه فارغاً بلا سقف.`,
    promptTitle: "سقف الطلبات",
    prompt: "اختياري. كم مرّةً يُطلب الموضوع، بما فيها المرفوضة. الفارغ بلا سقف.",
  });
  const active = input.years.find((y) => y.isActive)?.title;
  academic.validations(
    dv,
    active ? `اختيارية. الفارغة هي السنة الجارية (${active}).` : "اختر السنة من القائمة.",
  );

  return {
    ws,
    L,
    range,
    col,
    lists,
    column,
    dv,
    /** التلوين — الأحمر لما يُخطئ — ثم الملف. `extra` لتلوين ما يخصّ النموذج. */
    async finish(extra?: (cf: ReturnType<typeof conditionalRules<K | TopicFieldKey>>) => void): Promise<Buffer> {
      const cf = conditionalRules(ws, columns, L, range);
      cf.requiredEmpty();
      academic.colours(cf);
      extra?.(cf);
      return Buffer.from(await wb.xlsx.writeBuffer());
    },
  };
}

export async function buildTopicImportTemplate(input: TopicTemplateInput): Promise<Buffer> {
  const t = topicSheet(input, TOPIC_SPEC.sheetName, TOPIC_COLUMNS);
  const statusEnd = t.column(COL.status, "الحالة", Object.values(STATUS_LABEL));
  t.lists.getColumn(COL.status).width = 16;
  t.dv("status", {
    type: "list",
    formulae: [`${LISTS}!$${COL.status}$2:$${COL.status}$${statusEnd}`],
    errorTitle: "حالة غير معروفة",
    error: `اختر من القائمة: ${Object.values(STATUS_LABEL).join("، ")}.`,
    promptTitle: "الحالة",
    prompt: `إلزامية، كما في الموقع: ${Object.values(STATUS_LABEL).join("، ")}. «${STATUS_LABEL.approved}» لا يراه الطلبة حتى يُنشر.`,
  });
  return t.finish();
}
