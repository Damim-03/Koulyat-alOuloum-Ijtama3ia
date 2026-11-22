/**
 * نوعُ الموضوع ومشرفه المساعد ووصفه القصير — ما تطبعه قائمة المواضيع الرسمية.
 *
 *   ١. الإدارة تضع أنواع كلّ قسم: رمزٌ فريدٌ في القسم مهما كانت حالة حروفه،
 *      ولونٌ؛ ونوعٌ عليه مواضيع لا يُحذف ويُقال كم عليه.
 *   ٢. نموذج الموضوع يأخذ أنواع قسم تخصّصه (`/common/topic-types`)، وأساتذةَ
 *      المنصّة للمشرف المساعد (`/common/professors`) — للأستاذ والإدارة وحدهما،
 *      والقارئ معلَّمٌ فيها.
 *   ٣. كلّ مسارٍ يكتب موضوعاً يحرسها بقاعدةٍ واحدة: المشرف المساعد أستاذٌ من
 *      المنصّة غيرُ المشرف (ولو تغيّر المشرف)، والنوع من قسم التخصّص (ولو
 *      تغيّر التخصّص)، والوصف القصير ٣٠٠ حرفٍ على الأكثر؛ و`null` يمسح.
 *   ٤. وتصل إلى قائمة العناوين وإلى صفحة الموضوع العامّة.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, makeTopic, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
let student = "";
let otherDept: { id: string };
let otherSpec: { id: string };

const login = async (path: string, body: object) => `Bearer ${(await request(app).post(path).send(body).expect(200)).body.accessToken}`;

beforeAll(async () => {
  await teardown();
  f = await seed(2);
  admin = await login("/api/auth/admin/login", { email: f.admin.email, password: TEST_PASSWORD });
  prof = await login("/api/auth/professor/login", { universityEmail: `${TAG}.emp@test.local`, password: TEST_PASSWORD });
  student = await login("/api/auth/student/login", { registrationNumber: f.students[0]!.reg, password: TEST_PASSWORD });
  // A second department, with its own specialization: its types are not the first one's.
  otherDept = await prisma.department.create({ data: { name: `${TAG} dept B`, code: `${TAG}-DEPB`, facultyId: f.faculty.id } });
  const fil = await prisma.filiere.create({ data: { name: `${TAG} filiere B`, code: `${TAG}-FILB`, departmentId: otherDept.id } });
  otherSpec = await prisma.specialization.create({ data: { name: `${TAG} spec B`, level: "master", filiereId: fil.id } });
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const newType = (body: object) => request(app).post("/api/admin/topic-types").set("Authorization", admin).send(body);

describe("أنواع المواضيع — الإدارة", () => {
  it("تُضاف برمزٍ ولون، والرمز فريدٌ في القسم مهما كانت حروفه؛ وفي قسمٍ آخر يتكرّر", async () => {
    const ai = await newType({ departmentId: f.department.id, name: "الذكاء الاصطناعي", code: "AI", color: "#DBEAFE" }).expect(201);
    expect(ai.body.type).toMatchObject({ code: "AI", color: "#dbeafe", sortOrder: 0, topicsCount: 0, department: { id: f.department.id } });
    const iot = await newType({ departmentId: f.department.id, name: "إنترنت الأشياء", code: "IoT", color: "#dcfce7" }).expect(201);
    expect(iot.body.type.sortOrder).toBe(1);

    const taken = await newType({ departmentId: f.department.id, name: "آخر", code: "ai", color: "#ffffff" }).expect(409);
    expect(taken.body.message).toBe(tr("topicType.codeTaken", { code: "ai" }));
    await newType({ departmentId: otherDept.id, name: "AI B", code: "AI", color: "#ffffff" }).expect(201);

    await newType({ departmentId: f.department.id, name: "x", code: "9X", color: "#ffffff" }).expect(400);
    await newType({ departmentId: f.department.id, name: "x", code: "OK", color: "blue" }).expect(400);
    await newType({ departmentId: f.department.id, name: "", code: "OK", color: "#ffffff" }).expect(400);

    const list = await request(app).get("/api/admin/topic-types").query({ departmentId: f.department.id }).set("Authorization", admin).expect(200);
    expect(list.body.types.map((x: { code: string }) => x.code)).toEqual(["AI", "IoT"]);
  });

  it("تُعدَّل؛ ورمزٌ مأخوذ في التعديل يُردّ", async () => {
    const [ai, iot] = await prisma.topicType.findMany({ where: { departmentId: f.department.id }, orderBy: { sortOrder: "asc" } });
    const res = await request(app).patch(`/api/admin/topic-types/${iot!.id}`).set("Authorization", admin).send({ name: "إنترنت الأشياء والأنظمة المدمجة" }).expect(200);
    expect(res.body.type.name).toBe("إنترنت الأشياء والأنظمة المدمجة");
    await request(app).patch(`/api/admin/topic-types/${iot!.id}`).set("Authorization", admin).send({ code: "AI" }).expect(409);
    // Its own code, in another case: not taken by itself.
    await request(app).patch(`/api/admin/topic-types/${ai!.id}`).set("Authorization", admin).send({ code: "ai" }).expect(200);
    await request(app).patch(`/api/admin/topic-types/${ai!.id}`).set("Authorization", admin).send({ code: "AI" }).expect(200);
    await request(app).patch(`/api/admin/topic-types/${ai!.id}`).set("Authorization", admin).send({}).expect(400);
  });

  it("للإدارة وحدها", async () => {
    await request(app).get("/api/admin/topic-types").set("Authorization", prof).expect(403);
    await request(app).post("/api/admin/topic-types").set("Authorization", prof).send({}).expect(403);
  });
});

describe("ما يعرضه نموذج الموضوع", () => {
  it("أنواع قسم التخصّص؛ وتخصّصٌ مجهول لا نوع له", async () => {
    const mine = await request(app).get("/api/common/topic-types").query({ specializationId: f.specialization.id }).set("Authorization", prof).expect(200);
    expect(mine.body.types.map((x: { code: string }) => x.code)).toEqual(["AI", "IoT"]);
    const theirs = await request(app).get("/api/common/topic-types").query({ specializationId: otherSpec.id }).set("Authorization", prof).expect(200);
    expect(theirs.body.types.map((x: { departmentId: string }) => x.departmentId)).toEqual([otherDept.id]);
    const unknown = await request(app).get("/api/common/topic-types").query({ specializationId: "00000000-0000-4000-8000-000000000000" }).set("Authorization", prof).expect(200);
    expect(unknown.body.types).toEqual([]);
  });

  it("أساتذة المنصّة للمشرف المساعد: القارئ معلَّم، ولا يراها الطالب", async () => {
    const res = await request(app).get("/api/common/professors").set("Authorization", prof).expect(200);
    const mine = res.body.professors.filter((p: { id: string }) => [f.professor.id, f.professor2.id].includes(p.id));
    expect(mine).toHaveLength(2);
    expect(mine.find((p: { id: string }) => p.id === f.professor.id).isMe).toBe(true);
    expect(mine.find((p: { id: string }) => p.id === f.professor2.id).isMe).toBe(false);
    expect(Object.keys(mine[0]).sort()).toEqual(["department", "firstName", "firstNameLatin", "id", "isMe", "lastName", "lastNameLatin"]);
    await request(app).get("/api/common/professors").set("Authorization", admin).expect(200);
    await request(app).get("/api/common/professors").set("Authorization", student).expect(403);
  });
});

describe("كلّ مسارٍ يكتب موضوعاً يحرسها", () => {
  const types = async () => {
    const [ai, iot] = await prisma.topicType.findMany({ where: { departmentId: f.department.id }, orderBy: { sortOrder: "asc" } });
    const b = await prisma.topicType.findFirstOrThrow({ where: { departmentId: otherDept.id } });
    return { ai: ai!, iot: iot!, b };
  };
  const proposal = (over: object) => ({
    title: `${TAG} مقترح ${Math.random().toString(36).slice(2, 8)}`,
    description: "وصف",
    maxStudents: 2,
    specializationId: f.specialization.id,
    academicYearId: f.academicYear.id,
    ...over,
  });
  const propose = (over: object, token = prof) => request(app).post("/api/professor/topics").set("Authorization", token).send(proposal(over));

  it("الأستاذ: نوعٌ من قسم التخصّص، ومشرفٌ مساعدٌ غيرُه من المنصّة، ووصفٌ قصير", async () => {
    const { ai, b } = await types();
    const bad = await propose({ typeId: b.id }).expect(400);
    expect(bad.body.message).toBe(tr("topic.typeOtherDepartment"));
    const self = await propose({ coSupervisorId: f.professor.id }).expect(400);
    expect(self.body.message).toBe(tr("topic.coSupervisorSelf"));
    const ghost = await propose({ coSupervisorId: "00000000-0000-4000-8000-000000000000" }).expect(404);
    expect(ghost.body.message).toBe(tr("topic.coSupervisorNotFound"));
    await propose({ summary: "س".repeat(301) }).expect(400);

    const ok = await propose({ typeId: ai.id, coSupervisorId: f.professor2.id, summary: "  تصنيف الصور الطبية  " });
    expect([200, 201]).toContain(ok.status);
    const saved = await prisma.graduationTopic.findFirstOrThrow({ where: { professorId: f.professor.id, typeId: ai.id } });
    expect(saved).toMatchObject({ coSupervisorId: f.professor2.id, summary: "تصنيف الصور الطبية" });

    // Its reader gets them: the co-supervisor by name, the type with its code and colour.
    const read = await request(app).get(`/api/professor/topics/${saved.id}`).set("Authorization", prof).expect(200);
    const topic = read.body.topic ?? read.body;
    expect(topic.type).toMatchObject({ code: "AI", color: ai.color });
    expect(topic.coSupervisor.id).toBe(f.professor2.id);
    expect(topic.summary).toBe("تصنيف الصور الطبية");
  });

  it("تعديل الأستاذ: `null` يمسح، والغائب يبقى، وتخصّصٌ من قسمٍ آخر يُسقط نوعاً قائماً", async () => {
    const { ai } = await types();
    const t = await prisma.graduationTopic.findFirstOrThrow({ where: { professorId: f.professor.id, typeId: ai.id } });
    await request(app).put(`/api/professor/topics/${t.id}`).set("Authorization", prof).send({ title: `${TAG} معدّل` }).expect(200);
    expect(await prisma.graduationTopic.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ typeId: ai.id, coSupervisorId: f.professor2.id });

    const moved = await request(app).put(`/api/professor/topics/${t.id}`).set("Authorization", prof).send({ specializationId: otherSpec.id }).expect(400);
    expect(moved.body.message).toBe(tr("topic.typeOtherDepartment"));

    await request(app).put(`/api/professor/topics/${t.id}`).set("Authorization", prof).send({ coSupervisorId: null, summary: null, typeId: null }).expect(200);
    expect(await prisma.graduationTopic.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ typeId: null, coSupervisorId: null, summary: null });
  });

  it("الإدارة: موضوعٌ بها، وتغيير المشرف إلى المشرف المساعد يُردّ", async () => {
    const { iot } = await types();
    const created = await request(app)
      .post("/api/admin/topics")
      .set("Authorization", admin)
      .send({ ...proposal({}), professorId: f.professor.id, typeId: iot.id, coSupervisorId: f.professor2.id, summary: "قصير" })
      .expect(201);
    const id = created.body.topic?.id ?? created.body.id;
    expect(await prisma.graduationTopic.findUniqueOrThrow({ where: { id } })).toMatchObject({ typeId: iot.id, coSupervisorId: f.professor2.id, summary: "قصير" });

    // Assigned to a team, then edited: the supervisor cannot become the co-supervisor.
    const assigned = await request(app)
      .post("/api/admin/topics/assigned")
      .set("Authorization", admin)
      .send({
        ...proposal({}),
        professorId: f.professor.id,
        coSupervisorId: f.professor2.id,
        memberStudentIds: [f.students[1]!.id],
        leaderStudentId: f.students[1]!.id,
      })
      .expect(201);
    const aid = assigned.body.topic?.id ?? assigned.body.id;
    const clash = await request(app)
      .patch(`/api/admin/topics/${aid}/assignment`)
      .set("Authorization", admin)
      .send({ professorId: f.professor2.id })
      .expect(400);
    expect(clash.body.message).toBe(tr("topic.coSupervisorSelf"));
    // Together with clearing the co-supervisor, it goes through.
    await request(app).patch(`/api/admin/topics/${aid}/assignment`).set("Authorization", admin).send({ professorId: f.professor2.id, coSupervisorId: null }).expect(200);
    expect(await prisma.graduationTopic.findUniqueOrThrow({ where: { id: aid } })).toMatchObject({ professorId: f.professor2.id, coSupervisorId: null });
  });

  it("نوعٌ عليه مواضيع لا يُحذف ويقول كم؛ وبعد نقلها يُحذف", async () => {
    const { iot } = await types();
    const count = await prisma.graduationTopic.count({ where: { typeId: iot.id } });
    expect(count).toBeGreaterThan(0);
    const refused = await request(app).delete(`/api/admin/topic-types/${iot.id}`).set("Authorization", admin).expect(409);
    expect(refused.body.message).toBe(tr("topicType.inUse", { count }));
    await prisma.graduationTopic.updateMany({ where: { typeId: iot.id }, data: { typeId: null } });
    await request(app).delete(`/api/admin/topic-types/${iot.id}`).set("Authorization", admin).expect(200);
    await request(app).delete(`/api/admin/topic-types/${iot.id}`).set("Authorization", admin).expect(404);
  });
});

describe("وتصل إلى ما يُقرأ", () => {
  it("قائمة العناوين: المشرف المساعد والنوع والوصف القصير — أو بداية الكامل — والأسماء اللاتينية", async () => {
    const { id: aiId } = await prisma.topicType.findFirstOrThrow({ where: { departmentId: f.department.id, code: "AI" } });
    await prisma.department.update({ where: { id: f.department.id }, data: { nameLatin: "Département test" } });
    const typed = await makeTopic(f, "قائمة بنوع", "open");
    await prisma.graduationTopic.update({ where: { id: typed.id }, data: { typeId: aiId, coSupervisorId: f.professor2.id, summary: "سطرٌ قصير" } });
    const plain = await makeTopic(f, "قائمة بلا قصير", "open");
    await prisma.graduationTopic.update({ where: { id: plain.id }, data: { description: `${"كلمة ".repeat(80)}النهاية` } });

    const res = await request(app)
      .get("/api/admin/topics/titles-list")
      .query({ mode: "before", academicYearId: f.academicYear.id, specializationId: f.specialization.id })
      .set("Authorization", admin)
      .expect(200);
    const group = res.body.groups[0];
    expect(group.department.nameLatin).toBe("Département test");
    expect(group.faculty).toHaveProperty("nameLatin", null);
    const rows = group.rows as { id: string; summary: string | null; excerpt: string | null; type: { code: string } | null; coSupervisor: { id: string } | null }[];
    const a = rows.find((r) => r.id === typed.id)!;
    expect(a).toMatchObject({ summary: "سطرٌ قصير", excerpt: null, type: { code: "AI" }, coSupervisor: { id: f.professor2.id } });
    const b = rows.find((r) => r.id === plain.id)!;
    expect(b.summary).toBeNull();
    expect(b.excerpt!.length).toBeLessThanOrEqual(300);
    expect(b.excerpt!.endsWith("…")).toBe(true);
  });

  it("صفحة الموضوع العامّة: نوعه ومشرفه المساعد ووصفه القصير", async () => {
    const typed = await prisma.graduationTopic.findFirstOrThrow({ where: { title: `${TAG} قائمة بنوع` } });
    const res = await request(app).get(`/api/public/topics/${typed.id}`).set("Authorization", prof).expect(200);
    expect(res.body.topic).toMatchObject({ summary: "سطرٌ قصير", type: { code: "AI" }, coSupervisor: { id: f.professor2.id } });
  });
});
