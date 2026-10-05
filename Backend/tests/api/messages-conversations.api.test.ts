/**
 * الرسائل — المحادثات والجمهور وجهات الاتصال والزمن الحقيقي.
 *
 * ما يحرسه هذا الملفّ فوق قواعد «من يراسل مَن» (في messages.api.test.ts):
 *
 *   • الردّ يبقى في محادثته، ويصل كاتبَ الرسالة وحده إلا إن طُلب «الردّ على الكل».
 *   • مستلم التعميم لا يرى من استلمه غيره؛ والمرسِل وحده يرى من قرأ ومتى.
 *   • الحذف من الوارد لا يُنقص عدد مستلمي المرسِل ولا يمحو إيصال قراءته.
 *   • جهات الاتصال هي بالضبط من يقبل الخادمُ الإرسالَ إليه.
 *   • الجمهور الدقيق يُعدّ قبل الإرسال، ولا يشمل الحسابات الموقوفة.
 *   • والرسالة تصل شاشة مستلمها لحظة حفظها، وإيصال القراءة يصل مرسِلها.
 */
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import request from "supertest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";

import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
const tok: Record<string, string> = {};
let A: { id: string; userId: string; reg: string };
let B: { id: string; userId: string; reg: string };
let outsider: { id: string; userId: string; reg: string };

let httpServer: HttpServer;
let closeIo: () => void = () => {};
let url = "";
let open: ClientSocket[] = [];

const as = (r: request.Test, who: string) => r.set("Authorization", `Bearer ${tok[who]}`);

