/**
 * فهرس تقارير الاستيراد — كلّ رسالةٍ باللغات الثلاث.
 *
 * التقرير يُكتب بلغة المسؤول، فرسالةٌ ناقصةٌ بالفرنسية أو بقيمةٍ لم تُملأ
 * («{{rows}}»، «undefined») لا يراها إلّا مسؤولٌ يعمل بالفرنسية — بعد النشر.
 */
import { tr, type MessageKey } from "../index";
import { importsKit } from "./imports-kit";
import { imports } from "./imports";

const LANGS = ["ar", "en", "fr"] as const;
const KEYS = [...Object.keys(importsKit), ...Object.keys(imports)] as MessageKey[];

/** قيمٌ لكلّ ما قد تسأل عنه رسالة — نصوصاً وأعداداً. */
const PARAMS = {
  rows: "3، 5",
  noun: "student",
  list: "«أ»، «ب»",
  role: "student",
  name: "يوسف حمادي",
  id: "registration",
  year: "2026/2027",
  what: "students",
  count: 3,
  max: 1000,
  length: 12,
  usual: 12,
  odd: "#",
  value: "س",
  hint: "",
  column: "الاسم",
  example: "Youcef",
  error: "#N/A",
  sheet: "الطلبة",
  letters: "C",
  fix: "gmail.com",
  domain: "gmial.com",
  email: "a@b.dz",
  reg: "202131012345",
  spec: "علم النفس",
  file: "قديم",
  platform: "جديد",
  part: "كلية",
  faculty: "كلية العلوم",
  actual: "قسم آخر",
  parent: "قسم",
  department: "قسم التاريخ",
  filiere: "شعبة",
  level: "Master",
  columns: "«الكلية»",
  ranks: "أستاذ محاضر أ",
  status: "منشور",
  options: "«منشور»",
  text: "مرجع",
  url: "https://x",
  min: 1,
  professor: "قسم",
  seat: "الطالب 2",
  project: "مذكرة",
  request: "طلب",
  topicSpec: "تخصص",
};

describe("فهرس الاستيراد", () => {
  it.each(LANGS)("كلّ رسالةٍ بالـ%s تامّة: لا قيمة ناقصة، ولا «undefined»", (lang) => {
    for (const key of KEYS) {
      const text = tr(key, PARAMS, lang);
      expect([key, text.includes("{{") || /\bundefined\b|NaN/.test(text)]).toEqual([key, false]);
      expect([key, text.trim().length > 0]).toEqual([key, true]);
    }
  });

  it("وما يتبدّل بالقيمة يتبدّل في كلّ لغة: الأستاذ والطالب، والمسؤول، والرقم، والمواضيع", () => {
    const say = (key: MessageKey, p: Record<string, string | number>) =>
      LANGS.map((lang) => tr(key, { ...PARAMS, ...p }, lang));

    expect(say("imp.person.sameInFile", { noun: "professor" })).toEqual([
      expect.stringContaining("أستاذان"),
      expect.stringContaining("two professors"),
      expect.stringContaining("deux enseignants"),
    ]);
    expect(say("imp.person.namesake", { noun: "professor" })).toEqual([
      expect.stringContaining("أستاذٌ"),
      expect.stringContaining("a professor"),
      expect.stringContaining("un enseignant"),
    ]);
    expect(say("imp.email.taken", { role: "admin" })).toEqual([
      expect.stringContaining("مسؤول"),
      expect.stringContaining("administrator"),
      expect.stringContaining("administrateur"),
    ]);
    expect(say("imp.email.taken", { role: "professor" })[1]).toContain("professor account");
    expect(say("imp.email.taken", { role: "registrar" })).toEqual([
      expect.stringContaining("registrar"),
      expect.stringContaining("registrar"),
      expect.stringContaining("registrar"),
    ]);
    expect(say("imp.password.sameAsId", { id: "employee" })).toEqual([
      expect.stringContaining("الرقم الوظيفي"),
      expect.stringContaining("employee number"),
      expect.stringContaining("matricule employé"),
    ]);
    for (const key of ["imp.year.activeArchived", "imp.year.archived"] as const)
      expect(say(key, { what: "topics" })).toEqual([
        expect.stringContaining("مواضيع"),
        expect.stringContaining("no topics"),
        expect.stringContaining("de sujets"),
      ]);
    expect(say("imp.reg.taken", { name: "" })).toEqual([
      expect.stringContaining("طالب"),
      expect.stringContaining("a student"),
      expect.stringContaining("un étudiant"),
    ]);
    expect(say("imp.file.tooManyRows", { noun: "topic", count: 1001 })[1]).toContain("1001 topics");
    expect(say("imp.file.empty", { noun: "professor" })[2]).toContain("aucun enseignant");
  });
});
