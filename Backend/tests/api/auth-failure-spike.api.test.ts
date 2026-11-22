/**
 * الدخول المرفوض: يُكتب كلّه في سجلّ التدقيق، ويُراقَب مجموعه.
 *
 * قفل الحساب يرى المحاولات على حسابٍ واحد، وحدّ العنوان يرى المحاولات من
 * جهازٍ واحد. ولا يرى أيٌّ منهما «الرشّ»: قائمة أرقام تسجيل، كلٌّ منها يُجرَّب
 * مرّةً بتاريخ ميلادٍ محتمل، من أجهزةٍ كثيرة. فما يفضحه هو عرضه: حساباتٌ
 * كثيرة مختلفة تُرفض في دقائق. وحين يرنّ الإنذار، يجد المسؤول في السجلّ ما
 * جُرِّب ومن أين — للطالب والأستاذ كما للمسؤول.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import type { Prisma } from "../../src/generated/prisma";
import { config } from "../../src/core/config/app.config";
import { throttleKey } from "../../src/core/auth/login-throttle";
import { pruneFailedSignIns } from "../../src/core/audit/audit";
import { FAILURE_SPIKE_ACTION } from "../../src/modules/auth/failure-spike";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
const startedAt = new Date();
const SPIKE_LINK = "/admin/users?view=audit&kind=failed";

beforeAll(async () => {
  await teardown();
  f = await seed(2);
});

afterAll(async () => {
  // تنبيهات هذا الملفّ وصلت كلّ مسؤولٍ في القاعدة، لا مسؤولي الاختبار وحدهم.
  await prisma.notification.deleteMany({ where: { type: "security_alert", link: SPIKE_LINK } });
  await prisma.auditLog.deleteMany({
    where: {
      createdAt: { gte: startedAt },
      OR: [{ action: FAILURE_SPIKE_ACTION }, { actorLabel: { contains: TAG } }],
    },
  });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const studentLogin = (reg: string, password: string) =>
  request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password });

/** السجلّ يُكتب بعد الردّ لا قبله — فيُنتظر قليلاً حتى يظهر الصفّ. */
async function auditRow(where: Prisma.AuditLogWhereInput) {
  for (let i = 0; i < 40; i++) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

const clearThrottle = () =>
  prisma.loginThrottle.deleteMany({ where: { key: { contains: TAG.toLowerCase() } } });

//
// ═══ السجلّ ═══
//

describe("كلّ دخولٍ مرفوض يُكتب في السجلّ، بكلّ نموذج", () => {
  afterEach(clearThrottle);

  it("طالبٌ بكلمة مرورٍ خاطئة ⇒ رقمه ودوره وعنوانه — وكلمة المرور لا تُكتب", async () => {
    const s = f.students[0]!;
    await studentLogin(s.reg, "1999/12/31-wrong").expect(401);

    const row = await auditRow({ action: "auth.loginFailed", actorId: s.userId, createdAt: { gte: startedAt } });
    expect(row).toMatchObject({
      success: false,
      actorRole: "student",
      actorLabel: s.reg,
      details: { as: "student" },
    });
    expect(row!.ip).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain("1999/12/31-wrong");
  });

  it("ورقمٌ لا حساب له ⇒ يُكتب كما كُتب، بلا حسابٍ ولا دور", async () => {
    const ghost = `${TAG}-GHOST-LOG`;
    await studentLogin(ghost, "x").expect(401);

    const row = await auditRow({ action: "auth.loginFailed", actorLabel: ghost, createdAt: { gte: startedAt } });
    expect(row).toMatchObject({ actorId: null, actorRole: null, success: false, details: { as: "student" } });
  });

  it("وأستاذٌ بكلمة مرورٍ خاطئة ⇒ بريده ودوره", async () => {
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: "wrong-password" })
      .expect(401);

    const row = await auditRow({ action: "auth.loginFailed", actorId: f.profUser.id, createdAt: { gte: startedAt } });
    expect(row).toMatchObject({ actorRole: "professor", actorLabel: f.professor.universityEmail, details: { as: "professor" } });
  });

  it("والدخول الصحيح لا يُكتب مرفوضاً", async () => {
    const s = f.students[1]!;
    await studentLogin(s.reg, TEST_PASSWORD).expect(200);
    await new Promise((r) => setTimeout(r, 300));
    expect(
      await prisma.auditLog.count({ where: { action: "auth.loginFailed", actorId: s.userId, createdAt: { gte: startedAt } } }),
    ).toBe(0);
  });
});

describe("المرفوض يُحذف بعد مدّة الاحتفاظ، وما سواه باقٍ", () => {
  it("أقدم من 90 يوماً ⇒ يُحذف؛ أحدث منها، أو حدثٌ غير مرفوض ⇒ يبقى", async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const label = `${TAG}-RETENTION`;
    const [old, oldCode, recent, kept] = await Promise.all([
      prisma.auditLog.create({ data: { action: "auth.loginFailed", success: false, actorLabel: label, createdAt: daysAgo(91) } }),
      prisma.auditLog.create({ data: { action: "auth.twoFactorFailed", success: false, actorLabel: label, createdAt: daysAgo(120) } }),
      prisma.auditLog.create({ data: { action: "auth.loginFailed", success: false, actorLabel: label, createdAt: daysAgo(89) } }),
      prisma.auditLog.create({ data: { action: "auth.login", actorLabel: label, createdAt: daysAgo(400) } }),
    ]);

    expect(await pruneFailedSignIns(90)).toBeGreaterThanOrEqual(2);

    const left = await prisma.auditLog.findMany({ where: { actorLabel: label }, select: { id: true } });
    const ids = left.map((r) => r.id);
    expect(ids).not.toContain(old.id);
    expect(ids).not.toContain(oldCode.id);
    expect(ids).toEqual(expect.arrayContaining([recent.id, kept.id]));
    await prisma.auditLog.deleteMany({ where: { actorLabel: label } });
  });
});

