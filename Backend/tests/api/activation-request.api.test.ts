/**
 * التوثيق (modules/activation): يصوّر الطالب بطاقته وحدها (قرار المستخدم،
 * 2026-11-18 — كانت البطاقة ووجهه وهو يمسكها)؛ فيتحقّق المسؤول أنّها بطاقته
 * فيقبل فيُوثَّق الحساب، أو يرفض بسبب. يُعرض في المرحلة الثانية من أوّل دخولٍ للطالب، بعد أن
 * يستبدل كلمة المرور المسلَّمة، وفي «توثيق الحساب» من «حسابي».
 *
 * يُحرس: أنّ الطلب لا يُرسل إلا من طالبٍ كلمةُ مروره له، وبصورة البطاقة —
 * صورةً حقّاً، ولا صورة غيرها —؛ وأنّ طلباً سبق التغيير بصورتين يُعرض بهما؛ وأنّ الصور خاصّة — في مجلّدٍ لا يُخدم، يقرؤها المسؤول وحده —
 * وتُحذف عند القرار، وعند إعادة الإرسال، وبعد المدّة دون قرار؛ وأنّ القبول
 * يوثّق الحساب ولا يمسّ غيره؛ وأنّ القرار على ما رآه المسؤول لا على طلبٍ أُعيد
 * إرساله بعده؛ وأنّ الرفض يقول سببه للطالب.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { tr } from "../../src/core/i18n";
import { pruneActivationRequests } from "../../src/modules/activation/activation-request";
import { seed, teardown, residue, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

const DIR = path.resolve(process.env.ACTIVATION_PHOTOS_DIR ?? path.join(process.cwd(), "storage", "activation"));
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)]);

let f: Fixture;
let adminToken = "";

beforeAll(async () => {
  await teardown();
  f = await seed(16);
  adminToken = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  // Photos of requests still waiting when the tests end.
  const left = await prisma.activationRequest.findMany({
    where: { user: { email: { startsWith: TAG } } },
    select: { cardFile: true, selfieFile: true },
  });
  for (const name of left.flatMap((r) => [r.cardFile, r.selfieFile])) if (name) fs.rmSync(path.join(DIR, name), { force: true });
  await prisma.notification.deleteMany({ where: { link: "/admin/users?view=requests", user: { email: { startsWith: TAG } } } });
  await prisma.auditLog.deleteMany({ where: { actorLabel: { contains: TAG } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

afterEach(() => jest.restoreAllMocks());

const admin = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);
const login = (reg: string, password: string) =>
  request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password });

/** Each signed-in student's number: what their own card's code carries. */
const regOf = new Map<string, string>();

/** A student signed in with a password of their own: the whole account, «توثيق الحساب» included. */
const signedIn = async (s: { reg: string }) => {
  const token = (await login(s.reg, TEST_PASSWORD).expect(200)).body.accessToken as string;
  regOf.set(token, s.reg);
  return token;
};

/** The card's photo — and, read from its code, the account's own number unless told otherwise (`qr: null`: unread). */
const send = (
  token: string,
  { card = JPEG, selfie = null, qr }: { card?: Buffer | null; selfie?: Buffer | null; qr?: string | null } = {},
) => {
  const number = qr === undefined ? regOf.get(token) : qr;
  let r = request(app).post("/api/account/activation-request").set("Authorization", `Bearer ${token}`);
  if (number) r = r.field("qrNumber", number);
  if (card) r = r.attach("card", card, { filename: "card.jpg", contentType: "image/jpeg" });
  if (selfie) r = r.attach("selfie", selfie, { filename: "selfie.jpg", contentType: "image/jpeg" });
  return r;
};
const mine = (token: string) => request(app).get("/api/account/activation-request").set("Authorization", `Bearer ${token}`);
const list = () => admin(request(app).get("/api/admin/activation/requests"));
const rowOf = (userId: string) => prisma.activationRequest.findUnique({ where: { userId } });
const exists = (name: string | null | undefined) => !!name && fs.existsSync(path.join(DIR, name));

