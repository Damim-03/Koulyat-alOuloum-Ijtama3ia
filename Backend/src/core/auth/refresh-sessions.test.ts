/**
 * تدوير رمز التحديث ومهلات الجلسة — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI تمرّ بالتدوير السليم وبالرمز المُعاد مرّةً واحدة. وما يبقى
 * خارجها سباقاتٌ ومهلاتٌ لا يرتّبها HTTP بسهولة: تبويبان يجدّدان في اللحظة
 * نفسها، ورمزٌ من قبل التدوير يصل بعد أن تبنّته الجلسة، وتجديدان متزامنان
 * يكسب أحدهما الكتابة، وجلسةٌ بلا صفّ — مديرٌ تُرفض، وغيره تُتبنّى. وكلّها
 * تقرّر شيئاً واحداً: أيعيش هذا الحامل، أم أن نسخةً من رمزه في يدٍ أخرى؟
 */
jest.mock("../prisma/client", () => ({
  prisma: {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    revokedSession: { upsert: jest.fn() },
  },
}));
jest.mock("../realtime/realtime", () => ({ emitToUsers: jest.fn() }));

import jwt from "jsonwebtoken";

import { prisma } from "../prisma/client";
import { emitToUsers } from "../realtime/realtime";
import { config } from "../config/app.config";
import { Roles } from "../enums/role.enum";
import { verifyToken, type AppTokenPayload } from "./tokens";
import {
  closeUserSessions,
  endOtherSessions,
  endUserSession,
  idleLimitMs,
  listUserSessions,
  maxAgeMs,
  openSession,
  pruneAuthSessions,
  rotateSession,
  sessionLapse,
  touchSession,
} from "./refresh-sessions";

const db = prisma as unknown as {
  authSession: Record<"create" | "findUnique" | "findFirst" | "findMany" | "updateMany" | "upsert" | "deleteMany", jest.Mock>;
  revokedSession: { upsert: jest.Mock };
};

const HOUR = 60 * 60 * 1000;
const student = { userId: "u-1", role: Roles.STUDENT, refId: "s-1", tokenVersion: 0 };
const admin = { userId: "a-1", role: Roles.ADMIN, refId: "a-1", tokenVersion: 0 };
const device = { userAgent: "Mozilla/5.0 Chrome/120.0", ip: "10.0.0.7" };

/** رمز التحديث كما يصل الخادم بعد التحقّق منه. */
const presented = (over: Partial<AppTokenPayload> = {}): AppTokenPayload => ({
  ...student,
  typ: "refresh",
  sid: "sid-1",
  jti: "jti-current",
  ...over,
});

/** صفّ الجلسة كما في القاعدة. */
const row = (over: Record<string, unknown> = {}) => ({
  id: "sid-1",
  userId: "u-1",
  refreshJti: "jti-current",
  prevJti: "jti-previous",
  rotatedAt: new Date(Date.now() - HOUR),
  createdAt: new Date(Date.now() - 2 * HOUR),
  lastSeenAt: new Date(Date.now() - 60 * 1000),
  expiresAt: new Date(Date.now() + HOUR),
  ...over,
});

beforeEach(() => {
  db.authSession.updateMany.mockResolvedValue({ count: 1 });
});

//
// ═══ المهلات ═══
//

