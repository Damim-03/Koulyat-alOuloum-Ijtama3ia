/**
 * «دخولٌ من جهازٍ جديد» — بلا قاعدة بيانات.
 *
 * اختبارات الـAPI تدخل من متصفّحٍ واحد في الغالب، فيبقى خارجها ما يحرس
 * التنبيه نفسه: دخولٌ بلا معرّف جهاز لا يُسجَّل، والجهاز المعروف لا يُنبّه،
 * والأوّل لا يُقارَن بشيء، والقائمة لا تكبر بلا حدّ، والعنوان المجهول يُقال
 * «؟»، وعطلٌ في التسجيل لا يُفشل الدخول أبداً.
 */
import crypto from "node:crypto";

jest.mock("../../core/prisma/client", () => ({
  prisma: {
    userDevice: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock("../notification/notification.service", () => ({ createNotification: jest.fn() }));
jest.mock("../../core/audit/audit", () => ({ audit: jest.fn() }));

import { prisma } from "../../core/prisma/client";
import { createNotification } from "../notification/notification.service";
import { audit } from "../../core/audit/audit";
import { describeDevice, recordSignInDevice } from "./devices";

const db = (prisma as unknown as { userDevice: Record<string, jest.Mock> }).userDevice;

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const device = (over: Partial<{ userAgent: string | null; ip: string | null; deviceId: string }> = {}) => ({
  userAgent: CHROME,
  ip: "10.0.0.7",
  deviceId: "browser-id-0123456789abcdef",
  ...over,
});
const keyOf = (id: string) => crypto.createHash("sha256").update(id).digest("hex");

beforeEach(() => {
  db.findUnique.mockResolvedValue(null);
  db.count.mockResolvedValue(0);
  db.findMany.mockResolvedValue([]);
});

describe("describeDevice", () => {
  it("المتصفّح والنظام، أو اسم البرنامج كما يسمّي نفسه، أو «؟»", () => {
    expect(describeDevice(CHROME)).toBe("Chrome · Windows");
    expect(describeDevice("curl/8.4.0")).toBe("curl/8.4.0");
    expect(describeDevice(null)).toBe("?");
  });
});

describe("recordSignInDevice", () => {
  it("دخولٌ بلا معرّف جهاز (سكربت، أو نداءٌ من الخدمة مباشرةً) ⇒ لا شيء يُسجَّل", async () => {
    await recordSignInDevice("u-1", undefined, "sid-1");
    await recordSignInDevice("u-1", { userAgent: CHROME, ip: null }, "sid-1");
    expect(db.findUnique).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("جهازٌ معروف ⇒ يُحدَّث آخر ظهوره، ولا تنبيه", async () => {
    db.findUnique.mockResolvedValue({ id: "d-1" });
    await recordSignInDevice("u-1", device(), "sid-1");

    // يُحفظ بصمةً لا معرّفاً: من يقرأ الجدول لا يملك كوكي أحد.
    expect(db.findUnique.mock.calls[0]![0].where.userId_deviceKey).toEqual({
      userId: "u-1",
      deviceKey: keyOf("browser-id-0123456789abcdef"),
    });
    expect(db.update.mock.calls[0]![0]).toMatchObject({ where: { id: "d-1" }, data: { ip: "10.0.0.7" } });
    expect(db.create).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("أوّل جهازٍ للحساب ⇒ يُسجَّل بلا تنبيه: لا شيء يُقارَن به", async () => {
    await recordSignInDevice("u-1", device(), "sid-1");
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(createNotification).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("جهازٌ جديد لحسابٍ له غيره ⇒ تنبيهٌ لصاحبه، وسطرٌ في سجلّ التدقيق", async () => {
    db.count.mockResolvedValue(2);
    await recordSignInDevice("u-1", device(), "sid-9");

    const notice = (createNotification as jest.Mock).mock.calls[0]![0];
    expect(notice).toMatchObject({ userId: "u-1", type: "security_alert", link: "/account?tab=security&session=sid-9" });
    // معزولان (U+2066…U+2069) ليبقى اتّجاههما داخل جملةٍ عربية.
    expect(notice.message.params).toEqual({ device: "⁦Chrome · Windows⁩", ip: "⁦10.0.0.7⁩" });
    expect((audit as jest.Mock).mock.calls[0]![0]).toMatchObject({ action: "auth.newDevice", actor: { id: "u-1" } });
    // والقائمة لم تبلغ حدّها: لا شيء يُحذف.
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("وعنوانٌ مجهول يُقال «؟» لا «null»", async () => {
    db.count.mockResolvedValue(1);
    await recordSignInDevice("u-1", device({ ip: null }), "sid-1");
    expect((createNotification as jest.Mock).mock.calls[0]![0].message.params.ip).toBe("⁦?⁩");
  });

  /** عشرون جهازاً لكلّ حساب: الأقدم ظهوراً يُنسى، فلا تكبر القائمة بلا حدّ. */
  it("وحين تبلغ القائمة حدّها يُنسى الأقدم ظهوراً", async () => {
    db.count.mockResolvedValue(20);
    db.findMany.mockResolvedValue([{ id: "old-1" }]);
    await recordSignInDevice("u-1", device(), "sid-1");

    expect(db.findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: "u-1" },
      orderBy: { lastSeenAt: "desc" },
      skip: 20,
    });
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old-1"] } } });
  });

  it("وعطلٌ في التسجيل يُكتب في السجلّ ولا يُفشل الدخول", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    db.findUnique.mockRejectedValue(new Error("deadlock"));

    await expect(recordSignInDevice("u-1", device(), "sid-1")).resolves.toBeUndefined();
    expect(JSON.parse(logged.mock.calls[0]![0])).toMatchObject({
      level: "error",
      scope: "recordSignInDevice",
      message: "deadlock",
    });
    logged.mockRestore();
  });
});
