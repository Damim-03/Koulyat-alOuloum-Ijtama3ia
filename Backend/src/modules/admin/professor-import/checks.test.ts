import type { RawCell, RawRow } from "../import-kit/parser";
import { buildContext, checkRow, type Reference, type Taken } from "./checks";
import { AUTO_UNKNOWN, departmentLabels, type ProfessorKey } from "./columns";

/**
 * الحكم على صفٍّ من ملفّ استيراد الأساتذة — خانةً خانة، بلا قاعدة.
 *
 * ما يخصّ الأستاذ: البريد الجامعي (به يدخل)، والرقم الوظيفي، والقسم وكليّته،
 * والرتبة والصفة. والحقول الشخصية لها اختبارها في import-kit.
 */

const FAC_SOC = { id: "fac-soc", name: "كلية العلوم الاجتماعية" };
const FAC_HUM = { id: "fac-hum", name: "كلية العلوم الإنسانية" };
const dep = (id: string, name: string, fac: { id: string; name: string }) => ({ id, name, facultyId: fac.id, faculty: fac });
const PSY = dep("d-psy", "قسم علم النفس", FAC_SOC);
const HIST = dep("d-hist", "قسم التاريخ", FAC_HUM);
// اسمٌ واحد لقسمين في كليتين.
const LANG_SOC = dep("d-lang-soc", "قسم اللغات", FAC_SOC);
const LANG_HUM = dep("d-lang-hum", "قسم اللغات", FAC_HUM);

const REF: Reference = {
  faculties: [FAC_SOC, FAC_HUM],
  departments: [PSY, HIST, LANG_SOC, LANG_HUM],
  domains: ["univ-eloued.dz"],
};
const NO_TAKEN: Taken = { universityEmails: new Map(), employeeNumbers: new Map(), mails: new Map(), names: new Map() };

type Cells = Partial<Record<ProfessorKey, string | Partial<RawCell>>>;
let rowNo = 1;
const row = (over: Cells = {}): RawRow<ProfessorKey> => {
  const values: Cells = {
    firstNameLatin: "Youcef",
    lastNameLatin: "HAMADI",
    universityEmail: `prof${rowNo}@univ-eloued.dz`,
    department: "قسم علم النفس",
    ...over,
  };
  const cells = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, typeof v === "string" ? { text: v, raw: v } : { text: "", raw: "", ...v }]),
  );
  return { row: ++rowNo, hidden: false, cells };
};

/** يحكم على الصفوف معاً (فالتكرار في الملف يُرى)، ويعيد حكم كلّ صفّ. */
const check = (rows: RawRow<ProfessorKey>[], opts: { ref?: Reference; taken?: Partial<Taken> } = {}) => {
  const ctx = buildContext(opts.ref ?? REF, rows, { ...NO_TAKEN, ...opts.taken });
  return rows.map((r) => checkRow(r, ctx));
};
const one = (over: Cells = {}, opts: { ref?: Reference; taken?: Partial<Taken> } = {}) => check([row(over)], opts)[0]!;
const cell = (res: ReturnType<typeof one>, k: ProfessorKey) => res.report.cells[k];
const said = (res: ReturnType<typeof one>, k: ProfessorKey) => (cell(res, k).issues ?? []).map((i) => i.message).join(" | ");

