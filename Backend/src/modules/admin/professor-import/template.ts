import {
  ACADEMIC_RANKS,
  AUTO_UNKNOWN,
  PROFESSOR_COLUMNS,
  PROFESSOR_SPEC,
  departmentLabels,
  type DepartmentForLabel,
  type ProfessorKey,
} from "./columns";
import {
  FIRST,
  LAST,
  LISTS,
  byAr,
  conditionalRules,
  createImportSheet,
  dependentList,
  formatDataRows,
  listsWriter,
  newWorkbook,
  personalValidations,
  unique,
  validator,
} from "../import-kit/template-kit";

/**
 * نموذج استيراد الأساتذة، مولَّداً من القاعدة لحظة التنزيل: الكليات والأقسام
 * والنطاقات الجامعية المسجَّلة كما هي الآن.
 *
 * والقسم يُختار بطريقين، كنافذة «إضافة أستاذ»: مباشرةً فتُملأ الكلية منه
 * (صيغة)، أو تُختار الكلية أوّلاً فتضيق قائمة الأقسام إلى أقسامها. والكلية
 * المختارة باليد تُقارن بكلية القسم، وتعارضهما يُلوّن الخانة بالأحمر.
 */

const SHEET = PROFESSOR_SPEC.sheetName;

/** أعمدة ورقة «القوائم». */
const COL = {
  depLabel: "A", // جدول الأقسام — مصدر صيغة الكلية
  depFac: "B",
  domain: "D",
  gender: "F",
  verified: "G",
  faculty: "I",
  rank: "K",
  depKey: "M",
  depPick: "N",
} as const;

