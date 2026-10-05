/**
 * الحساب الشخصيّ — لكلّ دورٍ ما يملك تغييره من حسابه.
 *
 *   **المدير** — كلّ ما يخصّه: الاسمان، اسم المستخدم، الهاتف، الجنس، الصورة،
 *   والبريد (بكلمة المرور) وكلمة المرور.
 *   **الأستاذ** — اسماه والجنس والهاتف والصورة وكلمة المرور؛ والبريد الجامعي
 *   والقسم والرتبة سجلّ الإدارة.
 *   **الطالب** — كلمة مروره، لا غير.
 *
 * ولا يصل أحدٌ إلى ما ليس له: الدور والحالة والتوثيق يُتجاهَل ما يُدسّ منها.
 * والخطأ في كلمة المرور الحالية 400 لا 401، فلا يُطرد صاحبه. وكلمة مرورٍ
 * جديدة تُخرج الأجهزة الأخرى ويبقى هذا الجهاز برموزٍ جديدة.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
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
    expect(p.body.account.can).toEqual({
      edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone"],
      photo: true,
      email: false,
    });

    const s = await as(request(app).get("/api/account"), studentToken).expect(200);
    expect(s.body.account.student.registrationNumber).toBe(student.reg);
    expect(s.body.account.can).toEqual({ edit: [], photo: false, email: false });
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

  it("الطالب: لا شيء ⇒ 403", async () => {
    await as(request(app).patch("/api/account").send({ phone: "0550000000" }), studentToken).expect(403);
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
  it("للمدير وحده: الأستاذ والطالب ⇒ 403", async () => {
    await as(request(app).post("/api/account/email").send({ email: `${TAG}.p@test.local`, currentPassword: TEST_PASSWORD }), profToken).expect(403);
    await as(request(app).post("/api/account/email").send({ email: `${TAG}.s@test.local`, currentPassword: TEST_PASSWORD }), studentToken).expect(403);
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
    const res = await as(request(app).post("/api/account/password").send({ currentPassword: TEST_PASSWORD, newPassword: "Prof-New-Pass9" }), profToken).expect(200);
    expect(res.body.refreshToken).toBeTruthy();
    expect((await request(app).post("/api/auth/professor/login").send({ universityEmail: f.professor.universityEmail, password: "Prof-New-Pass9" })).status).toBe(200);
  });
});
