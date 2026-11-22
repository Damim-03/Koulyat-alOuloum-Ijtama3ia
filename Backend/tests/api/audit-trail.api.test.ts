/**
 * سجلّ العمليات — ما يُكتب فيه، كما يُكتب، من كلّ دور.
 *
 * التغيير يُكتب بما وقع عليه (باسمه، يبقى بعد حذفه) وبما تغيّر فيه حقلاً
 * حقلاً: من ماذا إلى ماذا. ويُكتب ما يغيّره الأستاذ والطالب وصاحب الحساب في
 * حسابه، لا الإدارة وحدها؛ ودخولُ كلّ دورٍ وخروجه — ويُحذف دخول الطلبة
 * والأساتذة بعد مدّة، ودخول المسؤول يبقى.
 *
 * ثم المرشّحات: المجال، والدور، ونوع الفعل، والعملية بعينها، وتاريخ عنصرٍ
 * واحد، والعنوان؛ ومن يظهر في السجلّ؛ وحصيلة اليوم.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { pruneSignIns } from "../../src/core/audit/audit";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let professor = "";
let student = "";
const started = new Date();

const as = (token: string) => (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

type Row = {
  id: string;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, any> | null;
  success: boolean;
  ip: string | null;
};

/** The row an action wrote — written after the answer, so waited for. */
async function rowOf(where: Record<string, unknown>): Promise<Row> {
  for (let i = 0; i < 40; i++) {
    const row = await prisma.auditLog.findFirst({ where: { createdAt: { gte: started }, ...where }, orderBy: { createdAt: "desc" } });
    if (row) return row as unknown as Row;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`no audit row for ${JSON.stringify(where)}`);
}

const changeOf = (row: Row, field: string) => (row.details?.changes as { field: string; from: unknown; to: unknown }[]).find((c) => c.field === field);

const list = (query: Record<string, unknown>) =>
  as(admin)(request(app).get("/api/admin/audit-logs").query(query)).expect(200).then((r) => r.body as { items: Row[]; total: number });

