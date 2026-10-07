import {
  AUTO_UNKNOWN,
  IMPORT_COLUMNS,
  LEVEL_LABEL,
  STUDENT_SPEC,
  specLabels,
  type ColumnKey,
  type SpecForLabel,
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
 * نموذج استيراد الطلبة، مولَّداً من القاعدة لحظة التنزيل.
 *
 * قوائمه — التخصصات والسنوات والهيكل الجامعي — من المنصّة كما هي الآن، فلا
 * يُنزَّل نموذجٌ بتخصصٍ حُذف أو ناقصٌ تخصصاً أُضيف أمس. وبلا صفوف أمثلة:
 * نموذجٌ يُملأ لا يحمل طلبةً وهميين يُستوردون سهواً مع الحقيقيين.
 *
 * والبيانات الجامعية تُملأ بطريقين، كنافذة «إضافة طالب»:
 *
 *   من التخصص — يُختار، فتُملأ الكلية والقسم والشعبة والمستوى وحدها (صيغ).
 *   من الأعلى — تُختار الكلية، فتضيق قائمة الأقسام إلى أقسامها، ثم الشعب،
 *     ثم التخصصات إلى ما يوافق كلّ ما اختير فوقها.
 *
 * والاختيار باليد يحلّ محلّ الصيغة في خانته، فيُعرف في الورقة المساعدة بأنّه
 * ليس صيغة (ISFORMULA): هو وحده يضيّق القوائم، وهو وحده يُقارن بالتخصص —
 * وتعارضهما يُلوّن الخانة بالأحمر في Excel قبل أن يقوله الخادم.
 */

const STUDENTS = STUDENT_SPEC.sheetName;
const LEVEL_ORDER: Record<string, number> = { licence: 0, master: 1, doctorate: 2 };

/** أعمدة ورقة «القوائم». */
const COL = {
  // جدول التخصصات — مصدر الصيغ التلقائية
  specLabel: "A",
  specFac: "B",
  specDep: "C",
  specFil: "D",
  specLvl: "E",
  year: "G",
  gender: "I",
  verified: "J",
  faculty: "L",
  level: "N",
  depKey: "P",
  depName: "Q",
  filKey: "S",
  filName: "T",
  specKey: "V",
  specKeyLvl: "W",
  specPick: "X",
} as const;

interface TreeRow {
  label: string;
  fac: string;
  dep: string;
  fil: string;
  lvl: string;
  order: number;
}

export async function buildImportTemplate(input: {
  specs: SpecForLabel[];
  years: { title: string; isActive: boolean }[];
}): Promise<Buffer> {
  const wb = newWorkbook();
  const { ws, L, range } = createImportSheet(wb, STUDENTS, IMPORT_COLUMNS);
  const lists = wb.addWorksheet("القوائم", { state: "hidden", views: [{ rightToLeft: true }] });
  const calc = wb.addWorksheet("تصفية", { state: "hidden", views: [{ rightToLeft: true }] });
  const { put, column, blocks } = listsWriter(lists);

  // ── the academic tree, in the order the dropdowns show it ──
  const tree: TreeRow[] = [...specLabels(input.specs).entries()]
    .map(([label, s]) => ({
      label,
      fac: s.filiere.department.faculty.name,
      dep: s.filiere.department.name,
      fil: s.filiere.name,
      lvl: LEVEL_LABEL[s.level] ?? s.level,
      order: LEVEL_ORDER[s.level] ?? 9,
    }))
    .sort(
      (a, b) =>
        byAr(a.fac, b.fac) || byAr(a.dep, b.dep) || byAr(a.fil, b.fil) || a.order - b.order || byAr(a.label, b.label),
    );
  const byLevel = (rows: TreeRow[]) => [...rows].sort((a, b) => a.order - b.order || byAr(a.label, b.label));

  // جدول التخصصات
  put(COL.specLabel, 1, "التخصص");
  put(COL.specFac, 1, "الكلية");
  put(COL.specDep, 1, "القسم");
  put(COL.specFil, 1, "الشعبة");
  put(COL.specLvl, 1, "المستوى");
  tree.forEach((t, i) => {
    put(COL.specLabel, i + 2, t.label);
    put(COL.specFac, i + 2, t.fac);
    put(COL.specDep, i + 2, t.dep);
    put(COL.specFil, i + 2, t.fil);
    put(COL.specLvl, i + 2, t.lvl);
  });
  const specEnd = Math.max(2, tree.length + 1);

  const yearEnd = column(COL.year, "السنة الجامعية", input.years.map((y) => y.title));
  column(COL.gender, "الجنس", ["ذكر", "أنثى"]);
  column(COL.verified, "حالة التوثيق", ["موثّق", "غير موثّق"]);
  const faculties = unique(tree.map((t) => t.fac));
  const facEnd = column(COL.faculty, "الكلية", faculties);
  const levelEnd = column(COL.level, "المستوى", ["licence", "master", "doctorate"].map((l) => LEVEL_LABEL[l]!));

  // الأقسام: لكلّ كليةٍ أقسامها، ثم الكلّ
  const depEnd = blocks(COL.depKey, COL.depName, "القسم", [
    ...faculties.flatMap((f) =>
      unique(tree.filter((t) => t.fac === f).map((t) => t.dep)).map((d) => ({ key: `fac:${f}`, value: d })),
    ),
    ...unique(tree.map((t) => t.dep)).map((d) => ({ key: "all", value: d })),
  ]);

  // الشعب: لكلّ قسمٍ شعبه، ولكلّ كليةٍ شعبها، ثم الكلّ
  const departments = unique(tree.map((t) => t.dep));
  const filEnd = blocks(COL.filKey, COL.filName, "الشعبة", [
    ...departments.flatMap((d) =>
      unique(tree.filter((t) => t.dep === d).map((t) => t.fil)).map((x) => ({ key: `dep:${d}`, value: x })),
    ),
    ...faculties.flatMap((f) =>
      unique(tree.filter((t) => t.fac === f).map((t) => t.fil)).map((x) => ({ key: `fac:${f}`, value: x })),
    ),
    ...unique(tree.map((t) => t.fil)).map((x) => ({ key: "all", value: x })),
  ]);

  // التخصصات: لأدنى ما اختير من الشعبة أو القسم أو الكلية (وبمستواه إن
  // اختير)، أو للمستوى وحده، أو الكلّ. داخل كلّ كتلةٍ بالمستوى، فيتجاور
  // مفتاحها الثاني «…|ماستر».
  const filieres = unique(tree.map((t) => t.fil));
  const specBlock = (prefix: string, name: string, rows: TreeRow[]) =>
    byLevel(rows).map((t) => ({ key: `${prefix}:${name}`, key2: `${prefix}:${name}|${t.lvl}`, value: t.label }));
  const specPickEnd = blocks(
    COL.specKey,
    COL.specPick,
    "التخصص",
    [
      ...filieres.flatMap((x) => specBlock("fil", x, tree.filter((t) => t.fil === x))),
      ...departments.flatMap((d) => specBlock("dep", d, tree.filter((t) => t.dep === d))),
      ...faculties.flatMap((f) => specBlock("fac", f, tree.filter((t) => t.fac === f))),
      ...["licence", "master", "doctorate"]
        .map((l) => LEVEL_LABEL[l]!)
        .flatMap((lvl) => tree.filter((t) => t.lvl === lvl).map((t) => ({ key: `lvl:${lvl}`, value: t.label }))),
      ...tree.map((t) => ({ key: "all", value: t.label })),
    ],
    COL.specKeyLvl,
  );
  for (const c of Object.values(COL)) lists.getColumn(c).width = 24;

  // ── data rows — text formats, and the path derived from the specialization ──
  const autoSrc: Partial<Record<ColumnKey, string>> = {
    faculty: COL.specFac,
    department: COL.specDep,
    filiere: COL.specFil,
    level: COL.specLvl,
  };
  const sp = L("specialization");
  formatDataRows(ws, IMPORT_COLUMNS, {
    textKeys: ["registrationNumber", "phone", "password"],
    autoFormula: (k, r) => {
      const src = autoSrc[k];
      return src
        ? `IF($${sp}${r}="","",IFERROR(INDEX(${LISTS}!$${src}$2:$${src}$${specEnd},MATCH($${sp}${r},${LISTS}!$A$2:$A$${specEnd},0)),"${AUTO_UNKNOWN}"))`
        : undefined;
    },
  });

  // ── the hidden helper: what was picked by hand, and where each list starts ──
  // لكلّ صفّ طالبٍ صفٌّ هنا بالرقم نفسه. الأعمدة:
  //   A–D  الكلية/القسم/الشعبة/المستوى المختارة باليد ("" إن كانت صيغة أو فارغة)
  //   E    أدنى ما اختير: «fil:…» أو «dep:…» أو «fac:…»
  //   F–I  قائمة التخصصات: بالمستوى؟ · مفتاحها · أوّل صفّ · عددها
  //   J–L  قائمة الأقسام: مفتاحها · أوّل صفّ · عددها
  //   M–O  قائمة الشعب:   مفتاحها · أوّل صفّ · عددها
  //   P–S  الكلية/القسم/الشعبة/المستوى كما يقتضيها التخصص
  //   T–U  القسم من الكلية؟ · الشعبة من القسم؟
  //   V–Y  تعارضٌ في الكلية/القسم/الشعبة/المستوى (يُلوّن الخانة)
  const rng = (c: string, end: number) => `${LISTS}!$${c}$1:$${c}$${end}`;
  const SK = rng(COL.specKey, specPickEnd);
  const SK2 = rng(COL.specKeyLvl, specPickEnd);
  const DK = rng(COL.depKey, depEnd);
  const DN = rng(COL.depName, depEnd);
  const FK = rng(COL.filKey, filEnd);
  const FN = rng(COL.filName, filEnd);
  const derive = (src: string, r: number) =>
    `IFERROR(INDEX(${LISTS}!$${src}$2:$${src}$${specEnd},MATCH('${STUDENTS}'!$${sp}${r},${LISTS}!$A$2:$A$${specEnd},0)),"")`;
  for (let r = FIRST; r <= LAST; r++) {
    const S = (k: ColumnKey) => `'${STUDENTS}'!$${L(k)}${r}`;
    const typed = (k: ColumnKey) => `IF(_xlfn.ISFORMULA(${S(k)}),"",${S(k)}&"")`;
    const f: Record<string, string> = {
      A: typed("faculty"),
      B: typed("department"),
      C: typed("filiere"),
      D: typed("level"),
      E: `IF(C${r}<>"","fil:"&C${r},IF(B${r}<>"","dep:"&B${r},IF(A${r}<>"","fac:"&A${r},"")))`,
      F: `AND(E${r}<>"",D${r}<>"",COUNTIF(${SK2},E${r}&"|"&D${r})>0)`,
      G: `IF(AND(E${r}<>"",COUNTIF(${SK},E${r})>0),E${r},IF(AND(D${r}<>"",COUNTIF(${SK},"lvl:"&D${r})>0),"lvl:"&D${r},"all"))`,
      H: `IF(F${r},MATCH(E${r}&"|"&D${r},${SK2},0),MATCH(G${r},${SK},0))`,
      I: `IF(F${r},COUNTIF(${SK2},E${r}&"|"&D${r}),COUNTIF(${SK},G${r}))`,
      J: `IF(AND(${S("faculty")}<>"",COUNTIF(${DK},"fac:"&${S("faculty")})>0),"fac:"&${S("faculty")},"all")`,
      K: `MATCH(J${r},${DK},0)`,
      L: `COUNTIF(${DK},J${r})`,
      M: `IF(AND(${S("department")}<>"",COUNTIF(${FK},"dep:"&${S("department")})>0),"dep:"&${S("department")},IF(AND(${S("faculty")}<>"",COUNTIF(${FK},"fac:"&${S("faculty")})>0),"fac:"&${S("faculty")},"all"))`,
      N: `MATCH(M${r},${FK},0)`,
      O: `COUNTIF(${FK},M${r})`,
      P: derive(COL.specFac, r),
      Q: derive(COL.specDep, r),
      R: derive(COL.specFil, r),
      S: derive(COL.specLvl, r),
      T: `IF(OR(A${r}="",B${r}=""),TRUE,COUNTIFS(${DK},"fac:"&A${r},${DN},B${r})>0)`,
      U: `IF(OR(B${r}="",C${r}=""),TRUE,COUNTIFS(${FK},"dep:"&B${r},${FN},C${r})>0)`,
      V: `AND(A${r}<>"",P${r}<>"",A${r}<>P${r})`,
      W: `OR(AND(B${r}<>"",Q${r}<>"",B${r}<>Q${r}),NOT(T${r}))`,
      X: `OR(AND(C${r}<>"",R${r}<>"",C${r}<>R${r}),NOT(U${r}))`,
      Y: `AND(D${r}<>"",S${r}<>"",D${r}<>S${r})`,
    };
    const row = calc.getRow(r);
    for (const [c, formula] of Object.entries(f)) row.getCell(c).value = { formula };
  }

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
    true,
  );
  dv("academicYear", {
    type: "list",
    formulae: [`${LISTS}!$${COL.year}$2:$${COL.year}$${yearEnd}`],
    errorTitle: "سنة غير معروفة",
    error: "اختر السنة الجامعية من القائمة.",
    promptTitle: "السنة الجامعية",
    prompt: "إلزامية. اختر من القائمة.",
  });
  dv("faculty", {
    type: "list",
    formulae: [`${LISTS}!$${COL.faculty}$2:$${COL.faculty}$${facEnd}`],
    errorTitle: "كلية غير معروفة",
    error: "اختر الكلية من القائمة.",
    promptTitle: "الكلية",
    prompt: "اختياري. اخترها لتضيق الأقسام والتخصصات — أو اتركها تُملأ من التخصص.",
  });
  dv("department", {
    type: "list",
    formulae: [dependentList(COL.depName, "K", "L")],
    errorTitle: "قسم غير معروف",
    error: "اختر القسم من القائمة — فيها أقسام الكلية المختارة وحدها.",
    promptTitle: "القسم",
    prompt: "اختياري. القائمة أقسام الكلية المختارة.",
  });
  dv("filiere", {
    type: "list",
    formulae: [dependentList(COL.filName, "N", "O")],
    errorTitle: "شعبة غير معروفة",
    error: "اختر الشعبة من القائمة — فيها شعب القسم المختار وحدها.",
    promptTitle: "الشعبة",
    prompt: "اختياري. القائمة شعب القسم المختار.",
  });
  dv("level", {
    type: "list",
    formulae: [`${LISTS}!$${COL.level}$2:$${COL.level}$${levelEnd}`],
    errorTitle: "مستوى غير معروف",
    error: "ليسانس أو ماستر أو دكتوراه.",
    promptTitle: "المستوى",
    prompt: "اختياري. يضيّق التخصصات إلى مستواه.",
  });
  dv("specialization", {
    type: "list",
    formulae: [dependentList(COL.specPick, "H", "I")],
    errorTitle: "تخصّص غير معروف",
    error: "اختر التخصص من القائمة — فيها ما يوافق الكلية والقسم والشعبة والمستوى المختارة.",
    promptTitle: "التخصص",
    prompt: "إلزامي. القائمة تضيق بما اخترته قبله؛ ومنه تُملأ الأعمدة الفارغة.",
  });

  // ── red cells ──
  const cf = conditionalRules(ws, IMPORT_COLUMNS, L, range);
  cf.requiredEmpty();
  cf.duplicates(["registrationNumber", "email"]);
  cf.latin(["firstNameLatin", "lastNameLatin"]);
  // ما اختير باليد ويعارض التخصص، أو قسمٌ من غير الكلية، أو شعبةٌ من غير القسم.
  const conflict: [ColumnKey, string][] = [
    ["faculty", "V"],
    ["department", "W"],
    ["filiere", "X"],
    ["level", "Y"],
  ];
  for (const [k, flag] of conflict) cf.conflict(k, flag);
  for (const [k] of conflict) cf.chosen(k);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
