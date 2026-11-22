/**
 * البريد: «نسيتُ كلمة المرور»، وتأكيد البريد، وتنبيهات الأمان.
 *
 * ما يُحرس:
 *
 *   ١. **لا يذهب ما يفتح الحساب إلّا إلى بريدٍ أثبت صاحبه أنّه له.** بريدٌ
 *      أدخله غيره (الإدارة، أو هو بخطأٍ مطبعيّ) لا يصله رابط الاستعادة حتى
 *      يؤكَّد. وبريد الأستاذ الجامعيّ مؤكَّدٌ بطبيعته.
 *   ٢. **لا يتعلّم السائل شيئاً:** الجواب نفسه، لحسابٍ موجودٍ أو لا، له بريدٌ
 *      أو لا.
 *   ٣. **الرابط:** مرّةً واحدة، لمدّةٍ قصيرة، ولآخر رابطٍ فقط، وما دام البريد
 *      نفسه؛ وثلاثة في الساعة على الأكثر. وبعد الاستعادة تخرج الأجهزة كلّها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import * as mailer from "../../src/core/mail/mailer";
import { outbox } from "../../src/core/mail/mailer";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
type S = { id: string; userId: string; reg: string; email: string };
let A: S; // email confirmed
let B: S; // email entered by the administration, not confirmed
let C: S; // no email at all

const NEW_PASSWORD = "Zeitoun-Ouargla-2026!";

const forgot = (identifier: string) => request(app).post("/api/auth/password/forgot").send({ identifier });
const reset = (token: string, password: string) => request(app).post("/api/auth/password/reset").send({ token, password });

/** Mail is sent in the background: wait for it. */
async function nextMail(after: number) {
  for (let i = 0; i < 50 && outbox.length <= after; i++) await new Promise((r) => setTimeout(r, 20));
  return outbox[after];
}
/** The first mail matching, once it has come. */
async function mailWhere(pred: (m: (typeof outbox)[number]) => boolean) {
  for (let i = 0; i < 50 && !outbox.some(pred); i++) await new Promise((r) => setTimeout(r, 20));
  return outbox.find(pred);
}
const tokenIn = (text: string, page: string) => new RegExp(`/${page}\\?token=([A-Za-z0-9_-]{43})`).exec(text)?.[1];
const quiet = () => new Promise((r) => setTimeout(r, 120));

const loginStudent = (reg: string, password = TEST_PASSWORD) =>
  request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password });

beforeAll(async () => {
  await teardown();
  f = await seed(5);
  [A, B, C] = f.nextStudents(3) as S[];
  await prisma.user.update({ where: { id: A.userId }, data: { verifiedEmail: A.email } });
  await prisma.user.update({ where: { id: C.userId }, data: { email: null } });
});

beforeEach(async () => {
  outbox.length = 0;
  await prisma.emailToken.deleteMany({ where: { user: { firstName: TAG } } });
});