beforeAll(async () => {
  await teardown();
  f = await seed(4);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  professor = (
    await request(app).post("/api/auth/professor/login").send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  student = (
    await request(app).post("/api/auth/student/login").send({ registrationNumber: f.students[0].reg, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: [f.admin.id, f.admin2.id, f.profUser.id, f.prof2User.id, ...f.students.map((s) => s.userId)] } },
        { actorLabel: { contains: TAG } },
        { targetLabel: { contains: TAG } },
      ],
    },
  });
  await prisma.faculty.deleteMany({ where: { code: { startsWith: `${TAG}-AUD` } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("a change: what it was made to, and each field that changed", () => {
  it("an administrator edits a student: named, and the fields from what to what", async () => {
    const s = f.students[1];
    await as(admin)(request(app).patch(`/api/admin/students/${s.id}`).send({ phone: "0550 11 22 33", lastName: `${TAG} Renamed` })).expect(200);

    const row = await rowOf({ action: "PATCH /students/:id", targetId: s.id });
    expect(row).toMatchObject({ targetType: "students", actorId: f.admin.id, actorRole: "admin" });
    expect(row.targetLabel).toBe(`${TAG} ${TAG} Renamed · ${s.reg}`);
    expect(changeOf(row, "phone")).toEqual({ field: "phone", from: null, to: "0550 11 22 33" });
    expect(changeOf(row, "lastName")).toEqual({ field: "lastName", from: "Student2", to: `${TAG} Renamed` });
    // Only what changed: the registration number did not.
    expect(changeOf(row, "registrationNumber")).toBeUndefined();
    // And what was sent, as before.
    expect(row.details?.body).toMatchObject({ phone: "0550 11 22 33" });
  });

  it("created, then changed, then deleted: what it held each time — a code is a code, not a secret", async () => {
    const created = await as(admin)(request(app).post("/api/admin/faculties").send({ name: `${TAG} كلية التدقيق`, code: `${TAG}-AUD1` })).expect(201);
    const id = created.body.faculty.id as string;
    const made = await rowOf({ action: "POST /faculties", targetId: id });
    expect(made.targetLabel).toBe(`${TAG} كلية التدقيق`);
    expect(made.details?.created).toEqual({ name: `${TAG} كلية التدقيق`, code: `${TAG}-AUD1` });

    await as(admin)(request(app).patch(`/api/admin/faculties/${id}`).send({ name: `${TAG} كلية التدقيق 2` })).expect(200);
    const changed = await rowOf({ action: "PATCH /faculties/:id", targetId: id });
    expect(changed.details?.changes).toEqual([{ field: "name", from: `${TAG} كلية التدقيق`, to: `${TAG} كلية التدقيق 2` }]);

    await as(admin)(request(app).delete(`/api/admin/faculties/${id}`)).expect(200);
    const gone = await rowOf({ action: "DELETE /faculties/:id", targetId: id });
    // The name stays with the row after the faculty is gone.
    expect(gone.targetLabel).toBe(`${TAG} كلية التدقيق 2`);
    expect(gone.details?.deleted).toEqual({ name: `${TAG} كلية التدقيق 2`, code: `${TAG}-AUD1` });
  });

  it("a password reset: the account named, the flag it sets shown, the password never", async () => {
    const s = f.students[2];
    await as(admin)(request(app).post(`/api/admin/users/${s.userId}/reset-password`).send({ password: "12/05/2003" })).expect(200);
    const row = await rowOf({ action: "POST /users/:id/reset-password", targetId: s.userId });
    expect(row.targetLabel).toBe(`${TAG} Student3 · ${s.email}`);
    expect(changeOf(row, "mustChangePassword")).toEqual({ field: "mustChangePassword", from: false, to: true });
    expect(JSON.stringify(row)).not.toContain("12/05/2003");
  });

  it("a page of the site: each text that changed, by where it sits", async () => {
    const page = (fullName: string) => ({
      isVisible: true,
      photoUrl: null,
      ar: { sectionTitle: "s", title: "t", paragraphs: ["p"], fullName, role: "r" },
      fr: {},
      en: {},
    });
    await as(admin)(request(app).put("/api/admin/director-message").send(page(`${TAG} Dr. A`))).expect(200);
    await as(admin)(request(app).put("/api/admin/director-message").send(page(`${TAG} Dr. B`))).expect(200);
    const row = await rowOf({ action: "PUT /director-message", details: { path: "$.changes[0].to", equals: `${TAG} Dr. B` } });
    expect(row.targetType).toBe("director-message");
    expect(row.details?.changes).toEqual([{ field: "ar.fullName", from: `${TAG} Dr. A`, to: `${TAG} Dr. B` }]);
    await prisma.siteContent.deleteMany({ where: { slug: "director-message" } });
  });
});

describe("not the administration alone", () => {
  it("a professor proposes a topic, then edits it: by route, by name, by field", async () => {
    const res = await as(professor)(
      request(app).post("/api/professor/topics").send({
        title: `${TAG} موضوع التدقيق`,
        description: "d",
        maxStudents: 2,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      }),
    ).expect(201);
    const id = res.body.topic.id as string;
    const made = await rowOf({ action: "POST /professor/topics", targetId: id });
    expect(made).toMatchObject({ actorId: f.profUser.id, actorRole: "professor", targetType: "topics", targetLabel: `${TAG} موضوع التدقيق` });
    expect(made.details?.created).toMatchObject({ title: `${TAG} موضوع التدقيق`, status: "pending", professor: `${TAG} Prof`, specialization: `${TAG} spec` });

    await as(professor)(request(app).put(`/api/professor/topics/${id}`).send({ maxStudents: 3 })).expect(200);
    const edited = await rowOf({ action: "PUT /professor/topics/:id", targetId: id });
    expect(changeOf(edited, "maxStudents")).toEqual({ field: "maxStudents", from: 2, to: 3 });
  });

  it("anyone in their own account: the account named, and what changed", async () => {
    await as(professor)(request(app).patch("/api/account").send({ phone: "0661 00 00 00" })).expect(200);
    const row = await rowOf({ action: "PATCH /account", actorId: f.profUser.id });
    expect(row).toMatchObject({ targetType: "users", targetId: f.profUser.id });
    expect(changeOf(row, "phone")).toEqual({ field: "phone", from: null, to: "0661 00 00 00" });
  });

  it("a route's other ids are named too: the student taken off a request", async () => {
    const topic = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} طلب التدقيق`,
        description: "d",
        maxStudents: 3,
        status: "open",
        publishedAt: new Date(),
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });
    const [leader, member] = [f.students[0], f.students[3]];
    const req = await prisma.groupRequest.create({
      data: {
        topicId: topic.id,
        leaderStudentId: leader.id,
        members: { create: [{ studentId: leader.id }, { studentId: member.id }] },
      },
    });
    await as(admin)(request(app).delete(`/api/admin/group-requests/${req.id}/members/${member.id}`)).expect(200);
    const row = await rowOf({ action: "DELETE /group-requests/:id/members/:studentId", targetId: req.id });
    expect(row.details?.refs).toEqual({ student: `${TAG} Student4 · ${member.reg}` });
    expect(changeOf(row, "members")).toEqual({
      field: "members",
      from: [`${TAG} Student1`, `${TAG} Student4`],
      to: [`${TAG} Student1`],
    });
  });
});

describe("signing in and out, every role", () => {
  it("a student's and a professor's sign-in are written; signing out too", async () => {
    expect(await rowOf({ action: "auth.login", actorId: f.students[0].userId })).toMatchObject({ actorRole: "student" });
    expect(await rowOf({ action: "auth.login", actorId: f.profUser.id })).toMatchObject({ actorRole: "professor" });

    const s = f.students[1];
    const token = (await request(app).post("/api/auth/student/login").send({ registrationNumber: s.reg, password: TEST_PASSWORD }).expect(200)).body
      .accessToken;
    await as(token)(request(app).post("/api/auth/logout")).expect(200);
    const out = await rowOf({ action: "auth.logout", actorId: s.userId });
    expect(out.actorRole).toBe("student");
    expect(out.details?.session).toEqual(expect.any(String));
    // When it began: how long it lasted is read from the two.
    expect(new Date(out.details?.startedAt).getTime()).toBeLessThanOrEqual(new Date((out as unknown as { createdAt: Date }).createdAt).getTime());
  });

  it("old sign-ins of students and professors are deleted; an administrator's stay", async () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const rows = await Promise.all(
      [
        { actorId: f.students[0].userId, actorRole: "student" },
        { actorId: f.profUser.id, actorRole: "professor" },
        { actorId: f.admin.id, actorRole: "admin" },
      ].map((a) => prisma.auditLog.create({ data: { ...a, action: "auth.login", actorLabel: `${TAG} old`, createdAt: old } })),
    );
    expect(await pruneSignIns(90)).toBeGreaterThanOrEqual(2);
    const left = await prisma.auditLog.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
    expect(left.map((r) => r.actorRole)).toEqual(["admin"]);
  });
});

describe("a refused sign-in says why — to the log alone", () => {
  afterAll(() => prisma.loginThrottle.deleteMany({ where: { key: { contains: TAG } } }));

  it("a wrong password, an account that does not exist, a suspended account with the right password", async () => {
    const s = f.students[3];
    await request(app).post("/api/auth/student/login").send({ registrationNumber: s.reg, password: "wrong-password" }).expect(401);
    expect((await rowOf({ action: "auth.loginFailed", actorId: s.userId })).details).toEqual({ as: "student", reason: "badPassword" });

    const nobody = `${TAG}-NOBODY`;
    await request(app).post("/api/auth/student/login").send({ registrationNumber: nobody, password: "whatever" }).expect(401);
    const unknown = await rowOf({ action: "auth.loginFailed", actorLabel: nobody });
    expect(unknown).toMatchObject({ actorId: null, details: { as: "student", reason: "unknownAccount" } });

    await prisma.user.update({ where: { id: s.userId }, data: { status: "suspended" } });
    try {
      await request(app).post("/api/auth/student/login").send({ registrationNumber: s.reg, password: TEST_PASSWORD }).expect(401);
      const suspended = await rowOf({ action: "auth.loginFailed", actorId: s.userId, details: { path: "$.reason", equals: "suspended" } });
      expect(suspended).toMatchObject({ actorRole: "student", success: false });
    } finally {
      await prisma.user.update({ where: { id: s.userId }, data: { status: "active" } });
    }
  });
});

describe("the filters", () => {
  it("by area, role, kind of act, one operation, one item's history, and address", async () => {
    // Every write above is in by now (each test waited for its own).
    const structure = await list({ area: "structure", actorId: f.admin.id });
    expect(structure.items.length).toBeGreaterThan(0);
    expect(structure.items.every((r) => r.targetType === "faculties")).toBe(true);

    const professors = await list({ role: "professor" });
    expect(professors.items.length).toBeGreaterThan(0);
    expect(professors.items.every((r) => r.actorRole === "professor")).toBe(true);

    const deletes = await list({ verb: "delete", actorId: f.admin.id });
    expect(deletes.items.length).toBeGreaterThan(0);
    expect(deletes.items.every((r) => r.action.startsWith("DELETE "))).toBe(true);

    const one = await list({ action: "POST /faculties" });
    expect(one.items.every((r) => r.action === "POST /faculties")).toBe(true);

    const student = f.students[1];
    const history = await list({ targetType: "students", targetId: student.id });
    expect(history.items.map((r) => r.action)).toContain("PATCH /students/:id");
    expect(history.items.every((r) => r.targetId === student.id)).toBe(true);

    const account = await list({ area: "account", actorId: f.profUser.id });
    expect(account.items.map((r) => r.action)).toEqual(["PATCH /account"]);

    const signin = await list({ area: "signin", actorId: f.students[0].userId });
    expect(signin.items.every((r) => r.action.startsWith("auth."))).toBe(true);

    const ip = signin.items[0]!.ip!;
    const fromThere = await list({ ip });
    expect(fromThere.items.every((r) => r.ip === ip)).toBe(true);

    // By name of what it was done to, and oldest first.
    const named = await list({ search: "كلية التدقيق 2", actorId: f.admin.id, order: "asc" });
    expect(named.items.map((r) => r.action)).toEqual(["PATCH /faculties/:id", "DELETE /faculties/:id"]);
  });

  it("by where the address was: one country, and the countries the log holds", async () => {
    const placed = await prisma.auditLog.create({
      data: { action: "auth.login", actorId: f.admin2.id, actorRole: "admin", actorLabel: `${TAG} placed`, ip: "41.100.1.1", country: "DZ", city: "Remchi", isp: "Telecom Algeria" },
    });
    const dz = await list({ country: "dz", actorId: f.admin2.id });
    expect(dz.items.map((r) => r.id)).toEqual([placed.id]);
    expect((await list({ search: "Telecom Algeria", actorId: f.admin2.id })).items.map((r) => r.id)).toEqual([placed.id]);
    const res = await as(admin)(request(app).get("/api/admin/audit-logs/countries")).expect(200);
    expect(res.body.countries).toContainEqual({ country: "DZ", count: expect.any(Number) });
  });

  it("an unknown area or role ⇒ 400", async () => {
    await as(admin)(request(app).get("/api/admin/audit-logs").query({ area: "everything" })).expect(400);
    await as(admin)(request(app).get("/api/admin/audit-logs/actors").query({ role: "owner" })).expect(400);
  });

  it("who appears in the log — the most active first, by the name last written", async () => {
    const res = await as(admin)(request(app).get("/api/admin/audit-logs/actors").query({ search: TAG })).expect(200);
    const actors = res.body.actors as { id: string; label: string; role: string; count: number; lastAt: string }[];
    const me = actors.find((a) => a.id === f.admin.id)!;
    expect(me).toMatchObject({ role: "admin", label: `${TAG} Admin · ${f.admin.email}` });
    expect(me.count).toBeGreaterThan(3);
    expect(actors.map((a) => a.count)).toEqual([...actors.map((a) => a.count)].sort((a, b) => b - a));

    const profs = await as(admin)(request(app).get("/api/admin/audit-logs/actors").query({ role: "professor" })).expect(200);
    expect((profs.body.actors as { role: string }[]).every((a) => a.role === "professor")).toBe(true);
  });

  it("the last day at a glance", async () => {
    const res = await as(admin)(request(app).get("/api/admin/audit-logs/summary")).expect(200);
    expect(res.body).toEqual({ total: expect.any(Number), changes: expect.any(Number), failed: expect.any(Number), people: expect.any(Number) });
    expect(res.body.changes).toBeGreaterThan(0);
    expect(res.body.people).toBeGreaterThanOrEqual(3);
  });
});
