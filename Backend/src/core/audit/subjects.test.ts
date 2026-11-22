/**
 * ما وقع عليه التغيير — بلا قاعدة بيانات.
 *
 * لكلّ نوعٍ قارئ يأخذ العنصر كما يصفه إنسان: اسمه، وحقوله، وما يشير إليه
 * بأسمائه لا بمعرّفاته. وقراءتان — قبل وبعد — تعطيان ما تغيّر حقلاً حقلاً.
 * ولا يدخل ما لا يُقرأ: لا كلمة مرور، ولا سرّ التحقّق، ولا رمز.
 */
const model = () => ({ findUnique: jest.fn() });
jest.mock("../prisma/client", () => ({
  prisma: {
    user: model(),
    student: model(),
    professor: model(),
    faculty: model(),
    department: model(),
    domain: model(),
    filiere: model(),
    specialization: model(),
    academicYear: model(),
    graduationTopic: model(),
    topicType: model(),
    groupRequest: model(),
    projectGroup: model(),
    milestone: model(),
    defense: model(),
    homeSlide: model(),
    newsItem: model(),
    universityDomain: model(),
    supervisionDocument: model(),
    siteContent: model(),
  },
}));

import { prisma } from "../prisma/client";
import { changesOf, countsOf, createdId, filled, isSubject, nameOf, readSubject, refsOf } from "./subjects";

const db = prisma as unknown as Record<string, { findUnique: jest.Mock }>;
const found = (m: string, row: unknown) => db[m]!.findUnique.mockResolvedValueOnce(row);

const account = {
  firstName: "أسامة",
  lastName: "بن علي",
  firstNameLatin: null,
  lastNameLatin: null,
  email: "o@univ.dz",
  username: null,
  phone: null,
  gender: "male",
  role: "student",
  status: "active",
  isVerified: false,
  mustChangePassword: true,
  avatarUrl: null,
  totpEnabledAt: null,
};
const accountFields = {
  firstName: "أسامة",
  lastName: "بن علي",
  firstNameLatin: null,
  lastNameLatin: null,
  email: "o@univ.dz",
  username: null,
  phone: null,
  gender: "male",
  role: "student",
  status: "active",
  isVerified: false,
  mustChangePassword: true,
  avatarUrl: null,
  twoFactor: false,
};
const person = (last: string, reg = `R-${last}`) => ({ registrationNumber: reg, user: { firstName: "ط", lastName: last } });
const prof = (last: string) => ({ user: { firstName: "أ", lastName: last } });

beforeEach(() => Object.values(db).forEach((m) => m.findUnique.mockReset()));

describe("names", () => {
  it("Arabic first, then Latin, then nothing", () => {
    expect(nameOf({ firstName: "أ", lastName: "ب" })).toBe("أ ب");
    expect(nameOf({ firstNameLatin: "Ali", lastNameLatin: null })).toBe("Ali");
    expect(nameOf({})).toBeNull();
    expect(nameOf(null)).toBeNull();
  });
});