describe("البريد الجامعي", () => {
  it("صالحٌ ⇒ يُحفظ بأحرفٍ صغيرة، والصفّ جاهز", () => {
    const res = one({ universityEmail: "Y.Hamadi@UNIV-ELOUED.DZ" });
    expect(cell(res, "universityEmail")).toMatchObject({ state: "ok", saved: "y.hamadi@univ-eloued.dz" });
    expect(res.ready).toMatchObject({ universityEmail: "y.hamadi@univ-eloued.dz", departmentId: PSY.id, grade: [], tags: [] });
  });

  it.each([
    ["غائب", "", /مطلوب|إلزامي/],
    ["فيه مسافة", "a b@univ-eloued.dz", /مسافة/],
    ["فيه حروفٌ غير لاتينية", "أ@univ-eloued.dz", /حروفٌ لا تكون في البريد/],
    ["صيغةٌ غير صحيحة", "not-an-email", /صيغة بريدٍ غير صحيحة، مثل name@univ-eloued\.dz/],
    ["نطاقٌ غير مسجَّل", "a@gmail.com", /«@gmail\.com» ليس نطاقاً جامعياً مسجَّلاً/],
  ])("%s ⇒ خطأ، ولا صفّ جاهز", (_label, value, message) => {
    const res = one({ universityEmail: value });
    expect(cell(res, "universityEmail").state).toBe("error");
    expect(said(res, "universityEmail")).toMatch(message);
    expect(res.ready).toBeUndefined();
  });

  it("ومنصّةٌ لا نطاقات فيها ⇒ يُقال أضِفها أوّلاً، والمثال عامّ", () => {
    const ref = { ...REF, domains: [] };
    expect(said(one({ universityEmail: "a@univ-eloued.dz" }, { ref }), "universityEmail")).toMatch(/لا نطاقات جامعية مسجَّلة/);
    expect(said(one({ universityEmail: "broken" }, { ref }), "universityEmail")).toMatch(/name@univ\.dz/);
  });

  it("ومكرّرٌ في الملف ⇒ خطأ في الصفّين، كلٌّ يسمّي الآخر", () => {
    const [a, b] = check([row({ universityEmail: "same@univ-eloued.dz" }), row({ universityEmail: "SAME@univ-eloued.dz" })]);
    expect(said(a!, "universityEmail")).toMatch(new RegExp(`في الصفّ ${b!.report.row}`));
    expect(said(b!, "universityEmail")).toMatch(new RegExp(`في الصفّ ${a!.report.row}`));
  });

  it("ومسجَّلٌ لأستاذٍ في المنصّة ⇒ يُسمّى صاحبه، أو «—»", () => {
    const named = { universityEmails: new Map([["old@univ-eloued.dz", { name: "يوسف حمادي" }]]) };
    expect(said(one({ universityEmail: "old@univ-eloued.dz" }, { taken: named }), "universityEmail")).toMatch(/يوسف حمادي/);
    const nameless = { universityEmails: new Map([["old@univ-eloued.dz", { name: "" }]]) };
    expect(said(one({ universityEmail: "old@univ-eloued.dz" }, { taken: nameless }), "universityEmail")).toMatch(/مسبقاً: —/);
  });

  it("وخانةٌ فيها خطأ Excel لا يُحكم عليها مرّتين", () => {
    const res = one({ universityEmail: { excelError: "#N/A" } });
    expect(said(res, "universityEmail")).toMatch(/خطأ Excel/);
    expect(cell(res, "universityEmail").issues).toHaveLength(1);
  });
});

describe("الرقم الوظيفي", () => {
  it("فارغ ⇒ يُولَّد تلقائياً", () => {
    const res = one();
    expect(cell(res, "employeeNumber").state).toBe("auto");
    expect(res.ready!.employeeNumber).toBeUndefined();
  });

  it("13 رقماً، ولو بأرقامٍ عربية أو بفواصل ⇒ يُحفظ لاتينياً", () => {
    const res = one({ employeeNumber: "١٢٣٤ ٥٦٧٨-٩٠١٢٣" });
    expect(cell(res, "employeeNumber").saved).toBe("1234567890123");
    expect(said(res, "employeeNumber")).toMatch(/حُوِّلت الأرقام العربية/);
    expect(res.ready!.employeeNumber).toBe("1234567890123");
  });

  it.each([
    ["فيه حروف", "12345A7890123", /أرقامٌ فقط — فيه «A»/],
    ["أقلّ من 13", "123456", /13 رقماً بالضبط — فيه 6/],
  ])("%s ⇒ خطأ", (_label, value, message) => {
    expect(said(one({ employeeNumber: value }), "employeeNumber")).toMatch(message);
  });

  it("ومكرّرٌ في الملف، أو مسجَّلٌ في المنصّة ⇒ خطأ", () => {
    const [a] = check([row({ employeeNumber: "1234567890123" }), row({ employeeNumber: "1234567890123" })]);
    expect(said(a!, "employeeNumber")).toMatch(/مكرّر في الملف/);
    const taken = { employeeNumbers: new Map([["1234567890123", { name: "" }]]) };
    expect(said(one({ employeeNumber: "1234567890123" }, { taken }), "employeeNumber")).toMatch(/مسبقاً: —/);
  });
});

