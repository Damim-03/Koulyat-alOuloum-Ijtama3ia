/**
 * Account security beyond the password: two-step verification for
 * administrators, their shorter sessions, the audit log, and the notice of a
 * sign-in from a new device.
 *
 * Two-step verification is off in the other test files (`.env.test`); this
 * one turns it on for its own administrator flows and back off at the end.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { totpAt, stepAt } from "../../src/core/auth/totp";
import { throttleKey } from "../../src/core/auth/login-throttle";
import { tr } from "../../src/core/i18n";
import bcrypt from "bcryptjs";
import * as account from "../../src/modules/account/account.service";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
const mutable = config as { REQUIRE_ADMIN_2FA: boolean };
const wasRequired = mutable.REQUIRE_ADMIN_2FA;

beforeAll(async () => {
  await teardown();
  f = await seed(2);
  mutable.REQUIRE_ADMIN_2FA = true;
});

afterAll(async () => {
  mutable.REQUIRE_ADMIN_2FA = wasRequired;
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [f.admin.id, f.admin2.id] } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const adminLogin = (email: string, password = TEST_PASSWORD) =>
  request(app).post("/api/auth/admin/login").send({ email, password });

const cookieOf = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${name}=`))?.split(";")[0];

//
// ═══ التحقّق بخطوتين ═══
//

describe("two-step verification for administrators", () => {
  let secret = "";
  let recovery: string[] = [];

  it("an administrator without it may reach only the setup", async () => {
    const res = await adminLogin(f.admin.email!).expect(200);
    expect(res.body.user.twoFactorSetupRequired).toBe(true);
    const bearer = `Bearer ${res.body.accessToken}`;

    const blocked = await request(app).get("/api/admin/users").set("Authorization", bearer).expect(403);
    expect(blocked.body.errorCode).toBe("TWO_FACTOR_SETUP_REQUIRED");
    await request(app).get("/api/account").set("Authorization", bearer).expect(200);

    const setup = await request(app).post("/api/account/2fa/setup").set("Authorization", bearer).expect(200);
    secret = setup.body.secret;
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

    await request(app).post("/api/account/2fa/enable").set("Authorization", bearer).send({ code: "000000" }).expect(400);
    const enabled = await request(app)
      .post("/api/account/2fa/enable")
      .set("Authorization", bearer)
      .send({ code: totpAt(secret) })
      .expect(200);
    recovery = enabled.body.recoveryCodes;
    expect(recovery).toHaveLength(10);

    // The secret is kept sealed, never as given.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: f.admin.id } });
    expect(row.totpSecret).not.toContain(secret);
    await request(app).get("/api/admin/users").set("Authorization", bearer).expect(200);
  });

  it("then a password alone earns a ticket, not a session", async () => {
    const res = await adminLogin(f.admin.email!).expect(200);
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.accessToken).toBeUndefined();
    expect(cookieOf(res, "refresh_token")).toBeUndefined();

    const wrong = await request(app)
      .post("/api/auth/admin/login/2fa")
      .send({ challenge: res.body.challenge, code: "123456" })
      .expect(401);
    expect(wrong.body.errorCode).toBe("AUTH_INVALID_CODE");
  });

  it("the code from the app opens it — once", async () => {
    // A code from a step not yet used (the setup used the current one).
    await prisma.user.update({ where: { id: f.admin.id }, data: { totpLastStep: stepAt() - 2 } });
    const code = totpAt(secret);
    const { challenge } = (await adminLogin(f.admin.email!).expect(200)).body;
    const ok = await request(app).post("/api/auth/admin/login/2fa").send({ challenge, code }).expect(200);
    expect(ok.body.accessToken).toBeDefined();
    expect(cookieOf(ok, "refresh_token")).toBeDefined();

    const again = (await adminLogin(f.admin.email!).expect(200)).body.challenge;
    await request(app).post("/api/auth/admin/login/2fa").send({ challenge: again, code }).expect(401);
  });

  it("a recovery code works in its place, and only once", async () => {
    const use = async () => {
      const { challenge } = (await adminLogin(f.admin.email!).expect(200)).body;
      return request(app).post("/api/auth/admin/login/2fa").send({ challenge, code: recovery[0] });
    };
    expect((await use()).status).toBe(200);
    expect((await use()).status).toBe(401);
    await prisma.loginThrottle.deleteMany({ where: { key: throttleKey("admin", f.admin.email!) } });
  });

  /**
   * Read, then written: two requests with the same code at the same moment
   * both found it on the list they had read. The write is now conditional on
   * the row being as it was read, so exactly one gets through.
   */
  it("the same recovery code sent twice at once opens one session, not two", async () => {
    const tickets = await Promise.all(
      [0, 1].map(async () => (await adminLogin(f.admin.email!).expect(200)).body.challenge as string),
    );
    const results = await Promise.all(
      tickets.map((challenge) =>
        request(app).post("/api/auth/admin/login/2fa").send({ challenge, code: recovery[1] }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: f.admin.id } });
    expect(row.totpRecoveryCodes as string[]).toHaveLength(8);
    await prisma.loginThrottle.deleteMany({ where: { key: throttleKey("admin", f.admin.email!) } });
  });

  it("a forged or expired ticket opens nothing", async () => {
    await request(app).post("/api/auth/admin/login/2fa").send({ challenge: "x.y.z", code: totpAt(secret) }).expect(401);
  });

  /**
   * The ticket says "this account's password was just given". A password
   * changed since (the generation moved) voids it — the code alone, however
   * right, opens nothing on a ticket the old password earned.
   */
  it("a ticket from before a password change opens nothing, even with the right code", async () => {
    const { challenge } = (await adminLogin(f.admin.email!).expect(200)).body;
    await prisma.user.update({ where: { id: f.admin.id }, data: { tokenVersion: { increment: 1 } } });

    const res = await request(app).post("/api/auth/admin/login/2fa").send({ challenge, code: totpAt(secret) }).expect(401);
    expect(res.body.errorCode).toBe("AUTH_INVALID_TOKEN");
    expect(res.body.message).toBe(tr("auth.challengeExpired"));
  });
});

