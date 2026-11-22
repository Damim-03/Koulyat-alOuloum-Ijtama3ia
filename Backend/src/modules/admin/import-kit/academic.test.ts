/**
 * البيانات الجامعية في الاستيراد — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI تعمل بتخصّصٍ واحدٍ وسنةٍ جارية. وهنا ما يحتاج هيكلاً أكبر:
 * سنةٌ فارغة أو مؤرشفة أو مكتوبةٌ بأربعة أرقام، وتخصّصان باسمٍ واحد، ومستوىً
 * لا تعرفه المنصّة، وتخصّصٌ مجهولٌ يُقترح له من نطاق ما كُتب، وصفٌّ بلا تخصّص
 * تُتحقّق كليته وقسمه وشعبته ومستواه فيما بينها.
 */
import type { ImportColumn } from "./columns";
import {
  academicContext,
  checkAcademicYear,
  checkPlacement,
  specLabels,
  type AcademicReference,
  type RefSpec,
} from "./academic";
import type { RawCell, RawRow } from "./parser";
import { required, RowCheck } from "./report";

const AUTO_UNKNOWN = "تخصصٌ غير معروف";

const faculties = [
  { id: "fac-soc", name: "كلية العلوم الاجتماعية" },
  { id: "fac-hum", name: "كلية العلوم الإنسانية" },
];
const departments = [
  { id: "dep-soc", name: "قسم علم الاجتماع", facultyId: "fac-soc" },
  { id: "dep-psy", name: "قسم علم النفس", facultyId: "fac-soc" },
  { id: "dep-med", name: "قسم الإعلام", facultyId: "fac-hum" },
];
const filieres = [
  { id: "fil-soc", name: "شعبة علم الاجتماع", departmentId: "dep-soc" },
  { id: "fil-psy", name: "شعبة علم النفس", departmentId: "dep-psy" },
  { id: "fil-med", name: "شعبة الإعلام", departmentId: "dep-med" },
];
const spec = (id: string, name: string, level: string, filiereId: string): RefSpec => {
  const fil = filieres.find((f) => f.id === filiereId)!;
  const dep = departments.find((d) => d.id === fil.departmentId)!;
  const fac = faculties.find((f) => f.id === dep.facultyId)!;
  return { id, name, level, filiere: { ...fil, department: { ...dep, faculty: fac } } };
};
const ref: AcademicReference = {
  specs: [
    spec("clin", "علم النفس العيادي", "master", "fil-psy"),
    spec("clinL", "علم النفس العيادي", "licence", "fil-psy"),
    spec("work", "علم النفس العمل", "master", "fil-psy"),
    spec("urban", "علم الاجتماع الحضري", "master", "fil-soc"),
    spec("digi", "إعلام رقمي", "bootcamp", "fil-med"),
    spec("digiM", "إعلام رقمي", "master", "fil-med"),
  ],
  years: [
    { id: "y1", title: "2026/2027", isActive: true, archivedAt: null },
    { id: "y0", title: "2025/2026", isActive: false, archivedAt: new Date("2026-07-01") },
  ],
  faculties,
  departments,
  filieres,
};
const ctx = academicContext(ref);

type Key = "academicYear" | "faculty" | "department" | "filiere" | "level" | "specialization";
const column = (key: Key, header: string, kind: "req" | "auto") => ({ key, header, kind, width: 10, note: "", group: "academic" });
const columns = [
  column("academicYear", "السنة الجامعية", "req"),
  column("faculty", "الكلية", "auto"),
  column("department", "القسم", "auto"),
  column("filiere", "الشعبة", "auto"),
  column("level", "المستوى", "auto"),
  column("specialization", "التخصص", "req"),
] as ImportColumn<Key>[];

let rowNo = 1;
const row = (values: Partial<Record<Key, string | RawCell>>): RawRow<Key> => ({
  row: ++rowNo,
  hidden: false,
  cells: Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? { text: v, raw: v } : v]),
  ),
});
/** ما تكتبه صيغة النموذج في عمودٍ تلقائيّ. */
const formula = (text: string): RawCell => ({ text, raw: text, formula: true });

const place = (values: Partial<Record<Key, string | RawCell>>) => {
  const raw = row(values);
  const r = new RowCheck(raw, columns);
  return { r, spec: checkPlacement(r, raw, ctx, AUTO_UNKNOWN) };
};
const said = (r: RowCheck<Key>, k: Key) => (r.cells[k].issues ?? []).map((i) => `${i.level}: ${i.message}`).join(" | ");