afterAll(async () => {
  await prisma.emailToken.deleteMany({ where: { user: { firstName: TAG } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [A.userId, B.userId, C.userId, f.profUser.id] } } });
  // C lost its email: the teardown finds users by it.
  await prisma.user.update({ where: { id: C.userId }, data: { email: `${TAG}.c@test.local` } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("نسيتُ كلمة المرور", () => {
  it("الخادم يقول إنّ البريد يعمل", async () => {
    expect((await request(app).get("/api/auth/password/available").expect(200)).body).toEqual({ available: true });
  });

  it("بريدٌ مؤكَّد ⇒ يصله رابطٌ بلغة الطلب؛ وغير المؤكَّد ومن لا بريد له ومن لا حساب له: الجواب نفسه، ولا رسالة", async () => {
    const answers = [];
    for (const id of [A.reg, B.reg, C.reg, `${TAG}-nobody`]) answers.push((await forgot(id).expect(200)).body);
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]).toEqual({ message: tr("auth.resetSent") });

    const mail = await nextMail(0);
    await quiet();
    expect(outbox).toHaveLength(1);
    expect(mail!.to).toBe(A.email);
    expect(mail!.subject).toBe(tr("mail.reset.subject"));
    expect(tokenIn(mail!.text, "ar/reset-password")).toBeTruthy();
    // Escaped HTML, the link inside.
    expect(mail!.html).toContain('dir="rtl"');
  });

  it("الأستاذ برقمه الجامعيّ ⇒ يصله على بريده الجامعيّ، بلغة الطلب", async () => {
    const prof = await prisma.professor.findUniqueOrThrow({ where: { userId: f.profUser.id }, select: { universityEmail: true } });
    await forgot(prof.universityEmail).set("Accept-Language", "fr").expect(200);
    const mail = await nextMail(0);
    expect(mail!.to).toBe(prof.universityEmail);
    expect(mail!.subject).toBe(tr("mail.reset.subject", undefined, "fr"));
    expect(tokenIn(mail!.text, "fr/reset-password")).toBeTruthy();
  });

  it("الرابط يغيّر كلمة المرور مرّةً واحدة، بالسياسة، ويُخرج كلّ الأجهزة، ويُبلَّغ صاحبه", async () => {
    const session = (await loginStudent(A.reg).expect(200)).body.accessToken as string;
    outbox.length = 0;
    await forgot(A.reg).expect(200);
    const token = tokenIn((await nextMail(0))!.text, "reset-password")!;

    expect((await request(app).post("/api/auth/password/reset/check").send({ token }).expect(200)).body).toEqual({ valid: true });
    // The policy every chosen password passes.
    const weak = await reset(token, "12345678").expect(400);
    expect(weak.body.message).not.toBe(tr("auth.resetDone"));

    expect((await reset(token, NEW_PASSWORD).expect(200)).body).toEqual({ message: tr("auth.resetDone") });
    await loginStudent(A.reg, NEW_PASSWORD).expect(200);
    await loginStudent(A.reg).expect(401);
    // The session from before is over.
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${session}`).expect(401);
    // Good once.
    expect((await reset(token, `${NEW_PASSWORD}x`).expect(400)).body.message).toBe(tr("auth.resetInvalid"));
    expect((await request(app).post("/api/auth/password/reset/check").send({ token }).expect(200)).body).toEqual({ valid: false });
    // And told by email.
    await nextMail(1);
    expect(outbox.some((m) => m.subject === tr("mail.passwordChanged.subject") && m.to === A.email)).toBe(true);

    // Back to the shared password for the other tests.
    await prisma.user.update({
      where: { id: A.userId },
      data: { password: (await prisma.user.findUniqueOrThrow({ where: { id: B.userId }, select: { password: true } })).password },
    });
  });

  it("رابطٌ أحدث يُبطل ما قبله؛ والمنتهي لا يعمل", async () => {
    await forgot(A.reg).expect(200);
    const first = tokenIn((await nextMail(0))!.text, "reset-password")!;
    await forgot(A.reg).expect(200);
    const second = tokenIn((await nextMail(1))!.text, "reset-password")!;
    expect((await request(app).post("/api/auth/password/reset/check").send({ token: first })).body.valid).toBe(false);
    expect((await request(app).post("/api/auth/password/reset/check").send({ token: second })).body.valid).toBe(true);

    await prisma.emailToken.updateMany({ where: { userId: A.userId, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(second, NEW_PASSWORD).expect(400)).body.message).toBe(tr("auth.resetInvalid"));
  });

  it("ثلاثة روابط في الساعة على الأكثر — الرابع لا يُرسَل، والجواب نفسه", async () => {
    for (let i = 0; i < 4; i++) await forgot(A.reg).expect(200);
    await quiet();
    expect(outbox).toHaveLength(3);
  });

  it("تغيّر البريد بعد الإرسال ⇒ الرابط لا يعمل", async () => {
    await forgot(A.reg).expect(200);
    const token = tokenIn((await nextMail(0))!.text, "reset-password")!;
    await prisma.user.update({ where: { id: A.userId }, data: { email: `${TAG}.a-new@test.local` } });
    expect((await reset(token, NEW_PASSWORD).expect(400)).body.message).toBe(tr("auth.resetInvalid"));
    await prisma.user.update({ where: { id: A.userId }, data: { email: A.email } });
  });

  it("رمزٌ ليس بشكل رموزنا ⇒ 400 قبل أيّ بحث", async () => {
    await request(app).post("/api/auth/password/reset").send({ token: "abc", password: NEW_PASSWORD }).expect(400);
  });
});

describe("تأكيد البريد", () => {
  it("بريدٌ غير مؤكَّد ⇒ رابطٌ إليه؛ فتحُه يؤكّده، فيصله بعدها رابط الاستعادة", async () => {
    const tok = (await loginStudent(B.reg).expect(200)).body.accessToken as string;
    const acc = await request(app).get("/api/account").set("Authorization", `Bearer ${tok}`).expect(200);
    expect(acc.body.emailVerified ?? acc.body.account?.emailVerified).toBe(false);
    outbox.length = 0;

    const sent = await request(app).post("/api/account/email/verify-request").set("Authorization", `Bearer ${tok}`).expect(200);
    expect(sent.body.message).toBe(tr("account.verifySent", { email: B.email, hours: 24 }));
    const mail = (await nextMail(0))!;
    expect(mail.to).toBe(B.email);
    const token = tokenIn(mail.text, "verify-email")!;

    // Opened on another device: no session needed.
    expect((await request(app).post("/api/auth/email/verify").send({ token }).expect(200)).body.message).toBe(
      tr("auth.verifyDone", { email: B.email }),
    );
    await request(app).post("/api/auth/email/verify").send({ token }).expect(400);
    const after = await request(app).get("/api/account").set("Authorization", `Bearer ${tok}`).expect(200);
    expect(after.body.emailVerified ?? after.body.account?.emailVerified).toBe(true);

    outbox.length = 0;
    await forgot(B.reg).expect(200);
    expect((await nextMail(0))!.to).toBe(B.email);

    // And the address changed by the administration is no longer proven.
    await prisma.user.update({ where: { id: B.userId }, data: { email: `${TAG}.b-new@test.local` } });
    const changed = await request(app).get("/api/account").set("Authorization", `Bearer ${tok}`).expect(200);
    expect(changed.body.emailVerified ?? changed.body.account?.emailVerified).toBe(false);
    await prisma.user.update({ where: { id: B.userId }, data: { email: B.email, verifiedEmail: null } });
  });

  it("خادم البريد يرفض ⇒ يقال «تعذّر الإرسال» لا «غير مفعّل»، ولا يُحسب الرابط من حدّ الساعة", async () => {
    const tok = (await loginStudent(B.reg).expect(200)).body.accessToken as string;
    const send = () => request(app).post("/api/account/email/verify-request").set("Authorization", `Bearer ${tok}`);
    const refused = jest.spyOn(mailer, "sendMail").mockResolvedValue(false);
    try {
      for (let i = 0; i < 4; i++) expect((await send().expect(400)).body.message).toBe(tr("auth.mailFailed"));
    } finally {
      refused.mockRestore();
    }
    expect(await prisma.emailToken.count({ where: { userId: B.userId } })).toBe(0);
    // The server is back: the next one goes, the failures not counted.
    await send().expect(200);
    expect((await nextMail(0))!.to).toBe(B.email);
  });

  it("مؤكَّدٌ من قبل، أو بلا بريد ⇒ 400 بسببه", async () => {
    const a = (await loginStudent(A.reg).expect(200)).body.accessToken as string;
    expect((await request(app).post("/api/account/email/verify-request").set("Authorization", `Bearer ${a}`).expect(400)).body.message).toBe(
      tr("account.alreadyVerified"),
    );
    const c = (await loginStudent(C.reg).expect(200)).body.accessToken as string;
    expect((await request(app).post("/api/account/email/verify-request").set("Authorization", `Bearer ${c}`).expect(400)).body.message).toBe(
      tr("account.noEmail"),
    );
  });
});

describe("تنبيهات الأمان بالبريد", () => {
  it("كلمة المرور تُغيَّر من صفحة الحساب ⇒ «تغيّرت كلمة مرور حسابك»", async () => {
    const tok = (await loginStudent(A.reg).expect(200)).body.accessToken as string;
    outbox.length = 0;
    await request(app)
      .post("/api/account/password")
      .set("Authorization", `Bearer ${tok}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })
      .expect((r) => expect([200, 201]).toContain(r.status));
    // (Each sign-in here is from "a new device" — that mail may come too.)
    const mail = await mailWhere((m) => m.subject === tr("mail.passwordChanged.subject"));
    expect(mail).toMatchObject({ to: A.email });
    await prisma.user.update({
      where: { id: A.userId },
      data: { password: (await prisma.user.findUniqueOrThrow({ where: { id: B.userId }, select: { password: true } })).password },
    });
  });

  it("دخولٌ من جهازٍ جديد ⇒ رسالةٌ تسمّيه؛ ومن لا بريد مؤكَّداً له لا يصله شيء", async () => {
    await loginStudent(A.reg).expect(200); // a device known from now on
    await quiet();
    outbox.length = 0;
    await loginStudent(A.reg).expect(200); // no cookie: another device
    const mail = await mailWhere((m) => m.subject === tr("mail.newDevice.subject"));
    expect(mail).toMatchObject({ to: A.email });
    expect(mail!.text).toContain(tr("mail.newDevice.action"));

    outbox.length = 0;
    await loginStudent(B.reg).expect(200);
    await loginStudent(B.reg).expect(200);
    await quiet();
    expect(outbox.filter((m) => m.to === B.email)).toEqual([]);
  });
});