describe("sessionLapse", () => {
  const now = Date.now();
  const at = (agoMs: number) => new Date(now - agoMs);

  it("جلسة المدير تنتهي بعد ساعاتها، أو بعد سكونها", () => {
    const hours = config.ADMIN_SESSION_HOURS * HOUR;
    const idle = config.ADMIN_IDLE_MINUTES * 60 * 1000;
    expect(maxAgeMs("admin")).toBe(hours);
    expect(idleLimitMs("admin")).toBe(idle);

    expect(sessionLapse("admin", { createdAt: at(hours + 1000), lastSeenAt: at(0) }, now)).toBe("expired");
    expect(sessionLapse("admin", { createdAt: at(HOUR), lastSeenAt: at(idle + 1000) }, now)).toBe("idle");
    expect(sessionLapse("admin", { createdAt: at(HOUR), lastSeenAt: at(1000) }, now)).toBeNull();
  });

  it("وجلسة غيره: ثلاثون يوماً، ولا مهلة سكون", () => {
    const days30 = 30 * 24 * HOUR;
    expect(idleLimitMs("student")).toBe(Infinity);
    expect(sessionLapse("student", { createdAt: at(days30 + 1000), lastSeenAt: at(0) }, now)).toBe("expired");
    expect(sessionLapse("student", { createdAt: at(days30 - 1000), lastSeenAt: at(days30 - 1000) }, now)).toBeNull();
    // وبلا «الآن» صريح: الساعة الحاضرة.
    expect(sessionLapse("student", { createdAt: new Date(), lastSeenAt: new Date() })).toBeNull();
  });
});

//
// ═══ فتح الجلسة ═══
//

describe("openSession", () => {
  it("صفٌّ يحفظ معرّف رمز التحديث وانتهاءه والجهاز، ويُعلَن للحساب", async () => {
    const tokens = await openSession(student, device, "sid-chosen");
    const refresh = verifyToken(tokens.refreshToken, "refresh");

    const { data } = db.authSession.create.mock.calls[0]![0];
    expect(data).toMatchObject({ id: "sid-chosen", userId: "u-1", refreshJti: refresh.jti, ...device });
    expect(data.expiresAt).toEqual(new Date(refresh.exp! * 1000));
    expect(refresh.sid).toBe("sid-chosen");
    // ورمز الوصول لا يحمل معرّف رمز التحديث.
    expect(verifyToken(tokens.accessToken, "access").jti).toBeUndefined();
    expect(emitToUsers).toHaveBeenCalledWith(["u-1"], "sessions", "created");
  });

  it("وبلا جهاز ⇒ لا متصفّح ولا عنوان، لا «undefined»", async () => {
    await openSession(student);
    await openSession(student, { userAgent: "curl/8", ip: null });
    expect(db.authSession.create.mock.calls[0]![0].data).toMatchObject({ userAgent: null, ip: null });
    expect(db.authSession.create.mock.calls[1]![0].data).toMatchObject({ userAgent: "curl/8", ip: null });
  });

  it("ورمزٌ لا يُقرأ انتهاؤه ⇒ سبعة أيام احتياطاً", async () => {
    jest.spyOn(jwt, "decode").mockReturnValueOnce(null);
    const before = Date.now();
    await openSession(student);
    const expiresAt: Date = db.authSession.create.mock.calls[0]![0].data.expiresAt;
    expect(Math.round((expiresAt.getTime() - before) / (24 * HOUR))).toBe(7);
  });
});

//
// ═══ التدوير ═══
//