//
// ═══ الإنذار ═══
//

describe("إنذار الفشل على حساباتٍ كثيرة", () => {
  /** معرِّفاتٌ لا حساب لها، كلٌّ منها يُجرَّب مرّةً واحدة — كما في الرشّ. */
  let n = 0;
  const spray = (count: number) =>
    Promise.all(Array.from({ length: count }, () => studentLogin(`${TAG}-SPRAY-${++n}`, "2003/01/01").expect(401)));

  const spikeRows = () => prisma.auditLog.findMany({ where: { action: FAILURE_SPIKE_ACTION } });
  const alertsFor = (userId: string) =>
    prisma.notification.findMany({ where: { userId, type: "security_alert", link: SPIKE_LINK } });

  beforeEach(async () => {
    await clearThrottle();
    // إنذارٌ سابق — من تشغيلٍ قبل ساعة — يُسكت هذا الإنذار بمهلته.
    await prisma.auditLog.deleteMany({ where: { action: FAILURE_SPIKE_ACTION } });
    await prisma.notification.deleteMany({ where: { type: "security_alert", link: SPIKE_LINK } });
    // الحدّ فوق ما في القاعدة الآن بثلاثة: ما خلّفته ملفّاتٌ أخرى لا يقرّب الإنذار ولا يبعده.
    const now = await prisma.loginThrottle.count({
      where: { lastFailureAt: { gte: new Date(Date.now() - config.LOGIN_SPIKE_WINDOW_MINUTES * 60 * 1000) } },
    });
    jest.replaceProperty(config, "LOGIN_SPIKE_ACCOUNTS", now + 3);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearThrottle();
  });

  it("دون الحدّ ⇒ لا شيء؛ عنده ⇒ سطرٌ في السجلّ وإشعارٌ لكلّ مسؤول، برابط المرفوضة", async () => {
    for (let i = 0; i < 2; i++) await spray(1);
    expect(await spikeRows()).toHaveLength(0);
    expect(await alertsFor(f.admin.id)).toHaveLength(0);

    await spray(1);
    const rows = await spikeRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      success: false,
      details: { minutes: config.LOGIN_SPIKE_WINDOW_MINUTES, threshold: config.LOGIN_SPIKE_ACCOUNTS },
    });
    const accounts = (rows[0]!.details as { accounts: number }).accounts;
    expect(accounts).toBeGreaterThanOrEqual(config.LOGIN_SPIKE_ACCOUNTS);

    for (const admin of [f.admin, f.admin2]) {
      const [alert, ...more] = await alertsFor(admin.id);
      expect(more).toHaveLength(0);
      expect(alert).toMatchObject({
        title: tr("notif.loginSpike.title", {}, "ar"),
        message: tr("notif.loginSpike.message", { count: accounts, minutes: config.LOGIN_SPIKE_WINDOW_MINUTES }, "ar"),
      });
    }
    // والطلبة والأساتذة لا يصلهم شيء.
    expect(await alertsFor(f.profUser.id)).toHaveLength(0);
    expect(await alertsFor(f.students[0]!.userId)).toHaveLength(0);
  });

  it("دفعةٌ متزامنة ⇒ إنذارٌ واحد؛ وما بعده خلال المهلة لا يُكرّره", async () => {
    await spray(6);
    await spray(4);
    expect(await spikeRows()).toHaveLength(1);
    expect(await alertsFor(f.admin.id)).toHaveLength(1);
  });

  it("بعد انقضاء المهلة ⇒ إنذارٌ جديد", async () => {
    await spray(3);
    const [first] = await spikeRows();
    await prisma.auditLog.update({
      where: { id: first!.id },
      data: { createdAt: new Date(Date.now() - (config.LOGIN_SPIKE_COOLDOWN_MINUTES + 1) * 60 * 1000) },
    });

    await spray(1);
    expect(await spikeRows()).toHaveLength(2);
    expect(await alertsFor(f.admin.id)).toHaveLength(2);
  });

  it("ومن أخطأ ثمّ دخل لا يُحسب: الحساب الذي فُتح خرج من العدّ", async () => {
    const s = f.students[0]!;
    await studentLogin(s.reg, "typo").expect(401);
    await studentLogin(s.reg, TEST_PASSWORD).expect(200);
    expect(await prisma.loginThrottle.findUnique({ where: { key: throttleKey("student", s.reg) } })).toBeNull();

    // اثنان آخران: لو بقي خطأ الطالب محسوباً لبلغ العدد الحدّ.
    await spray(2);
    expect(await spikeRows()).toHaveLength(0);
  });
});