describe("القسم والكلية", () => {
  it("قسمٌ باسمه ⇒ يُحفظ، والكلية تُملأ منه", () => {
    const res = one({ department: "قسم التاريخ" });
    expect(res.ready!.departmentId).toBe(HIST.id);
    expect(cell(res, "faculty")).toMatchObject({ state: "auto", saved: FAC_HUM.name });
  });

  it("غائب ⇒ خطأ، ولا صفّ جاهز", () => {
    const res = one({ department: "" });
    expect(cell(res, "department").state).toBe("error");
    expect(res.ready).toBeUndefined();
  });

  it("بفرقٍ في الكتابة ⇒ يُعرف ويُنبَّه عليه", () => {
    const res = one({ department: "قسم علم-النفس" });
    expect(res.ready!.departmentId).toBe(PSY.id);
    expect(cell(res, "department").state).toBe("warning");
    expect(said(res, "department")).toMatch(/بفرقٍ في الإملاء/);
  });

  it("اسمٌ لقسمين ⇒ تحدّده الكلية، وإلّا خطأٌ يذكرهما", () => {
    const narrowed = one({ department: "قسم اللغات", faculty: FAC_HUM.name });
    expect(narrowed.ready!.departmentId).toBe(LANG_HUM.id);
    expect(said(narrowed, "department")).toMatch(/وحدّدته «الكلية»/);

    const open = one({ department: "قسم اللغات" });
    expect(open.ready).toBeUndefined();
    expect(said(open, "department")).toMatch(/اسمٌ لـ2 أقسام/);
  });

  it("والتسمية الكاملة «القسم (الكلية)» تحدّده وحدها", () => {
    const label = `قسم اللغات (${FAC_SOC.name})`;
    expect([...departmentLabels(REF.departments).keys()]).toContain(label);
    const res = one({ department: label });
    expect(res.ready!.departmentId).toBe(LANG_SOC.id);
    // كما كُتب بالضبط: لا «saved» مختلفٌ عنه.
    expect(cell(res, "department")).toMatchObject({ state: "ok", value: label });
    expect(cell(res, "department").saved).toBeUndefined();
  });

  it("قسمٌ لا وجود له ⇒ تُقترح أقسام الكلية المكتوبة إن كُتبت", () => {
    const withFaculty = one({ department: "قسم الفلسفة", faculty: FAC_SOC.name });
    expect(said(withFaculty, "department")).toMatch(new RegExp(`أقسام «${FAC_SOC.name}»`));
    const without = one({ department: "قسم الفلسفة" });
    expect(said(without, "department")).toMatch(/ليس قسماً في المنصّة/);
    expect(said(without, "department")).not.toMatch(/أقسام «/);
  });

  describe("الكلية مع القسم", () => {
    it("مكتوبةٌ وتوافقه ⇒ تُحفظ؛ ومن صيغة النموذج ⇒ تلقائية", () => {
      expect(cell(one({ department: "قسم التاريخ", faculty: FAC_HUM.name }), "faculty")).toMatchObject({ state: "ok", value: FAC_HUM.name });
      expect(cell(one({ department: "قسم التاريخ", faculty: { text: FAC_HUM.name, formula: true } }), "faculty").state).toBe("auto");
    });

    it("وصيغةٌ أقدم من المنصّة ⇒ يُعتمد ما في المنصّة، بتنبيه", () => {
      const res = one({ department: "قسم التاريخ", faculty: { text: "كلية قديمة", formula: true } });
      expect(cell(res, "faculty")).toMatchObject({ state: "warning", saved: FAC_HUM.name });
      expect(said(res, "faculty")).toMatch(/النموذج أقدم من المنصّة/);
      expect(res.ready).toBeDefined();
    });

    it("ومكتوبةٌ بيدٍ ولا توافقه ⇒ خطأ: كليةٌ أخرى، أو ليست كلية", () => {
      expect(said(one({ department: "قسم التاريخ", faculty: FAC_SOC.name }), "faculty")).toMatch(/لا يوافق القسم/);
      expect(said(one({ department: "قسم التاريخ", faculty: "كلية الطبّ" }), "faculty")).toMatch(/ليست كليةً في المنصّة/);
    });

    it("و«قسمٌ غير معروف» من صيغة النموذج، أو خطأ Excel ⇒ كأنها لم تُكتب", () => {
      expect(cell(one({ department: "قسم التاريخ", faculty: AUTO_UNKNOWN }), "faculty").state).toBe("auto");
      expect(cell(one({ department: "قسم التاريخ", faculty: { excelError: "#REF!" } }), "faculty").saved).toBe(FAC_HUM.name);
    });
  });

  describe("الكلية بلا قسمٍ معروف", () => {
    it("مكتوبةٌ وموجودة ⇒ تُحفظ؛ وغير موجودة ⇒ خطأ", () => {
      expect(cell(one({ department: "قسم الفلسفة", faculty: "كلية العلوم الإجتماعية" }), "faculty").saved).toBe(FAC_SOC.name);
      expect(said(one({ department: "قسم الفلسفة", faculty: "كلية الطبّ" }), "faculty")).toMatch(/ليست كليةً في المنصّة/);
    });

    it("ومن صيغة النموذج ⇒ تبقى تلقائية", () => {
      expect(cell(one({ department: "قسم الفلسفة", faculty: { text: FAC_SOC.name, formula: true } }), "faculty").state).toBe("auto");
    });
  });
});

