import type { RawRow } from "../import-kit/parser";
import { buildContext, professorsOf, withExisting, type Reference } from "../topic-import/checks";
import type { AssignedKey } from "./columns";
import { checkRow, withStudents, type RefStudent } from "./checks";

/**
 * مقاعد الطلبة في استيراد المواضيع المُسنَدة — بقاعدة نافذة «إنشاء موضوع
 * وإسناده»: لا مذكرة ولا طلب قائم، والتخصّص المختلف تنبيه، والأوّل المرسِل.
 */

const spec = {
  id: "spec-psy",
  name: "علم النفس العيادي",
  level: "master",
  filiere: {
    id: "fil",
    name: "شعبة علم النفس",
    department: { id: "dep", name: "قسم العلوم الاجتماعية", faculty: { id: "fac", name: "كلية العلوم الاجتماعية" } },
  },
};
const ref = {
  specs: [spec],
  years: [{ id: "y1", title: "2026/2027", isActive: true, archivedAt: null }],
  faculties: [{ id: "fac", name: "كلية العلوم الاجتماعية" }],
  departments: [{ id: "dep", name: "قسم العلوم الاجتماعية", facultyId: "fac" }],
  filieres: [{ id: "fil", name: "شعبة علم النفس", departmentId: "dep" }],
  professors: [
    {
      id: "p1",
      universityEmail: "y.hamadi@univ.dz",
      employeeNumber: "1234567890123",
      departmentId: "dep",
      department: { name: "قسم العلوم الاجتماعية" },
      user: { firstName: null, lastName: null, firstNameLatin: "Youcef", lastNameLatin: "HAMADI", status: "active" },
    },
  ],
} as unknown as Reference;

const student = (reg: string, over: Partial<RefStudent> = {}): RefStudent => ({
  id: `s-${reg}`,
  userId: `u-${reg}`,
  registrationNumber: reg,
  name: `Student ${reg}`,
  suspended: false,
  specializationId: "spec-psy",
  specialization: "علم النفس العيادي",
  academicYearId: "y1",
  year: "2026/2027",
  ...over,
});
const STUDENTS = [
  student("202039000001"),
  student("202039000002"),
  student("202039000003", { specializationId: "other", specialization: "علم الطب" }),
  student("202039000004", { project: "موضوعٌ قديم" }),
  student("202039000005", { request: "موضوعٌ مطلوب" }),
  student("202039000006", { academicYearId: "y0", year: "2025/2026" }),
  student("202039000007", { suspended: true }),
];

let rowNo = 2;
const row = (over: Partial<Record<AssignedKey, string>>): RawRow<AssignedKey> => {
  const values: Partial<Record<AssignedKey, string>> = {
    professor: "HAMADI Youcef",
    title: `موضوع ${rowNo}`,
    description: "وصفٌ كافٍ لموضوعٍ مُسنَدٍ في الاختبار.",
    maxStudents: "3",
    specialization: "علم النفس العيادي",
    ...over,
  };
  const cells = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v)
      .map(([k, v]) => [k, { text: v!, raw: v! }]),
  );
  return { row: ++rowNo, hidden: false, cells };
};

const run = (rows: RawRow<AssignedKey>[]) => {
  const base = buildContext(ref, rows);
  const ctx = withStudents(withExisting(base, rows, professorsOf(base, rows), []), rows, STUDENTS);
  return rows.map((r) => checkRow(r, ctx));
};
const said = (out: ReturnType<typeof run>[number], k: AssignedKey) =>
  (out.report.cells[k].issues ?? []).map((i) => `${i.level}: ${i.message}`).join(" | ");

