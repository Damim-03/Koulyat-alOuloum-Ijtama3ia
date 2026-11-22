/**
 * تعديل الرسالة بعد إرسالها، وسحبُ الإدارة رسالتها من عند الجميع.
 *
 *   ١. **التعديل** لكلّ الأدوار، لصاحب الرسالة وحده، وخلال ١٥ دقيقة من
 *      إرسالها — بعدها يكون قد قُرئ ورُدّ عليه. ويُعلَّم «معدّلة» عند الجميع.
 *   ٢. **الحذف عند الجميع** للإدارة وحدها، ولرسائلها هي، **بلا أثر**: تزول
 *      الرسالة وملفّاتها ونسخها من كلّ صندوق، كأنّها لم تُرسل — لا «حُذفت»
 *      مكانها، ولا تبقى غير مقروءة. ويُسجَّل الحذف في سجلّ العمليات بلا نصّها.
 */
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

const DIR = path.resolve(process.env.MESSAGE_FILES_DIR ?? path.join(process.cwd(), "storage", "messages"));

let f: Fixture;
const tok: Record<string, string> = {};
let A: { id: string; userId: string; reg: string };
let B: { id: string; userId: string; reg: string };

const as = (r: request.Test, who: string) => r.set("Authorization", `Bearer ${tok[who]}`);
const send = (who: string, to: string, body: string, attachmentIds?: string[]) =>
  as(request(app).post("/api/messages").send({ recipientIds: [to], body, attachmentIds }), who).expect(201);
const edit = (who: string, id: string, body: string) => as(request(app).patch(`/api/messages/${id}`).send({ body }), who);
const retract = (who: string, id: string) => as(request(app).delete(`/api/messages/${id}/for-everyone`), who);
const chatOf = async (who: string, otherUserId: string) =>
  (await as(request(app).get(`/api/messages/chat/${otherUserId}`), who).expect(200)).body.items as {
    id: string;
    body: string;
    editedAt: string | null;
    attachments: unknown[];
  }[];

