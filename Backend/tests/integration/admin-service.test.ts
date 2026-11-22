/**
 * خدمة الإدارة مباشرةً — على قاعدة الاختبار، بلا HTTP.
 *
 * اختبارات الـAPI تمرّ بكلّ مسار بما يرسله المتصفّح فعلاً. وما يبقى خارجها
 * ثلاثة أصناف، وهذا الملف لها:
 *
 *   **مرشّحات القوائم كلّها** — كلّ خيارٍ وتركيبه، لا ما تطلبه الشاشة اليوم.
 *
 *   **الحرّاس التي تُكرّر المخطّط** — الخدمة لا تثق بأنّ مُناديها تحقّق: طلبٌ
 *   بلا أعضاء، أو قائدٌ من خارج المجموعة، أو عضوٌ مكرّر، تردّه هي أيضاً.
 *
 *   **ما لا يصنعه إلا الزمن أو التزامن** — بيانات قديمة (طلبٌ قائده ليس من
 *   أعضائه)، وموضوعٌ تغيّر بين الفحص والمعاملة (طلبان يُقبلان معاً).
 */
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import * as admin from "../../src/modules/admin/admin.service";
import * as v from "../../src/modules/admin/admin.validation";
import { seed, makeTopic, teardown, residue, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
const NOPE = "00000000-0000-0000-0000-000000000000";
const DOMAIN = "jest-svc.dz";
let n = 0;
const code = () => `${TAG}-AS${++n}`;
const PAST = new Date("2020-01-01");
const FUTURE = new Date("2999-01-01");

beforeAll(async () => {
  await teardown();
  f = await seed(30);
  await prisma.universityDomain.create({ data: { domain: DOMAIN } });
});

afterAll(async () => {
  await prisma.universityDomain.deleteMany({ where: { domain: { in: [DOMAIN, "jest-svc2.dz"] } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

type Student = Fixture["students"][number];

/** مشروعٌ قائمٌ على موضوعٍ مأخوذ، أوّل أعضائه قائده. */
async function project(title: string, members: Student[], status = "full") {
  const topic = await makeTopic(f, title, status);
  const group = await prisma.projectGroup.create({
    data: {
      topicId: topic.id,
      members: { create: members.map((s, i) => ({ studentId: s.id, isLeader: i === 0 })) },
    },
  });
  return { topic, group };
}

/** طلب فريقٍ على موضوع، بأعضائه كما هم — والقائد منهم ما لم يُذكر غير ذلك. */
async function request(topicId: string, leader: Student, members: Student[], status = "pending") {
  return prisma.groupRequest.create({
    data: {
      topicId,
      leaderStudentId: leader.id,
      status: status as never,
      members: { create: members.map((s) => ({ studentId: s.id })) },
    },
  });
}

//
// ═══ ما لا يوجد ═══
//

describe("غير موجود ⇒ 404", () => {
  const topic = (over: Record<string, string>) => ({
    title: `${TAG} موضوع`,
    description: "وصف",
    maxStudents: 2,
    professorId: f.professor.id,
    specializationId: f.specialization.id,
    academicYearId: f.academicYear.id,
    publish: false,
    ...over,
  });

  it.each<[string, () => Promise<unknown>]>([
    ["طالب", () => admin.getStudentByIdService(NOPE)],
    ["أستاذ", () => admin.getProfessorByIdService(NOPE)],
    ["حذف أستاذ", () => admin.deleteProfessorService(NOPE)],
    ["موضوع", () => admin.getTopicByIdService(NOPE)],
    ["نطاقٌ افتراضيّ", () => admin.setDefaultUniversityDomainService(NOPE)],
    ["شعبة", () => admin.updateFiliereService(NOPE, v.updateFiliereSchema.parse({}))],
    ["مراحل مشروع", () => admin.listGroupMilestonesService(NOPE, {})],
    ["قائد مشروع", () => admin.setProjectLeaderService(NOPE, NOPE)],
    ["إزالة عضو", () => admin.removeProjectMemberService(NOPE, NOPE)],
    ["فسخ مشروع", () => admin.dissolveProjectService(NOPE)],
    ["تغيير المشرف", () => admin.changeSupervisorService(NOPE, { professorId: NOPE })],
    ["إسناد طالب", () => admin.assignStudentService(NOPE, { studentId: NOPE })],
    ["تعديل مرحلة", () => admin.updateGroupMilestoneService(NOPE, { title: "x" })],
    ["عضو طلب", () => admin.removeGroupRequestMemberService(NOPE, NOPE)],
    ["قائد طلب", () => admin.setGroupRequestLeaderService(NOPE, NOPE)],
    ["رفض طلب", () => admin.rejectGroupRequestService(NOPE)],
    ["موضوعٌ لأستاذٍ غير موجود", () => admin.createTopicService(topic({ professorId: NOPE }))],
    ["موضوعٌ لتخصّصٍ غير موجود", () => admin.createTopicService(topic({ specializationId: NOPE }))],
    ["موضوعٌ لسنةٍ غير موجودة", () => admin.createTopicService(topic({ academicYearId: NOPE }))],
  ])("%s", async (_l, call) => {
    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
  });
});

//
// ═══ المستخدمون والمسؤولون ═══
//

describe("المستخدمون", () => {
  it("القائمة بكلّ مرشّحاتها معاً", async () => {
    const s = f.students[0]!;
    const res = await admin.listUsersService(
      v.listUsersSchema.parse({ role: "student", status: "active", search: TAG, email: "test.local", registrationNumber: s.reg }),
    );
    expect(res.items.map((u) => u.id)).toContain(s.userId);
    expect(res.items.every((u) => u.role === "student")).toBe(true);
  });

  /** بحثٌ من مسافاتٍ وحدها لا كلمة فيه: لا يُرشِّح بالاسم شيئاً (والمخطّط يقصّه قبل ذلك). */
  it("وبحثٌ من مسافاتٍ وحدها ⇒ لا مرشّح اسم", async () => {
    const all = await admin.listUsersService(v.listUsersSchema.parse({ limit: 1 }));
    const blank = await admin.listUsersService({ ...v.listUsersSchema.parse({ limit: 1 }), search: "   " });
    expect(blank.total).toBe(all.total);
  });

  it("مسؤولٌ موقوفٌ يُحذف — لا يمسّ ذلك من يبقى للإدارة", async () => {
    const suspended = await prisma.user.create({
      data: { email: `${TAG}.suspended-admin@test.local`, password: "x", role: "admin", status: "suspended" },
    });
    await expect(admin.deleteUserService(suspended.id, f.admin.id)).resolves.toEqual({ message: "User deleted" });
  });

  /** آخر مسؤولٍ نشط لا يُوقف — حتى لو أوقفه مسؤولٌ غيره. */
  it("وآخر مسؤولٍ نشط ⇒ لا يُوقف", async () => {
    const count = jest.spyOn(prisma.user, "count").mockResolvedValueOnce(0);
    try {
      await expect(admin.updateUserStatusService(f.admin2.id, { status: "suspended" }, f.admin.id)).rejects.toMatchObject({
        message: tr("user.lastAdmin"),
      });
    } finally {
      count.mockRestore();
    }
  });

  it("وكلمة مرور أستاذٍ تُعاد", async () => {
    await expect(admin.resetUserPasswordService(f.profUser.id, { password: "A-strong-Passw0rd!" })).resolves.toEqual({
      message: "Password reset",
    });
  });
});

//
// ═══ الطلبة والأساتذة ═══
//

describe("الطلبة", () => {
  it("قائمة من لم يُسنَد بعد، بالاسم والبحث السريع ورقم التسجيل", async () => {
    const s = f.nextStudents(1)[0]!;
    const res = await admin.listStudentsService(
      v.listStudentsSchema.parse({ unassigned: "true", search: TAG, quickSearch: s.reg, registrationNumber: s.reg }),
    );
    expect(res.items.map((x) => x.id)).toContain(s.id);
    expect(res.items.every((x) => x.registrationNumber.includes(s.reg))).toBe(true);

    // بحثٌ سريع من مسافاتٍ وحدها: لا كلمة لجزء الاسم، والمعرّفات تُطابَق كما كُتب — فلا شيء.
    const blank = await admin.listStudentsService({ ...v.listStudentsSchema.parse({ limit: 1 }), quickSearch: "   " });
    expect(blank.items).toEqual([]);
  });

  it("تعديل رقم التسجيل والتخصّص والسنة وحدها، ثمّ بريده وهاتفه وجنسه؛ والرقم المأخوذ ⇒ يُرفض", async () => {
    const [a, b] = f.nextStudents(2) as [Student, Student];
    const moved = await admin.updateStudentService(a.id, {
      registrationNumber: `${a.reg}-X`,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    });
    expect(moved.registrationNumber).toBe(`${a.reg}-X`);

    const contact = await admin.updateStudentService(a.id, { email: `${TAG}.moved@test.local`, phone: "0661234567", gender: "female" });
    expect(contact.user).toMatchObject({ email: `${TAG}.moved@test.local`, phone: "0661234567", gender: "female" });

    await expect(admin.updateStudentService(b.id, { registrationNumber: `${a.reg}-X` })).rejects.toMatchObject({
      message: tr("student.registrationTaken"),
    });
  });
});

describe("الأساتذة", () => {
  it("القائمة بلا مرشّح، وبكلّ مرشّح — والرتبة من مصفوفتها", async () => {
    expect((await admin.listProfessorsService(v.listProfessorsSchema.parse({}))).total).toBeGreaterThanOrEqual(2);

    const ids = async (q: Record<string, string>) =>
      (await admin.listProfessorsService(v.listProfessorsSchema.parse(q))).items.map((p) => p.id);
    expect(
      await ids({ search: "Test", employeeNumber: f.professor.employeeNumber, email: f.professor.universityEmail, departmentId: f.department.id }),
    ).toEqual([f.professor.id]);
    expect(await ids({ filiereId: f.filiere.id })).toContain(f.professor.id);
    expect(await ids({ facultyId: f.faculty.id })).toContain(f.professor.id);
    // `grade` عمود JSON: مرشّحه يبحث في المصفوفة (وكان `has` يُسقط الطلب بخطأ 500).
    await prisma.professor.update({ where: { id: f.professor.id }, data: { grade: ["MCA", "HDR"] } });
    expect(await ids({ grade: "HDR" })).toEqual([f.professor.id]);
    expect(await ids({ grade: "لا-رتبة-كهذه" })).toEqual([]);

    const blank = await admin.listProfessorsService({ ...v.listProfessorsSchema.parse({ limit: 1 }), quickSearch: "   " });
    expect(blank.items).toEqual([]);
  });

  it("تعديل الأستاذ: بريده الجامعيّ وقسمه ورتبه ووسومه وحسابه — أو رتبه وحدها", async () => {
    const universityEmail = `karim@${DOMAIN}`;
    const updated = await admin.updateProfessorService(f.professor2.id, {
      universityEmail,
      departmentId: f.department.id,
      grade: ["MCA"],
      tags: ["علم النفس"],
      firstName: "كريم",
      lastName: "بن علي",
      firstNameLatin: "Karim",
      lastNameLatin: "BENALI",
      email: `${TAG}.karim@test.local`,
      phone: "0550000000",
      gender: "male",
    });
    expect(updated).toMatchObject({ universityEmail, grade: ["MCA"], tags: ["علم النفس"] });
    expect(updated.user).toMatchObject({ firstNameLatin: "Karim", lastNameLatin: "BENALI", phone: "0550000000" });

    expect((await admin.updateProfessorService(f.professor2.id, { grade: ["MCB"] })).grade).toEqual(["MCB"]);
  });

  /** بريدٌ لا «@» فيه لا نطاق له — فلا يُقبل، ويُذكر ما يُقبل. (والمخطّط يردّه قبل ذلك.) */
  it("بريدٌ جامعيٌّ بلا نطاقٍ مسجَّل ⇒ يُرفض ويُسمّى المقبول؛ وبريدٌ مأخوذ ⇒ يُرفض", async () => {
    const base = { firstNameLatin: "Nadia", lastNameLatin: "SAIDI", password: "A-strong-Passw0rd!", departmentId: f.department.id };
    await expect(admin.createProfessorService({ ...base, universityEmail: "no-at-sign" } as never)).rejects.toMatchObject({
      message: expect.stringContaining(`@${DOMAIN}`),
    });

    await admin.createProfessorService({ ...base, universityEmail: `nadia@${DOMAIN}`, employeeNumber: `${TAG}0000001` } as never);
    await expect(
      admin.createProfessorService({ ...base, universityEmail: `nadia@${DOMAIN}` } as never),
    ).rejects.toMatchObject({ message: tr("professor.idsTaken") });
  });
});

//
// ═══ الهيكل والنطاقات ═══
//

describe("الهيكل الأكاديمي والنطاقات", () => {
  it("نطاقٌ جديد بلا «افتراضيّ» ⇒ ليس افتراضياً؛ والميادين بلا قسمٍ مُحدَّد ⇒ كلّها", async () => {
    const domain = await admin.createUniversityDomainService({ domain: "jest-svc2.dz" });
    expect(domain.isDefault).toBe(false);
    expect(Array.isArray(await admin.listDomainsService())).toBe(true);
  });

  it("شجرةٌ على كليةٍ قائمة بلا جديد ⇒ لا شيء يُنشأ؛ وشعبةٌ على قسمٍ قائم بلا ميدان", async () => {
    const empty = await admin.createAcademicStructureService(
      v.academicStructureSchema.parse({ faculty: { kind: "existing", id: f.faculty.id } }),
    );
    expect(empty.faculty.id).toBe(f.faculty.id);

    const fil = code();
    await admin.createAcademicStructureService(
      v.academicStructureSchema.parse({
        faculty: { kind: "existing", id: f.faculty.id },
        filieres: [{ key: "f", name: `${TAG} شعبة بلا ميدان`, code: fil, department: { kind: "existing", value: f.department.id } }],
      }),
    );
    expect(await prisma.filiere.findUnique({ where: { code: fil } })).toMatchObject({ departmentId: f.department.id, domainId: null });
  });

  it("الشعب: بلا مرشّح، وبميدان؛ وتُنشأ على قسمٍ بلا ميدان؛ وبلا أصلٍ ⇒ تُرفض", async () => {
    expect((await admin.listFilieresService({})).length).toBeGreaterThan(0);
    expect(await admin.listFilieresService({ domainId: NOPE })).toEqual([]);

    const fil = await admin.createFiliereService({ name: `${TAG} شعبة`, code: code(), departmentId: f.department.id, coverUrl: undefined });
    expect(fil.domainId).toBeNull();

    await expect(admin.createFiliereService({ name: `${TAG} يتيمة`, code: code() } as never)).rejects.toMatchObject({
      message: tr("structure.parentRequired"),
    });
  });

  it("تعديل الشعبة: اسمها وحده، وغلافها؛ وميدانٌ غير موجود ⇒ 404", async () => {
    const fil = await admin.createFiliereService({ name: `${TAG} شعبة`, code: code(), departmentId: f.department.id, coverUrl: undefined });
    expect((await admin.updateFiliereService(fil.id, v.updateFiliereSchema.parse({ name: `${TAG} شعبة معدّلة` }))).name).toBe(`${TAG} شعبة معدّلة`);
    expect((await admin.updateFiliereService(fil.id, v.updateFiliereSchema.parse({ coverUrl: "" }))).coverUrl).toBeNull();
    await expect(admin.updateFiliereService(fil.id, v.updateFiliereSchema.parse({ domainId: NOPE }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("سنةٌ تُطفأ بالتعديل", async () => {
    const y = await prisma.academicYear.create({ data: { title: `${TAG} 2101/2102`, isActive: false } });
    expect(await admin.updateAcademicYearService(y.id, { isActive: false })).toMatchObject({ isActive: false });
  });
});

//
// ═══ المواضيع ═══
//

describe("المواضيع", () => {
  it("موضوعٌ يُنشأ منشوراً ⇒ «مفتوح» بتاريخ نشره", async () => {
    const topic = await admin.createTopicService(
      v.createTopicSchema.parse({
        title: `${TAG} منشورٌ من الإدارة`,
        description: "وصف",
        maxStudents: 2,
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
        publish: true,
      }),
    );
    expect(topic.status).toBe("open");
    expect(topic.publishedAt).not.toBeNull();
  });

  it("القائمة بكلّ مرشّح، والأخصّ يغلب", async () => {
    const t = await makeTopic(f, "يُرشَّح", "pending");
    const ids = async (q: Record<string, string>) =>
      (await admin.listTopicsService(v.listTopicsSchema.parse({ limit: 100, ...q }))).items.map((x: { id: string }) => x.id);
    expect(
      await ids({ status: "pending", professorId: f.professor.id, academicYearId: f.academicYear.id, specializationId: f.specialization.id }),
    ).toContain(t.id);
    expect(await ids({ filiereId: f.filiere.id })).toContain(t.id);
    expect(await ids({ departmentId: f.department.id })).toContain(t.id);
    expect(await ids({ facultyId: f.faculty.id })).toContain(t.id);
  });

  /** قائمة العناوين للطباعة: بلا سنة، وبكلّ مرشّح — وأستاذٌ بلا اسمٍ عربيّ يُرتَّب بفراغ. */
  it("قائمة العناوين: بلا سنة، وبكلّ مرشّح، وأستاذٌ بلا اسم", async () => {
    await prisma.user.update({ where: { id: f.prof2User.id }, data: { firstName: null, lastName: null } });
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} عنوانٌ لأستاذٍ بلا اسم`,
        description: "وصف",
        maxStudents: 2,
        status: "approved",
        professorId: f.professor2.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });
    await makeTopic(f, "عنوانٌ معتمد", "approved");

    const list = (q: Record<string, string>) => admin.topicTitlesListService(v.topicTitlesListSchema.parse({ mode: "before", ...q }));
    const byProfessor = await list({ professorId: f.professor2.id, filiereId: f.filiere.id });
    expect(byProfessor.year).toBeNull();
    expect(byProfessor.groups[0]).toMatchObject({ filiere: { id: f.filiere.id }, department: { id: f.department.id } });
    expect((await list({ departmentId: f.department.id })).groups[0]!.rows.length).toBeGreaterThanOrEqual(2);
    expect((await list({ facultyId: f.faculty.id })).groups.length).toBeGreaterThan(0);
    expect((await list({ academicYearId: f.academicYear.id })).year).toMatchObject({ id: f.academicYear.id });
  });
});

//
// ═══ تعديل الموضوع المُسنَد — الخدمة لا تثق بمُناديها ═══
//

describe("updateAssignedTopicService", () => {
  let topicId = "";
  let s: Student[] = [];

  beforeAll(async () => {
    s = f.nextStudents(5);
    topicId = (await project("مُسنَدٌ يُعدَّل", [s[0]!, s[1]!])).topic.id;
  });

  it.each<[string, () => object, string]>([
    ["قائمة أعضاءٍ فارغة", () => ({ memberStudentIds: [], leaderStudentId: s[0]!.id }), "assigned.keepOne"],
    ["قائدٌ من خارجها", () => ({ memberStudentIds: [s[0]!.id, s[1]!.id], leaderStudentId: s[2]!.id }), "assigned.leaderInGroup"],
    ["عضوٌ مكرّر", () => ({ memberStudentIds: [s[0]!.id, s[0]!.id], leaderStudentId: s[0]!.id }), "assigned.duplicateStudent"],
    ["فوق سعة الموضوع", () => ({ memberStudentIds: s.slice(0, 4).map((x) => x.id), leaderStudentId: s[0]!.id }), "assigned.tooMany"],
    ["طالبٌ غير موجود", () => ({ memberStudentIds: [s[0]!.id, NOPE], leaderStudentId: s[0]!.id }), "assigned.studentsMissing"],
    ["قائدٌ وحده من خارج المجموعة", () => ({ leaderStudentId: s[2]!.id }), "assigned.leaderInMembers"],
  ])("%s ⇒ يُردّ", async (_l, body, key) => {
    await expect(admin.updateAssignedTopicService(topicId, body() as never)).rejects.toMatchObject({ message: tr(key as never) });
  });

  it("تعديلٌ جزئيّ بلا أعضاء؛ ثمّ الأعضاء أنفسهم بقائدٍ آخر؛ ثمّ ترقيةٌ وحدها", async () => {
    await admin.updateAssignedTopicService(topicId, {
      description: "وصفٌ جديد",
      requirements: ["أ"],
      objectives: ["ب"],
      maxRequests: 2,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    });
    expect(await prisma.graduationTopic.findUnique({ where: { id: topicId } })).toMatchObject({ description: "وصفٌ جديد", maxRequests: 2 });

    await admin.updateAssignedTopicService(topicId, { memberStudentIds: [s[0]!.id, s[1]!.id], leaderStudentId: s[1]!.id });
    await admin.updateAssignedTopicService(topicId, { leaderStudentId: s[0]!.id });
    const leaders = await prisma.projectMember.findMany({ where: { group: { topicId }, isLeader: true } });
    expect(leaders.map((m) => m.studentId)).toEqual([s[0]!.id]);
  });

  it("وموضوعٌ بلا مجموعة ⇒ تُنشأ له بأعضائها", async () => {
    const t = await makeTopic(f, "مُسنَدٌ بلا مجموعة", "approved");
    await admin.updateAssignedTopicService(t.id, { memberStudentIds: [s[4]!.id], leaderStudentId: s[4]!.id });
    expect(await prisma.projectMember.findMany({ where: { group: { topicId: t.id } } })).toMatchObject([
      { studentId: s[4]!.id, isLeader: true },
    ]);
  });
});

//
// ═══ المشاريع ومراحلها ═══
//

describe("المشاريع", () => {
  let p1: Awaited<ReturnType<typeof project>>;
  let p2: Awaited<ReturnType<typeof project>>;
  let members: Student[] = [];
  const milestone = (title: string, status: string, deadline: Date, order: number) =>
    prisma.milestone.create({ data: { title: `${TAG} ${title}`, status: status as never, deadline, order, groupId: p1.group.id } });
  const submit = (milestoneId: string, at: Date) =>
    prisma.submission.create({
      data: { fileUrl: "/uploads/x.pdf", fileName: "x.pdf", version: 1, milestoneId, uploadedById: members[0]!.userId, createdAt: at },
    });
  let done = "";

  beforeAll(async () => {
    members = f.nextStudents(4);
    p1 = await project("مشروعٌ بمراحل", [members[0]!, members[1]!]);
    p2 = await project("مشروعٌ آخر", [members[2]!]);
    done = (await milestone("مرحلة منجزة", "completed", PAST, 1)).id;
    const working = await milestone("مرحلة جارية", "in_progress", FUTURE, 2);
    await milestone("مرحلة فات موعدها", "pending", new Date("2021-01-01"), 3);
    await milestone("مرحلة لم يحن موعدها", "pending", FUTURE, 4);
    await submit(done, new Date("2026-01-01"));
    await submit(working.id, new Date("2026-03-01"));
  });

  it("التقدّم: المنجز والجاري والمتأخّر بموعده، والتسليمات وآخر نشاط", async () => {
    const res = await admin.listProjectsService(
      v.listProjectsSchema.parse({
        professorId: f.professor.id,
        academicYearId: f.academicYear.id,
        specializationId: f.specialization.id,
        sort: "oldest",
        limit: 100,
      }),
    );
    expect(res.items.find((p) => p.id === p1.group.id)!.progress).toMatchObject({
      total: 4,
      completed: 1,
      inProgress: 1,
      overdue: 1,
      submissions: 2,
      lastActivityAt: new Date("2026-03-01"),
    });
  });

  it("وكلّ مرشّحٍ آخر، وصفحةٌ فارغة لا تُسأل عن مراحل", async () => {
    const ids = async (q: Record<string, string>) =>
      (await admin.listProjectsService(v.listProjectsSchema.parse({ limit: 100, ...q }))).items.map((p) => p.id);
    expect(await ids({ filiereId: f.filiere.id, defense: "none" })).toContain(p1.group.id);
    expect(await ids({ departmentId: f.department.id })).toContain(p1.group.id);
    expect(await ids({ facultyId: f.faculty.id, defense: "scheduled", sort: "defenseSoon" })).not.toContain(p1.group.id);
    expect(await ids({ search: `${TAG} لا مشروع بهذا` })).toEqual([]);
    const spaces = await admin.listProjectsService({ ...v.listProjectsSchema.parse({ limit: 1 }), search: "   " });
    expect(spaces.items).toEqual([]);
  });

  it("تفاصيل المشروع: التسليمات وآخرها، وأصله إسنادٌ لا طلب", async () => {
    const res = await admin.getProjectByIdService(p1.group.id);
    expect(res.insights).toMatchObject({ submissions: 2, lastSubmissionAt: new Date("2026-03-01"), origin: { kind: "assignment" } });
  });

  it("المشرف نفسه ⇒ يُردّ؛ وطالبٌ غير موجود أو في مشروعٍ آخر ⇒ لا يُسند", async () => {
    await expect(admin.changeSupervisorService(p1.group.id, { professorId: f.professor.id })).rejects.toMatchObject({
      message: tr("project.sameSupervisor"),
    });
    await expect(admin.assignStudentService(p1.group.id, { studentId: NOPE })).rejects.toMatchObject({ statusCode: 404 });
    await expect(admin.assignStudentService(p1.group.id, { studentId: members[2]!.id })).rejects.toMatchObject({
      message: tr("project.studentInOther"),
    });
  });

  it("إزالة من ليس عضواً ⇒ تُردّ؛ وإزالة عضوٍ غير القائد ⇒ يبقى القائد", async () => {
    await expect(admin.removeProjectMemberService(p1.group.id, members[3]!.id)).rejects.toMatchObject({
      message: tr("project.notMember"),
    });
    await admin.removeProjectMemberService(p1.group.id, members[1]!.id);
    expect(await prisma.projectMember.findMany({ where: { groupId: p1.group.id } })).toMatchObject([
      { studentId: members[0]!.id, isLeader: true },
    ]);
  });

  it("المراحل: تُرشَّح بالحالة والبحث، وأوّلها يأخذ الترتيب الأوّل، وتُعدَّل كلّ حقولها", async () => {
    const found = await admin.listGroupMilestonesService(p1.group.id, { status: "completed", search: "منجزة" });
    expect(found.map((m) => m.id)).toEqual([done]);

    const first = await admin.createGroupMilestoneService(p2.group.id, v.adminCreateMilestoneSchema.parse({ title: `${TAG} أولى`, deadline: FUTURE }));
    expect(first.order).toBe(1);

    const changed = await admin.updateGroupMilestoneService(first.id, {
      description: "وصف",
      deadline: new Date("2998-01-01"),
      order: 9,
      status: "in_progress",
    });
    expect(changed).toMatchObject({ description: "وصف", order: 9, status: "in_progress" });
  });

  it("ومرحلةٌ عليها تسليمات ⇒ لا تُحذف", async () => {
    await expect(admin.deleteGroupMilestoneService(done)).rejects.toMatchObject({ message: tr("milestone.hasSubmissions") });
  });
});

//
// ═══ المناقشات ═══
//

describe("المناقشات", () => {
  it("تُلغى ثمّ تُعاد جدولتها؛ ومناقشةٌ غير مجدولة تُحذف بلا إعلام", async () => {
    const [a, b] = f.nextStudents(2) as [Student, Student];
    const g1 = (await project("مناقشةٌ تُلغى", [a])).group;
    const d = await prisma.defense.create({ data: { groupId: g1.id, date: FUTURE, room: "A1", status: "scheduled" } });

    expect((await admin.updateDefenseService(d.id, { status: "cancelled" })).status).toBe("cancelled");
    expect((await admin.updateDefenseService(d.id, { status: "scheduled" })).status).toBe("scheduled");

    // جمع من يُعلَم يسقط ⇒ لا إعلام، والتعديل قائم.
    const lookup = jest.spyOn(prisma.defense, "findUniqueOrThrow").mockRejectedValueOnce(new Error("db down"));
    try {
      expect((await admin.updateDefenseService(d.id, { room: "B2" })).room).toBe("B2");
    } finally {
      lookup.mockRestore();
    }

    const g2 = (await project("مناقشةٌ انتهت", [b])).group;
    const done = await prisma.defense.create({ data: { groupId: g2.id, date: PAST, room: "A2", status: "completed", grade: 14 } });
    await expect(admin.deleteDefenseService(done.id)).resolves.toEqual({ message: "Defense deleted" });
  });
});

//
// ═══ طلبات الفرق ═══
//

describe("طلبات الفرق", () => {
  let topicId = "";
  let s: Student[] = [];

  beforeAll(async () => {
    s = f.nextStudents(6);
    topicId = (await makeTopic(f, "عليه طلبات", "open")).id;
  });

  it("مقبولٌ ⇒ لا يتغيّر قائده؛ وقائدٌ من خارج الأعضاء ⇒ يُردّ", async () => {
    const accepted = await request(topicId, s[0]!, [s[0]!], "accepted");
    await expect(admin.setGroupRequestLeaderService(accepted.id, s[0]!.id)).rejects.toMatchObject({ message: tr("request.leaderLocked") });

    const pending = await request(topicId, s[1]!, [s[1]!, s[2]!]);
    await expect(admin.setGroupRequestLeaderService(pending.id, s[5]!.id)).rejects.toMatchObject({
      message: tr("request.leaderMustBeMember"),
    });
    await expect(admin.removeGroupRequestMemberService(pending.id, s[5]!.id)).rejects.toMatchObject({
      message: tr("request.notMember"),
    });
  });

  /** طلبٌ قديمٌ قائده ليس صفّاً في أعضائه: آخر عضوٍ فيه لا يُزال، فلا يبقى طلبٌ بلا أحد. */
  it("وطلبٌ قديمٌ قائده ليس من أعضائه ⇒ آخر عضوٍ لا يُزال", async () => {
    const legacy = await request(topicId, s[3]!, [s[4]!]);
    await expect(admin.removeGroupRequestMemberService(legacy.id, s[4]!.id)).rejects.toMatchObject({ message: tr("request.keepOne") });
  });

  it("المرشّحات كلّها، ومدى التاريخ من طرفٍ أو طرفين", async () => {
    const ids = async (q: Record<string, string>) =>
      (await admin.listGroupRequestsService(v.listQuerySchema.parse({ limit: 100, ...q }))).items.map((r: { id: string }) => r.id);
    const r = await request(topicId, s[5]!, [s[5]!]);
    expect(
      await ids({ search: TAG, professorId: f.professor.id, specializationId: f.specialization.id, dateFrom: "2020-01-01", dateTo: "2999-12-31" }),
    ).toContain(r.id);
    expect(await ids({ filiereId: f.filiere.id, dateFrom: "2020-01-01" })).toContain(r.id);
    expect(await ids({ departmentId: f.department.id, dateTo: "2999-12-31" })).toContain(r.id);
    expect(await ids({ facultyId: f.faculty.id })).toContain(r.id);
    expect(await ids({ dateTo: "2000-01-01" })).not.toContain(r.id);

    const byTopic = await admin.listGroupRequestsByTopicService(v.listQuerySchema.parse({ search: `${TAG} لا طلب بهذا` }));
    expect(byTopic.items).toEqual([]);
  });

  it("رفضٌ بلا سبب ⇒ مرفوض", async () => {
    const t = await makeTopic(f, "يُرفض عليه فريق", "open");
    const [x] = f.nextStudents(1) as [Student];
    const r = await request(t.id, x, [x]);
    await expect(admin.rejectGroupRequestService(r.id)).resolves.toMatchObject({ status: "rejected" });
    expect((await prisma.groupRequest.findUnique({ where: { id: r.id } }))!.rejectionReason).toBeNull();
  });

  /**
   * قبول طلبين على موضوعٍ واحدٍ معاً: يجتاز كلاهما الفحص الأوّل، ثمّ يجد الثاني
   * داخل المعاملة أنّ الموضوع تغيّر. يُحاكى هنا ما يراه الثاني.
   */
  it.each<[string, unknown, string]>([
    ["حُذف الموضوع", null, "request.topicGone"],
    ["أُرشف", { status: "archived", projectGroup: null }, "request.topicGone"],
    ["قُبل عليه فريقٌ آخر", { status: "open", projectGroup: { id: "g" } }, "request.otherAccepted"],
  ])("وموضوعٌ تغيّر بين الفحص والمعاملة — %s ⇒ يُردّ", async (_l, fresh, key) => {
    const t = await makeTopic(f, `يُقبل عليه ${key}`, "open");
    const [x] = f.nextStudents(1) as [Student];
    const r = await request(t.id, x, [x]);
    // المعاملة تبدأ بقفل الأعضاء وإعادة قراءة مشاريعهم — لا مشروع لهم هنا،
    // فيبلغ الفحصُ الموضوعَ الذي تغيّر.
    const tx = jest.spyOn(prisma, "$transaction").mockImplementationOnce((async (fn: (t: unknown) => unknown) =>
      fn({
        $queryRaw: async () => [],
        projectMember: { findMany: async () => [] },
        graduationTopic: { findUnique: async () => fresh },
      })) as never);
    try {
      await expect(admin.acceptGroupRequestService(r.id)).rejects.toMatchObject({ message: tr(key as never) });
    } finally {
      tx.mockRestore();
    }
  });
});
