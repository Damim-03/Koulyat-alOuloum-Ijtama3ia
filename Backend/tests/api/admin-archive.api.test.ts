/**
 * الإدارة — أرشيف السنوات الجامعية.
 *
 * السنة تُعاش ثمّ تُغلَق. والإغلاق يجمّد سجلّها — طلبتها ومواضيعها ومشاريعها
 * ومناقشاتها ودرجاتها — في وثيقةٍ واحدة تُقرأ كما كانت يوم أُغلقت، ولو تغيّر
 * بعدها كلّ شيء في الجداول الحيّة. وما يحكمه:
 *
 *   **السجلّ مجمَّد** — ما يتغيّر بعد الإغلاق لا يصل إليه.
 *
 *   **السنة المغلقة لا تستقبل جديداً** — لا طالب ولا موضوع، ولا تُفعَّل ولا
 *   تُحذف، حتى يُعاد فتحها.
 *
 *   **الإغلاق فعلٌ مقصود** — يُكتب عنوان السنة كما هو، وإلّا فلا شيء.
 *
 *   **وإعادة الفتح تُعيدها حيّة** — يزول المجمَّد وتعود الجداول سجلَّها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let professorToken = "";
let studentToken = "";

const as = (r: request.Test, token = adminToken) =>
  r.set("Authorization", `Bearer ${token}`);

let n = 0;
/** سنةٌ جديدة بطلبتها ومشروعٍ نوقش ومشروعٍ لم يُناقش بعد. */
async function year() {
  n += 1;
  const y = await prisma.academicYear.create({ data: { title: `${TAG} Y${n}` } });
  const [a, b, c] = f.nextStudents(3);
  await prisma.student.updateMany({
    where: { id: { in: [a.id, b.id, c.id] } },
    data: { academicYearId: y.id },
  });

  const topic = (title: string) =>
    prisma.graduationTopic.create({
      data: {
        title: `${TAG} ${title} ${n}`,
        description: `${TAG} d`,
        maxStudents: 2,
        status: "full",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: y.id,
      },
    });

  const t1 = await topic("defended");
  const g1 = await prisma.projectGroup.create({ data: { topicId: t1.id } });
  await prisma.projectMember.createMany({
    data: [
      { groupId: g1.id, studentId: a.id, isLeader: true },
      { groupId: g1.id, studentId: b.id },
    ],
  });
  const d1 = await prisma.defense.create({
    data: {
      groupId: g1.id,
      date: new Date(Date.now() - 86_400_000),
      room: `${TAG}-R`,
      status: "completed",
      grade: 15.5,
      committee: { create: [{ professorId: f.professor.id, role: "supervisor" }, { professorId: f.professor2.id, role: "president" }] },
    },
  });

  const t2 = await topic("waiting");
  const g2 = await prisma.projectGroup.create({ data: { topicId: t2.id } });
  await prisma.projectMember.create({ data: { groupId: g2.id, studentId: c.id, isLeader: true } });

  await topic("pending").then((t) => prisma.graduationTopic.update({ where: { id: t.id }, data: { status: "pending" } }));

  return { y, students: [a, b, c], t1, g1, d1, t2, g2 };
}

const close = (id: string, body: Record<string, unknown>) =>
  as(request(app).post(`/api/admin/archive/years/${id}/close`).send(body));