export async function buildProfessorImportTemplate(input: {
  departments: DepartmentForLabel[];
  domains: string[];
}): Promise<Buffer> {
  const wb = newWorkbook();
  const { ws, L, range } = createImportSheet(wb, SHEET, PROFESSOR_COLUMNS);
  const lists = wb.addWorksheet("القوائم", { state: "hidden", views: [{ rightToLeft: true }] });
  const calc = wb.addWorksheet("تصفية", { state: "hidden", views: [{ rightToLeft: true }] });
  const { put, column, blocks } = listsWriter(lists);

  // الأقسام بترتيب الكلية ثم الاسم، وبأسمائها كما في القائمة.
  const deps = [...departmentLabels(input.departments).entries()]
    .map(([label, d]) => ({ label, fac: d.faculty.name }))
    .sort((a, b) => byAr(a.fac, b.fac) || byAr(a.label, b.label));
  put(COL.depLabel, 1, "القسم");
  put(COL.depFac, 1, "الكلية");
  deps.forEach((d, i) => {
    put(COL.depLabel, i + 2, d.label);
    put(COL.depFac, i + 2, d.fac);
  });
  const depEnd = Math.max(2, deps.length + 1);

  const domainEnd = column(COL.domain, "النطاق الجامعي", input.domains);
  column(COL.gender, "الجنس", ["ذكر", "أنثى"]);
  column(COL.verified, "حالة التوثيق", ["موثّق", "غير موثّق"]);
  const faculties = unique(deps.map((d) => d.fac));
  const facEnd = column(COL.faculty, "الكلية", faculties);
  const rankEnd = column(COL.rank, "الرتبة", ACADEMIC_RANKS);
  // الأقسام: لكلّ كليةٍ أقسامها، ثم الكلّ
  const pickEnd = blocks(COL.depKey, COL.depPick, "القسم", [
    ...faculties.flatMap((f) => deps.filter((d) => d.fac === f).map((d) => ({ key: `fac:${f}`, value: d.label }))),
    ...deps.map((d) => ({ key: "all", value: d.label })),
  ]);
  for (const c of Object.values(COL)) lists.getColumn(c).width = 26;

  // ── data rows — text formats, and the faculty derived from the department ──
  const dep = L("department");
  formatDataRows(ws, PROFESSOR_COLUMNS, {
    textKeys: ["phone", "password", "employeeNumber"],
    autoFormula: (k, r) =>
      k === "faculty"
        ? `IF($${dep}${r}="","",IFERROR(INDEX(${LISTS}!$${COL.depFac}$2:$${COL.depFac}$${depEnd},MATCH($${dep}${r},${LISTS}!$${COL.depLabel}$2:$${COL.depLabel}$${depEnd},0)),"${AUTO_UNKNOWN}"))`
        : undefined,
  });

  // ── the hidden helper ──
  // لكلّ صفّ أستاذٍ صفٌّ هنا بالرقم نفسه:
  //   A    الكلية المختارة باليد ("" إن كانت صيغة أو فارغة)
  //   B–D  قائمة الأقسام: مفتاحها · أوّل صفّ · عددها
  //   E    الكلية كما يقتضيها القسم
  //   F    تعارضٌ بين الكلية المختارة وكلية القسم (يُلوّن الخانة)
  const DK = `${LISTS}!$${COL.depKey}$1:$${COL.depKey}$${pickEnd}`;
  for (let r = FIRST; r <= LAST; r++) {
    const S = (k: ProfessorKey) => `'${SHEET}'!$${L(k)}${r}`;
    const f: Record<string, string> = {
      A: `IF(_xlfn.ISFORMULA(${S("faculty")}),"",${S("faculty")}&"")`,
      B: `IF(AND(A${r}<>"",COUNTIF(${DK},"fac:"&A${r})>0),"fac:"&A${r},"all")`,
      C: `MATCH(B${r},${DK},0)`,
      D: `COUNTIF(${DK},B${r})`,
      E: `IFERROR(INDEX(${LISTS}!$${COL.depFac}$2:$${COL.depFac}$${depEnd},MATCH(${S("department")},${LISTS}!$${COL.depLabel}$2:$${COL.depLabel}$${depEnd},0)),"")`,
      F: `AND(A${r}<>"",E${r}<>"",A${r}<>E${r})`,
    };
    const row = calc.getRow(r);
    for (const [c, formula] of Object.entries(f)) row.getCell(c).value = { formula };
  }

  // ── validation on entry ──
  const dv = validator(ws, range);
  personalValidations(
    dv,
    L,
    {
      gender: `${LISTS}!$${COL.gender}$2:$${COL.gender}$3`,
      verified: `${LISTS}!$${COL.verified}$2:$${COL.verified}$3`,
    },
    { firstNameLatin: "الاسم باللاتينية", lastNameLatin: "اللقب باللاتينية" },
  );
  const uni = L("universityEmail");
  const at = `FIND("@",${uni}${FIRST})`;
  const domains = input.domains.map((d) => `@${d}`).join("، ");
  dv("universityEmail", {
    type: "custom",
    formulae: [
      `AND(ISNUMBER(${at}),COUNTIF(${LISTS}!$${COL.domain}$2:$${COL.domain}$${domainEnd},LOWER(MID(${uni}${FIRST},${at}+1,99)))>0,COUNTIF($${uni}$${FIRST}:$${uni}$${LAST},${uni}${FIRST})=1)`,
    ],
    errorTitle: "بريد جامعي غير صالح",
    error: `بريدٌ بنطاقٍ جامعيٍّ مسجَّل (${domains || "لا نطاقات مسجَّلة"})، ولا يتكرّر في الملف.`,
    promptTitle: "البريد الجامعي",
    prompt: `إلزامي. به يدخل الأستاذ. النطاقات: ${domains || "—"}`.slice(0, 255),
  });
  const emp = L("employeeNumber");
  dv("employeeNumber", {
    type: "custom",
    formulae: [`AND(ISNUMBER(--${emp}${FIRST}),LEN(${emp}${FIRST})=13,COUNTIF($${emp}$${FIRST}:$${emp}$${LAST},${emp}${FIRST})=1)`],
    errorTitle: "رقم وظيفي غير صالح",
    error: "13 رقماً، ولا يتكرّر في الملف — أو اتركه فارغاً فيُولَّد.",
    promptTitle: "الرقم الوظيفي",
    prompt: "اختياري. الفارغ يولّده النظام.",
  });
  dv("faculty", {
    type: "list",
    formulae: [`${LISTS}!$${COL.faculty}$2:$${COL.faculty}$${facEnd}`],
    errorTitle: "كلية غير معروفة",
    error: "اختر الكلية من القائمة.",
    promptTitle: "الكلية",
    prompt: "اختياري. اخترها لتضيق الأقسام — أو اتركها تُملأ من القسم.",
  });
  dv("department", {
    type: "list",
    formulae: [dependentList(COL.depPick, "C", "D")],
    errorTitle: "قسم غير معروف",
    error: "اختر القسم من القائمة — فيها أقسام الكلية المختارة وحدها.",
    promptTitle: "القسم",
    prompt: "إلزامي. القائمة تضيق بالكلية المختارة؛ ومنه تُملأ الكلية إن تُركت.",
  });
  // الرتبة: قائمةٌ تقترح ولا تفرض — غير الرسمية تُقبل بعد تنبيه، كنافذة الإضافة.
  dv("grade", {
    type: "list",
    formulae: [`${LISTS}!$${COL.rank}$2:$${COL.rank}$${rankEnd}`],
    errorStyle: "warning",
    errorTitle: "رتبة من غير السلّم الرسميّ",
    error: "ليست من الرتب الرسمية — «نعم» لإبقائها كما كُتبت.",
    promptTitle: "الرتبة",
    prompt: "اختيارية. من القائمة أو غيرها؛ وأكثر من رتبةٍ تُفصل بفاصلة.",
  });

  // ── red cells ──
  const cf = conditionalRules(ws, PROFESSOR_COLUMNS, L, range);
  cf.requiredEmpty();
  cf.duplicates(["universityEmail", "employeeNumber", "email"]);
  cf.latin(["firstNameLatin", "lastNameLatin"]);
  cf.conflict("faculty", "F");
  cf.chosen("faculty");

  return Buffer.from(await wb.xlsx.writeBuffer());
}