describe("الرتبة والصفة", () => {
  it("الرتب الرسمية تُكتب بصيغتها وإن اختلف الإملاء — ورتبةٌ بإملاءين رتبةٌ واحدة — وغيرها يُحفظ بتنبيه", () => {
    const res = one({ grade: "أستاذ محاضر  ا، أستاذ محاضر أ، باحث زائر" });
    expect(res.ready!.grade).toEqual(["أستاذ محاضر أ", "باحث زائر"]);
    expect(cell(res, "grade").state).toBe("warning");
    expect(said(res, "grade")).toMatch(/«باحث زائر» ليست من السلّم الرسميّ/);
  });

  it("والرتبة الرسمية وحدها بلا تنبيه", () => {
    expect(cell(one({ grade: "أستاذ التعليم العالي" }), "grade").state).toBe("ok");
  });

  it("وأكثر من عشرين، أو رتبةٌ أطول من مئة حرف ⇒ خطأ", () => {
    const many = Array.from({ length: 21 }, (_, i) => `رتبة ${i}`).join("، ");
    expect(said(one({ grade: many }), "grade")).toMatch(/21 رتبة، والحدّ 20/);
    expect(said(one({ grade: "ر".repeat(101) }), "grade")).toMatch(/أطول من 100 حرف/);
  });

  it("والصفة قائمةٌ حرّة، بحدودها", () => {
    expect(one({ tags: "رئيس قسم، مسؤول ماستر؛ رئيس قسم" }).ready!.tags).toEqual(["رئيس قسم", "مسؤول ماستر"]);
    const many = Array.from({ length: 21 }, (_, i) => `صفة ${i}`).join(",");
    expect(said(one({ tags: many }), "tags")).toMatch(/21 صفة، والحدّ 20/);
    expect(said(one({ tags: "ص".repeat(61) }), "tags")).toMatch(/أطول من 60 حرفاً/);
  });
});

describe("خانةٌ فيها خطأ Excel", () => {
  it("يُقال الخطأ مرّةً واحدة، ولا يُحكم عليها فوقه — في الرقم الوظيفي وفي القسم", () => {
    const res = one({ employeeNumber: { excelError: "#VALUE!" }, department: { excelError: "#N/A" } });
    for (const k of ["employeeNumber", "department"] as const) {
      expect(cell(res, k).state).toBe("error");
      expect(cell(res, k).issues).toHaveLength(1);
      expect(said(res, k)).toMatch(/خطأ Excel/);
    }
    expect(res.ready).toBeUndefined();
  });
});