describe("الطالب يرسل صورة بطاقته", () => {
  it("⇒ قيد المراجعة؛ الصورة في المجلّد الخاصّ، والإدارة تُنبَّه", async () => {
    const [picked] = f.nextStudents(1);
    // A registration number as real ones are — digits — so the card's QR code can match it.
    const s = { ...picked!, reg: "770000000001" };
    await prisma.student.update({ where: { id: s.id }, data: { registrationNumber: s.reg } });
    const token = await signedIn(s);
    expect((await mine(token).expect(200)).body).toEqual({ status: "none" });

    const res = await send(token, { card: PNG, qr: s.reg }).expect(200);
    expect(res.body).toEqual({ status: "pending", sentAt: expect.any(String) });
    const row = await rowOf(s.userId);
    expect(row).toMatchObject({ status: "pending", qrNumber: s.reg });
    const item = (await list().expect(200)).body.items.find((i: { id: string }) => i.id === s.id);
    expect(item).toMatchObject({ qrMatches: true, photos: { card: true, selfie: false } });
    expect(item).not.toHaveProperty("kind");
    expect(row!.cardFile).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(row!.selfieFile).toBeNull();
    expect(exists(row!.cardFile)).toBe(true);

    expect(await prisma.notification.count({ where: { userId: f.admin.id, link: "/admin/users?view=requests", message: { contains: s.reg } } })).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.auditLog.count({ where: { action: "activation.requested", actorId: s.userId } })).toBe(1);
  });

  it("ما ليس صورة ⇒ 400 ولا ملفّ يبقى", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    const before = fs.readdirSync(DIR).length;
    expect((await send(token, { card: Buffer.from("<html>not an image</html>") }).expect(400)).body.message).toBe(tr("upload.imageType"));
    expect(fs.readdirSync(DIR).length).toBe(before);
    expect(await rowOf(s!.userId)).toBeNull();
  });

  it("بلا البطاقة ⇒ 400؛ وصورةٌ أخرى معها — صورة الوجه كما كانت — تُردّ؛ ولا شيء يُحفظ", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    const before = fs.readdirSync(DIR).length;
    // The card is what the administrator checks: without it, nothing to check.
    expect((await send(token, { card: null }).expect(400)).body.message).toBe(tr("activation.photosRequired"));
    // The card alone is asked for: no other photo is taken in.
    await send(token, { card: null, selfie: JPEG }).expect(400);
    await send(token, { selfie: JPEG }).expect(400);
    expect(fs.readdirSync(DIR).length).toBe(before);
    expect(await rowOf(s!.userId)).toBeNull();
  });

  it("بطاقةٌ رمزها غير مقروء، أو برقمٍ غير رقم الحساب ⇒ 400 بسببه، ولا شيء يُحفظ", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    const before = fs.readdirSync(DIR).length;
    expect((await send(token, { qr: null }).expect(400)).body.message).toBe(tr("activation.qrUnread"));
    expect((await send(token, { qr: "999999999999" }).expect(400)).body.message).toBe(tr("activation.qrOther"));
    // Another student's number exactly: still not this account's card.
    const [other] = f.nextStudents(1);
    expect((await send(token, { qr: other!.reg }).expect(400)).body.message).toBe(tr("activation.qrOther"));
    expect(fs.readdirSync(DIR).length).toBe(before);
    expect(await rowOf(s!.userId)).toBeNull();
    // Its own number: sent.
    await send(token).expect(200);
    expect(await rowOf(s!.userId)).toMatchObject({ status: "pending", qrNumber: s!.reg });
  });

  it("كلمة مرورٍ مسلَّمة لم تُستبدل بعد ⇒ 403: الصور بعد كلمة المرور", async () => {
    const [s] = f.nextStudents(1);
    await prisma.user.update({ where: { id: s!.userId }, data: { mustChangePassword: true } });
    const token = await signedIn(s!);
    expect((await send(token).expect(403)).body).toMatchObject({ errorCode: "PASSWORD_CHANGE_REQUIRED" });
    expect(await rowOf(s!.userId)).toBeNull();
  });

  it("حسابٌ موثّقٌ أصلاً ⇒ 400؛ والأستاذ ⇒ 403", async () => {
    const [s] = f.nextStudents(1);
    await prisma.user.update({ where: { id: s!.userId }, data: { isVerified: true } });
    const token = await signedIn(s!);
    expect((await send(token).expect(400)).body.message).toBe(tr("activation.alreadyVerified"));

    const prof = (
      await request(app).post("/api/auth/professor/login").send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD }).expect(200)
    ).body.accessToken;
    expect((await send(prof).expect(403)).body.message).toBe(tr("activation.studentsOnly"));
  });

  it("إعادة الإرسال تحلّ محلّ الطلب وتحذف صوره القديمة", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    await send(token).expect(200);
    const first = await rowOf(s!.userId);
    await send(token, { card: PNG }).expect(200);
    const second = await rowOf(s!.userId);
    expect(exists(first!.cardFile)).toBe(false);
    expect(exists(second!.cardFile)).toBe(true);
    expect(await prisma.activationRequest.count({ where: { userId: s!.userId } })).toBe(1);
  });

  it("طلبٌ وصل بلا صور قبل أن تُشترط ⇒ الإدارة ترى أنّه بلا صور", async () => {
    const [s] = f.nextStudents(1);
    await prisma.activationRequest.create({ data: { userId: s!.userId, status: "pending" } });
    const item = (await list().expect(200)).body.items.find((i: { id: string }) => i.id === s!.id);
    expect(item).toMatchObject({ photos: { card: false, selfie: false } });
    await admin(request(app).get(`/api/admin/activation/requests/${s!.id}/selfie`)).expect(404);
  });

  it("طلبٌ بصورتين سبق التغيير ⇒ يُعرض بهما؛ وإعادة إرساله بالبطاقة وحدها تحذف الثانية", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    // As a request sent before the card alone was asked for: the card and the student holding it.
    const cardFile = `${crypto.randomUUID()}.jpg`;
    const selfieFile = `${crypto.randomUUID()}.jpg`;
    fs.writeFileSync(path.join(DIR, cardFile), JPEG);
    fs.writeFileSync(path.join(DIR, selfieFile), JPEG);
    await prisma.activationRequest.create({ data: { userId: s!.userId, status: "pending", cardFile, selfieFile } });

    const item = (await list().expect(200)).body.items.find((i: { id: string }) => i.id === s!.id);
    expect(item).toMatchObject({ photos: { card: true, selfie: true } });
    const second = await admin(request(app).get(`/api/admin/activation/requests/${s!.id}/selfie`)).expect(200);
    expect(second.headers["content-type"]).toBe("image/jpeg");

    await send(token, { card: PNG }).expect(200);
    const row = await rowOf(s!.userId);
    expect(row).toMatchObject({ selfieFile: null });
    expect(exists(cardFile) || exists(selfieFile)).toBe(false);
    expect(exists(row!.cardFile)).toBe(true);
  });
});

