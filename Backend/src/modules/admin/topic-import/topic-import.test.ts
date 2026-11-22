import { professorLabels, type TopicKey } from "./columns";
import {
  buildContext,
  checkRow,
  matchProfessor,
  parseReference,
  professorsOf,
  splitItems,
  withExisting,
  type ExistingTopic,
  type Reference,
} from "./checks";
import type { RawRow } from "../import-kit/parser";
import { required } from "../import-kit/report";
import { tr } from "../../../core/i18n";

const prof = (
  id: string,
  latin: [string, string] | null,
  arabic: [string, string] | null,
  email: string,
  employeeNumber = "0000000000000",
) => ({
  id,
  universityEmail: email,
  employeeNumber,
  departmentId: "d1",
  department: { name: "قسم العلوم الاجتماعية" },
  user: {
    firstNameLatin: latin?.[0] ?? null,
    lastNameLatin: latin?.[1] ?? null,
    firstName: arabic?.[0] ?? null,
    lastName: arabic?.[1] ?? null,
    status: "active",
  },
});

describe("splitItems — بندٌ في كلّ سطر", () => {
  it("splits on line breaks and semicolons, without bullets or numbers", () => {
    expect(splitItems("- قياس المستوى\n• تحديد العلاقة\n3) المقارنة")).toEqual([
      "قياس المستوى",
      "تحديد العلاقة",
      "المقارنة",
    ]);
    expect(splitItems("1. SPSS؛ ٢. الإحصاء; R")).toEqual(["SPSS", "الإحصاء", "R"]);
  });

  it("keeps commas inside an item, and drops blanks and repeats", () => {
    expect(splitItems("الأولى، والثانية\n\nالأولى، والثانية")).toEqual(["الأولى، والثانية"]);
  });
});

describe("parseReference — عنوانٌ ورابط", () => {
  it("title before the link, whatever the separator", () => {
    expect(parseReference("مقال مرجعي: https://example.org/paper.")).toEqual({
      title: "مقال مرجعي",
      url: "https://example.org/paper",
    });
    expect(parseReference("Guide — https://a.dz/x")).toEqual({ title: "Guide", url: "https://a.dz/x" });
  });

  it("a bare link is named after its site", () => {
    expect(parseReference("https://www.example.org/a")).toEqual({ title: "example.org", url: "https://www.example.org/a" });
  });

  it("keeps a parenthesis the link opened, drops one it did not", () => {
    expect(parseReference("https://en.wikipedia.org/wiki/X_(Y)")).toMatchObject({
      url: "https://en.wikipedia.org/wiki/X_(Y)",
    });
    expect(parseReference("(انظر https://a.dz/x)")).toMatchObject({ url: "https://a.dz/x" });
  });

  it("no link, or no scheme, is a problem said in words", () => {
    expect(parseReference("كتاب علم النفس")).toHaveProperty("problem");
    expect((parseReference("www.example.org") as { problem: string }).problem).toContain("https://");
  });
});

describe("professorLabels — اسمٌ يدلّ على أستاذٍ واحد", () => {
  it("surname first in Latin, Arabic when there is no Latin, and the e-mail on a clash", () => {
    const labels = [
      ...professorLabels([
        prof("1", ["Youcef", "HAMADI"], null, "y.hamadi@univ.dz"),
        prof("2", ["Youcef", "HAMADI"], null, "y.hamadi2@univ.dz"),
        prof("3", null, ["سعاد", "بلعربي"], "s.b@univ.dz"),
      ]).keys(),
    ];
    expect(labels).toEqual([
      "HAMADI Youcef — y.hamadi@univ.dz",
      "HAMADI Youcef — y.hamadi2@univ.dz",
      "بلعربي سعاد",
    ]);
  });
});

