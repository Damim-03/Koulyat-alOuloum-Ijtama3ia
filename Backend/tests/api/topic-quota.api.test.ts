/**
 * حدّ المواضيع لكلّ أستاذ في السنة — `/api/admin/academic-years/:id/topic-quota`،
 * وحارسه على ما يرسله الأستاذ (core/academic/topic-quota).
 *
 * ما يستحقّ حارساً:
 *   ١. بلا حدّ: يرسل ما شاء، و`/professor/topic-quota` يقول «لا حدّ» وكم له؛
 *   ٢. بحدّ: يرسل حتى يبلغه ثمّ يُردّ — موضوعاً وحده أو بفريق —؛ والمرفوض لا
 *      يُحسب فيُرسل بدله، وإعادةُ إرسال المرفوض بتعديله تُحسب؛ ونقلُ موضوعٍ إلى
 *      سنةٍ بلغ فيها حدّها يُردّ؛ وتعديلُ موضوعٍ في مكانه لا يُحسب؛
 *   ٣. والإدارة لا تتقيّد به: تُنشئ باسمه فوقه، فيُرى أنّه تجاوزه؛
 *   ٤. وإرسالان معاً عند الحدّ: يمرّ واحدٌ فقط؛
 *   ٥. وإلغاؤه يعيد الحرّية؛ والسنة المؤرشفة لا يُغيَّر حدّها؛ وما لا يصحّ
 *      يُردّ؛ وللإدارة وحدها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
let prof2 = "";

const as = (r: request.Test, token = admin) => r.set("Authorization", `Bearer ${token}`);
const url = (yearId = f.academicYear.id) => `/api/admin/academic-years/${yearId}/topic-quota`;
const body = (yearId = f.academicYear.id) => ({
  title: `${TAG} مقترح ${Math.random().toString(36).slice(2, 8)}`,
  description: `${TAG} وصف`,
  maxStudents: 2,
  specializationId: f.specialization.id,
  academicYearId: yearId,
});
const send = (token = prof, yearId?: string) => as(request(app).post("/api/professor/topics"), token).send(body(yearId));
const quota = async (token = prof, yearId = f.academicYear.id) =>
  (await as(request(app).get("/api/professor/topic-quota").query({ academicYearId: yearId }), token).expect(200)).body;

beforeAll(async () => {
  await teardown();
  f = await seed(6);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  const login = async (universityEmail: string) =>
    (await request(app).post("/api/auth/professor/login").send({ universityEmail, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  prof = await login(f.professor.universityEmail);
  prof2 = await login(f.professor2.universityEmail);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("حدّ المواضيع لكلّ أستاذ", () => {
  let first = "";
  let second = "";

  it("بلا حدّ: لا شيء يُحسب عليه، ويرسل ما شاء", async () => {
    const res = await as(request(app).get(url())).expect(200);
    expect(res.body).toMatchObject({
      year: { id: f.academicYear.id, maxTopicsPerProfessor: null },
      stats: { proposing: 0, atLimit: 0, over: 0 },
      histogram: {},
      professors: [],
    });
    expect(res.body.stats.professors).toBeGreaterThanOrEqual(2);
    expect(await quota()).toEqual({ year: { id: f.academicYear.id, title: f.academicYear.title }, max: null, used: 0 });
  });

  it("حدٌّ باثنين: يرسل اثنين، والثالث يُردّ بسببه — وحده وبفريق", async () => {
    const set = await as(request(app).put(url())).send({ max: 2 }).expect(200);
    expect(set.body.year.maxTopicsPerProfessor).toBe(2);

    first = (await send().expect(201)).body.topic.id;
    second = (await send().expect(201)).body.topic.id;
    expect(await quota()).toMatchObject({ max: 2, used: 2 });

    const refused = await send().expect(400);
    expect(refused.body.errorCode).toBe("TOPIC_QUOTA_REACHED");
    expect(refused.body.message).toContain(f.academicYear.title);

    const [s] = f.nextStudents(1);
    const team = await as(request(app).post("/api/professor/topics/with-group"), prof)
      .send({ ...body(), memberRegistrationNumbers: [s!.reg], leaderRegistrationNumber: s!.reg })
      .expect(400);
    expect(team.body.errorCode).toBe("TOPIC_QUOTA_REACHED");
    expect(await prisma.graduationTopic.count({ where: { professorId: f.professor.id } })).toBe(2);
    expect(await prisma.groupRequest.count({ where: { leaderStudentId: s!.id } })).toBe(0);

    // In place, his topic is edited as ever: it was already counted.
    await as(request(app).put(`/api/professor/topics/${first}`), prof).send({ title: `${TAG} معدّل في مكانه` }).expect(200);

    const stats = (await as(request(app).get(url())).expect(200)).body;
    expect(stats.stats).toMatchObject({ proposing: 1, atLimit: 1, over: 0 });
    expect(stats.histogram).toEqual({ "2": 1 });
    expect(stats.professors[0]).toMatchObject({ id: f.professor.id, count: 2 });
  });

  it("المرفوض لا يُحسب فيُرسل بدله؛ وإعادة إرساله بتعديله تُحسب فتُردّ", async () => {
    await prisma.graduationTopic.update({ where: { id: second }, data: { status: "rejected", rejectionReason: "ناقص" } });
    expect(await quota()).toMatchObject({ used: 1 });
    await send().expect(201);
    expect(await quota()).toMatchObject({ used: 2 });

    const back = await as(request(app).put(`/api/professor/topics/${second}`), prof).send({ title: `${TAG} مصحَّح` }).expect(400);
    expect(back.body.errorCode).toBe("TOPIC_QUOTA_REACHED");
    expect(await prisma.graduationTopic.findUniqueOrThrow({ where: { id: second } })).toMatchObject({ status: "rejected", title: expect.not.stringContaining("مصحَّح") });
  });

  it("نقلُ موضوعٍ إلى سنةٍ بلغ فيها حدّها يُردّ، وإلى سنةٍ لم يبلغه يمرّ", async () => {
    const other = await prisma.academicYear.create({ data: { title: `${TAG} 2101/2102`, maxTopicsPerProfessor: 1 } });
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} في السنة الأخرى`,
        description: `${TAG} d`,
        maxStudents: 2,
        status: "pending",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: other.id,
      },
    });
    const moved = await as(request(app).put(`/api/professor/topics/${first}`), prof).send({ academicYearId: other.id }).expect(400);
    expect(moved.body.errorCode).toBe("TOPIC_QUOTA_REACHED");
    expect(moved.body.message).toContain(other.title);

    await prisma.academicYear.update({ where: { id: other.id }, data: { maxTopicsPerProfessor: 2 } });
    await as(request(app).put(`/api/professor/topics/${first}`), prof).send({ academicYearId: other.id }).expect(200);
    // Back where it was — the first year has a place for it again.
    await as(request(app).put(`/api/professor/topics/${first}`), prof).send({ academicYearId: f.academicYear.id }).expect(200);
    await prisma.graduationTopic.deleteMany({ where: { academicYearId: other.id } });
  });

  it("الإدارة لا تتقيّد به: تُنشئ باسمه فوقه، فيُرى أنّه تجاوزه", async () => {
    await as(request(app).post("/api/admin/topics")).send({ ...body(), professorId: f.professor.id }).expect(201);
    expect(await quota()).toMatchObject({ max: 2, used: 3 });
    const res = (await as(request(app).get(url())).expect(200)).body;
    expect(res.stats).toMatchObject({ proposing: 1, atLimit: 0, over: 1 });
    expect(res.histogram).toEqual({ "3": 1 });
    expect((await send().expect(400)).body.errorCode).toBe("TOPIC_QUOTA_REACHED");
  });

  it("إرسالان معاً عند الحدّ: يمرّ واحدٌ فقط", async () => {
    await as(request(app).put(url())).send({ max: 1 }).expect(200);
    const results = await Promise.all([send(prof2), send(prof2)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await prisma.graduationTopic.count({ where: { professorId: f.professor2.id } })).toBe(1);
    expect(await quota(prof2)).toMatchObject({ max: 1, used: 1 });
  });

  it("إلغاؤه يعيد الحرّية؛ وبلا سنةٍ مذكورة تُقرأ الجارية", async () => {
    const cleared = await as(request(app).delete(url())).expect(200);
    expect(cleared.body.year.maxTopicsPerProfessor).toBeNull();
    expect(cleared.body.stats).toMatchObject({ atLimit: 0, over: 0 });
    await send().expect(201);

    await prisma.academicYear.update({ where: { id: f.academicYear.id }, data: { isActive: true } });
    try {
      const current = (await as(request(app).get("/api/professor/topic-quota"), prof).expect(200)).body;
      expect(current).toMatchObject({ year: { id: f.academicYear.id }, max: null, used: 4 });
    } finally {
      await prisma.academicYear.update({ where: { id: f.academicYear.id }, data: { isActive: false } });
    }
  });

  it("سنةٌ مؤرشفة لا يُغيَّر حدّها؛ وما لا يصحّ يُردّ؛ وللإدارة وحدها", async () => {
    for (const bad of [{ max: 0 }, { max: 51 }, { max: 2.5 }, { max: "3" }, {}]) await as(request(app).put(url())).send(bad).expect(400);
    await as(request(app).get(url("00000000-0000-4000-8000-000000000000"))).expect(404);
    await as(request(app).get(url()), prof).expect(403);
    await as(request(app).put(url()), prof).send({ max: 9 }).expect(403);
    await as(request(app).delete(url()), prof).expect(403);

    await prisma.academicYear.update({ where: { id: f.academicYear.id }, data: { archivedAt: new Date() } });
    try {
      await as(request(app).put(url())).send({ max: 3 }).expect(400);
      await as(request(app).delete(url())).expect(400);
    } finally {
      await prisma.academicYear.update({ where: { id: f.academicYear.id }, data: { archivedAt: null } });
    }
    expect((await as(request(app).get(url())).expect(200)).body.year.maxTopicsPerProfessor).toBeNull();
  });
});