describe("الإدارة تراجع", () => {
  it("القائمة والصورة للمسؤول وحده، ولا تُحفظ في ذاكرةٍ وسيطة", async () => {
    const [s, other] = f.nextStudents(2);
    const token = await signedIn(s!);
    await send(token, { card: PNG }).expect(200);

    const item = (await list().expect(200)).body.items.find((i: { id: string }) => i.id === s!.id);
    expect(item).toMatchObject({ registrationNumber: s!.reg, qrNumber: s!.reg, qrMatches: true, sentAt: expect.any(String) });

    const card = await admin(request(app).get(`/api/admin/activation/requests/${s!.id}/card`)).expect(200);
    expect(card.headers["content-type"]).toBe("image/png");
    expect(card.headers["cache-control"]).toBe("no-store");
    expect(Buffer.compare(card.body as Buffer, PNG)).toBe(0);
    // The card alone: no second photo to read.
    await admin(request(app).get(`/api/admin/activation/requests/${s!.id}/selfie`)).expect(404);

    // Not to the student, not without a request, and never from /uploads.
    await request(app).get(`/api/admin/activation/requests/${s!.id}/card`).set("Authorization", `Bearer ${token}`).expect(403);
    await admin(request(app).get(`/api/admin/activation/requests/${other!.id}/card`)).expect(404);
    const row = await rowOf(s!.userId);
    await request(app).get(`/uploads/${row!.cardFile}`).expect(404);
    await request(app).get(`/uploads/cards/${row!.cardFile}`).expect(404);
  });

  it("القبول ⇒ الحساب موثّق، والصور تُحذف — ولا يتغيّر غير ذلك", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    await send(token).expect(200);
    const row = await rowOf(s!.userId);

    await admin(request(app).post(`/api/admin/activation/requests/${s!.id}/approve`)).send({ sentAt: row!.sentAt }).expect(200);
    expect(await rowOf(s!.userId)).toBeNull();
    expect(exists(row!.cardFile)).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: s!.userId }, select: { isVerified: true } })).toEqual({ isVerified: true });
    // Still signed in, with the same password.
    await request(app).get("/api/account").set("Authorization", `Bearer ${token}`).expect(200);
    await login(s!.reg, TEST_PASSWORD).expect(200);
    // And now verified, nothing more to send.
    expect((await send(token).expect(400)).body.message).toBe(tr("activation.alreadyVerified"));

    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.auditLog.count({ where: { action: "POST /activation/requests/:id/approve", targetId: s!.id } })).toBe(1);
  });

  it("أُعيد الإرسال بعد ما رآه المسؤول ⇒ 409، لا يُقرَّر عليه دون أن يُرى", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    await send(token).expect(200);
    const seen = await rowOf(s!.userId);
    await new Promise((r) => setTimeout(r, 15));
    await send(token, { card: PNG }).expect(200);

    const res = await admin(request(app).post(`/api/admin/activation/requests/${s!.id}/approve`)).send({ sentAt: seen!.sentAt }).expect(409);
    expect(res.body.message).toBe(tr("activation.changed"));
    await admin(request(app).post(`/api/admin/activation/requests/${s!.id}/reject`)).send({ sentAt: seen!.sentAt, reason: "x" }).expect(409);
    expect((await rowOf(s!.userId))!.status).toBe("pending");
  });

  it("الرفض بلا سبب ⇒ 400؛ وبسببه ⇒ يقرؤه الطالب، والصور تُحذف، ويعيد الإرسال", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    await send(token).expect(200);
    const row = await rowOf(s!.userId);
    const reject = (body: object) => admin(request(app).post(`/api/admin/activation/requests/${s!.id}/reject`)).send(body);

    expect((await reject({ sentAt: row!.sentAt, reason: "  " }).expect(400)).body.message).toContain(tr("activation.reasonRequired"));
    await reject({ sentAt: row!.sentAt, reason: "البطاقة غير واضحة في الصورة." }).expect(200);

    expect((await mine(token).expect(200)).body).toMatchObject({ status: "rejected", reason: "البطاقة غير واضحة في الصورة." });
    expect(exists(row!.cardFile)).toBe(false);
    expect(await rowOf(s!.userId)).toMatchObject({ cardFile: null, selfieFile: null });
    expect(await prisma.user.findUnique({ where: { id: s!.userId }, select: { isVerified: true } })).toEqual({ isVerified: false });

    await send(token).expect(200);
    expect((await mine(token).expect(200)).body.status).toBe("pending");
  });
});

describe("تُحذف الصور بغير قرار أيضاً", () => {
  it("بعد المدّة دون قرار ⇒ يذهب الطلب وصوره", async () => {
    const [s] = f.nextStudents(1);
    const token = await signedIn(s!);
    await send(token).expect(200);
    const row = await rowOf(s!.userId);
    const old = new Date(Date.now() - (config.ACTIVATION_REQUEST_DAYS + 1) * 24 * 60 * 60 * 1000);
    await prisma.activationRequest.update({ where: { userId: s!.userId }, data: { sentAt: old } });

    await pruneActivationRequests();
    expect(await rowOf(s!.userId)).toBeNull();
    expect(exists(row!.cardFile)).toBe(false);
  });
});