describe("matchProfessor — من القائمة، أو بالبريد، أو بالرقم، أو بالاسم", () => {
  const ref = {
    specs: [],
    years: [],
    faculties: [],
    departments: [],
    filieres: [],
    professors: [
      prof("1", ["Youcef", "HAMADI"], ["يوسف", "حمادي"], "y.hamadi@univ.dz", "1234567890123"),
      prof("2", ["Souad", "BELARBI"], null, "s.belarbi@univ.dz"),
      prof("3", ["Souad", "BELARBI"], null, "s.belarbi2@univ.dz"),
    ],
  } as unknown as Reference;
  const ctx = buildContext(ref, []);
  const who = (v: string) => {
    const m = matchProfessor(ctx, v);
    return "professor" in m ? `${m.professor.id}:${m.how}` : "problem";
  };

  it("finds the professor every way the admin may write them", () => {
    expect(who("HAMADI Youcef")).toBe("1:label");
    expect(who("Y.Hamadi@UNIV.dz")).toBe("1:email");
    expect(who("1234 5678 90123")).toBe("1:number");
    expect(who("Youcef Hamadi")).toBe("1:name");
    expect(who("يوسف حمادي")).toBe("1:name");
    expect(who("BELARBI Souad — s.belarbi2@univ.dz")).toBe("3:label");
  });

  it("a name shared by two is not guessed", () => {
    const m = matchProfessor(ctx, "Souad Belarbi");
    expect(m).toHaveProperty("problem");
    expect((m as { problem: string }).problem).toContain("s.belarbi2@univ.dz");
  });

  it("an unknown e-mail or number says so", () => {
    expect(who("x@univ.dz")).toBe("problem");
    expect(who("9999999999999")).toBe("problem");
  });
});

describe("the professor's notification — the count agrees with its number", () => {
  it.each([
    [1, "موضوعاً تحت إشرافك: «أ»"],
    [2, "موضوعين تحت إشرافك"],
    [3, "3 مواضيع تحت إشرافك"],
    [11, "11 موضوعاً تحت إشرافك"],
    [100, "100 موضوع تحت إشرافك"],
  ])("%i ⇒ %s", (count, text) => {
    expect(tr("notif.topicsImported.message", { count, title: "أ" }, "ar")).toContain(text);
  });

  it("and in English and French", () => {
    expect(tr("notif.topicsImported.message", { count: 3, title: "A" }, "en")).toContain("3 topics");
    expect(tr("notif.topicsImported.message", { count: 3, title: "A" }, "fr")).toContain("3 sujets");
  });
});

//
// ═══ الحكم على صفٍّ كامل ═══
//

describe("parseReference — ما لا يُقبل رابطاً", () => {
  it("رابطٌ لا يُقرأ عنواناً، وأطول من الحدّ", () => {
    expect(parseReference("https://[::1/x")).toEqual({ problem: "«https://[::1/x» — رابطٌ غير صحيح." });
    expect((parseReference(`https://a.dz/${"x".repeat(2050)}`) as { problem: string }).problem).toBe(
      "رابطٌ أطول من 2048 حرف.",
    );
  });
});