describe("each kind, as a person would describe it", () => {
  it("an account: its name and what it is known by — the two-step secret only as on or off", async () => {
    found("user", { ...account, totpEnabledAt: new Date(), student: null, professor: null });
    expect(await readSubject("users", "u1")).toEqual({ label: "أسامة بن علي · o@univ.dz", fields: { ...accountFields, twoFactor: true } });

    found("user", { ...account, firstName: null, lastName: null, email: null, student: { registrationNumber: "2020" }, professor: null });
    expect((await readSubject("users", "u1"))?.label).toBe("2020");
    found("user", { ...account, firstName: null, lastName: null, email: null, student: null, professor: { universityEmail: "p@univ.dz" } });
    expect((await readSubject("users", "u1"))?.label).toBe("p@univ.dz");
    found("user", { ...account, firstName: null, lastName: null, email: null, username: "registrar", student: null, professor: null });
    expect((await readSubject("users", "u1"))?.label).toBe("registrar");
    found("user", null);
    expect(await readSubject("users", "gone")).toBeNull();
  });

  it("a student and a professor: the account, and what they belong to by name", async () => {
    found("student", { registrationNumber: "2020", user: account, specialization: { name: "علم اجتماع" }, academicYear: { title: "2025/2026" } });
    expect(await readSubject("students", "s1")).toEqual({
      label: "أسامة بن علي · 2020",
      fields: { ...accountFields, registrationNumber: "2020", specialization: "علم اجتماع", academicYear: "2025/2026" },
    });
    found("student", null);
    expect(await readSubject("students", "s1")).toBeNull();

    found("professor", { employeeNumber: "E1", universityEmail: "p@univ.dz", grade: null, tags: ["x"], user: { ...account, role: "professor" }, department: { name: "قسم" } });
    expect(await readSubject("professors", "p1")).toEqual({
      label: "أسامة بن علي · p@univ.dz",
      fields: { ...accountFields, role: "professor", employeeNumber: "E1", universityEmail: "p@univ.dz", department: "قسم", rank: null, tags: ["x"] },
    });
    found("professor", { employeeNumber: "E1", universityEmail: "p@univ.dz", grade: ["MCA"], tags: null, user: account, department: { name: "قسم" } });
    expect((await readSubject("professors", "p1"))?.fields).toMatchObject({ rank: ["MCA"], tags: null });
    found("professor", null);
    expect(await readSubject("professors", "p1")).toBeNull();
  });

  it("the academic structure, each level naming the one above", async () => {
    found("faculty", { name: "كلية", nameLatin: null, code: "F", coverUrl: null, iconUrl: null });
    expect(await readSubject("faculties", "x")).toEqual({
      label: "كلية",
      fields: { name: "كلية", nameLatin: null, code: "F", coverUrl: null, iconUrl: null },
    });
    found("department", { name: "قسم", nameLatin: "Département", code: "D", coverUrl: null, faculty: { name: "كلية" } });
    expect((await readSubject("departments", "x"))?.fields).toEqual({
      name: "قسم",
      nameLatin: "Département",
      code: "D",
      coverUrl: null,
      faculty: "كلية",
    });
    // A department's topic type: by its code and name, in its department.
    found("topicType", { name: "الذكاء الاصطناعي", code: "AI", color: "#dbeafe", sortOrder: 0, department: { name: "قسم" } });
    expect(await readSubject("topic-types", "x")).toEqual({
      label: "AI · الذكاء الاصطناعي",
      fields: { name: "الذكاء الاصطناعي", code: "AI", color: "#dbeafe", sortOrder: 0, department: "قسم" },
    });
    found("domain", { name: "ميدان", code: "M", coverUrl: null, department: { name: "قسم" } });
    expect((await readSubject("domains", "x"))?.fields).toEqual({ name: "ميدان", code: "M", coverUrl: null, department: "قسم" });
    found("filiere", { name: "شعبة", code: "S", coverUrl: null, department: { name: "قسم" }, domain: null });
    expect((await readSubject("filieres", "x"))?.fields).toEqual({ name: "شعبة", code: "S", coverUrl: null, department: "قسم", domain: null });
    found("filiere", { name: "شعبة", code: "S", coverUrl: null, department: { name: "قسم" }, domain: { name: "ميدان" } });
    expect((await readSubject("filieres", "x"))?.fields.domain).toBe("ميدان");
    found("specialization", { name: "تخصص", level: "master", coverUrl: null, filiere: { name: "شعبة" } });
    expect((await readSubject("specializations", "x"))?.fields).toEqual({ name: "تخصص", level: "master", coverUrl: null, filiere: "شعبة" });
    const year = {
      title: "2025/2026",
      isActive: true,
      archivedAt: null,
      proposalsOpenAt: null,
      proposalsCloseAt: null,
      selectionOpenAt: null,
      selectionCloseAt: null,
    };
    found("academicYear", year);
    expect(await readSubject("academic-years", "y")).toEqual({ label: "2025/2026", fields: year });
    // The archive closes and reopens years: it reads them.
    found("academicYear", year);
    expect((await readSubject("archive", "y"))?.label).toBe("2025/2026");
    for (const kind of ["faculties", "departments", "topic-types", "domains", "filieres", "specializations", "academic-years"]) {
      expect(await readSubject(kind, "gone")).toBeNull();
    }
  });

  it("a topic: its professor, specialization and year by name, and its students once assigned", async () => {
    const topic = {
      title: "موضوع",
      description: "وصف",
      status: "pending",
      maxStudents: 2,
      maxRequests: null,
      rejectionReason: null,
      publishedAt: null,
      requirements: null,
      objectives: ["هدف"],
      references: [],
      summary: null,
      professor: prof("المشرف"),
      coSupervisor: null,
      type: null,
      specialization: { name: "تخصص" },
      academicYear: { title: "2025/2026" },
    };
    found("graduationTopic", { ...topic, projectGroup: null });
    expect(await readSubject("topics", "t")).toEqual({
      label: "موضوع",
      fields: {
        title: "موضوع",
        description: "وصف",
        status: "pending",
        maxStudents: 2,
        maxRequests: null,
        rejectionReason: null,
        publishedAt: null,
        requirements: null,
        objectives: ["هدف"],
        references: [],
        summary: null,
        professor: "أ المشرف",
        coSupervisor: null,
        type: null,
        specialization: "تخصص",
        academicYear: "2025/2026",
        students: null,
      },
    });
    // Its co-supervisor by name, its type by code and name.
    found("graduationTopic", { ...topic, summary: "قصير", coSupervisor: prof("المساعد"), type: { code: "AI", name: "ذكاء" }, projectGroup: null });
    expect((await readSubject("topics", "t"))?.fields).toMatchObject({ summary: "قصير", coSupervisor: "أ المساعد", type: "AI · ذكاء" });
    found("graduationTopic", {
      ...topic,
      objectives: null,
      references: null,
      projectGroup: { members: [{ student: person("ياء") }, { student: { registrationNumber: "R9", user: {} } }, { student: person("ألف") }] },
    });
    // Names in a stable order; a student without a name by their number.
    expect((await readSubject("topics", "t"))?.fields).toMatchObject({ students: ["R9", "ط ألف", "ط ياء"], objectives: null, references: null });
    found("graduationTopic", null);
    expect(await readSubject("topics", "t")).toBeNull();
  });

  it("a group request, a project, a milestone, a defense", async () => {
    found("groupRequest", {
      status: "pending",
      priority: 1,
      rejectionReason: null,
      topic: { title: "موضوع" },
      leader: person("القائد"),
      members: [{ student: person("القائد") }, { student: person("عضو") }],
    });
    expect(await readSubject("group-requests", "r")).toEqual({
      label: "موضوع · ط القائد",
      fields: { topic: "موضوع", leader: "ط القائد", members: ["ط القائد", "ط عضو"], status: "pending", priority: 1, rejectionReason: null },
    });

    found("projectGroup", {
      topic: { title: "موضوع", professor: prof("المشرف") },
      members: [{ isLeader: false, student: person("ب") }, { isLeader: true, student: person("أ") }],
    });
    expect(await readSubject("projects", "g")).toEqual({
      label: "موضوع",
      fields: { topic: "موضوع", supervisor: "أ المشرف", members: ["ط أ", "ط ب"], leader: "ط أ" },
    });
    found("projectGroup", { topic: { title: "موضوع", professor: prof("المشرف") }, members: [] });
    expect((await readSubject("projects", "g"))?.fields.leader).toBeNull();

    const deadline = new Date("2026-12-01T00:00:00Z");
    found("milestone", { title: "الفصل الأول", description: null, deadline, status: "pending", order: 1, group: { topic: { title: "موضوع" } } });
    expect(await readSubject("milestones", "m")).toEqual({
      label: "الفصل الأول",
      fields: { title: "الفصل الأول", description: null, deadline, status: "pending", order: 1, project: "موضوع" },
    });

    const date = new Date("2026-06-15T09:00:00Z");
    found("defense", {
      date,
      durationMinutes: 60,
      room: "A1",
      grade: null,
      status: "scheduled",
      notes: null,
      group: { topic: { title: "موضوع" } },
      committee: [{ role: "president", professor: prof("الرئيس") }, { role: "examiner", professor: { user: {} } }],
    });
    expect(await readSubject("defenses", "d")).toEqual({
      label: "موضوع",
      fields: { date, durationMinutes: 60, room: "A1", grade: null, status: "scheduled", notes: null, project: "موضوع", committee: ["? (examiner)", "أ الرئيس (president)"] },
    });
    for (const kind of ["group-requests", "projects", "milestones", "defenses"]) expect(await readSubject(kind, "gone")).toBeNull();
  });

  it("the site: slides, news, mail domains — and a page kept as one document, a field per text", async () => {
    found("homeSlide", { placement: "home", imageUrl: "/uploads/a.webp", caption: "صورة", isActive: true, sortOrder: 0 });
    expect((await readSubject("home-slides", "s"))?.label).toBe("صورة");
    const date = new Date("2026-11-01T00:00:00Z");
    found("newsItem", { text: "خ".repeat(200), textFr: null, textEn: null, date, linkUrl: null, isActive: true });
    expect((await readSubject("news", "n"))?.label).toHaveLength(120);
    found("universityDomain", { domain: "univ-eloued.dz", isDefault: true });
    expect(await readSubject("university-domains", "u")).toEqual({ label: "univ-eloued.dz", fields: { domain: "univ-eloued.dz", isDefault: true } });
    for (const kind of ["home-slides", "news", "university-domains"]) expect(await readSubject(kind, "gone")).toBeNull();

    found("siteContent", { value: { ar: { fullName: "د. أ", paragraphs: ["p"], deep: { deeper: { deepest: 1 } } }, isVisible: true, photoUrl: null } });
    expect(await readSubject("director-message", "director-message")).toEqual({
      label: null,
      fields: { "ar.fullName": "د. أ", "ar.paragraphs": ["p"], "ar.deep.deeper": { deepest: 1 }, isVisible: true, photoUrl: null },
    });
    // Never saved yet: nothing to compare against.
    found("siteContent", null);
    expect(await readSubject("about-page", "about-page")).toEqual({ label: null, fields: {} });
  });

  it("a verification request, through its student's account — approved, it is gone and the account verified", async () => {
    found("user", { firstName: "ط", lastName: "أ", isVerified: false, student: { registrationNumber: "2020" }, activationRequest: { status: "pending", rejectionReason: null } });
    expect(await readSubject("activation", "u")).toEqual({
      label: "ط أ · 2020",
      fields: { request: "pending", rejectionReason: null, isVerified: false },
    });
    found("user", { firstName: "ط", lastName: "أ", isVerified: true, student: null, activationRequest: null });
    expect(await readSubject("activation", "u")).toEqual({ label: "ط أ", fields: { request: null, rejectionReason: null, isVerified: true } });
    found("user", null);
    expect(await readSubject("activation", "u")).toBeNull();
  });

  it("a supervision document: its number and topic", async () => {
    found("supervisionDocument", { documentNumber: "SD-1", status: "active", revokedAt: null, topic: { title: "موضوع" } });
    expect(await readSubject("supervision-documents", "d")).toEqual({
      label: "SD-1 · موضوع",
      fields: { documentNumber: "SD-1", status: "active", revokedAt: null, topic: "موضوع" },
    });
    found("supervisionDocument", null);
    expect(await readSubject("supervision-documents", "d")).toBeNull();
  });

  it("no such kind, or no id ⇒ nothing read", async () => {
    expect(isSubject("uploads")).toBe(false);
    expect(isSubject(null)).toBe(false);
    expect(await readSubject("uploads", "x")).toBeNull();
    expect(await readSubject("users", null)).toBeNull();
    expect(db.user!.findUnique).not.toHaveBeenCalled();
  });
});