//
// ═══ جلسة المسؤول: مدّتها على الخادم ═══
//

describe("an administrator's session ends on the server", () => {
  it("after its idle limit, with or without the browser", async () => {
    await prisma.user.update({ where: { id: f.admin2.id }, data: { totpEnabledAt: new Date() } });
    const res = await adminLogin(f.admin2.email!).expect(200);
    const bearer = `Bearer ${res.body.accessToken}`;
    await request(app).get("/api/admin/users").set("Authorization", bearer).expect(200);

    const idle = new Date(Date.now() - (config.ADMIN_IDLE_MINUTES + 1) * 60 * 1000);
    await prisma.authSession.updateMany({ where: { userId: f.admin2.id }, data: { lastSeenAt: idle } });

    const gone = await request(app).get("/api/admin/users").set("Authorization", bearer).expect(401);
    expect(gone.body.message).toBeTruthy();
    await request(app).post("/api/auth/refresh").set("Cookie", cookieOf(res, "refresh_token")!).expect(401);
  });

  /**
   * A browser left open makes no request; the first thing it does on return
   * is refresh. That refresh is refused — and says why, so the page can tell
   * "you were away too long" from "you were signed out".
   */
  it("and a refresh after the idle limit is refused with the reason, ending the session", async () => {
    await prisma.user.update({ where: { id: f.admin2.id }, data: { totpEnabledAt: new Date() } });
    const res = await adminLogin(f.admin2.email!).expect(200);
    const sid = (await prisma.authSession.findFirstOrThrow({
      where: { userId: f.admin2.id },
      orderBy: { createdAt: "desc" },
    })).id;
    const idle = new Date(Date.now() - (config.ADMIN_IDLE_MINUTES + 1) * 60 * 1000);
    await prisma.authSession.update({ where: { id: sid }, data: { lastSeenAt: idle } });

    const refused = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieOf(res, "refresh_token")!)
      .expect(401);
    expect(refused.body.message).toBe(tr("auth.idleTimeout"));
    expect(await prisma.authSession.findUnique({ where: { id: sid } })).toBeNull();
    expect(await prisma.revokedSession.findUnique({ where: { id: sid } })).not.toBeNull();
  });
});

//
// ═══ سجلّ العمليات ═══
//

describe("the audit log", () => {
  it("records an administrator's change — without the password — and lists it", async () => {
    await prisma.user.update({ where: { id: f.admin2.id }, data: { totpEnabledAt: new Date() } });
    const bearer = `Bearer ${(await adminLogin(f.admin2.email!).expect(200)).body.accessToken}`;
    await request(app)
      .post(`/api/admin/users/${f.students[0].userId}/reset-password`)
      .set("Authorization", bearer)
      .send({ password: "12/05/2003" })
      .expect(200);

    // Written after the response: give it a moment.
    await new Promise((r) => setTimeout(r, 300));
    const list = await request(app)
      .get("/api/admin/audit-logs")
      .query({ kind: "changes", search: "reset-password" })
      .set("Authorization", bearer)
      .expect(200);
    const row = list.body.items.find((r: { targetId: string }) => r.targetId === f.students[0].userId);
    expect(row.action).toBe("POST /users/:id/reset-password");
    expect(row.actorId).toBe(f.admin2.id);
    expect(row.details.body.password).toBe("[hidden]");
    expect(JSON.stringify(row)).not.toContain("12/05/2003");

    // And the account it reset must choose its own before anything else.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.students[0].userId } })).mustChangePassword).toBe(true);
  });

  it("records refused administrator sign-ins", async () => {
    await adminLogin(f.admin2.email!, "wrong-password").expect(401);
    await new Promise((r) => setTimeout(r, 300));
    const failed = await prisma.auditLog.findFirst({
      where: { action: "auth.loginFailed", actorId: f.admin2.id, success: false },
    });
    expect(failed).not.toBeNull();
    await prisma.loginThrottle.deleteMany({ where: { key: throttleKey("admin", f.admin2.email!) } });
  });
});