beforeAll(async () => {
  await teardown();
  f = await seed(40);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  professorToken = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  studentToken = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[39].reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ القراءة ═══
//

describe("GET /api/admin/archive/years/:id — the record of an open year", () => {
  it("سنةٌ مفتوحة ⇒ سجلٌّ حيّ بكلّ ما فيها، وأرقامه صحيحة", async () => {
    const { y, g1 } = await year();
    const res = await as(request(app).get(`/api/admin/archive/years/${y.id}`)).expect(200);

    expect(res.body.source).toBe("live");
    const r = res.body.record;
    expect(r.year.title).toBe(y.title);
    expect(r.students).toHaveLength(3);
    expect(r.topics).toHaveLength(3);
    expect(r.projects).toHaveLength(2);
    expect(r.defenses).toHaveLength(1);

    const s = r.summary;
    expect(s.students).toBe(3);
    expect(s.studentsWithProject).toBe(3);
    expect(s.projects).toBe(2);
    expect(s.defenses.completed).toBe(1);
    expect(s.averageGrade).toBe(15.5);
    expect(s.passRate).toBe(100);
    expect(s.mentions.good + s.mentions.veryGood).toBe(1);
    expect(s.mentions.veryGood).toBe(1); // 15.5 ⇒ جيّد جدّاً
    expect(s.topicsByStatus.pending).toBe(1);

    const p = r.projects.find((x: { id: string }) => x.id === g1.id);
    expect(p.members.map((m: { leader: boolean }) => m.leader)).toEqual([true, false]);
    expect(p.defense.committee).toHaveLength(2);
    expect(p.defense.mention).toBe("veryGood");
  });

  it("سنةٌ غير موجودة ⇒ 404", async () => {
    await as(request(app).get(`/api/admin/archive/years/00000000-0000-4000-8000-000000000000`)).expect(404);
  });

  it("ليست للطالب ولا للأستاذ", async () => {
    await as(request(app).get("/api/admin/archive/years"), studentToken).expect(403);
    await as(request(app).get("/api/admin/archive/years"), professorToken).expect(403);
  });
});

describe("GET /api/admin/archive/years/:id/readiness", () => {
  it("يعدّ ما بقي معلّقاً: مشروعٌ بلا مناقشة، وموضوعٌ ينتظر", async () => {
    const { y } = await year();
    const res = await as(request(app).get(`/api/admin/archive/years/${y.id}/readiness`)).expect(200);
    const by = Object.fromEntries(res.body.items.map((i: { key: string; count: number }) => [i.key, i.count]));
    expect(by.noDefense).toBe(1);
    expect(by.pendingTopics).toBe(1);
    expect(by.scheduledDefenses).toBe(0);
    expect(by.studentsWithout).toBe(0);
    expect(res.body.ready).toBe(false);
  });
});

//
// ═══ الإغلاق ═══
//

describe("POST /api/admin/archive/years/:id/close", () => {
  it("العنوان لا يُطابق ⇒ 400 ولا يتغيّر شيء", async () => {
    const { y } = await year();
    await close(y.id, { confirmTitle: "2000/2001" }).expect(400);
    const after = await prisma.academicYear.findUnique({ where: { id: y.id }, include: { archive: true } });
    expect(after!.archivedAt).toBeNull();
    expect(after!.archive).toBeNull();
  });

  it("يُجمَّد السجلّ: ما يتغيّر بعد الإغلاق لا يصل إليه", async () => {
    const { y, t1, d1 } = await year();
    await prisma.academicYear.update({ where: { id: y.id }, data: { isActive: true } });

    const res = await close(y.id, { confirmTitle: y.title, note: "  سنةٌ جيّدة  " }).expect(200);
    expect(res.body.summary.students).toBe(3);

    const saved = await prisma.academicYear.findUnique({ where: { id: y.id }, include: { archive: true } });
    expect(saved!.archivedAt).not.toBeNull();
    expect(saved!.isActive).toBe(false); // سنةٌ مغلقة ليست جارية
    expect(saved!.archive!.note).toBe("سنةٌ جيّدة");
    expect(saved!.archive!.archivedByName).toContain("Admin");

    // الجداول الحيّة تتغيّر…
    await prisma.graduationTopic.update({ where: { id: t1.id }, data: { title: `${TAG} renamed later` } });
    await prisma.defense.update({ where: { id: d1.id }, data: { grade: 4 } });

    // …والسجلّ لا.
    const rec = await as(request(app).get(`/api/admin/archive/years/${y.id}`)).expect(200);
    expect(rec.body.source).toBe("archive");
    expect(rec.body.note).toBe("سنةٌ جيّدة");
    expect(rec.body.record.projects.map((p: { title: string }) => p.title)).toContain(t1.title);
    expect(rec.body.record.summary.averageGrade).toBe(15.5);

    // والقائمة تقرأ أرقام الإغلاق.
    const list = await as(request(app).get("/api/admin/archive/years")).expect(200);
    const row = list.body.items.find((i: { id: string }) => i.id === y.id);
    expect(row.archivedAt).not.toBeNull();
    expect(row.counts).toMatchObject({ students: 3, topics: 3, projects: 2, defended: 1, averageGrade: 15.5 });
  });

  it("سنةٌ مؤرشفة لا تُغلق مرّتين", async () => {
    const { y } = await year();
    await close(y.id, { confirmTitle: y.title }).expect(200);
    await close(y.id, { confirmTitle: y.title }).expect(400);
    expect(await prisma.academicYearArchive.count({ where: { academicYearId: y.id } })).toBe(1);
  });

  it("مع سنةٍ تالية ⇒ تصير هي الجارية، وحدها", async () => {
    const { y } = await year();
    const next = await prisma.academicYear.create({ data: { title: `${TAG} next ${n}` } });
    const res = await close(y.id, { confirmTitle: y.title, nextYearId: next.id }).expect(200);
    expect(res.body.activeYearId).toBe(next.id);

    const active = await prisma.academicYear.findMany({ where: { isActive: true } });
    expect(active.map((a) => a.id)).toEqual([next.id]);
  });

  it("سنةٌ تالية جديدة بعنوانٍ غير صالح ⇒ 400", async () => {
    const { y } = await year();
    await close(y.id, { confirmTitle: y.title, nextYearTitle: "next year" }).expect(400);
    expect((await prisma.academicYear.findUnique({ where: { id: y.id } }))!.archivedAt).toBeNull();
  });
});

//
// ═══ ما لا تقبله سنةٌ مغلقة ═══
//

describe("a closed year takes nothing new", () => {
  let closed: Awaited<ReturnType<typeof year>>;

  beforeAll(async () => {
    closed = await year();
    await close(closed.y.id, { confirmTitle: closed.y.title }).expect(200);
  });

  it("لا تُفعَّل قبل إعادة فتحها", async () => {
    await as(request(app).patch(`/api/admin/academic-years/${closed.y.id}/activate`)).expect(400);
  });

  it("ولا تُحذف — حذفها يمحو سجلّها", async () => {
    await as(request(app).delete(`/api/admin/academic-years/${closed.y.id}`)).expect(400);
  });

  it("ولا يُضاف إليها طالب", async () => {
    const res = await as(
      request(app).post("/api/admin/students").send({
        firstName: TAG,
        lastName: "Late",
        firstNameLatin: "Late",
        lastNameLatin: "STUDENT",
        email: `${TAG}.late@test.local`,
        password: TEST_PASSWORD,
        registrationNumber: `${TAG}-LATE`,
        specializationId: f.specialization.id,
        academicYearId: closed.y.id,
      }),
    ).expect(400);
    expect(res.body.message).toContain("الأرشيف");
    expect(await prisma.student.count({ where: { registrationNumber: `${TAG}-LATE` } })).toBe(0);
  });

  it("ولا يُنقل إليها طالب", async () => {
    const [s] = f.nextStudents(1);
    await as(
      request(app).patch(`/api/admin/students/${s.id}`).send({ academicYearId: closed.y.id }),
    ).expect(400);
  });

  it("ولا يُقترح فيها موضوع — لا من الإدارة ولا من الأستاذ", async () => {
    const body = {
      title: `${TAG} too late`,
      description: `${TAG} d`,
      maxStudents: 2,
      specializationId: f.specialization.id,
      academicYearId: closed.y.id,
    };
    await as(request(app).post("/api/admin/topics").send({ ...body, professorId: f.professor.id })).expect(400);
    await as(request(app).post("/api/professor/topics").send(body), professorToken).expect(400);
    expect(await prisma.graduationTopic.count({ where: { title: `${TAG} too late` } })).toBe(0);
  });

  it("ولا تظهر في قائمة السنوات التي يختار منها الأستاذ", async () => {
    const res = await as(request(app).get("/api/common/academic-years"), professorToken).expect(200);
    const ids = JSON.stringify(res.body);
    expect(ids).not.toContain(closed.y.id);
    expect(ids).toContain(f.academicYear.id);
  });
});

//
// ═══ إعادة الفتح ═══
//

describe("POST /api/admin/archive/years/:id/reopen", () => {
  it("تعود حيّة: يزول المجمَّد وتعود الجداول سجلَّها، وتصير جارية إن طُلب", async () => {
    const { y, t1 } = await year();
    await close(y.id, { confirmTitle: y.title }).expect(200);
    await prisma.graduationTopic.update({ where: { id: t1.id }, data: { title: `${TAG} edited while closed` } });

    const res = await as(
      request(app).post(`/api/admin/archive/years/${y.id}/reopen`).send({ activate: true }),
    ).expect(200);
    expect(res.body.active).toBe(true);

    const saved = await prisma.academicYear.findUnique({ where: { id: y.id }, include: { archive: true } });
    expect(saved!.archivedAt).toBeNull();
    expect(saved!.archive).toBeNull();
    expect(saved!.isActive).toBe(true);

    const rec = await as(request(app).get(`/api/admin/archive/years/${y.id}`)).expect(200);
    expect(rec.body.source).toBe("live");
    expect(rec.body.record.topics.map((t: { title: string }) => t.title)).toContain(`${TAG} edited while closed`);

    // ثمّ تُغلق من جديد متى شاءت الإدارة.
    await close(y.id, { confirmTitle: y.title }).expect(200);
  });

  it("سنةٌ غير مؤرشفة ⇒ 400", async () => {
    const { y } = await year();
    await as(request(app).post(`/api/admin/archive/years/${y.id}/reopen`).send({})).expect(400);
  });
});
