/**
 * «نسيت كلمة المرور» عبر الإدارة (modules/password-request): طالبٌ لا بريد
 * مؤكَّداً لحسابه يكتب رقم تسجيله — فيُقال له هل الرقم لطالبٍ موجود — ويصوّر
 * بطاقته؛ فتتحقّق الإدارة وتكتب له كلمة مرور (قرار المستخدم، 2026-11-20: يكتبها
 * المسؤول، لا تُولَّد)، فيقرؤها المتصفّح الذي أرسل الطلب وحده.
 *
 * يُحرس: أنّ البحث يقول «موجود/غير موجود» وطريق الاستعادة فقط، بلا اسم؛ وأنّ
 * الطلب لا يُرسل إلا ببطاقة صاحب الرقم، ولا لحسابٍ له بريدٌ مؤكَّد أو موقوف؛ وأنّ
 * المتصفّح يتابعه بسرٍّ لا يُحفظ إلا بصمته؛ وأنّ الإدارة تُنبَّه؛ وأنّ كلمة المرور
 * تمرّ بقواعد الموقع، وتصير كلمة الحساب مؤقّتةً (يستبدلها عند أوّل دخول)،
 * ومختومةً في القاعدة؛ وأنّ القرار على ما رآه المسؤول؛ وأنّ الصورة تُحذف عند
 * القرار؛ وأنّ الإغلاق يحذف الطلب؛ وأنّ الإرسال من جديد يُبطل المتصفّح الأوّل.
 */
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { tr } from "../../src/core/i18n";
import { prunePasswordRequests } from "../../src/modules/password-request/password-request";
import { seed, teardown, residue, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

const DIR = path.resolve(process.env.PASSWORD_REQUEST_PHOTOS_DIR ?? path.join(process.cwd(), "storage", "password-requests"));
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const STRONG = "Zeitoun-Ouargla-2026!";

let f: Fixture;
let adminToken = "";

beforeAll(async () => {
  await teardown();
  f = await seed(12);
  adminToken = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  const left = await prisma.passwordRequest.findMany({ where: { user: { email: { startsWith: TAG } } }, select: { cardFile: true } });
  for (const r of left) if (r.cardFile) fs.rmSync(path.join(DIR, r.cardFile), { force: true });
  await prisma.notification.deleteMany({ where: { link: "/admin/users?view=passwords", user: { email: { startsWith: TAG } } } });
  await prisma.auditLog.deleteMany({ where: { actorLabel: { contains: TAG } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const admin = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

let n = 0;
/** A student whose number is digits, as real ones are — so the card's code can carry it. */
const student = async () => {
  const [picked] = f.nextStudents(1);
  const reg = `8800000000${String(++n).padStart(2, "0")}`;
  await prisma.student.update({ where: { id: picked!.id }, data: { registrationNumber: reg } });
  return { ...picked!, reg };
};

const lookup = (reg: string) => request(app).post("/api/auth/password/student").send({ registrationNumber: reg });
const send = (reg: string, { card = JPEG as Buffer | null, qr = reg as string | null } = {}) => {
  let r = request(app).post("/api/auth/password/request").field("registrationNumber", reg);
  if (qr) r = r.field("qrNumber", qr);
  if (card) r = r.attach("card", card, { filename: "card.jpg", contentType: "image/jpeg" });
  return r;
};
const status = (token: string) => request(app).post("/api/auth/password/request/status").send({ token });
const close = (token: string) => request(app).post("/api/auth/password/request/close").send({ token });
const list = () => admin(request(app).get("/api/admin/password-requests"));
const itemOf = async (studentId: string) =>
  (await list().expect(200)).body.items.find((i: { id: string }) => i.id === studentId) as { sentAt: string } | undefined;
const rowOf = (userId: string) => prisma.passwordRequest.findUnique({ where: { userId } });
const exists = (name: string | null | undefined) => !!name && fs.existsSync(path.join(DIR, name));

describe("البحث برقم التسجيل", () => {
  it("موجود أو لا، وطريق الاستعادة — ولا اسم", async () => {
    expect((await lookup("000000000000").expect(200)).body).toEqual({ found: false });

    const s = await student();
    expect((await lookup(s.reg).expect(200)).body).toEqual({ found: true, via: "admin" });

    // A proven address: the link by email instead.
    const u = await prisma.user.findUniqueOrThrow({ where: { id: s.userId }, select: { email: true } });
    await prisma.user.update({ where: { id: s.userId }, data: { verifiedEmail: u.email } });
    expect((await lookup(s.reg).expect(200)).body).toEqual({ found: true, via: "email" });

    const other = await student();
    await prisma.user.update({ where: { id: other.userId }, data: { status: "suspended" } });
    expect((await lookup(other.reg).expect(200)).body).toEqual({ found: true, via: "blocked" });
    expect((await send(other.reg).expect(400)).body.message).toBe(tr("passwordRequest.suspended"));
    expect((await send(s.reg).expect(400)).body.message).toBe(tr("passwordRequest.hasEmail"));
  });
});

describe("الطالب يرسل صورة بطاقته", () => {
  it("بلا بطاقة، أو برمزٍ لغير صاحب الرقم، أو برقمٍ لا طالب له ⇒ 400 ولا شيء يُحفظ", async () => {
    const s = await student();
    expect((await send(s.reg, { card: null }).expect(400)).body.message).toBe(tr("activation.photosRequired"));
    expect((await send(s.reg, { qr: null }).expect(400)).body.message).toBe(tr("activation.qrUnread"));
    expect((await send(s.reg, { qr: "999999999999" }).expect(400)).body.message).toBe(tr("activation.qrOther"));
    expect((await send("000000000000", { qr: "000000000000" }).expect(400)).body.message).toBe(tr("passwordRequest.unknown"));
    expect((await send(s.reg, { card: Buffer.from("<html>no</html>") }).expect(400)).body.message).toBe(tr("upload.imageType"));
    expect(await rowOf(s.userId)).toBeNull();
  });

  it("⇒ سرٌّ للمتصفّح (بصمته وحدها في القاعدة)، والطلب ينتظر، والإدارة تُنبَّه", async () => {
    const s = await student();
    const res = await send(s.reg).expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({ token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), status: "pending", sentAt: expect.any(String) });
    const row = await rowOf(s.userId);
    expect(row).toMatchObject({ status: "pending", qrNumber: s.reg, sealedPassword: null });
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.tokenHash).not.toContain(res.body.token);
    expect(exists(row!.cardFile)).toBe(true);

    expect((await status(res.body.token).expect(200)).body).toEqual({ status: "pending", sentAt: expect.any(String) });
    expect((await status("A".repeat(43)).expect(200)).body).toEqual({ status: "none" });
    await status("short").expect(400);

    expect(
      await prisma.notification.count({ where: { userId: f.admin.id, link: "/admin/users?view=passwords", message: { contains: s.reg } } }),
    ).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.auditLog.count({ where: { action: "password.adminRequested", actorId: s.userId } })).toBe(1);
  });

  it("إرسالٌ جديد يحلّ محلّ القائم: صورته تُحذف، والمتصفّح الأوّل لا يتابعه", async () => {
    const s = await student();
    const first = (await send(s.reg).expect(200)).body.token as string;
    const old = (await rowOf(s.userId))!.cardFile;
    const second = (await send(s.reg).expect(200)).body.token as string;
    expect(exists(old)).toBe(false);
    expect((await status(first).expect(200)).body).toEqual({ status: "none" });
    expect((await status(second).expect(200)).body.status).toBe("pending");
  });

  it("والإغلاق وهو ينتظر يسحبه، بصورته", async () => {
    const s = await student();
    const token = (await send(s.reg).expect(200)).body.token as string;
    const file = (await rowOf(s.userId))!.cardFile;
    expect((await close(token).expect(200)).body).toEqual({ status: "none" });
    expect(await rowOf(s.userId)).toBeNull();
    expect(exists(file)).toBe(false);
  });
});

describe("الإدارة تكتب كلمة المرور", () => {
  it("القائمة والصورة؛ كلمةٌ ضعيفة تُردّ؛ والمقبولة تصير كلمة الحساب — مؤقّتة — ويقرؤها المتصفّح الذي سأل", async () => {
    const s = await student();
    const token = (await send(s.reg).expect(200)).body.token as string;
    const item = (await itemOf(s.id))!;
    expect(item).toMatchObject({ registrationNumber: s.reg, qrMatches: true, photo: true, verified: false });
    expect(item).not.toHaveProperty("password");

    const photo = await admin(request(app).get(`/api/admin/password-requests/${s.id}/card`)).expect(200);
    expect(photo.headers["content-type"]).toBe("image/jpeg");
    await request(app).get(`/api/admin/password-requests/${s.id}/card`).expect(401);

    const approve = (body: object) => admin(request(app).post(`/api/admin/password-requests/${s.id}/approve`)).send(body);
    expect((await approve({ sentAt: item.sentAt, password: "12345678" }).expect(400)).body.message).toMatch(/./);
    await approve({ sentAt: new Date(0).toISOString(), password: STRONG }).expect(409);
    const file = (await rowOf(s.userId))!.cardFile;
    expect((await approve({ sentAt: item.sentAt, password: STRONG }).expect(200)).body.message).toBe(tr("passwordRequest.approved"));

    const row = (await rowOf(s.userId))!;
    expect(row).toMatchObject({ status: "approved", cardFile: null, qrNumber: null });
    expect(row.sealedPassword).toMatch(/^v1\./);
    expect(row.sealedPassword).not.toContain(STRONG);
    expect(exists(file)).toBe(false);
    expect(await itemOf(s.id)).toBeUndefined();

    // The account's password now — to be replaced at the first sign-in.
    const login = await request(app).post("/api/auth/student/login").send({ registrationNumber: s.reg, password: STRONG }).expect(200);
    expect(login.body.user?.mustChangePassword ?? login.body.mustChangePassword).toBe(true);

    expect((await status(token).expect(200)).body).toEqual({
      status: "approved",
      password: STRONG,
      registrationNumber: s.reg,
      decidedAt: expect.any(String),
    });

    // Copied: the request goes, password and all.
    await close(token).expect(200);
    expect(await rowOf(s.userId)).toBeNull();
    expect((await status(token).expect(200)).body).toEqual({ status: "none" });
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.auditLog.count({ where: { action: "password.pickedUp", actorId: s.userId } })).toBe(1);
    // The audit trail says a password was set — never which.
    const trail = await prisma.auditLog.findFirst({ where: { action: "POST /password-requests/:id/approve", targetId: s.id } });
    expect(JSON.stringify(trail)).not.toContain(STRONG);
  });

  it("الرفض بسببٍ يقرؤه الطالب؛ والصورة تُحذف", async () => {
    const s = await student();
    const token = (await send(s.reg).expect(200)).body.token as string;
    const item = (await itemOf(s.id))!;
    const file = (await rowOf(s.userId))!.cardFile;
    const reject = (body: object) => admin(request(app).post(`/api/admin/password-requests/${s.id}/reject`)).send(body);
    await reject({ sentAt: item.sentAt, reason: " " }).expect(400);
    await reject({ sentAt: item.sentAt, reason: "الصورة غير واضحة" }).expect(200);
    expect(exists(file)).toBe(false);
    expect((await status(token).expect(200)).body).toEqual({ status: "rejected", reason: "الصورة غير واضحة", decidedAt: expect.any(String) });
    // Decided: nothing left to decide.
    await reject({ sentAt: item.sentAt, reason: "x" }).expect(404);
  });
});

describe("ما طال انتظاره يذهب", () => {
  it("طلبٌ لم يُقرَّر في المدّة، وكلمة مرورٍ لم تُنسخ في وقتها", async () => {
    const a = await student();
    const ta = (await send(a.reg).expect(200)).body.token as string;
    const file = (await rowOf(a.userId))!.cardFile;
    await prisma.passwordRequest.update({
      where: { userId: a.userId },
      data: { sentAt: new Date(Date.now() - (config.PASSWORD_REQUEST_DAYS + 1) * 24 * 3600_000) },
    });
    await prunePasswordRequests();
    expect(await rowOf(a.userId)).toBeNull();
    expect(exists(file)).toBe(false);
    expect((await status(ta).expect(200)).body).toEqual({ status: "none" });

    const b = await student();
    const tb = (await send(b.reg).expect(200)).body.token as string;
    const item = (await itemOf(b.id))!;
    await admin(request(app).post(`/api/admin/password-requests/${b.id}/approve`)).send({ sentAt: item.sentAt, password: STRONG }).expect(200);
    await prisma.passwordRequest.update({
      where: { userId: b.userId },
      data: { decidedAt: new Date(Date.now() - (config.PASSWORD_PICKUP_HOURS + 1) * 3600_000) },
    });
    expect((await status(tb).expect(200)).body).toEqual({ status: "none" });
    expect(await rowOf(b.userId)).toBeNull();
  });
});
