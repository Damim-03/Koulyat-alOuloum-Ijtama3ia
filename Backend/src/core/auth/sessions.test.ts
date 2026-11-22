/**
 * إبطال جلسةٍ واحدة — بلا قاعدة بيانات.
 *
 * صفّ الإبطال يبقى حتى ينتهي الرمز الذي يحرس منه، ثم يُكنس. فما يُختبر هنا:
 * رمزٌ بلا جلسة لا يُكتب له صفّ (يحرسه جيل الحساب وحده)، وصفّ الإبطال ينتهي
 * بانتهاء الرمز نفسه — وبلا تاريخ انتهاءٍ فيه، بعد ثلاثين يوماً احتياطاً.
 */
jest.mock("../prisma/client", () => ({
  prisma: { revokedSession: { upsert: jest.fn() } },
}));

import { prisma } from "../prisma/client";
import { revokeSession } from "./sessions";
import { Roles } from "../enums/role.enum";

const upsert = (prisma as unknown as { revokedSession: { upsert: jest.Mock } }).revokedSession.upsert;
const base = { userId: "u-1", role: Roles.STUDENT, refId: "s-1", tokenVersion: 0, typ: "access" as const };

describe("revokeSession", () => {
  it("رمزٌ من قبل الجلسات (بلا sid) ⇒ لا صفّ يُكتب", async () => {
    await revokeSession(base);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ينتهي صفّ الإبطال بانتهاء الرمز نفسه", async () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    await revokeSession({ ...base, sid: "sid-1", exp });
    expect(upsert).toHaveBeenCalledWith({
      where: { id: "sid-1" },
      create: { id: "sid-1", userId: "u-1", expiresAt: new Date(exp * 1000) },
      update: {},
    });
  });

  it("وبلا انتهاءٍ في الرمز: ثلاثون يوماً — أطول من عمر أيّ رمزٍ يصدر", async () => {
    const before = Date.now();
    await revokeSession({ ...base, sid: "sid-2" });
    const expiresAt: Date = upsert.mock.calls[0]![0].create.expiresAt;
    const days = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThan(30.01);
  });
});
