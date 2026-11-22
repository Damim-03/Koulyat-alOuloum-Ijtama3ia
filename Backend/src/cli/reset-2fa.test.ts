/**
 * إطفاء التحقّق بخطوتين لمسؤولٍ فقد هاتفه — من طرفية السيرفر.
 */
jest.mock("../core/prisma/client", () => ({
  prisma: {
    user: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    authSession: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

import { prisma } from "../core/prisma/client";
import { Prisma } from "../generated/prisma";
import { main, resetTwoFactor, run } from "./reset-2fa";

const db = prisma as unknown as {
  user: { findFirst: jest.Mock; update: jest.Mock };
  authSession: { deleteMany: jest.Mock };
  auditLog: { create: jest.Mock };
};

const out = () => {
  const logs: string[] = [];
  const errors: string[] = [];
  return { logs, errors, log: (...a: unknown[]) => logs.push(a.join(" ")), error: (...a: unknown[]) => errors.push(a.join(" ")) };
};

beforeEach(() => {
  db.user.findFirst.mockReset().mockResolvedValue({ id: "admin-1", totpEnabledAt: new Date() });
  db.user.update.mockReset().mockResolvedValue({});
  db.authSession.deleteMany.mockReset().mockResolvedValue({ count: 2 });
  db.auditLog.create.mockReset().mockResolvedValue({});
});

describe("resetTwoFactor", () => {
  it("يمحو السرّ ورموز الاسترداد، ويُخرج كلّ الأجهزة، ويكتب ذلك", async () => {
    expect(await resetTwoFactor("  Dean@Univ-Eloued.DZ ")).toEqual({ email: "dean@univ-eloued.dz", wasEnabled: true });

    expect(db.user.findFirst.mock.lastCall![0].where).toEqual({ email: "dean@univ-eloued.dz", role: "admin" });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpRecoveryCodes: Prisma.DbNull,
        tokenVersion: { increment: 1 },
      },
    });
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin-1" } });
    expect(db.auditLog.create.mock.lastCall![0].data).toMatchObject({
      action: "cli.twoFactorReset",
      actorLabel: "server console",
      targetId: "admin-1",
      details: { email: "dean@univ-eloued.dz", wasEnabled: true },
    });
  });

  it("ومن لم يفعّله بعد يُعاد ضبطه كذلك، ويُقال إنه لم يكن مفعّلاً", async () => {
    db.user.findFirst.mockResolvedValue({ id: "admin-1", totpEnabledAt: null });
    expect((await resetTwoFactor("dean@univ-eloued.dz")).wasEnabled).toBe(false);
  });

  it("بلا بريد، أو ببريدٍ لا مسؤول له ⇒ لا شيء يُمسّ", async () => {
    await expect(resetTwoFactor(undefined)).rejects.toThrow("Set ADMIN_EMAIL");
    await expect(resetTwoFactor("   ")).rejects.toThrow("Set ADMIN_EMAIL");
    db.user.findFirst.mockResolvedValue(null);
    await expect(resetTwoFactor("student@univ-eloued.dz")).rejects.toThrow("No administrator signs in with student@univ-eloued.dz.");
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("run", () => {
  it("ينجح ويقول ما جرى", async () => {
    const o = out();
    expect(await run({ ADMIN_EMAIL: "dean@univ-eloued.dz" }, o)).toBe(0);
    expect(o.logs[0]).toBe("✔ Two-step verification reset for dean@univ-eloued.dz; every session signed out.");
  });

  it("ورفضٌ معروف يُطبع كما هو؛ وعطلٌ غير متوقّع يُذكر بسببه", async () => {
    const refused = out();
    expect(await run({}, refused)).toBe(1);
    expect(refused.errors).toEqual(["✖ Set ADMIN_EMAIL to the administrator's sign-in email."]);

    db.user.update.mockRejectedValue(new Error("db down"));
    const broken = out();
    expect(await run({ ADMIN_EMAIL: "dean@univ-eloued.dz" }, broken)).toBe(1);
    expect(broken.errors).toEqual(["✖ Could not reset: db down"]);

    db.user.update.mockRejectedValue("not an Error");
    const odd = out();
    expect(await run({ ADMIN_EMAIL: "dean@univ-eloued.dz" }, odd)).toBe(1);
    expect(odd.errors).toEqual(["✖ Could not reset: not an Error"]);
  });

  it("ويكتب في الطرفية نفسها إن لم يُعطَ غيرها", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await run({ ADMIN_EMAIL: "dean@univ-eloued.dz" })).toBe(0);
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("main — مدخل الأمر", () => {
  it("رمز الخروج للعمليّة، ثمّ تُترك القاعدة", async () => {
    const disconnect = jest.fn();
    (prisma as unknown as { $disconnect: jest.Mock }).$disconnect = disconnect;
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const exitCode = process.exitCode;
    try {
      await main({ ADMIN_EMAIL: "dean@univ-eloued.dz" });
      expect(process.exitCode).toBe(0);
      await main({});
      expect(process.exitCode).toBe(1);
      expect(error).toHaveBeenCalledWith("✖ Set ADMIN_EMAIL to the administrator's sign-in email.");
      expect(log).toHaveBeenCalled();
      expect(disconnect).toHaveBeenCalledTimes(2);
    } finally {
      process.exitCode = exitCode;
    }
  });

  it("وبلا وسيطٍ — كما تشغّله الطرفية — يقرأ بيئة العمليّة", async () => {
    (prisma as unknown as { $disconnect: jest.Mock }).$disconnect = jest.fn();
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const saved = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    const exitCode = process.exitCode;
    try {
      await main();
      expect(process.exitCode).toBe(1);
      expect(error).toHaveBeenCalledWith("✖ Set ADMIN_EMAIL to the administrator's sign-in email.");
    } finally {
      process.exitCode = exitCode;
      if (saved !== undefined) process.env.ADMIN_EMAIL = saved;
    }
  });
});
