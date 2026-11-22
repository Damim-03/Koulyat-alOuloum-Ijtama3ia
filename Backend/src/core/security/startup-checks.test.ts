/**
 * التنبيه عند تشغيل الإنتاج إن بقي حسابٌ بكلمة مرور ملفّ البذر التجريبيّ —
 * تلك المكتوبة في المستودع لكلّ من يقرؤه.
 */
jest.mock("../prisma/client", () => ({ prisma: { user: { findMany: jest.fn() } } }));

import { prisma } from "../prisma/client";
import { config } from "../config/app.config";
import { warnAboutDemoAccounts } from "./startup-checks";

const findMany = prisma.user.findMany as jest.Mock;
const mutable = config as { IS_PRODUCTION: boolean };
const wasProduction = mutable.IS_PRODUCTION;

let printed: jest.SpyInstance;
beforeEach(() => {
  findMany.mockReset();
  printed = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  mutable.IS_PRODUCTION = wasProduction;
});

const output = () => printed.mock.calls.map((c) => String(c[0])).join("\n");

describe("warnAboutDemoAccounts", () => {
  it("في التطوير لا يسأل القاعدة أصلاً: الحسابات التجريبية هناك في مكانها", async () => {
    mutable.IS_PRODUCTION = false;
    await warnAboutDemoAccounts();
    expect(findMany).not.toHaveBeenCalled();
    expect(printed).not.toHaveBeenCalled();
  });

  it("في الإنتاج، ولا حساب بتلك الكلمة ⇒ صمت", async () => {
    mutable.IS_PRODUCTION = true;
    findMany.mockResolvedValue([]);
    await warnAboutDemoAccounts();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { password: expect.stringMatching(/^\$2b\$10\$/) } }));
    expect(printed).not.toHaveBeenCalled();
  });

  it("وإن وُجد حسابٌ يُسمّى بدوره وبريده — أو باسم دخوله، أو بلا شيء", async () => {
    mutable.IS_PRODUCTION = true;
    findMany.mockResolvedValue([
      { role: "admin", email: "admin@demo.dz", username: null },
      { role: "professor", email: null, username: "prof.demo" },
      { role: "student", email: null, username: null },
    ]);
    await warnAboutDemoAccounts();
    const text = output();
    expect(text).toContain("SECURITY: 3 account(s)");
    expect(text).toContain("admin: admin@demo.dz");
    expect(text).toContain("professor: prof.demo");
    expect(text).toContain("student: (no email)");
  });

  it("وفحصٌ تعذّر (قاعدةٌ لم تجهز بعد) لا يمنع الخادم من العمل", async () => {
    mutable.IS_PRODUCTION = true;
    findMany.mockRejectedValue(new Error("db not ready"));
    await expect(warnAboutDemoAccounts()).resolves.toBeUndefined();
    expect(printed).not.toHaveBeenCalled();
  });
});
