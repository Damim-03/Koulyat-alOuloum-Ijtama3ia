/**
 * فترة اقتراح المواضيع — بلا قاعدة بيانات.
 *
 * يُحرس: أنّ الفترة أيّامٌ كاملة بتوقيت الجامعة (فـ«إلى 11 نوفمبر» تشمل
 * مساءه كلّه، لا منتصف ليلته بتوقيت غرينتش)؛ وأنّ حالها يُقرأ من اللحظة؛
 * وأنّ الرفض يقول التاريخ — متى تبدأ، أو متى انتهت.
 */
jest.mock("../prisma/client", () => ({ prisma: { academicYear: { findUnique: jest.fn() } } }));

import { prisma } from "../prisma/client";
import { withLang } from "../i18n";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { assertProposalsOpen, proposalWindowState, windowBounds } from "./proposal-window";

const findUnique = (prisma as unknown as { academicYear: { findUnique: jest.Mock } }).academicYear.findUnique;

describe("windowBounds — من بداية اليوم الأوّل إلى نهاية الأخير، بتوقيت الجزائر", () => {
  it("11 أكتوبر 00:00 و11 نوفمبر 23:59:59.999 (UTC+1)", () => {
    const b = windowBounds("2026-10-11", "2026-11-11");
    expect(b.proposalsOpenAt.toISOString()).toBe("2026-10-10T23:00:00.000Z");
    expect(b.proposalsCloseAt.toISOString()).toBe("2026-11-11T22:59:59.999Z");
  });
});

describe("proposalWindowState", () => {
  const w = windowBounds("2026-10-11", "2026-11-11");
  it.each([
    ["قبل بدايتها بلحظة", "2026-10-10T22:59:59.999Z", "upcoming"],
    ["أوّل لحظةٍ منها", "2026-10-10T23:00:00.000Z", "open"],
    ["مساء يومها الأخير (23:30 بتوقيت الجامعة)", "2026-11-11T22:30:00.000Z", "open"],
    ["بعد نهايتها بلحظة", "2026-11-11T23:00:00.000Z", "closed"],
  ])("%s ⇒ %s", (_label, at, state) => {
    expect(proposalWindowState(w, new Date(at))).toBe(state);
  });

  it("بلا فترة ⇒ unset: الاقتراح بلا قيدٍ زمنيّ", () => {
    expect(proposalWindowState({ proposalsOpenAt: null, proposalsCloseAt: null })).toBe("unset");
  });
});

describe("assertProposalsOpen", () => {
  const year = (opensOn: string, closesOn: string) => ({ title: "2026/2027", ...windowBounds(opensOn, closesOn) });
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const refusal = (yearId = "y1") => withLang("ar", () => assertProposalsOpen(yearId).catch((e: unknown) => e));

  it("داخل الفترة، وبلا فترة، وبسنةٍ غائبة (يرفضها ما بعده) ⇒ يمرّ", async () => {
    findUnique.mockResolvedValueOnce(year(day(-3), day(3)));
    await expect(assertProposalsOpen("y1")).resolves.toBeUndefined();
    findUnique.mockResolvedValueOnce({ title: "2026/2027", proposalsOpenAt: null, proposalsCloseAt: null });
    await expect(assertProposalsOpen("y1")).resolves.toBeUndefined();
    findUnique.mockResolvedValueOnce(null);
    await expect(assertProposalsOpen("gone")).resolves.toBeUndefined();
  });

  it("قبلها ⇒ يُرفض بيوم بدايتها", async () => {
    findUnique.mockResolvedValueOnce(year("2099-10-11", "2099-11-11"));
    const e = await refusal();
    expect(e).toMatchObject({ statusCode: 400, errorCode: ErrorCodeEnum.TOPIC_PROPOSALS_CLOSED });
    expect((e as Error).message).toMatch(/^فترة اقتراح المواضيع للسنة «2026\/2027» تبدأ في 11 أكتوبر 2099/);
  });

  it("بعدها ⇒ يُرفض بيوم نهايتها، ويقول إنّ التعديل باقٍ", async () => {
    findUnique.mockResolvedValueOnce(year("2020-10-11", "2020-11-11"));
    const e = await refusal();
    expect(e).toMatchObject({ statusCode: 400, errorCode: ErrorCodeEnum.TOPIC_PROPOSALS_CLOSED });
    expect((e as Error).message).toContain("انتهت فترة اقتراح المواضيع للسنة «2026/2027» في 11 نوفمبر 2020");
    expect((e as Error).message).toContain("تعديل مقترحاتك");
  });
});