//
// ═══ الدخول من جهازٍ جديد ═══
//

describe("a sign-in from a new device", () => {
  const login = (cookie?: string) => {
    const r = request(app).post("/api/auth/student/login");
    if (cookie) r.set("Cookie", cookie);
    return r.send({ registrationNumber: f.students[1].reg, password: TEST_PASSWORD });
  };

  it("tells the owner — but not for the first browser, nor for one seen before", async () => {
    const alerts = () =>
      prisma.notification.count({ where: { userId: f.students[1].userId, type: "security_alert" } });

    const first = await login().expect(200);
    const device = cookieOf(first, "device_id")!;
    expect(device).toBeDefined();
    expect(await alerts()).toBe(0);

    await login(device).expect(200);
    expect(await alerts()).toBe(0);

    const other = await login().expect(200); // no cookie: another browser
    expect(await alerts()).toBe(1);

    // Shown to the account's other devices, not to the one it is about.
    const mine = await request(app)
      .get("/api/account/security-alerts")
      .set("Authorization", `Bearer ${other.body.accessToken}`)
      .expect(200);
    expect(mine.body.alerts).toHaveLength(0);
  });
});

//
// ═══ التحقّق بخطوتين: إطفاؤه، وتجديد رموزه، وما يحرسه ═══
//