describe("specLabels — اسم التخصص في القائمة", () => {
  /** الاسم وحده إن لم يتكرّر؛ وبمستواه إن تكرّر — والمستوى المجهول كما هو؛ وبشعبته إن تكرّر بالمستوى نفسه. */
  it("يُميَّز المكرّر بمستواه، ثم بشعبته", () => {
    expect([...ctx.labelOf.values()]).toEqual([
      "علم النفس العيادي — ماستر",
      "علم النفس العيادي — ليسانس",
      "علم النفس العمل",
      "علم الاجتماع الحضري",
      "إعلام رقمي — bootcamp",
      "إعلام رقمي — ماستر",
    ]);
    const twins = specLabels([spec("a", "علم الاجتماع", "master", "fil-soc"), spec("b", "علم الاجتماع", "master", "fil-psy")]);
    expect([...twins.keys()]).toEqual(["علم الاجتماع — ماستر (شعبة علم الاجتماع)", "علم الاجتماع — ماستر (شعبة علم النفس)"]);
  });
});

describe("checkAcademicYear", () => {
  const year = (v: string | undefined, opts: { what: "students" | "topics"; emptyIsActive?: boolean }, c = ctx) => {
    const r = new RowCheck(row(v === undefined ? {} : { academicYear: v }), columns);
    return { r, id: checkAcademicYear(r, c, opts) };
  };

  it("فارغةٌ حيث هي إلزامية ⇒ خطأ", () => {
    const { r, id } = year(undefined, { what: "students" });
    expect(said(r, "academicYear")).toBe("error: إلزامية — الخانة فارغة.");
    expect(id).toBe("");
  });

  /** الفارغة هي الجارية حيث يُسمح بذلك — فإن لم تكن جارية، أو كانت مؤرشفة، فلا سنة تُملأ. */
  it("فارغةٌ تُملأ بالجارية: ولا جارية، أو الجارية مؤرشفة ⇒ خطأ", () => {
    const none = academicContext({ ...ref, years: ref.years.map((y) => ({ ...y, isActive: false })) });
    const archived = academicContext({ ...ref, years: [{ ...ref.years[0]!, archivedAt: new Date("2027-07-01") }] });
    const opts = { what: "topics" as const, emptyIsActive: true };

    expect(said(year(undefined, opts, none).r, "academicYear")).toBe(
      "error: لا سنةَ جامعيةً جارية في المنصّة — اختر السنة من القائمة.",
    );
    expect(said(year(undefined, opts, archived).r, "academicYear")).toBe(
      "error: السنة الجارية 2026/2027 مغلقةٌ ومحفوظة في الأرشيف — لا يُضاف إليها مواضيع.",
    );
  });

  it("أربعة أرقام ⇒ تُكتب كاملة؛ وسنةٌ مؤرشفة ⇒ لا يُضاف إليها", () => {
    expect(said(year("2026", { what: "students" }).r, "academicYear")).toContain("error: اكتبها كاملة، مثل 2026/2027.");
    const { r, id } = year("2025/2026", { what: "students" });
    expect(said(r, "academicYear")).toBe("error: السنة 2025/2026 مغلقةٌ ومحفوظة في الأرشيف — لا يُضاف إليها طلبة.");
    expect(id).toBe("");
  });
});

