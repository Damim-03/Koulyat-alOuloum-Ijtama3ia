import { AUTO_UNKNOWN, IMPORT_COLUMNS, STUDENT_SPEC, type SpecForLabel } from "./columns";
import {
  FIRST,
  LAST,
  LISTS,
  conditionalRules,
  createImportSheet,
  formatDataRows,
  listsWriter,
  newWorkbook,
  personalValidations,
  validator,
} from "../import-kit/template-kit";
import { academicTemplate } from "../import-kit/academic-template";

/**
 * نموذج استيراد الطلبة، مولَّداً من القاعدة لحظة التنزيل.
 *
 * قوائمه — التخصصات والسنوات والهيكل الجامعي — من المنصّة كما هي الآن، فلا
 * يُنزَّل نموذجٌ بتخصصٍ حُذف أو ناقصٌ تخصصاً أُضيف أمس. وبلا صفوف أمثلة:
 * نموذجٌ يُملأ لا يحمل طلبةً وهميين يُستوردون سهواً مع الحقيقيين.
 *
 * والبيانات الجامعية بقاعدة النماذج المشتركة (import-kit/academic-template):
 * من التخصص تُملأ الكلية والقسم والشعبة والمستوى، أو من الأعلى تضيق القوائم.
 */

const STUDENTS = STUDENT_SPEC.sheetName;

/** أعمدة ورقة «القوائم» الخاصّة بالطلبة — بين أعمدة الهيكل الجامعي. */
const COL = {
  gender: "I",
  verified: "J",
} as const;

export async function buildImportTemplate(input: {
  specs: SpecForLabel[];
  years: { title: string; isActive: boolean }[];
}): Promise<Buffer> {
  const wb = newWorkbook();
  const { ws, L, range } = createImportSheet(wb, STUDENTS, IMPORT_COLUMNS);
  const lists = wb.addWorksheet("القوائم", { state: "hidden", views: [{ rightToLeft: true }] });
  const calc = wb.addWorksheet("تصفية", { state: "hidden", views: [{ rightToLeft: true }] });
  const { column } = listsWriter(lists);

  const academic = academicTemplate({
    sheet: STUDENTS,
    lists,
    calc,
    L,
    specs: input.specs,
    years: input.years.map((y) => y.title),
    autoUnknown: AUTO_UNKNOWN,
  });
  column(COL.gender, "الجنس", ["ذكر", "أنثى"]);
  column(COL.verified, "حالة التوثيق", ["موثّق", "غير موثّق"]);
  for (const c of Object.values(COL)) lists.getColumn(c).width = 24;

  // ── data rows — text formats, and the path derived from the specialization ──
  formatDataRows(ws, IMPORT_COLUMNS, {
    textKeys: ["registrationNumber", "phone", "password"],
    autoFormula: academic.autoFormula,
  });

  // ── validation on entry ──
  const dv = validator(ws, range);
  const reg = L("registrationNumber");
  dv("registrationNumber", {
    type: "custom",
    formulae: [`AND(ISNUMBER(--${reg}${FIRST}),LEN(${reg}${FIRST})>=6,LEN(${reg}${FIRST})<=20,COUNTIF($${reg}$${FIRST}:$${reg}$${LAST},${reg}${FIRST})=1)`],
    errorTitle: "رقم تسجيل غير صالح",
    error: "أرقام فقط (6 إلى 20 رقماً)، ولا يتكرّر في الملف.",
    promptTitle: "رقم التسجيل",
    prompt: "إلزامي. أرقام فقط، ولا يتكرّر.",
  });
  personalValidations(
    dv,
    L,
    {
      gender: `${LISTS}!$${COL.gender}$2:$${COL.gender}$3`,
      verified: `${LISTS}!$${COL.verified}$2:$${COL.verified}$3`,
    },
    { firstNameLatin: "الاسم باللاتينية", lastNameLatin: "اللقب باللاتينية" },
  );
  academic.validations(dv, "إلزامية. اختر من القائمة.");

  // ── red cells ──
  const cf = conditionalRules(ws, IMPORT_COLUMNS, L, range);
  cf.requiredEmpty();
  cf.duplicates(["registrationNumber", "email"]);
  cf.latin(["firstNameLatin", "lastNameLatin"]);
  academic.colours(cf);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
