/**
 * الرسائل — ما بقي بلا اختبار من قواعدها، على قاعدةٍ حقيقية.
 *
 *   - فريقٌ طلبُه على موضوعٍ **قيد الانتظار** يراسل أستاذ الموضوع ويتراسل
 *     أعضاؤه — قبل أن يُقبل الطلب، وهو حين يحتاجون الكلام أكثر؛
 *   - الردّ داخل محادثتي أنا، ومستلمٌ معطَّل، ومحادثةٌ لم يبقَ فيها أحد؛
 *   - جمهور التعميم بكلّ مُرشِّح، ووسمُه الذي يبقى بعد أن تتغيّر الأسماء؛
 *   - البحث والتصفية في الوارد والصادر، والحضور، وعلامات القراءة الفارغة.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
const tok: Record<string, string> = {};
type S = { id: string; userId: string; reg: string };
let L: S; // يقود طلباً قيد الانتظار على موضوع الأستاذ الثاني
let M: S; // عضوٌ في ذلك الطلب
let X: S; // غريبٌ عن كلّ شيء
let Z: S; // يُعطَّل حسابه في بعض الاختبارات
let requestId = "";

const as = (r: request.Test, who: string) => r.set("Authorization", `Bearer ${tok[who]}`);
const send = (who: string, recipientIds: string[], body = `${TAG} رسالة`) =>
  as(request(app).post("/api/messages").send({ recipientIds, subject: `${TAG} موضوع`, body }), who);
const audience = (q: Record<string, string>) =>
  as(request(app).get("/api/messages/audience").query(q), "admin").expect(200).then((r) => r.body.count as number);
const setStatus = (userId: string, status: "active" | "suspended") =>
  prisma.user.update({ where: { id: userId }, data: { status } });

async function studentLogin(reg: string) {
  return (await request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password: TEST_PASSWORD }).expect(200)).body
    .accessToken as string;
}

beforeAll(async () => {
  await teardown();
  f = await seed(6);
  [L, M, X, Z] = f.nextStudents(4) as unknown as [S, S, S, S];

  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} موضوع الأستاذ الثاني`,
      description: `${TAG} d`,
      maxStudents: 2,
      status: "open",
      professorId: f.professor2.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
  requestId = (
    await prisma.groupRequest.create({
      data: {
        topicId: topic.id,
        leaderStudentId: L.id,
        status: "pending",
        members: { create: [{ studentId: L.id }, { studentId: M.id }] },
      },
    })
  ).id;

  tok.admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body
    .accessToken;
  tok.prof2 = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: `${TAG}.emp2@test.local`, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  tok.L = await studentLogin(L.reg);
  tok.M = await studentLogin(M.reg);
  tok.X = await studentLogin(X.reg);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("فريقٌ طلبُه قيد الانتظار", () => {
  it("قائده يراسل أستاذ الموضوع وزميله", async () => {
    await send("L", [f.prof2User.id]).expect(201);
    await send("L", [M.userId]).expect(201);
  });

  it("وعضوه يراسل الأستاذ والقائد", async () => {
    await send("M", [f.prof2User.id]).expect(201);
    await send("M", [L.userId]).expect(201);
  });

  it("ولا يتّسع ذلك لغريب", async () => {
    await send("L", [X.userId]).expect(400);
  });

  it("ويظهران في جهات اتّصاله بصلتهما: مشرفٌ وزميل", async () => {
    const res = await as(request(app).get("/api/messages/contacts").query({ search: TAG, limit: 30 }), "L").expect(200);
    const rel = Object.fromEntries(res.body.items.map((c: { id: string; relation: string }) => [c.id, c.relation]));
    expect(rel[f.prof2User.id]).toBe("supervisor");
    expect(rel[M.userId]).toBe("teammate");
    expect(rel[X.userId]).toBeUndefined();
  });

  it("والأستاذ يراسل طلبة من طلبوا موضوعه", async () => {
    await send("prof2", [L.userId, M.userId]).expect(201);
  });

  it("وطلبٌ رُفض لا يفتح بابه: من لم يكتب إليه أحدٌ منهم لا يُراسَل", async () => {
    await prisma.groupRequest.update({ where: { id: requestId }, data: { status: "rejected" } });
    try {
      // M لم يكتب إلى X، وX غريب — والطلب المرفوض لا يُحسب.
      await send("X", [M.userId]).expect(400);
    } finally {
      await prisma.groupRequest.update({ where: { id: requestId }, data: { status: "pending" } });
    }
  });
});

describe("مستلمٌ معطَّل، وردٌّ في محادثتي", () => {
  afterEach(() => setStatus(Z.userId, "active"));

  it("لا تُرسل رسالةٌ إلى حسابٍ معطَّل", async () => {
    await setStatus(Z.userId, "suspended");
    await send("admin", [Z.userId]).expect(400);
  });

  it("والردّ على رسالتي يذهب إلى من أرسلتُها إليه", async () => {
    const first = await send("admin", [X.userId]).expect(201);
    const reply = await as(
      request(app).post(`/api/messages/${first.body.message.id}/reply`).send({ body: `${TAG} تتمّة` }),
      "admin",
    ).expect(201);
    const rows = await prisma.messageRecipient.findMany({ where: { messageId: reply.body.message.id } });
    expect(rows.map((r) => r.userId)).toEqual([X.userId]);
  });

  it("ومحادثةٌ عُطّل كلّ من فيها لا يُردّ فيها", async () => {
    const first = await send("admin", [Z.userId]).expect(201);
    await setStatus(Z.userId, "suspended");
    await as(request(app).post(`/api/messages/${first.body.message.id}/reply`).send({ body: "x" }), "admin").expect(400);
  });
});

describe("جمهور التعميم", () => {
  it("كلّ مُرشِّحٍ أكاديميّ يصل إلى طلبة الكلية نفسها هنا", async () => {
    const bySpec = await audience({ target: "students", specializationId: f.specialization.id });
    expect(bySpec).toBeGreaterThanOrEqual(6);
    expect(await audience({ target: "students", filiereId: f.filiere.id })).toBe(bySpec);
    expect(await audience({ target: "students", departmentId: f.department.id })).toBe(bySpec);
    expect(await audience({ target: "students", facultyId: f.faculty.id })).toBe(bySpec);
    expect(await audience({ target: "students", facultyId: f.faculty.id, level: "master" })).toBe(bySpec);
    expect(await audience({ target: "students", facultyId: f.faculty.id, level: "doctorate" })).toBe(0);
    expect(await audience({ target: "students", academicYearId: f.academicYear.id })).toBe(bySpec);
  });

  it("والأساتذة بقسمهم أو كليّتهم، و«الجميع» بمُرشِّح: طلبته وأساتذته معاً", async () => {
    expect(await audience({ target: "professors", departmentId: f.department.id })).toBe(2);
    expect(await audience({ target: "professors", facultyId: f.faculty.id })).toBe(2);
    const students = await audience({ target: "students", departmentId: f.department.id });
    expect(await audience({ target: "all", departmentId: f.department.id })).toBe(students + 2);
  });

  it("و«الجميع» بلا مُرشِّح: كلّ طالبٍ وأستاذٍ نشِط", async () => {
    const expected = await prisma.user.count({ where: { status: "active", role: { in: ["student", "professor"] } } });
    expect(await audience({ target: "all" })).toBe(expected);
  });

  it("والإدارة: كلّ مسؤولٍ نشِطٍ سواي", async () => {
    const expected = await prisma.user.count({ where: { status: "active", role: "admin", id: { not: f.admin.id } } });
    expect(await audience({ target: "admins" })).toBe(expected);
  });

  it("والوسم يحفظ ما ضُيِّق به الجمهور، بالأسماء", async () => {
    const res = await as(
      request(app).post("/api/messages/broadcast").send({
        target: "students",
        facultyId: f.faculty.id,
        level: "master",
        academicYearId: f.academicYear.id,
        project: "without",
        subject: `${TAG} تعميم`,
        body: "نصّ",
      }),
      "admin",
    ).expect(201);
    const msg = await prisma.message.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(msg.broadcast).toBe(`students|${TAG} faculty · @master · ${TAG} 2099/2100 · @project-without`);
  });

  it("وجمهورٌ فارغ لا يُعمَّم عليه", async () => {
    await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "students", facultyId: f.faculty.id, level: "doctorate", subject: `${TAG} لا أحد`, body: "نصّ" }),
      "admin",
    ).expect(400);
  });
});

describe("الوارد والصادر: البحث والتصفية", () => {
  const word = `${TAG}-كلمة-نادرة`;

  beforeAll(async () => {
    await send("admin", [X.userId], `نصٌّ فيه ${word}`).expect(201);
  });

  it("البحث في الوارد يجد الرسالة بكلمةٍ من نصّها", async () => {
    const res = await as(request(app).get("/api/messages/inbox").query({ search: word }), "X").expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].message.body).toContain(word);
  });

  it("والتصفية: المباشر، والتعميم، وغير المقروء", async () => {
    const list = async (filter: string) =>
      (await as(request(app).get("/api/messages/inbox").query({ filter, limit: 100 }), "X").expect(200)).body.items as {
        readAt: string | null;
        message: { broadcast: string | null };
      }[];
    expect((await list("direct")).every((r) => r.message.broadcast === null)).toBe(true);
    expect((await list("broadcast")).every((r) => r.message.broadcast !== null)).toBe(true);
    expect((await list("broadcast")).length).toBeGreaterThan(0);
    expect((await list("unread")).every((r) => r.readAt === null)).toBe(true);
  });

  it("والصادر كذلك", async () => {
    const sent = async (filter: string) =>
      (await as(request(app).get("/api/messages/sent").query({ filter, limit: 100 }), "admin").expect(200)).body.items as {
        broadcast: string | null;
      }[];
    const broadcasts = await sent("broadcast");
    expect(broadcasts.length).toBeGreaterThan(0);
    expect(broadcasts.every((m) => m.broadcast !== null)).toBe(true);
    expect((await sent("direct")).every((m) => m.broadcast === null)).toBe(true);
  });
});

describe("الحضور وعلامات القراءة", () => {
  it("الطالب يسأل عمّن يراسلهم، والإدارة عن أيّ أحد — ولا أحد متّصلٌ هنا", async () => {
    const ids = [f.prof2User.id, X.userId].join(",");
    const mine = await as(request(app).get("/api/messages/presence").query({ ids }), "L").expect(200);
    expect(mine.body.online).toEqual({ [f.prof2User.id]: false, [X.userId]: false });
    const admin = await as(request(app).get("/api/messages/presence").query({ ids }), "admin").expect(200);
    expect(Object.keys(admin.body.online)).toHaveLength(2);
    const none = await as(request(app).get("/api/messages/presence").query({ ids: " , " }), "L").expect(200);
    expect(none.body.online).toEqual({});
  });

  it("تعليم المقروء مقروءاً مرّةً ثانية لا يغيّر شيئاً", async () => {
    const msg = await send("admin", [X.userId]).expect(201);
    const id = msg.body.message.id;
    expect((await as(request(app).patch(`/api/messages/${id}/read`), "X").expect(200)).body.updated).toBeGreaterThan(0);
    expect((await as(request(app).patch(`/api/messages/${id}/read`), "X").expect(200)).body.updated).toBe(0);
  });

  it("و«تعليم الكلّ» و«المحادثة مقروءة» بلا جديد ⇒ صفر", async () => {
    await as(request(app).patch("/api/messages/read-all"), "X").expect(200);
    expect((await as(request(app).patch("/api/messages/read-all"), "X").expect(200)).body.updated).toBe(0);
    expect((await as(request(app).patch(`/api/messages/chat/${f.admin.id}/read`), "X").expect(200)).body.updated).toBe(0);
  });
});

describe("ما بقي من المسارات الحقيقية", () => {
  it("الأساتذة بلا مُرشِّح: كلّ أستاذٍ نشِط", async () => {
    const expected = await prisma.user.count({ where: { status: "active", role: "professor" } });
    expect(await audience({ target: "professors" })).toBe(expected);
  });

  it("ووسم التعميم بالشعبة، أو بالقسم", async () => {
    for (const [key, id, name] of [
      ["filiereId", f.filiere.id, `${TAG} filiere`],
      ["departmentId", f.department.id, `${TAG} dept`],
    ] as const) {
      const res = await as(
        request(app).post("/api/messages/broadcast").send({ target: "students", [key]: id, subject: `${TAG} وسم`, body: "نصّ" }),
        "admin",
      ).expect(201);
      expect((await prisma.message.findUniqueOrThrow({ where: { id: res.body.id } })).broadcast).toBe(`students|${name}`);
    }
  });

  it("و«غير المقروء» بالمُعامِل القديم (unread=true) كما بالجديد", async () => {
    await send("admin", [X.userId]).expect(201);
    const old = await as(request(app).get("/api/messages/inbox").query({ unread: "true", limit: 100 }), "X").expect(200);
    const now = await as(request(app).get("/api/messages/inbox").query({ filter: "unread", limit: 100 }), "X").expect(200);
    expect(old.body.total).toBeGreaterThan(0);
    expect(old.body.total).toBe(now.body.total);
  });

  it("والردّ على رسالةٍ لا وجود لها، أو تعليمها غير مقروءة ⇒ 404", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    await as(request(app).post(`/api/messages/${ghost}/reply`).send({ body: "x" }), "X").expect(404);
    await as(request(app).patch(`/api/messages/${ghost}/unread`), "X").expect(404);
  });

  /**
   * حذفتُ أوّل المحادثة من صندوقي وأبقيتُ الردّ: يُفتح الردّ وحده، وعنوانه
   * عنوانه هو — لا عنوان رسالةٍ لم تعد عندي.
   */
  it("وردٌّ حُذف أوّلُ محادثته من صندوقي يُفتح بعنوانه هو", async () => {
    const root = await send("admin", [X.userId], `${TAG} الأولى`).expect(201);
    const reply = await as(
      request(app).post(`/api/messages/${root.body.message.id}/reply`).send({ body: `${TAG} الثانية` }),
      "admin",
    ).expect(201);
    await as(request(app).delete(`/api/messages/${root.body.message.id}`), "X").expect(200);

    const res = await as(request(app).get(`/api/messages/${reply.body.message.id}`), "X").expect(200);
    expect(res.body.thread.map((m: { id: string }) => m.id)).toEqual([reply.body.message.id]);
    expect(res.body.subject).toBe(reply.body.message.subject);
  });
});
