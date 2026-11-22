/**
 * الحقول الشخصية المشتركة بين استيراد الطلبة والأساتذة — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI تمرّ بالصفّ السليم وأشهر الأخطاء. وهنا كلّ خانةٍ بما يُقال
 * فيها: الاسم العربيّ برموزٍ أو بحروفٍ لاتينية، واللاتينيّ طويلاً أو بفواصل
 * لا تصحّ، والتكرار في الملف، والتوثيق، والبريد والهاتف بصيغهما، وكلمة المرور.
 */
import type { ImportColumn } from "./columns";
import { checkPerson, personContext } from "./fields";
import type { RawRow } from "./parser";
import { required, RowCheck } from "./report";

type Key =
  | "firstName"
  | "lastName"
  | "firstNameLatin"
  | "lastNameLatin"
  | "gender"
  | "verified"
  | "email"
  | "phone"
  | "password";
const KEYS: Key[] = ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "verified", "email", "phone", "password"];
const columns = KEYS.map((key) => ({ key, header: key, kind: "opt", width: 10, note: "", group: "personal" })) as ImportColumn<Key>[];

const REG = "202039000001";
let rowNo = 1;
/** صفٌّ باسمٍ لاتينيٍّ سليمٍ لا يتكرّر، إلا ما يُغيَّر. `null` يُسقط الخانة. */
const row = (over: Partial<Record<Key, string | null>> = {}): RawRow<Key> => {
  const values: Partial<Record<Key, string | null>> = {
    firstNameLatin: "Youcef",
    lastNameLatin: `HAMADI${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[rowNo % 26]}`,
    ...over,
  };
  const cells = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, { text: v!.trim(), raw: v! }]),
  );
  return { row: ++rowNo, hidden: false, cells };
};
const excelError = (raw: RawRow<Key>, k: Key) => {
  raw.cells[k] = { text: "", raw: "", excelError: "#N/A" };
  return raw;
};

const run = (
  rows: RawRow<Key>[],
  takenMails = new Map<string, { role: string; name: string }>(),
  /** null: بلا معرّف (أستاذٌ بلا رقمٍ وظيفيّ في الملف). */
  identifier: { value: string; kind: "registration" | "employee" } | null = { value: REG, kind: "registration" },
) => {
  const ctx = { ...personContext(rows), takenMails };
  return rows.map((raw) => {
    const r = new RowCheck(raw, columns);
    const person = checkPerson(r, ctx, {
      headers: { firstNameLatin: "الاسم باللاتينية", lastNameLatin: "اللقب باللاتينية" },
      namesakes: () => [],
      noun: "student",
      identifier: identifier ?? undefined,
    });
    return { r, person };
  });
};
const said = (out: { r: RowCheck<Key> }, k: Key) =>
  (out.r.cells[k].issues ?? []).map((i) => `${i.level}: ${i.message}`).join(" | ");

describe("checkPerson — الاسم واللقب بالعربية (اختياريّان)", () => {
  it("برموزٍ لا تكون في الأسماء، وأطول من الحدّ ⇒ خطأ", () => {
    const [odd, long] = run([row({ firstName: "يوسف#" }), row({ lastName: "ح".repeat(61) })]);
    expect(said(odd!, "firstName")).toBe("error: فيه رموزٌ لا تكون في الأسماء: «#».");
    expect(said(long!, "lastName")).toBe("error: 61 حرفاً، والحدّ 60 — لعلّه أكثر من اسم؟");
  });

  it("بحروفٍ لاتينية ⇒ يُنبَّه إلى عمودها، والخليط يُقال، ويُحفظان كما هما", () => {
    const [latin, mixed] = run([
      row({ firstName: "Youcef", lastName: "حمادي" }),
      row({ firstName: "يوسف", lastName: "حمادي HAMADI" }),
    ]);
    expect(said(latin!, "firstName")).toBe("warning: مكتوبٌ بحروفٍ لاتينية — مكانه عمود «الاسم باللاتينية»؟ يُحفظ كما هو.");
    expect(said(mixed!, "lastName")).toBe("warning: خليطٌ من حروفٍ عربية ولاتينية.");
    expect(latin!.person).toMatchObject({ firstName: "Youcef", lastName: "حمادي" });
  });

  it("أحدهما دون الآخر ⇒ نصف اسم، يُنبَّه عليه", () => {
    const [onlyFirst, onlyLast] = run([row({ firstName: "يوسف" }), row({ lastName: "حمادي" })]);
    expect(said(onlyFirst!, "lastName")).toBe("warning: فارغ، و«الاسم» مملوء.");
    expect(said(onlyLast!, "firstName")).toBe("warning: فارغ، و«اللقب» مملوء.");
  });
});

