/**
 * نسيان الإخفاقات وتنظيف الجدول — بلا قاعدة بيانات.
 *
 * يُنادى `clearFailures` بعد كلّ دخولٍ ناجح، وبعد إعادة الإدارة كلمةَ مرور،
 * بمعرّفات الحساب التي له منها (قد لا يكون له أيّها: حسابٌ بلا بريدٍ ولا رقم
 * تسجيل). فلا يُسأل القاعدة عن لا شيء — `IN ()` استعلامٌ يُرسَل بلا سبب.
 *
 * ومع واحدٍ من كلّ عشرين إخفاقاً تُحذف المفاتيح التي سكتت يوماً كاملاً ولا
 * قفل عليها. والسحب عشوائيّ، فيُثبَّت هنا: لولا ذلك لغُطّي التنظيف في تشغيلٍ
 * وغاب في آخر، ولما عُرف إن كان يحذف ما يجب — أو إن كان فشله يُفشل الدخول.
 */
jest.mock("../prisma/client", () => ({
  prisma: {
    loginThrottle: {
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import { prisma } from "../prisma/client";
import { assertNotLocked, clearFailures, failSignIn, recordFailure, throttleKey } from "./login-throttle";
import { ErrorCodeEnum } from "../enums/error-code.enum";

const table = (prisma as unknown as {
  loginThrottle: { deleteMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
}).loginThrottle;
const { deleteMany } = table;
/** The prune runs unawaited (`void`): let it settle before looking. */
const settle = () => new Promise((r) => setImmediate(r));
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  table.findUnique.mockResolvedValue(null);
  table.upsert.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 0 });
});
afterEach(() => jest.restoreAllMocks());

describe("clearFailures", () => {
  it("بلا معرّفات ⇒ لا استعلام", async () => {
    await clearFailures();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("وبمعرّفاتٍ ⇒ تُنسى كلّها في استعلامٍ واحد", async () => {
    const keys = [throttleKey("student", "202039000001"), throttleKey("admin", "A@Univ.dz ")];
    await clearFailures(...keys);
    expect(deleteMany).toHaveBeenCalledWith({ where: { key: { in: ["student:202039000001", "admin:a@univ.dz"] } } });
  });
});

describe("تنظيف الجدول مع الإخفاقات", () => {
  it("حين يقع السحب ⇒ تُحذف المفاتيح الساكتة يوماً بلا قفلٍ قائم، لا غيرها", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const before = Date.now();
    await recordFailure("student:202039000001");
    await settle();

    expect(deleteMany).toHaveBeenCalledTimes(1);
    const { where } = deleteMany.mock.calls[0]![0] as {
      where: { lastFailureAt: { lt: Date }; OR: [{ lockedUntil: null }, { lockedUntil: { lt: Date } }] };
    };
    // «ساكتةٌ يوماً»: آخر إخفاقٍ قبل يومٍ من الآن.
    expect(where.lastFailureAt.lt.getTime()).toBeGreaterThanOrEqual(before - DAY);
    expect(where.lastFailureAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - DAY);
    // «ولا قفل عليها»: بلا قفلٍ أصلاً، أو بقفلٍ انتهى — فالقائم لا يُمسّ.
    expect(where.OR[0]).toEqual({ lockedUntil: null });
    expect(where.OR[1].lockedUntil.lt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("تنظيفٌ يفشل لا يُفشل الدخول، ولا يترك رفضاً بلا معالجة", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.01);
    deleteMany.mockRejectedValue(new Error("deadlock"));
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    try {
      await expect(recordFailure("professor:k@univ.dz")).resolves.toBeNull();
      await settle();
      expect(deleteMany).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("وفي الأغلب (٩٥٪) لا تنظيف: الإخفاق يُسجَّل وحده", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.05);
    await recordFailure("admin:a@univ.dz");
    await settle();
    expect(table.upsert).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("القفل — بلا قاعدة بيانات", () => {
  const MIN = 60 * 1000;
  /** صفٌّ بآخر إخفاقٍ قبل `agoMs`. */
  const row = (failures: number, lockCount: number, agoMs = MIN) => ({
    key: "k",
    failures,
    lockCount,
    lockedUntil: null,
    lastFailureAt: new Date(Date.now() - agoMs),
  });
  const saved = () => table.upsert.mock.calls[0]![0] as { create: Record<string, unknown>; update: Record<string, unknown> };
  beforeEach(() => jest.spyOn(Math, "random").mockReturnValue(0.5));

  it("الإخفاق الأوّل يُعدّ ولا يقفل", async () => {
    await expect(recordFailure("k")).resolves.toBeNull();
    expect(saved().create).toMatchObject({ key: "k", failures: 1, lockCount: 0, lockedUntil: null });
  });

  it("الخامس يقفل ربع ساعة ويصفّر العدّ؛ وكلّ قفلٍ يضاعف الذي قبله حتى ستّ ساعات", async () => {
    const cases: [number, number][] = [
      [0, 15],
      [1, 30],
      [2, 60],
      [4, 240],
      [5, 360],
      [9, 360],
    ];
    for (const [lockCount, minutes] of cases) {
      table.upsert.mockClear();
      table.findUnique.mockResolvedValue(row(4, lockCount));
      const before = Date.now();
      const until = await recordFailure("k");
      expect(until!.getTime() - before).toBeGreaterThanOrEqual(minutes * MIN - 50);
      expect(until!.getTime() - before).toBeLessThanOrEqual(minutes * MIN + 1000);
      expect(saved().update).toMatchObject({ failures: 0, lockCount: lockCount + 1, lockedUntil: until });
    }
  });

  it("ساعةٌ من السكوت تبدأ العدّ من جديد، ويومٌ ينسى الأقفال السابقة", async () => {
    table.findUnique.mockResolvedValue(row(4, 3, 2 * 60 * MIN));
    await expect(recordFailure("k")).resolves.toBeNull();
    expect(saved().update).toMatchObject({ failures: 1, lockCount: 3 });

    table.upsert.mockClear();
    table.findUnique.mockResolvedValue(row(4, 3, 25 * 60 * MIN));
    await recordFailure("k");
    expect(saved().update).toMatchObject({ failures: 1, lockCount: 0 });
  });

  it("وهو مقفل ⇒ 429 بالدقائق الباقية رقماً؛ وانتهى قفله ⇒ يمرّ", async () => {
    table.findUnique.mockResolvedValue({ lockedUntil: new Date(Date.now() + 14.2 * MIN) });
    const error = await assertNotLocked("k").catch((e: unknown) => e);
    expect(error).toMatchObject({ statusCode: 429, errorCode: ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS, extra: { retryAfterMinutes: 15 } });

    table.findUnique.mockResolvedValue({ lockedUntil: new Date(Date.now() - MIN) });
    await expect(assertNotLocked("k")).resolves.toBeUndefined();
    table.findUnique.mockResolvedValue(null);
    await expect(assertNotLocked("k")).resolves.toBeUndefined();
  });

  it("failSignIn: يرمي القفل إن أحدثه هذا الإخفاق، وإلّا خطأ صاحبه", async () => {
    const wrong = new Error("كلمة المرور خاطئة");
    await expect(failSignIn("k", wrong)).rejects.toBe(wrong);

    table.findUnique.mockResolvedValue(row(4, 0));
    await expect(failSignIn("k", wrong)).rejects.toMatchObject({ statusCode: 429 });
  });
});