describe("two-step verification — turned off, renewed, and what guards it", () => {
  const email = `${TAG}.admin3@test.local`;
  let adminId = "";
  let bearer = "";
  let secret = "";
  let recovery: string[] = [];
  const as = (r: request.Test, token = bearer) => r.set("Authorization", token);

  beforeAll(async () => {
    adminId = (
      await prisma.user.create({
        data: { email, password: await bcrypt.hash(TEST_PASSWORD, 4), role: "admin", firstName: TAG, lastName: "Admin3" },
      })
    ).id;
  });

  /** تفعيله يُنهي جلسات الحساب الأخرى: فُتحت كلّها بلا خطوةٍ ثانية. */
  it("turning it on ends the account's other sessions, and cannot be done twice", async () => {
    const other = `Bearer ${(await adminLogin(email).expect(200)).body.accessToken}`;
    bearer = `Bearer ${(await adminLogin(email).expect(200)).body.accessToken}`;

    secret = (await as(request(app).post("/api/account/2fa/setup")).expect(200)).body.secret;
    recovery = (await as(request(app).post("/api/account/2fa/enable")).send({ code: totpAt(secret) }).expect(200)).body.recoveryCodes;

    await as(request(app).get("/api/account"), other).expect(401);
    const mine = await as(request(app).get("/api/account")).expect(200);
    expect(mine.body.account.twoFactor).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });

    const setup = await as(request(app).post("/api/account/2fa/setup")).expect(400);
    expect(setup.body.message).toBe(tr("twoFactor.alreadyEnabled"));
    await as(request(app).post("/api/account/2fa/enable")).send({ code: "123456" }).expect(400);
  });

  it("new recovery codes take the password, and the old ones stop working", async () => {
    await as(request(app).post("/api/account/2fa/recovery-codes")).send({ currentPassword: "wrong" }).expect(400);
    const res = await as(request(app).post("/api/account/2fa/recovery-codes")).send({ currentPassword: TEST_PASSWORD }).expect(200);
    expect(res.body.recoveryCodes).toHaveLength(10);
    expect(res.body.recoveryCodes).not.toContain(recovery[0]);

    const old = await as(request(app).post("/api/account/2fa/disable"))
      .send({ currentPassword: TEST_PASSWORD, code: recovery[0] })
      .expect(400);
    expect(old.body.message).toBe(tr("twoFactor.badCode"));
    recovery = res.body.recoveryCodes;
  });

  /** «كان هذا أنا»: يُقرّ به تنبيهٌ واحد أو كلّها. وتنبيهُ غيره لا يُقرّ به. */
  it("security alerts are acknowledged one by one or all at once — only one's own", async () => {
    const alert = () =>
      prisma.notification.create({ data: { userId: adminId, type: "security_alert", title: "t", message: "m" } });
    const [one, two, three] = [await alert(), await alert(), await alert()];
    const foreign = await prisma.notification.create({
      data: { userId: f.admin.id, type: "security_alert", title: "t", message: "m" },
    });

    await as(request(app).post(`/api/account/security-alerts/${one.id}/ack`)).expect(200);
    await as(request(app).post(`/api/account/security-alerts/${foreign.id}/ack`)).expect(404);
    // ومعها تنبيه «دخولٌ من جهازٍ جديد» الذي صنعه الدخول الثاني أعلاه.
    const unread = await prisma.notification.count({ where: { userId: adminId, type: "security_alert", isRead: false } });
    expect(unread).toBeGreaterThanOrEqual(2);
    const all = await as(request(app).post("/api/account/security-alerts/ack-all")).expect(200);
    expect(all.body).toEqual({ acknowledged: unread });
    const rows = await prisma.notification.findMany({ where: { id: { in: [one.id, two.id, three.id, foreign.id] } } });
    expect(rows.filter((r) => r.isRead).map((r) => r.id).sort()).toEqual([one.id, two.id, three.id].sort());
    await prisma.notification.delete({ where: { id: foreign.id } });
  });

  it("turning it off takes the password and a code — then nothing of it remains", async () => {
    await as(request(app).post("/api/account/2fa/disable")).send({ currentPassword: TEST_PASSWORD, code: "000000" }).expect(400);
    await as(request(app).post("/api/account/2fa/disable")).send({ currentPassword: TEST_PASSWORD, code: recovery[0] }).expect(200);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect([row.totpSecret, row.totpEnabledAt, row.totpRecoveryCodes]).toEqual([null, null, null]);

    const again = await as(request(app).post("/api/account/2fa/disable")).send({ currentPassword: TEST_PASSWORD, code: recovery[1] }).expect(400);
    expect(again.body.message).toBe(tr("twoFactor.notEnabled"));
    const codes = await as(request(app).post("/api/account/2fa/recovery-codes")).send({ currentPassword: TEST_PASSWORD }).expect(400);
    expect(codes.body.message).toBe(tr("twoFactor.notEnabled"));
    const enable = await as(request(app).post("/api/account/2fa/enable")).send({ code: totpAt(secret) }).expect(400);
    expect(enable.body.message).toBe(tr("twoFactor.noSetup"));
  });

  it("is for administrators only", async () => {
    const prof = await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200);
    const res = await as(request(app).post("/api/account/2fa/setup"), `Bearer ${prof.body.accessToken}`).expect(403);
    expect(res.body.message).toBe(tr("twoFactor.adminOnly"));
  });

  /** يُسمّى في تطبيق المصادقة بما يُعرف به: بريده، وإلّا اسم المستخدم، وإلّا معرّفه. */
  it("the authenticator names the account by its email, else its username, else its id", async () => {
    await prisma.user.update({ where: { id: adminId }, data: { email: null, username: `${TAG}-admin3` } });
    try {
      expect((await account.startTwoFactorSetupService(adminId)).account).toBe(`${TAG}-admin3`);
      await prisma.user.update({ where: { id: adminId }, data: { username: null } });
      expect((await account.startTwoFactorSetupService(adminId)).account).toBe(adminId);

      // وبلا بريدٍ يُضاف بريدٌ لا «يساوي الحاليّ».
      const changed = await account.changeEmailService(adminId, { email, currentPassword: TEST_PASSWORD });
      expect(changed.email).toBe(email.toLowerCase()); // يُحفظ بحروفٍ صغيرة
    } finally {
      await prisma.user.update({ where: { id: adminId }, data: { email, totpPendingSecret: null } });
    }
  });

  /** حسابٌ حُذف بين وسيط المصادقة والخدمة: لا شيء يُكتب لحسابٍ غائب. */
  it("an account gone between the middleware and the service ⇒ 404 everywhere", async () => {
    const gone = "00000000-0000-0000-0000-000000000000";
    for (const call of [
      () => account.getAccountService(gone),
      () => account.enableTwoFactorService(gone, { code: "123456" }, {}),
      () => account.disableTwoFactorService(gone, { currentPassword: "x", code: "123456" }),
      () => account.regenerateRecoveryCodesService(gone, { currentPassword: "x" }),
    ])
      await expect(call()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("and an administrator's own password change keeps them signed in on this device", async () => {
    const res = await as(request(app).post("/api/account/password"))
      .send({ currentPassword: TEST_PASSWORD, newPassword: "Another-Strong-Pass1" })
      .expect(200);
    await as(request(app).get("/api/account"), `Bearer ${res.body.accessToken}`).expect(200);
  });
});