describe("checkPerson — الاسم واللقب باللاتينية (إلزاميّان)", () => {
  it("غائب ⇒ إلزامي؛ وفيه خطأ Excel ⇒ خطؤه وحده", () => {
    const [none, blocked] = run([row({ firstNameLatin: null }), excelError(row(), "lastNameLatin")]);
    expect(said(none!, "firstNameLatin")).toBe(`error: ${required()}`);
    expect(blocked!.r.cells.lastNameLatin.issues).toHaveLength(1);
    expect(blocked!.person.lastNameLatin).toBeUndefined();
  });

  it("أطول من الحدّ، وبفواصل لا تصحّ ⇒ خطأ يقول المثال", () => {
    const [long, dashes] = run([row({ lastNameLatin: "H".repeat(61) }), row({ firstNameLatin: "Nour--Houda" })]);
    expect(said(long!, "lastNameLatin")).toBe("error: 61 حرفاً، والحدّ 60.");
    expect(said(dashes!, "firstNameLatin")).toBe("error: حروفٌ لاتينية فقط، مثل Youcef.");
  });

  it("اللقب هو الاسم ⇒ يُنبَّه؛ والاسم واللقب نفسهما في صفٍّ آخر ⇒ يُسأل: اثنان أم تكرار؟", () => {
    const [same] = run([row({ firstNameLatin: "Amine", lastNameLatin: "AMINE" })]);
    expect(said(same!, "lastNameLatin")).toBe("warning: مطابقٌ للاسم — تأكّد منهما.");

    const [a, b] = run([row({ lastNameLatin: "BENALI" }), row({ lastNameLatin: "Benali" })]);
    expect(said(a!, "firstNameLatin")).toBe(`warning: الاسم واللقب نفسهما في الصفّ ${b!.r.raw.row} — طالبان أم تكرار؟`);
  });
});

