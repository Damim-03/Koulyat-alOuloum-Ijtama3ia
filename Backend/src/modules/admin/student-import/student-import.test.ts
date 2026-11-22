/**
 * رقم التسجيل في استيراد الطلبة — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يستورد ملفّاً سليماً وآخر فيه أخطاءٌ معروفة. وهنا ما لا يصنعه
 * ملفّ اختبارٍ صغير: طولٌ يخالف أغلب الملف (رقمٌ نقص منه خانتان عند النسخ)،
 * وخانةٌ غائبة من الصفّ أصلاً، وحروفٌ في الرقم، وأرقامٌ عربية ومسافاتٌ تُنظَّف
 * ويُقال ذلك، ورقمٌ سبق إلى المنصّة لطالبٍ بلا اسم.
 */
import type { RawRow } from "../import-kit/parser";
import { required } from "../import-kit/report";
import type { ColumnKey } from "./columns";
import { buildContext, checkRow, type Reference, type Taken } from "./checks";

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
} as unknown as Reference;

const noneTaken = (): Taken => ({ regs: new Map(), mails: new Map(), names: new Map() });

let rowNo = 1;
const row = (over: Partial<Record<ColumnKey, string>>): RawRow<ColumnKey> => {
  const values: Partial<Record<ColumnKey, string>> = {
    firstNameLatin: "Youcef",
    lastNameLatin: `HAMADI${String.fromCharCode(65 + (rowNo % 26))}`,
    academicYear: "2026/2027",
    specialization: "علم النفس العيادي",
    ...over,
  };
  const cells = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, { text: v!, raw: v! }]),
  );
  return { row: ++rowNo, hidden: false, cells };
};

const run = (rows: RawRow<ColumnKey>[], taken = noneTaken()) => {
  const ctx = buildContext(ref, rows, taken);
  return rows.map((r) => checkRow(r, ctx));
};
const said = (out: ReturnType<typeof run>[number]) =>
  (out.report.cells.registrationNumber.issues ?? []).map((i) => `${i.level}: ${i.message}`).join(" | ");

describe("استيراد الطلبة — رقم التسجيل", () => {
  /**
   * أغلب الملف بطولٍ واحد (أربعة من خمسة هنا): رقمٌ بطولٍ آخر غالباً نقص منه
   * شيءٌ عند النسخ. يُنبَّه عليه ولا يُردّ — قد يكون صحيحاً فعلاً.
   */
  it("رقمٌ بطولٍ يخالف أغلب الملف ⇒ تنبيهٌ يقول الطولين، لا خطأ", () => {
    const outs = run([
      row({ registrationNumber: "202039000001" }),
      row({ registrationNumber: "202039000002" }),
      row({ registrationNumber: "202039000003" }),
      row({ registrationNumber: "202039000004" }),
      row({ registrationNumber: "2020390005" }),
    ]);
    expect(said(outs[4]!)).toContain("warning: فيه 10 أرقام، وأغلب أرقام الملف 12 — تأكّد منه.");
    expect(outs[4]!.report.errors).toBe(0);
    expect(said(outs[0]!)).not.toContain("warning");
  });

  /** ولا أغلبية (ثلاثةٌ من خمسة): لا طولَ «صحيح» يُقاس عليه، فلا يُنبَّه أحد. */
  it("وملفٌّ لا يغلب فيه طولٌ واحد ⇒ لا تنبيه على أحد", () => {
    const outs = run([
      row({ registrationNumber: "202039000011" }),
      row({ registrationNumber: "202039000012" }),
      row({ registrationNumber: "202039000013" }),
      row({ registrationNumber: "2020390014" }),
      row({ registrationNumber: "2020390015" }),
    ]);
    expect(outs.map(said).filter((t) => t.includes("warning"))).toEqual([]);
  });

  it("خانةٌ غائبة من الصفّ ⇒ «إلزامي»", () => {
    const [out] = run([row({})]);
    expect(said(out!)).toBe(`error: ${required()}`);
  });

  it("حروفٌ في الرقم ⇒ تُسمّى", () => {
    const [out] = run([row({ registrationNumber: "2020-39ab01" })]);
    expect(said(out!)).toContain("error: أرقامٌ فقط — فيه «a b»");
  });

  it("أرقامٌ عربية ومسافاتٌ وشرطات ⇒ تُنظَّف ويُقال ذلك، والرقم يُحفظ لاتينياً", () => {
    const [out] = run([row({ registrationNumber: "٢٠٢٠ ٣٩٠٠-٠٠٠١" })]);
    expect(out!.report.cells.registrationNumber.saved).toBe("202039000001");
    expect(said(out!)).toContain("info: حُوِّلت الأرقام العربية إلى لاتينية.");
    expect(said(out!)).toContain("info: حُذفت المسافات والشرطات.");
  });

  it("ورقمٌ سبق إلى المنصّة لطالبٍ بلا اسم ⇒ يُقال «طالب» لا فراغ", () => {
    const taken = noneTaken();
    taken.regs.set("202039000009", { name: "", specialization: "علم النفس العيادي" });
    const [out] = run([row({ registrationNumber: "202039000009" })], taken);
    expect(said(out!)).toContain("error: مسجَّلٌ في المنصّة مسبقاً: طالب — علم النفس العيادي.");
  });
});
