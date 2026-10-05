/**
 * قائمةُ عناوين المذكرات — `GET /api/admin/topics/titles-list`.
 *
 * ما تُبنى عليه الورقة المطبوعة، فما يستحقّ حارساً:
 *   ١. «بعد الإسناد» تحمل المذكرات التي لها طلبة، بأسمائهم وقائدُهم أوّلاً؛
 *   ٢. «قبل الإسناد» تحمل المعتمَد وحده — لا المعلّق ولا المرفوض — وتُبقي
 *      ما أُسند منه، فالقائمة قائمةُ المقترَح لا المتبقّي؛
 *   ٣. والصفوف مجموعةٌ بالتخصّص، ومعه شعبته وقسمه وكلّيته لترويسة الصفحة؛
 *   ٤. والمسار لا يُقرأ «titles-list» معرّفاً لموضوع؛ وليس لغير الإدارة.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";

const as = (r: request.Test, token = admin) => r.set("Authorization", `Bearer ${token}`);

async function topic(title: string, status: string) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents: 2,
      status: status as never,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

/** A memoir: a full topic, a group, and its students — the leader second, to see the order. */
async function memoir(title: string) {
  const t = await topic(title, "full");
  const group = await prisma.projectGroup.create({ data: { topicId: t.id } });
  const [member, leader] = f.nextStudents(2);
  await prisma.projectMember.create({ data: { groupId: group.id, studentId: member.id, isLeader: false } });
  await prisma.projectMember.create({ data: { groupId: group.id, studentId: leader.id, isLeader: true } });
  return { topic: t, member, leader };
}

beforeAll(async () => {
  await teardown();
  f = await seed(10);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  prof = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const scope = () => ({ academicYearId: f.academicYear.id, specializationId: f.specialization.id });

describe("قائمة عناوين المذكرات", () => {
  it("بعد الإسناد: المذكرات وطلبتها، القائد أوّلاً، مجموعةً بالتخصّص", async () => {
    const m = await memoir("مذكرة مسندة");
    await topic("موضوع متاح", "open");

    const res = await as(request(app).get("/api/admin/topics/titles-list").query({ mode: "after", ...scope() })).expect(200);
    expect(res.body.mode).toBe("after");
    expect(res.body.year).toMatchObject({ id: f.academicYear.id });
    expect(res.body.groups).toHaveLength(1);
    const g = res.body.groups[0];
    expect(g.specialization).toMatchObject({ id: f.specialization.id, level: "master" });
    expect(g.filiere).toMatchObject({ id: f.filiere.id });
    expect(g.department).toMatchObject({ id: f.department.id });
    expect(g.faculty).toMatchObject({ id: f.faculty.id });

    const titles = g.rows.map((r: { title: string }) => r.title);
    expect(titles).toContain(m.topic.title);
    expect(titles).not.toContain(`${TAG} موضوع متاح`);
    const row = g.rows.find((r: { id: string }) => r.id === m.topic.id);
    expect(row.students.map((s: { registrationNumber: string }) => s.registrationNumber)).toEqual([m.leader.reg, m.member.reg]);
    expect(row.supervisor).toMatchObject({ id: f.professor.id, email: f.professor.universityEmail });
  });

  it("قبل الإسناد: المعتمَد وحده — ويبقى عليها ما أُسند", async () => {
    await topic("معلّق", "pending");
    await topic("مرفوض", "rejected");
    const approved = await topic("معتمد", "approved");

    const res = await as(request(app).get("/api/admin/topics/titles-list").query({ mode: "before", ...scope() })).expect(200);
    const titles = res.body.groups.flatMap((g: { rows: { title: string }[] }) => g.rows.map((r) => r.title));
    expect(titles).toContain(approved.title);
    expect(titles).toContain(`${TAG} مذكرة مسندة`);
    expect(titles).not.toContain(`${TAG} معلّق`);
    expect(titles).not.toContain(`${TAG} مرفوض`);
  });

  it("وليست لغير الإدارة", async () => {
    await request(app).get("/api/admin/topics/titles-list").expect(401);
    await as(request(app).get("/api/admin/topics/titles-list"), prof).expect(403);
  });

  it("ووضعٌ غير معروف ⇒ 400", async () => {
    await as(request(app).get("/api/admin/topics/titles-list").query({ mode: "later" })).expect(400);
  });
});