describe("checkPerson — التوثيق والبريد والهاتف", () => {
  it("التوثيق: قيمةٌ لا تُعرف ⇒ خطأ؛ وخطأ Excel ⇒ لا يُعدّ موثّقاً", () => {
    const [odd, blocked] = run([row({ verified: "ربما" }), excelError(row(), "verified")]);
    expect(said(odd!, "verified")).toBe("error: «ربما» ليست قيمةً — «موثّق» أو «غير موثّق».");
    expect(blocked!.r.cells.verified.issues).toHaveLength(1);
    expect(blocked!.person.isVerified).toBe(false);
  });

  it("البريد: مسافة، وحروفٌ غير لاتينية، وبلا «@» ⇒ كلٌّ بسببه", () => {
    const [space, arabic, noAt] = run([
      row({ email: "y hamadi@gmail.com" }),
      row({ email: "يوسف@gmail.com" }),
      row({ email: "hamadi" }),
    ]);
    expect(said(space!, "email")).toBe("error: فيه مسافة.");
    expect(said(arabic!, "email")).toBe("error: فيه حروفٌ لا تكون في البريد: «ي و س ف».");
    expect(said(noAt!, "email")).toBe("error: صيغة بريدٍ غير صحيحة، مثل name@example.com.");
    expect(noAt!.person.email).toBeUndefined();
  });

  /** مستعمَلٌ لحسابٍ في المنصّة: يُسمّى نوعه وصاحبه — أو نوعه كما هو و«—» إن جُهلا. */
  it("البريد مستعمَلٌ في المنصّة ⇒ يُسمّى الحساب وصاحبه", () => {
    const taken = new Map([
      ["y.hamadi@gmail.com", { role: "professor", name: "يوسف حمادي" }],
      ["old@gmail.com", { role: "guest", name: "" }],
    ]);
    const [prof, unknown] = run([row({ email: "Y.Hamadi@gmail.com" }), row({ email: "old@gmail.com" })], taken);
    expect(said(prof!, "email")).toBe("error: مستعمَلٌ في المنصّة لحساب أستاذ: يوسف حمادي.");
    expect(said(unknown!, "email")).toBe("error: مستعمَلٌ في المنصّة لحساب guest: —.");
  });

  it("الهاتف: حروف ⇒ خطأ؛ «00» الدوليّ يُحذف؛ وطولٌ لا يُقبل ⇒ خطأ", () => {
    const [letters, intl, short] = run([
      row({ phone: "06 61 ab 45" }),
      row({ phone: "00213661234567" }),
      row({ phone: "0661" }),
    ]);
    expect(said(letters!, "phone")).toBe("error: أرقامٌ فقط — فيه «a b».");
    expect(said(intl!, "phone")).toBe("info: حُذف «00» الدوليّ من أوّله.");
    expect(intl!.person.phone).toBe("213661234567");
    expect(said(short!, "phone")).toBe("error: فيه 4 أرقام، والمقبول من 9 إلى 13.");
  });

  it("والهاتف بغير صيغةٍ جزائرية ⇒ يُنبَّه ويُحفظ؛ والرقم نفسه في صفٍّ آخر ⇒ يُقال", () => {
    const [foreign, a, b] = run([row({ phone: "0123456789" }), row({ phone: "0661234567" }), row({ phone: "0661 23 45 67" })]);
    expect(said(foreign!, "phone")).toContain("warning: ليس بصيغة رقمٍ جزائري مألوفة");
    expect(foreign!.person.phone).toBe("0123456789");
    expect(said(a!, "phone")).toBe(`warning: الرقم نفسه في الصفّ ${b!.r.raw.row}.`);
  });
});

describe("checkPerson — كلمة المرور", () => {
  it("فيها خطأ Excel ⇒ لا تُولَّد ولا تُقرأ", () => {
    const [out] = run([excelError(row(), "password")]);
    expect(out!.r.cells.password.issues).toHaveLength(1);
    expect(out!.person.password).toBeUndefined();
  });

  it("مسافةٌ في طرفيها تُحذف ويُقال؛ وأقصر من 8 ⇒ خطأ", () => {
    const [spaced, short] = run([row({ password: " Tassili#2026 " }), row({ password: "abc" })]);
    expect(said(spaced!, "password")).toContain("warning: في طرفيها مسافةٌ حُذفت — كلمة المرور بدونها.");
    expect(spaced!.person.password).toBe("Tassili#2026");
    expect(said(short!, "password")).toContain("error: من 8 إلى 72 حرفاً — أو اتركها فارغة ليولّدها النظام.");
  });

  it("مطابقةٌ للمعرّف، أو أرقامٌ فقط ⇒ سهلة التخمين؛ وبلا معرّفٍ تُقاس بالضعف وحده", () => {
    const [id, digits] = run([row({ password: REG }), row({ password: "12345678" })]);
    expect(said(id!, "password")).toContain("warning: مطابقةٌ لـرقم التسجيل — سهلة التخمين.");
    expect(said(digits!, "password")).toContain("warning: ضعيفة: أرقامٌ فقط أو حرفٌ واحدٌ مكرّر.");

    const [noId] = run([row({ password: REG })], undefined, null);
    expect(said(noId!, "password")).toContain("warning: ضعيفة");
  });
});
