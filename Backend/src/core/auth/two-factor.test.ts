/**
 * الخطوة الثانية — رمز التطبيق أو رمز الاسترداد — بلا قاعدة بيانات.
 *
 * اختبار الـAPI يدخل بالرمز الصحيح وبالخاطئ وبرمز استردادٍ مرّتين. وهنا ما
 * لا يصل إليه HTTP بسهولة: خانةٌ فارغة، وسرٌّ لا يُفكّ (غُيّر SESSION_SECRET
 * بعد إعداده)، وطلبان يتسابقان بالرمز نفسه فيصل الآخر بعد أن كُتبت الخطوة،
 * ورمز استردادٍ يُنازَع على صفّه حتى تنفد المحاولات. في كلّها: لا دخول.
 */
jest.mock("../prisma/client", () => ({
  prisma: { user: { findUnique: jest.fn(), updateMany: jest.fn() } },
}));

import { prisma } from "../prisma/client";
import { seal } from "./secret-box";
import { hashRecoveryCode, newTotpSecret, stepAt, totpAt } from "./totp";
import { recoveryHashes, verifySecondFactor } from "./two-factor";

const db = (prisma as unknown as { user: { findUnique: jest.Mock; updateMany: jest.Mock } }).user;

const SECRET = newTotpSecret();
const holder = (over: Partial<Parameters<typeof verifySecondFactor>[0]> = {}) => ({
  id: "u-1",
  totpSecret: seal(SECRET),
  totpLastStep: stepAt() - 5,
  totpRecoveryCodes: [],
  ...over,
});

describe("recoveryHashes", () => {
  it("ما ليس قائمةً ⇒ لا رموز، وما ليس نصّاً في القائمة يُسقط", () => {
    expect(recoveryHashes(null)).toEqual([]);
    expect(recoveryHashes("abc")).toEqual([]);
    expect(recoveryHashes(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });
});

describe("verifySecondFactor — رمز التطبيق", () => {
  it("الصحيح يدخل، وتُحفظ خطوته فلا يدخل مرّتين", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await verifySecondFactor(holder(), totpAt(SECRET))).toBe("totp");
    expect(db.updateMany.mock.calls[0]![0].data.totpLastStep).toBe(stepAt());
  });

  it("خانةٌ فارغة أو مسافات ⇒ لا شيء، ولا تُسأل القاعدة", async () => {
    expect(await verifySecondFactor(holder(), "   ")).toBeNull();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  /** سرٌّ خُتم بمفتاحٍ آخر (SESSION_SECRET تغيّر) أو أُفسد ⇒ لا يُفكّ، ولا يُقبل رمز. */
  it("سرٌّ لا يُفكّ ⇒ لا دخول، مهما كان الرمز", async () => {
    expect(await verifySecondFactor(holder({ totpSecret: "v1.garbage" }), totpAt(SECRET))).toBeNull();
    expect(await verifySecondFactor(holder({ totpSecret: null }), totpAt(SECRET))).toBeNull();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  /** طلبان بالرمز نفسه: كلاهما وجد الخطوة جديدة، والكتابة المشروطة تُدخل واحداً. */
  it("ومن سبقه طلبٌ آخر بالرمز نفسه ⇒ لا دخول", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await verifySecondFactor(holder(), totpAt(SECRET))).toBeNull();
  });
});

describe("verifySecondFactor — رمز الاسترداد", () => {
  const CODE = "abcde-fghjk";
  const updatedAt = new Date("2026-10-12T10:00:00Z");

  it("رمزٌ على القائمة يدخل ويُشطب منها", async () => {
    db.findUnique.mockResolvedValueOnce({ totpRecoveryCodes: [hashRecoveryCode(CODE), "other"], updatedAt });
    db.updateMany.mockResolvedValueOnce({ count: 1 });

    expect(await verifySecondFactor(holder(), CODE)).toBe("recovery");
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { id: "u-1", updatedAt },
      data: { totpRecoveryCodes: ["other"] },
    });
  });

  /**
   * كلّ كتابةٍ مشروطةٌ بأن الصفّ كما قُرئ. صفٌّ يتغيّر تحت كلّ محاولة —
   * منازَعٌ بلا توقّف — لا يُدخل بعد خمس محاولات: يُرفض، ولا يُكتب شيء.
   */
  it("وصفٌّ يتغيّر تحت كلّ محاولة ⇒ خمس محاولات ثم لا دخول", async () => {
    db.findUnique.mockResolvedValue({ totpRecoveryCodes: [hashRecoveryCode(CODE)], updatedAt });
    db.updateMany.mockResolvedValue({ count: 0 });

    expect(await verifySecondFactor(holder(), CODE)).toBeNull();
    expect(db.updateMany).toHaveBeenCalledTimes(5);
  });

  it("وحسابٌ زال بين الطلب والقراءة ⇒ لا دخول", async () => {
    db.findUnique.mockResolvedValueOnce(null);
    expect(await verifySecondFactor(holder(), CODE)).toBeNull();
    expect(db.updateMany).not.toHaveBeenCalled();
  });
});