describe("الأستاذ يضيف بريده ويؤكّده كالطالب (2026-11-20)", () => {
  const UNIVERSITY = `${TAG}.emp@test.local`;
  // Kept in lower case, as the server keeps it.
  const PERSONAL = `${TAG}.prof.personal@test.local`.toLowerCase();
  const loginProf = () => request(app).post("/api/auth/professor/login").send({ universityEmail: UNIVERSITY, password: TEST_PASSWORD });
  const accountOf = (body: { account?: unknown }) => (body.account ?? body) as { can: { email: boolean }; emailVerified: boolean; recoveryEmail: string | null };

  afterAll(async () => {
    await prisma.user.update({ where: { id: f.profUser.id }, data: { email: `${TAG}.prof@test.local`, verifiedEmail: null } });
  });

  it("يحفظه بكلمة مروره، ويؤكّده بالرابط ⇒ إليه تصل روابط الاستعادة بدل الجامعيّ", async () => {
    const tok = (await loginProf().expect(200)).body.accessToken as string;
    const as = (r: request.Test) => r.set("Authorization", `Bearer ${tok}`);

    const before = accountOf((await as(request(app).get("/api/account")).expect(200)).body);
    expect(before.can.email).toBe(true);
    expect(before.emailVerified).toBe(false);
    // Until then, the university address.
    expect(before.recoveryEmail).toBe(UNIVERSITY);

    // Its own university address is not «another» one.
    const own = await as(request(app).post("/api/account/email")).send({ email: UNIVERSITY, currentPassword: TEST_PASSWORD }).expect(400);
    expect(own.body.message).toBe(tr("account.emailIsUniversity"));

    outbox.length = 0;
    const changed = (await as(request(app).post("/api/account/email")).send({ email: PERSONAL, currentPassword: TEST_PASSWORD }).expect(200)).body;
    expect(changed.verification).toBe("sent");
    expect(accountOf(changed).emailVerified).toBe(false);
    expect(accountOf(changed).recoveryEmail).toBe(UNIVERSITY);
    const token = tokenIn((await mailWhere((m) => m.to === PERSONAL))!.text, "verify-email")!;
    await request(app).post("/api/auth/email/verify").send({ token }).expect(200);

    const after = accountOf((await as(request(app).get("/api/account")).expect(200)).body);
    expect(after.emailVerified).toBe(true);
    expect(after.recoveryEmail).toBe(PERSONAL);

    // «نسيت كلمة المرور» by the university address: the link goes to the proven one.
    outbox.length = 0;
    await forgot(UNIVERSITY).expect(200);
    expect((await nextMail(0))!.to).toBe(PERSONAL);
    // Proven: no second link.
    expect((await as(request(app).post("/api/account/email/verify-request")).expect(400)).body.message).toBe(tr("account.alreadyVerified"));
  });
});
