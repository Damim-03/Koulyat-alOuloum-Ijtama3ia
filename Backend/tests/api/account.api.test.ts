/**
 * الحساب الشخصيّ — لكلّ دورٍ ما يملك تغييره من حسابه.
 *
 *   **المدير** — كلّ ما يخصّه: الاسمان، اسم المستخدم، الهاتف، الجنس، الصورة،
 *   والبريد (بكلمة المرور) وكلمة المرور.
 *   **الأستاذ** — اسماه والجنس والهاتف والصورة وكلمة المرور؛ والبريد الجامعي
 *   والقسم والرتبة سجلّ الإدارة.
 *   **الطالب** — اسمه ولقبه بالعربية (يُصحَّحان، أو يُملآن إن كانا فارغين)،
 *   وبريده (بكلمة المرور)، وكلمة مروره — لا غير.
 *
 * ولا يصل أحدٌ إلى ما ليس له: الدور والحالة والتوثيق يُتجاهَل ما يُدسّ منها.
 * والخطأ في كلمة المرور الحالية 400 لا 401، فلا يُطرد صاحبه. وكلمة مرورٍ
 * جديدة تُخرج الأجهزة الأخرى ويبقى هذا الجهاز برموزٍ جديدة.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import * as account from "../../src/modules/account/account.service";
import { outbox } from "../../src/core/mail/mailer";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let profToken = "";
let studentToken = "";
let student: Fixture["students"][number];

const adminLogin = (email: string, password = TEST_PASSWORD) => request(app).post("/api/auth/admin/login").send({ email, password });
const as = (r: request.Test, token: string) => r.set("Authorization", `Bearer ${token}`);
// The smallest valid PNG: enough for the magic-byte check behind the upload.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

beforeAll(async () => {
  await teardown();
  f = await seed(4);
  [student] = f.nextStudents(1);
  adminToken = (await adminLogin(f.admin.email!)).body.accessToken;
  profToken = (
    await request(app).post("/api/auth/professor/login").send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  studentToken = (await request(app).post("/api/auth/student/login").send({ registrationNumber: student.reg, password: TEST_PASSWORD }).expect(200)).body
    .accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("GET /api/account", () => {
  it("لكلّ دورٍ حسابه وما يملك تغييره — بلا كلمة المرور", async () => {
    const a = await as(request(app).get("/api/account"), adminToken).expect(200);
    expect(a.body.account).not.toHaveProperty("password");
    expect(a.body.account.can).toMatchObject({ photo: true, email: true });

    const p = await as(request(app).get("/api/account"), profToken).expect(200);
    expect(p.body.account.professor.universityEmail).toBe(f.professor.universityEmail);
    // A professor's own address too, for links and alerts (2026-11-20) — signing in stays by the university one.
    expect(p.body.account.can).toEqual({
      edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone"],
      photo: true,
      email: true,
    });
    expect(p.body.account.recoveryEmail).toBe(f.professor.universityEmail);

    const s = await as(request(app).get("/api/account"), studentToken).expect(200);
    expect(s.body.account.student.registrationNumber).toBe(student.reg);
    expect(s.body.account.can).toEqual({ edit: ["firstName", "lastName"], photo: false, email: true });
  });

  it("بلا تسجيل دخول ⇒ 401", async () => {
    await request(app).get("/api/account").expect(401);
  });
});

describe("PATCH /api/account", () => {
  it("المدير: الاسم واللاتينيّ موحَّداً والهاتف والجنس، و null يُفرغ", async () => {
    const res = await as(
      request(app).patch("/api/account").send({ firstName: `${TAG} أحمد`, lastNameLatin: "ben  ali", firstNameLatin: "ahmed amine", phone: "+213 550 00 00 01", gender: "male" }),
      adminToken,
    ).expect(200);
    expect(res.body.account).toMatchObject({ firstNameLatin: "Ahmed Amine", lastNameLatin: "BEN ALI", phone: "+213 550 00 00 01", gender: "male" });
    const cleared = await as(request(app).patch("/api/account").send({ phone: null }), adminToken).expect(200);
    expect(cleared.body.account.phone).toBeNull();
  });

  it("الدور والحالة والتوثيق والبريد لا تُعدَّل من هنا — تُتجاهَل", async () => {
    await as(request(app).patch("/api/account").send({ role: "student", status: "suspended", isVerified: false, email: `${TAG}.x@test.local` }), adminToken).expect(200);
    expect(await prisma.user.findUnique({ where: { id: f.admin.id } })).toMatchObject({ role: "admin", status: "active", email: f.admin.email });
  });

  it("اسم مستخدم محجوز ⇒ 400، وقيمٌ غير صالحة ⇒ 400", async () => {
    await prisma.user.update({ where: { id: f.admin2.id }, data: { username: `${TAG}_taken` } });
    await as(request(app).patch("/api/account").send({ username: `${TAG}_taken` }), adminToken).expect(400);
    await as(request(app).patch("/api/account").send({ username: "a b" }), adminToken).expect(400);
    await as(request(app).patch("/api/account").send({ lastNameLatin: "بن علي" }), adminToken).expect(400);
  });

  it("الأستاذ: اسماه والجنس والهاتف — واسم المستخدم يُتجاهَل، والصورة لا تُضبط بعنوان", async () => {
    const res = await as(
      request(app)
        .patch("/api/account")
        .send({ phone: "0661 22 33 44", firstName: `${TAG} خالد`, lastNameLatin: "merabet", gender: "male", username: `${TAG}_prof` }),
      profToken,
    ).expect(200);
    expect(res.body.account).toMatchObject({ phone: "0661 22 33 44", firstName: `${TAG} خالد`, lastNameLatin: "MERABET", gender: "male" });
    const u = await prisma.user.findUnique({ where: { id: f.profUser.id } });
    expect(u!.username).not.toBe(`${TAG}_prof`);
    // والبريد الجامعي سجلّ الإدارة: لا يصل إليه من هنا.
    await as(request(app).patch("/api/account").send({ universityEmail: `${TAG}.x@test.local` }), profToken).expect(200);
    expect((await prisma.professor.findUnique({ where: { id: f.professor.id } }))!.universityEmail).toBe(f.professor.universityEmail);
    await as(request(app).patch("/api/account").send({ avatarUrl: "https://evil.example/pixel.png" }), profToken).expect(400);
  });

  it("الطالب: اسمه ولقبه بالعربية وحدهما — يُملآن إن كانا فارغين، ويُصحَّحان؛ وما سواهما يُتجاهَل", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: student.userId } });
    // Left empty by the administration: filled in by the student.
    await prisma.user.update({ where: { id: student.userId }, data: { firstName: null, lastName: null } });
    const res = await as(
      request(app)
        .patch("/api/account")
        .send({ firstName: "  عماد   الدين ", lastName: "كير", firstNameLatin: "X", phone: "0550000000", gender: "female", email: `${TAG}.z@test.local` }),
      studentToken,
    ).expect(200);
    expect(res.body.account).toMatchObject({ firstName: "عماد الدين", lastName: "كير" });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: student.userId } });
    // Nothing else moved: the Latin name, the phone, the gender, the email are not the student's to change here.
    expect(u).toMatchObject({
      firstNameLatin: before.firstNameLatin,
      phone: before.phone,
      gender: before.gender,
      email: before.email,
    });
    // Corrected later, one of them alone.
    await as(request(app).patch("/api/account").send({ lastName: "بن كير" }), studentToken).expect(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: student.userId } })).toMatchObject({ firstName: "عماد الدين", lastName: "بن كير" });
    await prisma.user.update({ where: { id: student.userId }, data: { firstName: before.firstName, lastName: before.lastName } });
  });

  it("الطالب: بالعربية وحدها — لا لاتينية ولا أرقام، ولا يُفرَّغ", async () => {
    for (const bad of [{ firstName: "Imad" }, { lastName: "كير2" }, { firstName: "" }, { lastName: " " }, { firstName: null }, { firstName: "ك" }])
      expect((await as(request(app).patch("/api/account").send(bad), studentToken).expect(400)).body.message).toBeTruthy();
    expect((await as(request(app).patch("/api/account").send({ firstName: "Imad" }), studentToken).expect(400)).body.message).toContain(
      tr("account.arabicName"),
    );
  });
});

describe("POST /api/account/avatar", () => {
  it("الأستاذ يرفع صورته فتُضبط، ويحذفها بـ null", async () => {
    const res = await as(request(app).post("/api/account/avatar").attach("image", PNG, { filename: "me.png", contentType: "image/png" }), profToken).expect(200);
    expect(res.body.account.avatarUrl).toMatch(/^\/uploads\/cards\//);
    const cleared = await as(request(app).patch("/api/account").send({ avatarUrl: null }), profToken).expect(200);
    expect(cleared.body.account.avatarUrl).toBeNull();
  });

  it("ملفٌّ ليس صورة ⇒ 400", async () => {
    await as(request(app).post("/api/account/avatar").attach("image", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" }), profToken).expect(400);
  });

  it("الطالب ⇒ 403", async () => {
    await as(request(app).post("/api/account/avatar").attach("image", PNG, { filename: "me.png", contentType: "image/png" }), studentToken).expect(403);
  });
});

describe("POST /api/account/email", () => {
  it("الأستاذ أيضاً (2026-11-20) — لكن لا بريدَ جامعيّاً: بريده هو ⇒ 400، وبريد أستاذٍ آخر ⇒ 400 «مستعمل»", async () => {
    const send = (email: string) =>
      as(request(app).post("/api/account/email").send({ email, currentPassword: TEST_PASSWORD }), profToken);
    expect((await send(f.professor.universityEmail).expect(400)).body.message).toBe(tr("account.emailIsUniversity"));
    const other = await prisma.professor.findFirstOrThrow({ where: { NOT: { userId: f.profUser.id }, user: { email: { startsWith: TAG } } } });
    expect((await send(other.universityEmail).expect(400)).body.message).toBe(tr("account.emailTaken"));
  });

  it("الطالب يُدخل بريده بكلمة مروره: الخاطئة ⇒ 400، والمستعمل ⇒ 400، والصحيحة ⇒ يتغيّر ويصله رابط التأكيد", async () => {
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: student.userId } })).email;
    await as(request(app).post("/api/account/email").send({ email: `${TAG}.s-new@test.local`, currentPassword: "wrong" }), studentToken).expect(400);
    await as(request(app).post("/api/account/email").send({ email: f.admin2.email, currentPassword: TEST_PASSWORD }), studentToken).expect(400);
    const res = await as(
      request(app).post("/api/account/email").send({ email: `${TAG}.S-New@test.local`, currentPassword: TEST_PASSWORD }),
      studentToken,
    ).expect(200);
    expect(res.body.account.email).toBe(`${TAG}.s-new@test.local`.toLowerCase());
    // Not proven yet — and the link that proves it left at once, to the new address.
    expect(res.body.account.emailVerified).toBe(false);
    expect(res.body.verification).toBe("sent");
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe(`${TAG}.s-new@test.local`.toLowerCase());
    expect(mail.subject).toBe(tr("mail.verify.subject"));
    expect(await prisma.emailToken.count({ where: { userId: student.userId, purpose: "verify", email: `${TAG}.s-new@test.local`.toLowerCase() } })).toBe(1);
    // Still signed in by the registration number — the email is not how a student signs in.
    expect((await request(app).post("/api/auth/student/login").send({ registrationNumber: student.reg, password: TEST_PASSWORD })).status).toBe(200);
    await prisma.user.update({ where: { id: student.userId }, data: { email: before } });
  });

  it("كلمة مرور خاطئة ⇒ 400 (لا 401)، وبريدٌ مستعمل ⇒ 400", async () => {
    await as(request(app).post("/api/account/email").send({ email: `${TAG}.new@test.local`, currentPassword: "wrong" }), adminToken).expect(400);
    await as(request(app).post("/api/account/email").send({ email: f.admin2.email, currentPassword: TEST_PASSWORD }), adminToken).expect(400);
  });

  it("بالكلمة الصحيحة يتغيّر، ويُسجَّل الدخول به", async () => {
    const next = `${TAG}.renamed@test.local`;
    await as(request(app).post("/api/account/email").send({ email: next.toUpperCase(), currentPassword: TEST_PASSWORD }), adminToken).expect(200);
    expect((await adminLogin(next)).status).toBe(200);
    await prisma.user.update({ where: { id: f.admin.id }, data: { email: f.admin.email } });
  });
});

describe("POST /api/account/password", () => {
  it("الحالية خاطئة ⇒ 400، والجديدة كالحالية ⇒ 400، وقصيرة ⇒ 400", async () => {
    await as(request(app).post("/api/account/password").send({ currentPassword: "nope", newPassword: "Another-Pass1" }), studentToken).expect(400);
    await as(request(app).post("/api/account/password").send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }), studentToken).expect(400);
    await as(request(app).post("/api/account/password").send({ currentPassword: TEST_PASSWORD, newPassword: "short" }), studentToken).expect(400);
  });

  it("الطالب يغيّرها: الرمز القديم يسقط، والجديد يعمل بدوره نفسه، والدخول بالجديدة", async () => {
    const res = await as(request(app).post("/api/account/password").send({ currentPassword: TEST_PASSWORD, newPassword: "Brand-New-Pass9" }), studentToken).expect(200);
    await as(request(app).get("/api/account"), studentToken).expect(401);
    const now = await as(request(app).get("/api/account"), res.body.accessToken).expect(200);
    expect(now.body.account.role).toBe("student");
    expect((await request(app).post("/api/auth/student/login").send({ registrationNumber: student.reg, password: "Brand-New-Pass9" })).status).toBe(200);
  });

  it("الأستاذ يغيّرها كذلك", async () => {
    // كلمةٌ واحدة للتغيير والدخول: كانت كلمتين مختلفتين، فكان الدخول يفشل
    // بكلمةٍ لم تُضبط أصلاً — والتغيير نفسه سليم.
    const next = "Ustad-Jadid-2026";
    const res = await as(request(app).post("/api/account/password").send({ currentPassword: TEST_PASSWORD, newPassword: next }), profToken).expect(200);
    expect(res.body.refreshToken).toBeTruthy();
    expect((await request(app).post("/api/auth/professor/login").send({ universityEmail: f.professor.universityEmail, password: next })).status).toBe(200);
  });
});

//
// ═══ ما بقي من الحساب ═══
//

describe("الحساب — ما بقي", () => {
  it("المدير يختار اسم مستخدمٍ حرّاً", async () => {
    const res = await as(request(app).patch("/api/account"), adminToken).send({ username: `${TAG}-free-name` }).expect(200);
    expect(res.body.account.username).toBe(`${TAG}-free-name`);
  });

  it("البريد نفسه ⇒ لا تغيير", async () => {
    const res = await as(request(app).post("/api/account/email"), adminToken)
      .send({ email: f.admin.email!.toUpperCase(), currentPassword: TEST_PASSWORD })
      .expect(400);
    expect(res.body.message).toBe(tr("account.sameEmail"));
  });

  /** (والخدمة مباشرةً: اختبارٌ قبله غيّر كلمة مرور الأستاذ فأنهى جلساته.) */
  it("الأستاذ بلا ملفٍّ مرفوع ⇒ 400", async () => {
    await expect(account.setAvatarService(f.profUser.id, undefined)).rejects.toMatchObject({
      statusCode: 400,
      message: tr("upload.none"),
    });
  });

  /** الطالب يُردّ قبل الرفع على المسار؛ والخدمة تردّه أيضاً — وتمحو ما رُفع، لا تتركه يتيماً. */
  it("والخدمة نفسها ترفض صورة الطالب وتمحو الملفّ", async () => {
    const file = path.join(os.tmpdir(), `${TAG}-avatar.png`);
    fs.writeFileSync(file, PNG);
    await expect(account.setAvatarService(student.userId, { path: file } as Express.Multer.File)).rejects.toMatchObject({
      statusCode: 403,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(fs.existsSync(file)).toBe(false);
  });
  /** وملفٌّ اختفى قبل أن يُمحى (نظّفه غيرها) لا يُبدّل الجواب: 403، لا 500. */
  it("وملفٌّ لم يعد موجوداً لا يُسقطها", async () => {
    const gone = path.join(os.tmpdir(), `${TAG}-never-written.png`);
    await expect(account.setAvatarService(student.userId, { path: gone } as Express.Multer.File)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