describe("rotateSession", () => {
  it("رمزٌ من قبل الجلسات (بلا sid) ⇒ تُفتح له جلسة", async () => {
    const r = await rotateSession(presented({ sid: undefined, jti: undefined }), student, device);
    expect(r.kind).toBe("rotated");
    expect(db.authSession.create).toHaveBeenCalledTimes(1);
  });

  it("الرمز الحاليّ ⇒ رمزٌ جديد، والقديم يصير «السابق»، ومكان الجهاز يُحدَّث", async () => {
    db.authSession.findUnique.mockResolvedValue(row());
    const r = await rotateSession(presented(), student, device);

    expect(r.kind).toBe("rotated");
    const { where, data } = db.authSession.updateMany.mock.calls[0]![0];
    // مشروطٌ بأن الرمز ما زال الحاليّ: من تجديدين متزامنين يدوّر واحد.
    expect(where).toEqual({ id: "sid-1", refreshJti: "jti-current" });
    expect(data).toMatchObject({ prevJti: "jti-current", ...device });
    expect(data.refreshJti).not.toBe("jti-current");
  });

  it("وبلا جهازٍ معروف ⇒ يبقى المحفوظ كما هو", async () => {
    db.authSession.findUnique.mockResolvedValue(row());
    await rotateSession(presented(), student, { userAgent: null, ip: null });
    const { data } = db.authSession.updateMany.mock.calls[0]![0];
    expect(data).not.toHaveProperty("userAgent");
    expect(data).not.toHaveProperty("ip");
  });

  /** تبويبان: الأوّل دوّر قبل لحظة، والثاني يصل بالرمز الذي استُبدل للتوّ. */
  it("رمزٌ استُبدل قبل لحظة (تبويبٌ آخر) ⇒ رمز وصولٍ فقط، بلا تدوير", async () => {
    db.authSession.findUnique.mockResolvedValue(row({ rotatedAt: new Date(Date.now() - 1000) }));
    const r = await rotateSession(presented({ jti: "jti-previous" }), student);

    expect(r).toMatchObject({ kind: "grace" });
    expect(r).toHaveProperty("tokens.accessToken");
    expect(r).not.toHaveProperty("tokens.refreshToken");
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("ورمزٌ قديمٌ بعد انقضاء المهلة ⇒ نسخةٌ في يدٍ أخرى: يُرفض", async () => {
    db.authSession.findUnique.mockResolvedValue(row({ rotatedAt: new Date(Date.now() - 2 * 60 * 1000) }));
    expect(await rotateSession(presented({ jti: "jti-previous" }), student)).toEqual({
      kind: "refused",
      reason: "replayed",
    });
    expect(await rotateSession(presented({ jti: "jti-unknown" }), student)).toMatchObject({ reason: "replayed" });
  });

  /** رمزٌ من قبل التدوير (بلا jti) يصل بعد أن تبنّت الجلسة التدوير للتوّ: السباق نفسه. */
  it("رمزٌ بلا jti لجلسةٍ دوّرت للتوّ ⇒ رمز وصولٍ فقط؛ وبعد المهلة ⇒ يُرفض", async () => {
    db.authSession.findUnique.mockResolvedValueOnce(row({ rotatedAt: new Date(Date.now() - 1000) }));
    expect((await rotateSession(presented({ jti: undefined }), student)).kind).toBe("grace");

    db.authSession.findUnique.mockResolvedValueOnce(row());
    expect(await rotateSession(presented({ jti: undefined }), student)).toMatchObject({ reason: "replayed" });
  });

  it("وتجديدان متزامنان: من خسر الكتابة يأخذ رمز وصولٍ فقط", async () => {
    db.authSession.findUnique.mockResolvedValue(row());
    db.authSession.updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await rotateSession(presented(), student);
    expect(r.kind).toBe("grace");
    expect(r).not.toHaveProperty("tokens.refreshToken");
  });

  it("جلسةٌ انقضت ⇒ تُغلق ويُرفض رمزها بسببه", async () => {
    db.authSession.findUnique.mockResolvedValue(row({ lastSeenAt: new Date(Date.now() - 24 * HOUR) }));
    expect(await rotateSession(presented({ ...admin, typ: "refresh" }), admin)).toEqual({ kind: "refused", reason: "idle" });
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["sid-1"] } } });
  });

  /** جلسة المدير تُفتح بصفٍّ دائماً: بلا صفّ خرج منها أو سبقت هذه المهلات. */
  it("مديرٌ بلا صفّ جلسة ⇒ يُرفض", async () => {
    db.authSession.findUnique.mockResolvedValue(null);
    expect(await rotateSession(presented({ ...admin, typ: "refresh" }), admin)).toEqual({
      kind: "refused",
      reason: "expired",
    });
  });

  /** وغيره: جلسةٌ من قبل التدوير، أو كُنس صفّها — تُتبنّى بصفٍّ جديد. */
  it("وغيره بلا صفّ ⇒ تُتبنّى الجلسة بالرمز الجديد", async () => {
    db.authSession.findUnique.mockResolvedValue(null);
    const r = await rotateSession(presented(), student, device);

    expect(r.kind).toBe("rotated");
    const call = db.authSession.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "sid-1" });
    expect(call.create).toMatchObject({ id: "sid-1", userId: "u-1", ...device });
    expect(call.update).toMatchObject({ prevJti: null });
  });
});