describe("what changed, and what an answer says", () => {
  it("field by field, dates as moments, lists by their content", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(
      changesOf(
        { a: 1, b: "x", c: new Date(at), d: ["p", "q"], e: null, gone: true },
        { a: 1, b: "y", c: new Date(at), d: ["p"], e: undefined, added: 0 },
      ),
    ).toEqual([
      { field: "b", from: "x", to: "y" },
      { field: "d", from: ["p", "q"], to: ["p"] },
      { field: "gone", from: true, to: null },
      { field: "added", from: null, to: 0 },
    ]);
  });

  it("sixty changes at most", () => {
    const before = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    const after = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i + 1]));
    expect(changesOf(before, after)).toHaveLength(60);
  });

  it("what an item holds, without its empty fields — and nothing at all ⇒ nothing", () => {
    expect(filled({ a: 1, b: null, c: undefined, d: "", e: [], f: false, g: ["x"] })).toEqual({ a: 1, f: false, g: ["x"] });
    expect(filled({ a: null })).toBeUndefined();
  });

  it("the counts of an answer, never its text: numbers, yes/no, lists by length, three levels down, twelve at most", () => {
    expect(
      countsOf({
        message: "ok",
        ok: true,
        created: 3,
        accounts: [{ registrationNumber: "1", password: "secret" }],
        id: "x",
        groupId: "y",
        report: { summary: { valid: 3, invalid: 0, deeper: { lost: 1 } } },
      }),
    ).toEqual({ ok: true, created: 3, accounts: 1, "report.summary.valid": 3, "report.summary.invalid": 0 });
    expect(countsOf({ message: "Logged out" })).toBeUndefined();
    expect(countsOf(undefined)).toBeUndefined();
    expect(Object.keys(countsOf(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`n${i}`, i])))!)).toHaveLength(12);
  });

  it("a create's id: given, or the one item answered — never a guess between two", () => {
    expect(createdId({ id: "a" })).toBe("a");
    expect(createdId({ message: "Student created", student: { id: "s1", name: "x" } })).toBe("s1");
    expect(createdId({ a: { id: "1" }, b: { id: "2" } })).toBeNull();
    expect(createdId({ items: [{ id: "1" }] })).toBeNull();
    expect(createdId([{ id: "1" }])).toBeNull();
    expect(createdId(null)).toBeNull();
    expect(createdId("text")).toBeNull();
  });

  it("a route's other ids by name — by its id when it cannot be read", async () => {
    found("student", { registrationNumber: "2020", user: account, specialization: { name: "x" }, academicYear: { title: "y" } });
    found("projectGroup", null);
    db.graduationTopic!.findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await refsOf({ id: "r1", studentId: "s1", groupId: "g1", topicId: "t1", other: "z", userId: 5 })).toEqual({
      student: "أسامة بن علي · 2020",
      project: "g1",
      topic: "t1",
    });
    expect(await refsOf({ id: "r1" })).toBeUndefined();
    expect(await refsOf(undefined)).toBeUndefined();
  });
});