describe("checkPlacement — التخصص", () => {
  it("فيه خطأ Excel ⇒ خطؤه وحده، ولا تخصّص", () => {
    const { r, spec: s } = place({ specialization: { text: "", raw: "", excelError: "#N/A" } });
    expect(r.cells.specialization.issues).toHaveLength(1);
    expect(s).toBeUndefined();
  });

  /** اسمٌ لتخصّصين: يُسمّيان بمستواهما وشعبتهما — والمستوى المجهول كما هو. */
  it("اسمٌ لأكثر من تخصّص ⇒ يُسمّى كلٌّ منها", () => {
    const { r, spec: s } = place({ specialization: "إعلام رقمي" });
    expect(said(r, "specialization")).toContain("«إعلام رقمي — bootcamp، شعبة شعبة الإعلام»");
    expect(said(r, "specialization")).toContain("«إعلام رقمي — ماستر، شعبة شعبة الإعلام»");
    expect(s).toBeUndefined();
  });

  /** وما كُتب في المستوى لا يوافق أيّاً منهما: لا يضيّق شيئاً، فيُسمّى المرشّحان كلاهما. */
  it("ومستوىً لا يوافق أيّاً منها ⇒ تُسمّى كلّها", () => {
    const { r } = place({ specialization: "علم النفس العيادي", level: "دكتوراه" });
    expect(said(r, "specialization")).toContain("«علم النفس العيادي — ماستر، شعبة شعبة علم النفس»");
    expect(said(r, "specialization")).toContain("«علم النفس العيادي — ليسانس، شعبة شعبة علم النفس»");
  });

  it("ليس في المنصّة ⇒ تُذكر تخصّصات ما كُتب من الكلية", () => {
    const { r } = place({ specialization: "علم النفس المرضي", faculty: "كلية العلوم الاجتماعية" });
    expect(said(r, "specialization")).toContain("error: «علم النفس المرضي» ليس تخصّصاً في المنصّة.");
    expect(said(r, "specialization")).toContain(
      "التخصصات فيما كُتب من الكلية والقسم والشعبة والمستوى: «علم النفس العيادي — ماستر»، «علم النفس العيادي — ليسانس»، «علم النفس العمل»، «علم الاجتماع الحضري».",
    );
  });

  it("كليةٌ في المنصّة غير كلية التخصص ⇒ تُسمّى كليته", () => {
    const { r } = place({ specialization: "علم النفس العمل", faculty: "كلية العلوم الإنسانية" });
    expect(said(r, "faculty")).toBe("error: لا يوافق التخصص «علم النفس العمل» — كليته في المنصّة «كلية العلوم الاجتماعية».");
  });

  it("ومستوىً لا تعرفه المنصّة ⇒ يُملأ كما هو", () => {
    const { r, spec: s } = place({ specialization: "إعلام رقمي — bootcamp" });
    expect(s?.id).toBe("digi");
    expect(r.cells.level).toMatchObject({ state: "auto", saved: "bootcamp" });
  });
});

describe("checkPlacement — صفٌّ بلا تخصّص", () => {
  it("صيغ النموذج في الأعمدة التلقائية ⇒ تبقى تلقائية، ولا يُحكم عليها", () => {
    const { r } = place({ faculty: formula("كلية العلوم الاجتماعية"), level: formula("ماستر") });
    expect(said(r, "specialization")).toBe(`error: ${required()}`);
    expect([r.cells.faculty.state, r.cells.level.state]).toEqual(["auto", "auto"]);
  });

  it("كليةٌ وقسمٌ وشعبةٌ ليست في المنصّة ⇒ كلٌّ يُقال", () => {
    const { r } = place({ faculty: "كلية الطب", department: "قسم الطب", filiere: "شعبة الطب" });
    expect(said(r, "faculty")).toContain("error: «كلية الطب» ليست كليةً في المنصّة.");
    expect(said(r, "department")).toContain("error: «قسم الطب» ليس قسماً في المنصّة.");
    expect(said(r, "filiere")).toContain("error: «شعبة الطب» ليست شعبةً في المنصّة.");
  });

  it("قسمٌ من غير الكلية، وشعبةٌ من غير القسم أو الكلية ⇒ يُقال أين هي", () => {
    const depElsewhere = place({ faculty: "كلية العلوم الإنسانية", department: "قسم علم النفس" }).r;
    expect(said(depElsewhere, "department")).toBe(
      "error: ليس من كلية «كلية العلوم الإنسانية» — هو في «كلية العلوم الاجتماعية».",
    );

    const filOutsideDep = place({ faculty: "كلية العلوم الاجتماعية", department: "قسم علم النفس", filiere: "شعبة الإعلام" }).r;
    expect(filOutsideDep.cells.department.state).toBe("ok"); // قُبل، وبه تُقاس الشعبة
    expect(said(filOutsideDep, "filiere")).toBe("error: ليست من قسم «قسم علم النفس» — هي في قسم «قسم الإعلام».");

    const filOutsideFac = place({ faculty: "كلية العلوم الاجتماعية", filiere: "شعبة الإعلام" }).r;
    expect(said(filOutsideFac, "filiere")).toBe("error: ليست من كلية «كلية العلوم الاجتماعية» — هي في قسم «قسم الإعلام».");
  });

  it("شعبةٌ وحدها في المنصّة ⇒ تُقبل؛ والمستوى: اسمه يُحفظ، وما ليس مستوى يُقال", () => {
    const ok = place({ filiere: "شعبة الاعلام", level: "master" }).r;
    expect(ok.cells.filiere).toMatchObject({ saved: "شعبة الإعلام" });
    expect(ok.cells.level).toMatchObject({ saved: "ماستر" });

    const bad = place({ level: "سنة أولى" }).r;
    expect(said(bad, "level")).toBe("error: «سنة أولى» ليس مستوى — ليسانس أو ماستر أو دكتوراه.");
  });
});