//
// ═══ إنهاء الجلسات وقراءتها ═══
//

describe("إنهاء الجلسات", () => {
  it("closeUserSessions: كلّها، أو كلّها إلا واحدة", async () => {
    await closeUserSessions("u-1");
    await closeUserSessions("u-1", "sid-keep");
    expect(db.authSession.deleteMany.mock.calls[0]![0]).toEqual({ where: { userId: "u-1" } });
    expect(db.authSession.deleteMany.mock.calls[1]![0]).toEqual({ where: { userId: "u-1", NOT: { id: "sid-keep" } } });
  });

  it("endUserSession: جلسةٌ ليست لهذا الحساب ⇒ false، ولا شيء يُمسّ", async () => {
    db.authSession.findFirst.mockResolvedValue(null);
    expect(await endUserSession("u-1", "sid-other")).toBe(false);
    expect(db.revokedSession.upsert).not.toHaveBeenCalled();
  });

  it("وجلسته ⇒ تُبطَل حتى انتهاء رمز تحديثها، ويُحذف صفّها", async () => {
    const expiresAt = new Date(Date.now() + HOUR);
    db.authSession.findFirst.mockResolvedValue({ expiresAt });
    expect(await endUserSession("u-1", "sid-1")).toBe(true);
    expect(db.revokedSession.upsert.mock.calls[0]![0].create).toEqual({ id: "sid-1", userId: "u-1", expiresAt });
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["sid-1"] } } });
  });

  it("endOtherSessions: كلّ جلسةٍ غير المُبقاة تُبطَل، وتُعاد معرّفاتها", async () => {
    const e = new Date(Date.now() + HOUR);
    db.authSession.findMany.mockResolvedValue([
      { id: "sid-2", expiresAt: e },
      { id: "sid-3", expiresAt: e },
    ]);

    expect(await endOtherSessions("u-1", "sid-1")).toEqual(["sid-2", "sid-3"]);
    expect(db.authSession.findMany.mock.calls[0]![0].where).toEqual({ userId: "u-1", NOT: { id: "sid-1" } });
    expect(db.revokedSession.upsert).toHaveBeenCalledTimes(2);

    db.authSession.findMany.mockResolvedValue([]);
    expect(await endOtherSessions("u-1", undefined)).toEqual([]);
    expect(db.authSession.findMany.mock.calls[1]![0].where).toEqual({ userId: "u-1" });
  });

  it("listUserSessions: الجهاز مقروءاً من متصفّحه، وآخر نشاطٍ هو آخر تدوير", async () => {
    const rotatedAt = new Date();
    db.authSession.findMany.mockResolvedValue([
      { id: "sid-1", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0", ip: "10.0.0.7", createdAt: rotatedAt, rotatedAt },
    ]);
    const [s] = await listUserSessions("u-1");
    expect(s).toMatchObject({ id: "sid-1", ip: "10.0.0.7", lastActiveAt: rotatedAt, device: { browser: "Chrome", os: "Windows" } });
  });
});

describe("التدبير المنزليّ لا يُفشل طلباً", () => {
  it("touchSession: مرّةً في الدقيقة على الأكثر", async () => {
    await touchSession("sid-1", new Date(Date.now() - 10 * 1000));
    expect(db.authSession.updateMany).not.toHaveBeenCalled();

    await touchSession("sid-1", new Date(Date.now() - 2 * 60 * 1000));
    expect(db.authSession.updateMany.mock.calls[0]![0].where).toEqual({ id: "sid-1" });
  });

  it("وعطلُها أو عطلُ الكنس يُبتلع", async () => {
    db.authSession.updateMany.mockRejectedValueOnce(new Error("deadlock"));
    await expect(touchSession("sid-1", new Date(0))).resolves.toBeUndefined();

    db.authSession.deleteMany.mockRejectedValueOnce(new Error("deadlock"));
    await expect(pruneAuthSessions()).resolves.toBeUndefined();
  });
});