beforeAll(async () => {
  await teardown();
  f = await seed(3);
  [A, B] = f.nextStudents(2);
  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} EDIT topic`,
      description: `${TAG} d`,
      maxStudents: 3,
      status: "full",
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
  const group = await prisma.projectGroup.create({ data: { topicId: topic.id } });
  await prisma.projectMember.createMany({
    data: [
      { groupId: group.id, studentId: A.id, isLeader: true },
      { groupId: group.id, studentId: B.id },
    ],
  });
  const login = async (reg: string) =>
    (await request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password: TEST_PASSWORD }).expect(200))
      .body.accessToken as string;
  tok.A = await login(A.reg);
  tok.B = await login(B.reg);
  tok.admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body
    .accessToken;
});

afterAll(async () => {
  const files = await prisma.messageAttachment.findMany({
    where: { uploader: { email: { startsWith: TAG } } },
    select: { id: true, storedName: true },
  });
  await prisma.messageAttachment.deleteMany({ where: { id: { in: files.map((x) => x.id) } } });
  files.forEach((x) => fs.rmSync(path.join(DIR, x.storedName), { force: true }));
  await prisma.auditLog.deleteMany({ where: { actorId: f.admin.id } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("التعديل", () => {
  it("صاحب الرسالة يعدّلها خلال ١٥ دقيقة ⇒ يراها الآخر بنصّها الجديد، «معدّلة»", async () => {
    const m = (await send("A", B.userId, "موعدنا الأحد")).body.message;
    const res = await edit("A", m.id, "موعدنا الإثنين").expect(200);
    expect(res.body.message).toMatchObject({ id: m.id, body: "موعدنا الإثنين" });
    expect(res.body.message.editedAt).toBeTruthy();

    const seen = (await chatOf("B", A.userId)).find((x) => x.id === m.id)!;
    expect(seen.body).toBe("موعدنا الإثنين");
    expect(seen.editedAt).toBeTruthy();
  });

  it("والنصّ نفسه ⇒ لا يُعلَّم «معدّلة»", async () => {
    const m = (await send("A", B.userId, "كما هو")).body.message;
    const res = await edit("A", m.id, "  كما هو ").expect(200);
    expect(res.body.message.editedAt).toBeNull();
  });

  it("بعد ١٥ دقيقة ⇒ 400 بسببه", async () => {
    const m = (await send("A", B.userId, "قديمة")).body.message;
    await prisma.message.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    const res = await edit("A", m.id, "جديدة").expect(400);
    expect(res.body.message).toBe(tr("messages.editWindowPassed", { minutes: 15 }));
  });

  it("رسالة غيري ⇒ 404 — ولو وصلتني", async () => {
    const m = (await send("A", B.userId, "لك")).body.message;
    await edit("B", m.id, "عدّلتها أنا").expect(404);
  });

  it("نصٌّ فارغ ⇒ يُرفض إلّا إن كان في الرسالة ملفّ", async () => {
    const plain = (await send("A", B.userId, "نصّ")).body.message;
    expect((await edit("A", plain.id, "   ").expect(400)).body.message).toBe(tr("messages.bodyOrFile"));

    const up = await as(
      request(app).post("/api/messages/attachments").attach("file", Buffer.from("%PDF-1.7\n%%EOF"), { filename: "ملف.pdf" }),
      "A",
    ).expect(201);
    const withFile = (await send("A", B.userId, "مع ملف", [up.body.attachment.id])).body.message;
    const res = await edit("A", withFile.id, "").expect(200);
    expect(res.body.message.body).toBe("");
    expect(res.body.message.attachments).toHaveLength(1);
  });
});

describe("الحذف عند الجميع", () => {
  it("المسؤول يحذف رسالته ⇒ تزول من عند المستلم بلا أثر، مع ملفّها، ولا تُعدّ غير مقروءة، وتُسجَّل", async () => {
    const up = await as(
      request(app).post("/api/messages/attachments").attach("file", Buffer.from("%PDF-1.7\n%%EOF"), { filename: "جدول.pdf" }),
      "admin",
    ).expect(201);
    const stored = (await prisma.messageAttachment.findUniqueOrThrow({ where: { id: up.body.attachment.id } })).storedName;
    const m = (await send("admin", A.userId, "رسالة بالخطأ", [up.body.attachment.id])).body.message;
    const unreadBefore = (await as(request(app).get("/api/messages/unread-count"), "A").expect(200)).body.count;

    await retract("admin", m.id).expect(200);

    expect((await chatOf("A", f.admin.id)).find((x) => x.id === m.id)).toBeUndefined();
    expect(await prisma.message.findUnique({ where: { id: m.id } })).toBeNull();
    expect(await prisma.messageRecipient.count({ where: { messageId: m.id } })).toBe(0);
    expect(fs.existsSync(path.join(DIR, stored))).toBe(false);
    await as(request(app).get(`/api/messages/attachments/${up.body.attachment.id}`), "A").expect(404);
    expect((await as(request(app).get("/api/messages/unread-count"), "A").expect(200)).body.count).toBe(unreadBefore - 1);

    const log = await prisma.auditLog.findFirst({ where: { action: "message.deletedForEveryone", targetId: m.id } });
    expect(log).toBeTruthy();
    expect(JSON.stringify(log!.details)).not.toContain("رسالة بالخطأ");

    // Nor does the conversation list name it.
    const list = await as(request(app).get("/api/messages/conversations"), "A").expect(200);
    expect(JSON.stringify(list.body)).not.toContain(m.id);
  });

  it("وبعد حذفها لا شيء: لا ردّ، ولا تعديل، ولا حذفٌ ثانٍ — كأنّها لم تكن", async () => {
    const m = (await send("admin", A.userId, "ستُحذف")).body.message;
    await retract("admin", m.id).expect(200);
    await retract("admin", m.id).expect(404);
    await as(request(app).post(`/api/messages/${m.id}/reply`).send({ body: "ردّ" }), "A").expect(404);
    await edit("admin", m.id, "تعديل").expect(404);
    await as(request(app).get(`/api/messages/${m.id}`), "A").expect(404);
  });

  it("والتعميم كذلك: يزول من عند كلّ من وصله", async () => {
    const res = await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "students", specializationId: f.specialization.id, subject: `${TAG} تنبيه`, body: "تعميم بالخطأ" }),
      "admin",
    ).expect(201);
    await retract("admin", res.body.id).expect(200);
    await as(request(app).get(`/api/messages/${res.body.id}`), "B").expect(404);
    const inbox = await as(request(app).get("/api/messages/inbox"), "B").expect(200);
    expect(JSON.stringify(inbox.body)).not.toContain(res.body.id);
  });

  it("ليس لغير الإدارة ⇒ 403؛ ولا لرسالةٍ لم يرسلها المسؤول ⇒ 404", async () => {
    const mine = (await send("A", B.userId, "رسالة طالب")).body.message;
    await retract("A", mine.id).expect(403);
    const toAdmin = (await send("A", f.admin.id, "إلى الإدارة")).body.message;
    await retract("admin", toAdmin.id).expect(404);
    const still = (await chatOf("admin", A.userId)).find((x) => x.id === toAdmin.id)!;
    expect(still.body).toBe("إلى الإدارة");
  });
});