async function loginStudent(reg: string) {
  return (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;
}

const send = (who: string, recipientIds: string[], subject: string, body = `${TAG} نصّ`) =>
  as(request(app).post("/api/messages").send({ recipientIds, subject: `${TAG} ${subject}`, body }), who);

function connect(token: string): Promise<ClientSocket> {
  const socket = ioClient(url, { transports: ["websocket"], reconnection: false, auth: { token } });
  open.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function catchEvent(socket: ClientSocket, event: string, match: (p: any) => boolean = () => true, ms = 1500) {
  return new Promise<any>((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload: any) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

beforeAll(async () => {
  await teardown();
  f = await seed(8);
  [A, B, outsider] = f.nextStudents(3);

  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} CONV topic`,
      description: `${TAG} description`,
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

  tok.admin = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  tok.professor = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  tok.A = await loginStudent(A.reg);
  tok.B = await loginStudent(B.reg);
  tok.outsider = await loginStudent(outsider.reg);

  expect(config.PORT).toBe(0);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../../src/server") as typeof import("../../src/server");
  httpServer = mod.server;
  closeIo = () => mod.io.close();
  if (!httpServer.listening) await once(httpServer, "listening");
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const s of open) s.close();
  open = [];
});

afterAll(async () => {
  for (const s of open) s.close();
  closeIo();
  if (httpServer?.listening) {
    httpServer.close();
    await once(httpServer, "close");
  }
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("المحادثة: الردّ يبقى في مكانه", () => {
  it("الأستاذ يكتب إلى A و B، وA يردّ ⇒ يصل الأستاذ وحده، وفي المحادثة نفسها", async () => {
    const first = await send("professor", [A.userId, B.userId], "محادثة").expect(201);
    const rootId = first.body.message.id;

    const reply = await as(
      request(app).post(`/api/messages/${rootId}/reply`).send({ body: `${TAG} ردّ A` }),
      "A",
    ).expect(201);
    expect(reply.body.message.threadId).toBe(rootId);
    expect(reply.body.message.replyToId).toBe(rootId);

    const rows = await prisma.messageRecipient.findMany({ where: { messageId: reply.body.message.id } });
    expect(rows.map((r) => r.userId)).toEqual([f.professor.userId]);

    // والمحادثة تُقرأ من أيّ رسالةٍ فيها، بترتيبها.
    const thread = await as(request(app).get(`/api/messages/${reply.body.message.id}`), "professor").expect(200);
    expect(thread.body.rootId).toBe(rootId);
    expect(thread.body.thread.map((m: any) => m.id)).toEqual([rootId, reply.body.message.id]);
    expect(thread.body.thread[0].mine).toBe(true);
    expect(thread.body.thread[1].mine).toBe(false);

    // و B لا يرى ردّ A لأنه لم يُرسَل إليه.
    const forB = await as(request(app).get(`/api/messages/${rootId}`), "B").expect(200);
    expect(forB.body.thread.map((m: any) => m.id)).toEqual([rootId]);
  });

  it("و«الردّ على الكل» يصل الكاتب وبقية المستلمين", async () => {
    const first = await send("professor", [A.userId, B.userId], "للجميع").expect(201);
    const reply = await as(
      request(app).post(`/api/messages/${first.body.message.id}/reply`).send({ body: `${TAG} للكل`, all: true }),
      "A",
    ).expect(201);
    const rows = await prisma.messageRecipient.findMany({ where: { messageId: reply.body.message.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual([f.professor.userId, B.userId].sort());
  });

  it("ولا يُردّ على رسالةٍ ليست لك ⇒ 404، ولا على تعميمٍ أرسلتَه ⇒ 400", async () => {
    const first = await send("professor", [A.userId], "خاصّة").expect(201);
    await as(
      request(app).post(`/api/messages/${first.body.message.id}/reply`).send({ body: "x" }),
      "outsider",
    ).expect(404);

    const b = await as(
      request(app).post("/api/messages/broadcast").send({ target: "admins", subject: `${TAG} للإدارة`, body: "x" }),
      "admin",
    );
    if (b.status === 201) {
      await as(request(app).post(`/api/messages/${b.body.id}/reply`).send({ body: "x" }), "admin").expect(400);
    } else {
      // لا إداريّ غير المرسِل في قاعدة الاختبار
      expect(b.status).toBe(400);
    }
  });
});

describe("الخصوصية والإيصالات", () => {
  it("مستلم التعميم لا يرى المستلمين، والمرسِل يرى من قرأ", async () => {
    const b = await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "students", specializationId: f.specialization.id, subject: `${TAG} تعميم`, body: "نصّ" }),
      "admin",
    ).expect(201);

    const forA = await as(request(app).get(`/api/messages/${b.body.id}`), "A").expect(200);
    expect(forA.body.message.recipients).toBeUndefined();
    expect(JSON.stringify(forA.body)).not.toContain(B.userId);

    await as(request(app).patch(`/api/messages/${b.body.id}/read`), "A").expect(200);
    const forAdmin = await as(request(app).get(`/api/messages/${b.body.id}`), "admin").expect(200);
    expect(forAdmin.body.message.readCount).toBe(1);
    const readers = forAdmin.body.message.recipients.filter((r: any) => r.readAt);
    expect(readers.map((r: any) => r.user.id)).toEqual([A.userId]);
  });

  it("والحذف من الوارد يُبقي عدد مستلمي المرسِل وإيصاله", async () => {
    const m = await send("admin", [A.userId, B.userId], "حذف").expect(201);
    const id = m.body.message.id;
    await as(request(app).delete(`/api/messages/${id}`), "A").expect(200);
    await as(request(app).get(`/api/messages/${id}`), "A").expect(404);

    const sent = await as(request(app).get(`/api/messages/${id}`), "admin").expect(200);
    expect(sent.body.message.recipientsCount).toBe(2);
    // حذفُه قراءةٌ ضمنية — لم يعد في صندوقه ما يُقرأ.
    expect(sent.body.message.readCount).toBe(1);
  });

  it("و?unread=false لا يُصفّي (كان يعني العكس)، وfilter=unread يُصفّي", async () => {
    await send("admin", [B.userId], "غير مقروءة").expect(201);
    const all = await as(request(app).get("/api/messages/inbox").query({ unread: "false" }), "B").expect(200);
    const unread = await as(request(app).get("/api/messages/inbox").query({ filter: "unread" }), "B").expect(200);
    expect(all.body.total).toBeGreaterThanOrEqual(unread.body.total);
    expect(unread.body.items.every((r: any) => r.readAt === null)).toBe(true);
  });

  it("وتعليمها غير مقروءة يُعيد العدّاد، والملخّص يعدّ الوارد والصادر", async () => {
    const m = await send("admin", [B.userId], "عدّاد").expect(201);
    await as(request(app).patch(`/api/messages/${m.body.message.id}/read`), "B").expect(200);
    const before = (await as(request(app).get("/api/messages/summary"), "B").expect(200)).body;
    await as(request(app).patch(`/api/messages/${m.body.message.id}/unread`), "B").expect(200);
    const after = (await as(request(app).get("/api/messages/summary"), "B").expect(200)).body;
    expect(after.unread).toBe(before.unread + 1);
    expect(after.inbox).toBe(before.inbox);
  });
});

describe("جهات الاتصال = من يقبل الخادم الإرسال إليه", () => {
  it("الطالب: مشرفه وزميله والإدارة، لا الغريب", async () => {
    const res = await as(request(app).get("/api/messages/contacts").query({ limit: 30 }), "A").expect(200);
    const byId = new Map(res.body.items.map((c: any) => [c.id, c.relation]));
    expect(byId.get(f.professor.userId)).toBe("supervisor");
    expect(byId.get(B.userId)).toBe("teammate");
    expect(byId.get(f.admin.id)).toBe("admin");
    expect(byId.has(outsider.userId)).toBe(false);
    // ولا معرّفات لغير الإدارة.
    expect(res.body.items.every((c: any) => c.handle === null)).toBe(true);
  });

  it("الأستاذ: طلبة مواضيعه لا غيرهم", async () => {
    const res = await as(request(app).get("/api/messages/contacts").query({ search: TAG, limit: 30 }), "professor").expect(200);
    const ids = res.body.items.map((c: any) => c.id);
    expect(ids).toContain(A.userId);
    expect(ids).not.toContain(outsider.userId);
  });

  it("كلّ دورٍ بحصّته، والتصفية بدورٍ واحد، والعدد لكلّ دور", async () => {
    const all = await as(request(app).get("/api/messages/contacts").query({ limit: 2 }), "admin").expect(200);
    const roles = new Set(all.body.items.map((c: any) => c.role));
    // حصّةٌ لكلّ دور: لا يملأ دورٌ القائمة وحده.
    expect(roles.has("student")).toBe(true);
    expect(roles.has("professor")).toBe(true);
    expect(all.body.items.filter((c: any) => c.role === "student").length).toBeLessThanOrEqual(2);
    expect(all.body.counts.student).toBeGreaterThanOrEqual(3);

    const onlyProfs = await as(request(app).get("/api/messages/contacts").query({ role: "professor" }), "admin").expect(200);
    expect(onlyProfs.body.items.every((c: any) => c.role === "professor")).toBe(true);
    expect(onlyProfs.body.counts.professor).toBe(all.body.counts.professor);

    await as(request(app).get("/api/messages/contacts").query({ role: "x" }), "admin").expect(400);
  });

  it("والإدارة تجد الطالب برقم تسجيله", async () => {
    const res = await as(request(app).get("/api/messages/contacts").query({ search: outsider.reg }), "admin").expect(200);
    expect(res.body.items[0]?.id).toBe(outsider.userId);
    expect(res.body.items[0]?.handle).toBe(outsider.reg);
  });
});

describe("الجمهور الدقيق", () => {
  it("يُعدّ قبل الإرسال، ولا يشمل الحساب الموقوف", async () => {
    const q = { target: "students", specializationId: f.specialization.id };
    const before = (await as(request(app).get("/api/messages/audience").query(q), "admin").expect(200)).body.count;
    expect(before).toBeGreaterThan(0);

    await prisma.user.update({ where: { id: outsider.userId }, data: { status: "suspended" as never } });
    try {
      const after = (await as(request(app).get("/api/messages/audience").query(q), "admin").expect(200)).body.count;
      expect(after).toBe(before - 1);
    } finally {
      await prisma.user.update({ where: { id: outsider.userId }, data: { status: "active" as never } });
    }
  });

  it("والطالب في مشروع يُفرَز عن غيره", async () => {
    const q = { target: "students", specializationId: f.specialization.id };
    const all = (await as(request(app).get("/api/messages/audience").query(q), "admin").expect(200)).body.count;
    const withP = (await as(request(app).get("/api/messages/audience").query({ ...q, project: "with" }), "admin").expect(200)).body.count;
    const without = (await as(request(app).get("/api/messages/audience").query({ ...q, project: "without" }), "admin").expect(200)).body.count;
    expect(withP + without).toBe(all);
    expect(withP).toBeGreaterThanOrEqual(2);
  });

  it("والمعاينة للإدارة وحدها", async () => {
    await as(request(app).get("/api/messages/audience").query({ target: "all" }), "A").expect(403);
  });
});

describe("الزمن الحقيقي", () => {
  it("الرسالة تصل شاشة مستلمها لحظة حفظها، بكاتبها وموضوعها", async () => {
    const socket = await connect(tok.B);
    const arrived = catchEvent(socket, "message:new", (p) => String(p?.subject).includes("لحظية"));
    await send("admin", [B.userId], "لحظية").expect(201);
    const payload = await arrived;
    expect(payload).toBeTruthy();
    expect(payload.sender.id).toBe(f.admin.id);
    expect(payload.preview).toContain(TAG);
  });

  it("وإيصال القراءة يصل مرسِلها", async () => {
    const m = await send("admin", [B.userId], "إيصال").expect(201);
    const socket = await connect(tok.admin);
    const receipt = catchEvent(socket, "data:changed", (p) => p?.resource === "messages" && p?.action === "updated");
    await as(request(app).patch(`/api/messages/${m.body.message.id}/read`), "B").expect(200);
    expect(await receipt).toBeTruthy();
  });

  it("ولا تصل من ليست له", async () => {
    const socket = await connect(tok.outsider);
    const leaked = catchEvent(socket, "message:new", () => true, 600);
    await send("admin", [B.userId], "ليست لك").expect(201);
    expect(await leaked).toBeNull();
  });
});


describe("المحادثات شخصاً شخصاً", () => {
  it("المحادثة تجمع الاتجاهين بترتيبها، وتُعلَّم مقروءةً دفعةً واحدة", async () => {
    await send("professor", [A.userId], "دردشة 1", `${TAG} من الأستاذ`).expect(201);
    await send("A", [f.professor.userId], "دردشة 2", `${TAG} من A`).expect(201);
    await send("professor", [A.userId], "دردشة 3", `${TAG} من الأستاذ ثانيةً`).expect(201);

    const chat = await as(request(app).get(`/api/messages/chat/${f.professor.userId}`), "A").expect(200);
    const bodies = chat.body.items.map((m: any) => m.body);
    expect(bodies.slice(-3)).toEqual([`${TAG} من الأستاذ`, `${TAG} من A`, `${TAG} من الأستاذ ثانيةً`]);
    expect(chat.body.items.at(-2).mine).toBe(true);
    expect(chat.body.canWrite).toBe(true);
    expect(chat.body.user.id).toBe(f.professor.userId);

    const list = await as(request(app).get("/api/messages/conversations"), "A").expect(200);
    const withProf = list.body.items.find((c: any) => c.user.id === f.professor.userId);
    expect(withProf.unread).toBeGreaterThanOrEqual(2);
    expect(withProf.last.preview).toContain("ثانيةً");
    expect(withProf.last.mine).toBe(false);

    await as(request(app).patch(`/api/messages/chat/${f.professor.userId}/read`), "A").expect(200);
    const after = await as(request(app).get("/api/messages/conversations"), "A").expect(200);
    expect(after.body.items.find((c: any) => c.user.id === f.professor.userId).unread).toBe(0);

    // والأستاذ يرى أنّ رسالته قُرئت.
    const forProf = await as(request(app).get(`/api/messages/chat/${A.userId}`), "professor").expect(200);
    expect(forProf.body.items.at(-1).mine).toBe(true);
    expect(forProf.body.items.at(-1).readAt).toBeTruthy();
  });

  it("والصفحات إلى الخلف بـ before", async () => {
    const first = await as(request(app).get(`/api/messages/chat/${f.professor.userId}`).query({ limit: 2 }), "A").expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.hasMore).toBe(true);
    const older = await as(
      request(app).get(`/api/messages/chat/${f.professor.userId}`).query({ limit: 2, before: first.body.items[0].createdAt }),
      "A",
    ).expect(200);
    expect(new Date(older.body.items.at(-1).createdAt).getTime()).toBeLessThan(
      new Date(first.body.items[0].createdAt).getTime(),
    );
  });

  it("ومن لا تحقّ مراسلته: canWrite=false، والإرسال يُرفض", async () => {
    const chat = await as(request(app).get(`/api/messages/chat/${outsider.userId}`), "A").expect(200);
    expect(chat.body.canWrite).toBe(false);
    await send("A", [outsider.userId], "ممنوع").expect(400);
  });

  it("ومن كتب إليك تستطيع أن تردّ عليه ولو لم تكن القاعدة تسمح بالبدء", async () => {
    // رسالةٌ وصلت الغريبَ من أستاذٍ لا يشرف عليه (أُرسلت قبل أن تنقطع الصلة مثلاً).
    const m = await prisma.message.create({
      data: { senderId: f.professor2.userId, subject: `${TAG} قديمة`, body: `${TAG} قديمة` },
    });
    await prisma.messageRecipient.create({ data: { messageId: m.id, userId: outsider.userId } });

    const chat = await as(request(app).get(`/api/messages/chat/${f.professor2.userId}`), "outsider").expect(200);
    expect(chat.body.canWrite).toBe(true);
    await send("outsider", [f.professor2.userId], "ردّ الغريب").expect(201);
  });

  it("والتواجد يُقال، ومستخدمٌ غير موجود ⇒ 404", async () => {
    const res = await as(request(app).get("/api/messages/presence").query({ ids: `${A.userId},${B.userId}` }), "admin").expect(200);
    expect(Object.keys(res.body.online).sort()).toEqual([A.userId, B.userId].sort());
    await as(request(app).get("/api/messages/chat/00000000-0000-0000-0000-000000000000"), "A").expect(404);
  });
});

describe("«يكتب الآن…»", () => {
  it("يصل من يُكتب إليه — ولا يصل ممّن لا تحقّ له مراسلته", async () => {
    const prof = await connect(tok.professor);
    const a = await connect(tok.A);
    const typing = catchEvent(prof, "typing", (p) => p?.from === A.userId);
    a.emit("typing", { to: f.professor.userId, active: true });
    expect(await typing).toMatchObject({ from: A.userId, active: true });

    const bSock = await connect(tok.B);
    const out = await connect(tok.outsider);
    const leaked = catchEvent(bSock, "typing", () => true, 700);
    out.emit("typing", { to: B.userId, active: true });
    expect(await leaked).toBeNull();
  });
});