describe("استيراد المواضيع المُسنَدة — مقاعد الطلبة", () => {
  it("صفٌّ سليم: الطلبة بترتيب مقاعدهم والأوّل المرسِل، والتخصّص المختلف تنبيهٌ لا منع", () => {
    const [out] = run([row({ student1: "202039000001", student2: "2020 3900 0003" })]);
    expect(out!.report.errors).toBe(0);
    expect(out!.ready!.members.map((m) => m.id)).toEqual(["s-202039000001", "s-202039000003"]);
    expect(out!.report.cells.student1.saved).toBe("202039000001 — Student 202039000001");
    expect(said(out!, "student2")).toContain("warning: من تخصّص «علم الطب»");
  });

  it("لا مذكرة ولا طلب قائم — كمرشّح المقاعد في النافذة", () => {
    const [out] = run([row({ student1: "202039000004", student2: "202039000005" })]);
    expect(said(out!, "student1")).toContain("له مذكرة: «موضوعٌ قديم»");
    expect(said(out!, "student2")).toContain("له طلب فريقٍ قائم على «موضوعٌ مطلوب»");
    expect(out!.ready).toBeUndefined();
  });

  it("الطالب في مذكرةٍ واحدة: لا يتكرّر في صفّه ولا في صفٍّ آخر", () => {
    const [a, b] = run([
      row({ student1: "202039000001", student2: "202039000001" }),
      row({ student1: "202039000002", student3: "202039000001" }),
    ]);
    expect(said(a!, "student1")).toContain("مكرّرٌ في الصفّ نفسه");
    expect(said(b!, "student3")).toContain("مُسنَدٌ في الملف إلى موضوعٍ آخر");
  });

  it("المرسِل إلزاميّ، والعدد لا يتجاوز «عدد الطلبة»، والرقم المجهول يُقال", () => {
    const [noLeader, tooMany, unknown] = run([
      row({ student2: "202039000003" }),
      row({ maxStudents: "1", student1: "202039000001", student2: "202039000002" }),
      row({ student1: "999999999", student2: "Ali" }),
    ]);
    expect(said(noLeader!, "student1")).toContain("المرسِل");
    expect(said(tooMany!, "maxStudents")).toContain("(2)");
    expect(said(unknown!, "student1")).toContain("لا طالب برقم التسجيل 999999999");
    expect(said(unknown!, "student2")).toContain("اكتب رقمه");
  });
});

describe("استيراد المواضيع المُسنَدة — ما يُنبَّه إليه ولا يمنع، وما يُردّ", () => {
  /** تنبيهاتٌ لا أخطاء: يُسنَد الطالب، وتعرف الإدارة ما قد تريد مراجعته. */
  it("أرقامٌ عربية، وسنةٌ أخرى، وحسابٌ موقوف ⇒ يُسنَدون، وكلٌّ بتنبيهه", () => {
    const [out] = run([row({ student1: "٢٠٢٠٣٩٠٠٠٠٠١", student2: "202039000006", student3: "202039000007" })]);
    expect(out!.report.errors).toBe(0);
    expect(out!.ready!.members.map((m) => m.id)).toEqual(["s-202039000001", "s-202039000006", "s-202039000007"]);
    expect(said(out!, "student1")).toContain("info: حُوِّلت الأرقام العربية إلى لاتينية.");
    expect(said(out!, "student2")).toContain("warning: مسجَّلٌ في السنة 2025/2026");
    expect(said(out!, "student3")).toContain("warning: حسابه موقوف");
  });

  it("رقمٌ أقصر من ستّة أو أطول من عشرين ⇒ يُقال طوله", () => {
    const [out] = run([row({ student1: "12345", student2: "123456789012345678901" })]);
    expect(said(out!, "student1")).toContain("من 6 إلى 20 رقماً — فيه 5");
    expect(said(out!, "student2")).toContain("فيه 21");
    expect(out!.ready).toBeUndefined();
  });

  /** خانةٌ فيها خطأ Excel تحمل خطأها هي — لا يُضاف فوقه «إلزاميّ» لخانةٍ ليست فارغة. */
  it("خانةٌ فيها خطأ Excel ⇒ خطؤها وحده، ولا يُبنى عليها", () => {
    const r = row({});
    r.cells.student1 = { text: "#N/A", raw: "#N/A", excelError: "#N/A" };
    const [out] = run([r]);
    expect(said(out!, "student1")).toContain("خطأ Excel (#N/A)");
    expect(said(out!, "student1")).not.toContain("إلزامي");
    expect(out!.ready).toBeUndefined();
  });

  /** صفٌّ يُحكم عليه بسياقٍ لم يُعدّ مقاعده (لم يكن بين صفوف الملف) يُفحص وحده، ولا يرمي. */
  it("وصفٌّ خارج مقاعد الملف يُفحص وحده", () => {
    const r = row({ student1: "202039000002" });
    const base = buildContext(ref, [r]);
    const ctx = withStudents(withExisting(base, [r], professorsOf(base, [r]), []), [], STUDENTS);
    const out = checkRow(r, ctx);
    expect(out.report.errors).toBe(0);
    expect(out.ready!.members.map((m) => m.id)).toEqual(["s-202039000002"]);
  });
});
