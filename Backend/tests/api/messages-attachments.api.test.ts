/**
 * الملفات المرفقة بالرسائل.
 *
 * الملفّ يُرفع أوّلاً مسوّدةً لصاحبه، ثمّ تحمله رسالةٌ عند إرسالها. وما
 * يستحقّ الحراسة هنا ثلاثة:
 *
 *   ١. **الخصوصية.** لا يفتح الملفَّ إلّا من يقرأ رسالته: مرسِلها ومستلموها
 *      — لا الغريب، ولا من حذفها من وارده. والمسوّدة لصاحبها وحده.
 *   ٢. **النوع.** يُقبل بامتداده وبأوّل بايتاته معاً، لا بما يدّعيه المتصفّح:
 *      فلا يمرّ ملفٌّ تنفيذيّ، ولا صورةٌ سُمّيت PDF.
 *   ٣. **الملكية.** لا تحمل رسالةٌ مسوّدةَ غير مرسِلها، ولا ملفّاً أرسلته رسالةٌ
 *      أخرى — وإن رُفض ملفٌّ لم تُخزَّن الرسالة أصلاً.
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
let outsider: { id: string; userId: string; reg: string };

const as = (r: request.Test, who: string) => r.set("Authorization", `Bearer ${tok[who]}`);

const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 2)]);

const upload = (who: string, bytes: Buffer, filename: string) =>
  as(request(app).post("/api/messages/attachments").attach("file", bytes, { filename }), who);

async function draft(who: string, bytes = PDF, filename = "مذكرة التخرج.pdf") {
  const res = await upload(who, bytes, filename).expect(201);
  return res.body.attachment as { id: string; fileName: string; mimeType: string; size: number };
}

const stored = async (id: string) =>
  (await prisma.messageAttachment.findUniqueOrThrow({ where: { id }, select: { storedName: true } })).storedName;

beforeAll(async () => {
  await teardown();
  f = await seed(4);
  [A, B, outsider] = f.nextStudents(3);

  // A و B في مشروعٍ واحد: يتراسلان. `outsider` خارجه.
  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} FILES topic`,
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
  tok.outsider = await login(outsider.reg);
  tok.admin = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  // Rows and files of this file's accounts: their users go with the teardown,
  // which leaves these behind (the relations set null, for the sweep).
  const mine = await prisma.messageAttachment.findMany({
    where: { OR: [{ uploader: { email: { startsWith: TAG } } }, { message: { sender: { email: { startsWith: TAG } } } }] },
    select: { id: true, storedName: true },
  });
  await prisma.messageAttachment.deleteMany({ where: { id: { in: mine.map((m) => m.id) } } });
  mine.forEach((m) => fs.rmSync(path.join(DIR, m.storedName), { force: true }));
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("الرفع", () => {
  it("PDF باسمٍ عربيّ ⇒ مسوّدة، بالاسم كما هو والنوعِ من جدول الخادم", async () => {
    const a = await draft("A");
    expect(a).toMatchObject({ fileName: "مذكرة التخرج.pdf", mimeType: "application/pdf", size: PDF.length });
    const row = await prisma.messageAttachment.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.messageId).toBeNull();
    expect(row.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(fs.existsSync(path.join(DIR, row.storedName))).toBe(true);
  });

  it("امتدادٌ غير مقبول ⇒ 400، ولا يبقى منه شيء", async () => {
    const before = fs.readdirSync(DIR).length;
    const res = await upload("A", Buffer.from("MZ\x90\x00"), "setup.exe").expect(400);
    expect(res.body.message).toBe(tr("messages.fileType"));
    expect(fs.readdirSync(DIR).length).toBe(before);
  });

  it("صورةٌ سُمّيت .pdf، وملفٌّ ثنائيّ سُمّي .txt ⇒ 400 «لا يطابق امتداده»", async () => {
    expect((await upload("A", PNG, "report.pdf").expect(400)).body.message).toBe(tr("messages.fileMismatch"));
    expect((await upload("A", Buffer.from([0x41, 0x00, 0x42]), "notes.txt").expect(400)).body.message).toBe(
      tr("messages.fileMismatch"),
    );
  });

  it("فوق ٢٥ ميغابايت ⇒ 400 بالحدّ", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(25 * 1024 * 1024)]);
    const res = await upload("A", big, "big.pdf").expect(400);
    expect(res.body.message).toBe(tr("messages.fileTooLarge", { max: 25 }));
  });

  it("علامات قلب الاتجاه تُنزع من الاسم: لا يتنكّر ملفٌّ بامتدادٍ آخر", async () => {
    const a = await draft("A", PDF, "invoice‮exe.pdf");
    expect(a.fileName).toBe("invoiceexe.pdf");
  });

  it("وصورة PNG ونصٌّ عاديّ وWord ⇒ مقبولة بأنواعها", async () => {
    expect((await draft("A", PNG, "شاشة.png")).mimeType).toBe("image/png");
    expect((await draft("A", Buffer.from("ملاحظات\nسطر ثانٍ", "utf8"), "notes.txt")).mimeType).toBe("text/plain; charset=utf-8");
    expect((await draft("A", DOCX, "plan.docx")).mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });
});

describe("الإرسال والفتح", () => {
  it("ملفٌّ بلا نصّ ⇒ رسالة؛ يفتحه المستلم، ولا يفتحه الغريب", async () => {
    const a = await draft("A");
    const sent = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [a.id] }), "A").expect(
      201,
    );
    expect(sent.body.message.body).toBe("");
    expect(sent.body.message.attachments).toEqual([expect.objectContaining({ id: a.id, fileName: "مذكرة التخرج.pdf" })]);

    // B يراه في المحادثة، ويفتحه تنزيلاً باسمه.
    const chat = await as(request(app).get(`/api/messages/chat/${A.userId}`), "B").expect(200);
    expect(chat.body.items.at(-1).attachments[0].id).toBe(a.id);
    const file = await as(request(app).get(`/api/messages/attachments/${a.id}`), "B")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(file.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(file.headers["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent("مذكرة التخرج.pdf")}`);
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect((file.body as Buffer).equals(PDF)).toBe(true);

    // والمرسِل كذلك؛ والغريب لا يعرف أنّه موجود.
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "A").expect(200);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "outsider").expect(404);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "admin").expect(404);
  });

  it("المسوّدة قبل الإرسال لصاحبها وحده", async () => {
    const a = await draft("A");
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "A").expect(200);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "B").expect(404);
  });

  it("مسوّدة غيري ⇒ تُرفض الرسالة كلّها، ولا تُخزَّن", async () => {
    const theirs = await draft("B");
    const before = await prisma.message.count({ where: { senderId: A.userId } });
    const res = await as(
      request(app).post("/api/messages").send({ recipientIds: [B.userId], body: "خذ", attachmentIds: [theirs.id] }),
      "A",
    ).expect(400);
    expect(res.body.message).toBe(tr("messages.filesGone"));
    expect(await prisma.message.count({ where: { senderId: A.userId } })).toBe(before);
    expect((await prisma.messageAttachment.findUniqueOrThrow({ where: { id: theirs.id } })).messageId).toBeNull();
  });

  it("وملفٌّ أرسلته رسالةٌ أخرى لا تحمله ثانية", async () => {
    const a = await draft("A");
    const send = () =>
      as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [a.id] }), "A");
    await send().expect(201);
    expect((await send().expect(400)).body.message).toBe(tr("messages.filesGone"));
  });

  it("أكثر من ٥ ملفات في رسالة ⇒ 400", async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `x${i}`);
    const res = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: ids }), "A").expect(400);
    expect(res.body.message).toBe(tr("messages.tooManyFiles", { max: 5 }));
  });

  it("لا نصّ ولا ملف ⇒ 400 «اكتب أو أرفق»", async () => {
    const res = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], body: "  " }), "A").expect(400);
    expect(res.body.message).toBe(tr("messages.bodyOrFile"));
  });

  it("من حذف الرسالة من وارده لا يفتح ملفّها بعد؛ والمرسِل يفتحه", async () => {
    const a = await draft("A");
    const sent = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [a.id] }), "A").expect(201);
    await as(request(app).delete(`/api/messages/${sent.body.message.id}`), "B").expect(200);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "B").expect(404);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "A").expect(200);
  });

  it("الصورة تُعرض في مكانها بـ?inline=1؛ والـPDF يبقى تنزيلاً", async () => {
    const img = await draft("A", PNG, "صورة.png");
    const pdf = await draft("A");
    await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [img.id, pdf.id] }), "A").expect(201);
    const shown = await as(request(app).get(`/api/messages/attachments/${img.id}?inline=1`), "B").expect(200);
    expect(shown.headers["content-disposition"]).toBe("inline");
    expect(shown.headers["content-type"]).toBe("image/png");
    const doc = await as(request(app).get(`/api/messages/attachments/${pdf.id}?inline=1`), "B").expect(200);
    expect(doc.headers["content-disposition"]).toMatch(/^attachment;/);
  });

  it("الردّ يحمل ملفّاً كذلك", async () => {
    const first = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], body: "سؤال" }), "A").expect(201);
    const a = await draft("B");
    const reply = await as(
      request(app).post(`/api/messages/${first.body.message.id}/reply`).send({ attachmentIds: [a.id] }),
      "B",
    ).expect(201);
    expect(reply.body.message.attachments[0].id).toBe(a.id);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "A").expect(200);
  });

  it("والمحادثات تسمّي الملفّ مكان النصّ الفارغ", async () => {
    const a = await draft("A", PDF, "الفصل الثاني.pdf");
    await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [a.id] }), "A").expect(201);
    const list = await as(request(app).get("/api/messages/conversations"), "B").expect(200);
    const withA = list.body.items.find((c: { user: { id: string } }) => c.user.id === A.userId);
    expect(withA.last.file).toEqual({ fileName: "الفصل الثاني.pdf", mimeType: "application/pdf", count: 1 });
  });
});

describe("التعميم", () => {
  it("تعميمٌ بملفّ ⇒ يفتحه كلّ من وصله", async () => {
    const a = await draft("admin", PDF, "جدول المناقشات.pdf");
    const res = await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "students", specializationId: f.specialization.id, subject: `${TAG} جدول`, body: "", attachmentIds: [a.id] }),
      "admin",
    ).expect(201);
    expect(res.body.recipients).toBeGreaterThan(1);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "A").expect(200);
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "outsider").expect(200);
  });
});

describe("التنظيف", () => {
  it("مسوّدةٌ يُتراجع عنها ⇒ تُحذف بملفّها؛ والمُرسَل لا يُحذف هكذا", async () => {
    const a = await draft("A");
    const name = await stored(a.id);
    await as(request(app).delete(`/api/messages/attachments/${a.id}`), "A").expect(200);
    expect(fs.existsSync(path.join(DIR, name))).toBe(false);
    expect(await prisma.messageAttachment.findUnique({ where: { id: a.id } })).toBeNull();

    const sent = await draft("A");
    await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [sent.id] }), "A").expect(201);
    await as(request(app).delete(`/api/messages/attachments/${sent.id}`), "A").expect(404);
    // ولا يحذف أحدٌ مسوّدة غيره.
    const theirs = await draft("B");
    await as(request(app).delete(`/api/messages/attachments/${theirs.id}`), "A").expect(404);
  });

  it("مسوّدةٌ مضى عليها يوم ⇒ تُكنَس عند الرفع التالي، بملفّها", async () => {
    const old = await draft("A");
    const name = await stored(old.id);
    await prisma.messageAttachment.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
    await draft("B");
    expect(await prisma.messageAttachment.findUnique({ where: { id: old.id } })).toBeNull();
    expect(fs.existsSync(path.join(DIR, name))).toBe(false);
  });

  it("رسالةٌ تزول ⇒ يبقى ملفّها بلا رسالة، فيُكنَس كذلك", async () => {
    const a = await draft("A");
    const sent = await as(request(app).post("/api/messages").send({ recipientIds: [B.userId], attachmentIds: [a.id] }), "A").expect(201);
    await prisma.message.delete({ where: { id: sent.body.message.id } });
    const row = await prisma.messageAttachment.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.messageId).toBeNull();
    // ولا يفتحه مستلمه بعد زوال رسالته.
    await as(request(app).get(`/api/messages/attachments/${a.id}`), "B").expect(404);
  });
});