describe("checkRow — خانةً خانة", () => {
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
  const professor = (id: string, email: string, over: { status?: string; departmentId?: string; dep?: string } = {}) => ({
    id,
    universityEmail: email,
    employeeNumber: `00000000000${id}`,
    departmentId: over.departmentId ?? "dep",
    department: { name: over.dep ?? "قسم العلوم الاجتماعية" },
    user: { firstName: null, lastName: null, firstNameLatin: "Prof", lastNameLatin: `P${id}`, status: over.status ?? "active" },
  });
  const ref = {
    specs: [spec],
    years: [{ id: "y1", title: "2026/2027", isActive: true, archivedAt: null }],
    faculties: [{ id: "fac", name: "كلية العلوم الاجتماعية" }],
    departments: [{ id: "dep", name: "قسم العلوم الاجتماعية", facultyId: "fac" }],
    filieres: [{ id: "fil", name: "شعبة علم النفس", departmentId: "dep" }],
    professors: [
      professor("1", "p1@univ.dz"),
      professor("2", "p2@univ.dz", { status: "suspended" }),
      professor("3", "p3@univ.dz", { departmentId: "dep-other", dep: "قسم علوم الإعلام" }),
    ],
  } as unknown as Reference;

  const DESC = "وصفٌ كافٍ لموضوعٍ يُستورد من ملفّ Excel في الاختبار.";
  let rowNo = 1;
  /** صفٌّ سليم، إلا ما يُغيَّر. `null` يُسقط الخانة من الصفّ أصلاً. */
  const row = (over: Partial<Record<TopicKey, string | null>> = {}): RawRow<TopicKey> => {
    const values: Partial<Record<TopicKey, string | null>> = {
      professor: "p1@univ.dz",
      title: `موضوع ${rowNo}`,
      description: DESC,
      maxStudents: "3",
      specialization: "علم النفس العيادي",
      status: "قيد الانتظار",
      ...over,
    };
    const cells = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, { text: v!, raw: v! }]),
    );
    return { row: ++rowNo, hidden: false, cells };
  };
  const run = (rows: RawRow<TopicKey>[], existing: ExistingTopic[] = []) => {
    const base = buildContext(ref, rows);
    const ctx = withExisting(base, rows, professorsOf(base, rows), existing);
    return rows.map((r) => checkRow(r, ctx));
  };
  const said = (out: ReturnType<typeof run>[number], k: TopicKey) =>
    (out.report.cells[k].issues ?? []).map((i) => `${i.level}: ${i.message}`).join(" | ");

  it("صفٌّ سليم ⇒ جاهز", () => {
    const [out] = run([row()]);
    expect(out!.report.errors).toBe(0);
    expect(out!.ready).toMatchObject({ professorId: "1", maxStudents: 3, maxRequests: null, status: "pending" });
  });

  it("الأستاذ: غائب ⇒ إلزامي؛ موقوف ⇒ تنبيه؛ من قسمٍ غير قسم التخصص ⇒ يُقال", () => {
    const [none, suspended, other] = run([
      row({ professor: null }),
      row({ professor: "p2@univ.dz" }),
      row({ professor: "p3@univ.dz" }),
    ]);
    expect(said(none!, "professor")).toBe(`error: ${required()}`);
    expect(said(suspended!, "professor")).toContain("warning: حسابه موقوف");
    expect(suspended!.ready).toBeDefined();
    expect(said(other!, "specialization")).toContain("info: التخصص من «قسم العلوم الاجتماعية»، والأستاذ من «قسم علوم الإعلام»");
  });

  it("العنوان: غائب، وأطول من الحدّ، وعلى أسطرٍ تُجمع", () => {
    const [none, long, lines] = run([
      row({ title: null }),
      row({ title: "ع".repeat(192) }),
      row({ title: "عنوانٌ\nعلى سطرين" }),
    ]);
    expect(said(none!, "title")).toBe(`error: ${required()}`);
    expect(said(long!, "title")).toContain("error: أطول من 191 حرفاً (فيه 192)");
    expect(said(lines!, "title")).toContain("info: جُمعت أسطره في سطرٍ واحد.");
    expect(lines!.report.cells.title.saved).toBe("عنوانٌ على سطرين");
  });

  /** العنوان نفسه لأستاذين في الملف تنبيهٌ لا منع: قد يكونان موضوعين مختلفين. */
  it("والعنوان نفسه لأستاذٍ آخر في الملف ⇒ تنبيهٌ يسمّي الصفّ", () => {
    const [a, b] = run([row({ title: "العنوان المشترك" }), row({ title: "العنوان المشترك", professor: "p3@univ.dz" })]);
    expect(said(a!, "title")).toContain(`warning: العنوان نفسه لأستاذٍ آخر في الملف — في الصفّ ${b!.report.row}`);
    expect(a!.ready).toBeDefined();
  });

  it("الوصف: غائب، وأطول من الحدّ، وقصيرٌ جداً ⇒ تنبيه", () => {
    const [none, long, short] = run([
      row({ description: null }),
      row({ description: "و".repeat(5001) }),
      row({ description: "قصير" }),
    ]);
    expect(said(none!, "description")).toBe(`error: ${required()}`);
    expect(said(long!, "description")).toContain("error: أطول من 5000 حرف (فيه 5001)");
    expect(said(short!, "description")).toContain("warning: وصفٌ قصيرٌ جداً");
    expect(short!.ready).toBeDefined();
  });

  it("الأهداف والمتطلّبات: كثيرةٌ جداً، وبندٌ أطول من الحدّ، وبندٌ واحدٌ طويل ⇒ تنبيه", () => {
    const [many, long, one] = run([
      row({ objectives: Array.from({ length: 51 }, (_, i) => `هدف ${i}`).join("\n") }),
      row({ requirements: "م".repeat(501) }),
      row({ objectives: "ه".repeat(151) }),
    ]);
    expect(said(many!, "objectives")).toContain("error: 51 بنداً، والحدّ 50.");
    expect(said(long!, "requirements")).toContain("error: بندٌ أطول من 500 حرف");
    expect(said(one!, "objectives")).toContain("warning: بندٌ واحدٌ طويل");
    expect(one!.ready!.objectives).toHaveLength(1);
  });

  /** خانة قائمةٍ فيها خطأ Excel: خطؤها وحده، ولا يُبنى عليها بند. */
  it("وقائمةٌ في خانتها خطأ Excel ⇒ لا بنود منها", () => {
    const r = row();
    r.cells.objectives = { text: "#VALUE!", raw: "#VALUE!", excelError: "#VALUE!" };
    const [out] = run([r]);
    expect(said(out!, "objectives")).toContain("خطأ Excel");
    expect(out!.ready).toBeUndefined();
  });

  it("المراجع: المكرّر يُحفظ مرّة، والرابط عنواناً لنفسه يُحفظ وحده", () => {
    const [dup, self] = run([
      row({ references: "مقال — https://a.dz/x\nمقالٌ آخر https://a.dz/x" }),
      row({ references: "https://b.dz/y https://b.dz/y" }),
    ]);
    expect(dup!.ready!.references).toEqual([{ title: "مقال", url: "https://a.dz/x" }]);
    expect(self!.report.cells.references.saved).toBe("https://b.dz/y");
  });

  it("والمراجع: أكثر من ثلاث مشكلات تُعدّ ولا تُسرد، وأكثر من الحدّ ⇒ خطأ", () => {
    const [bad, many] = run([
      row({ references: "كتاب أ\nكتاب ب\nكتاب ج\nكتاب د" }),
      row({ references: Array.from({ length: 21 }, (_, i) => `https://a.dz/${i}`).join("\n") }),
    ]);
    expect(said(bad!, "references")).toContain("(و1 غيرها)");
    expect(said(many!, "references")).toContain("error: 21 مرجعاً، والحدّ 20.");
  });

  it("عدد الطلبة: غائب ⇒ إلزامي؛ ليس عدداً ⇒ يُقال؛ وسقف الطلبات كذلك", () => {
    const [none, words, cap] = run([
      row({ maxStudents: null }),
      row({ maxStudents: "ثلاثة" }),
      row({ maxRequests: "بلا" }),
    ]);
    expect(said(none!, "maxStudents")).toBe(`error: ${required()}`);
    expect(said(words!, "maxStudents")).toContain("error: عددٌ صحيح من 1 إلى 10 — فيه «ثلاثة».");
    expect(said(cap!, "maxRequests")).toContain("error: عددٌ صحيح من 1 إلى 50 — فيه «بلا».");
  });

  /** في المنصّة مسبقاً: الحيّ للأستاذ نفسه في السنة نفسها يمنع؛ والباقي يُقال ولا يمنع. */
  it("موضوعاتٌ في المنصّة بالعنوان نفسه: المرفوض، ولغيره، ومن سنةٍ أخرى", () => {
    const existing = (over: Partial<ExistingTopic>): ExistingTopic => ({
      title: "عنوانٌ قديم",
      status: "rejected",
      professorId: "1",
      academicYearId: "y1",
      professorName: "P1 Prof",
      yearTitle: "2026/2027",
      ...over,
    });
    const [rejected, theirs, before, live] = [
      run([row({ title: "عنوانٌ قديم" })], [existing({})]),
      run([row({ title: "عنوانٌ قديم" })], [existing({ status: "open", professorId: "3", professorName: "P3 Prof" })]),
      run([row({ title: "عنوانٌ قديم" })], [existing({ status: "full", academicYearId: "y0", yearTitle: "2025/2026" })]),
      run([row({ title: "عنوانٌ قديم" })], [existing({ status: "archived" })]),
    ].map((outs) => outs[0]!);

    expect(said(rejected, "title")).toContain("warning: رُفض موضوعٌ بهذا العنوان للأستاذ نفسه");
    expect(rejected.ready).toBeDefined();
    expect(said(theirs, "title")).toContain("warning: العنوان نفسه في المنصّة لـ«P3 Prof» في هذه السنة.");
    expect(said(before, "title")).toContain("info: اقترحه الأستاذ نفسه في «2025/2026».");
    expect(said(live, "title")).toContain("error: موجودٌ في المنصّة مسبقاً للأستاذ نفسه في هذه السنة (مؤرشف)");
  });
  it("الأستاذ برقمه الوظيفي، وسقف الطلبات عدداً، والحالة: غائبةٌ أو ليست حالة", () => {
    const [byNumber, missing, wrong] = run([
      row({ professor: "000000000001", maxRequests: "5" }),
      row({ status: null }),
      row({ status: "محذوف" }),
    ]);
    expect(said(byNumber!, "professor")).toContain("info: عُرف برقمه الوظيفي.");
    expect(byNumber!.ready).toMatchObject({ professorId: "1", maxRequests: 5 });
    expect(said(missing!, "status")).toContain("error: إلزامية — الخانة فارغة.");
    expect(said(wrong!, "status")).toContain("error: «محذوف» ليست حالة");
  });
  it("الأستاذ: مجهولٌ ⇒ خطأ، وباسمه ⇒ يُعرف؛ وعدد الطلبة خارج الحدّ ⇒ يُقال", () => {
    const [unknown, byName, over] = run([
      row({ professor: "nobody@univ.dz" }),
      row({ professor: "Prof P1" }),
      row({ maxStudents: "11" }),
    ]);
    expect(unknown!.report.cells.professor.state).toBe("error");
    expect(unknown!.ready).toBeUndefined();
    expect(byName!.ready).toMatchObject({ professorId: "1" });
    expect(said(over!, "maxStudents")).toBe("error: من 1 إلى 10 — فيه 11.");
  });

  /** للأستاذ نفسه مرّتين خطأ، فلا يُقال فوقه «لأستاذٍ آخر». */
  it("العنوان نفسه للأستاذ نفسه مرّتين في الملف ⇒ خطأٌ يسمّي الصفّ الآخر", () => {
    const [a, b] = run([row({ title: "عنوانٌ مكرّر" }), row({ title: "عنوانٌ مكرّر" })]);
    expect(said(a!, "title")).toBe(`error: مكرّرٌ للأستاذ نفسه في الملف — في الصفّ ${b!.report.row} أيضاً.`);
    expect(a!.ready).toBeUndefined();
  });

  it("قائمةٌ من عدّة بنود ⇒ تُرقَّم؛ ومرجعٌ واحدٌ معطوب ⇒ يُسمّى بلا عدّ", () => {
    const [list, broken] = run([row({ objectives: "هدفٌ أوّل؛ هدفٌ ثانٍ" }), row({ references: "كتابٌ بلا رابط" })]);
    expect(list!.report.cells.objectives.saved).toBe("1. هدفٌ أوّل\n2. هدفٌ ثانٍ");
    expect(list!.ready!.objectives).toEqual(["هدفٌ أوّل", "هدفٌ ثانٍ"]);
    expect(broken!.report.cells.references.state).toBe("error");
    expect(said(broken!, "references")).not.toContain("غيرها");
  });

  /** خانةٌ فيها خطأ Excel لا يُحكم عليها بشيءٍ آخر — لا «إلزامي» ولا «ليس عدداً». */
  it("خطأ Excel في كلّ خانة ⇒ خطؤها وحده", () => {
    const keys = ["professor", "title", "description", "maxStudents", "maxRequests", "status"] as const;
    const r = row();
    for (const k of keys) r.cells[k] = { text: "#N/A", raw: "#N/A", excelError: "#N/A" };
    const [out] = run([r]);
    for (const k of keys) {
      expect(out!.report.cells[k].issues).toHaveLength(1);
      expect(said(out!, k)).toContain("خطأ Excel");
    }
    expect(out!.ready).toBeUndefined();
  });
});
