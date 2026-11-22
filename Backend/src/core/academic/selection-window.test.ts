/**
 * مهلة اختيار المواضيع — بلا قاعدة بيانات: حدودها أيّامٌ كاملة بتوقيت
 * الجامعة، وحالها من الساعة، وحارساها (الطلب، والسحب) يعرفان سنةً غائبة.
 */
jest.mock("../prisma/client", () => ({ prisma: { academicYear: { findUnique: jest.fn() } } }));

import { prisma } from "../prisma/client";
import { assertSelectionNotClosed, assertSelectionOpen, selectionBounds, selectionWindowState } from "./selection-window";

const findYear = prisma.academicYear.findUnique as unknown as jest.Mock;

describe("selection window", () => {
  it("from the first moment of the first day to the last of the last, university time", () => {
    expect(selectionBounds("2026-11-15", "2026-11-30")).toEqual({
      selectionOpenAt: new Date("2026-11-14T23:00:00.000Z"),
      selectionCloseAt: new Date("2026-11-30T22:59:59.999Z"),
    });
  });

  it("where it stands, by the clock", () => {
    const y = selectionBounds("2026-11-15", "2026-11-30");
    expect(selectionWindowState(y, new Date("2026-11-10T12:00:00Z"))).toBe("upcoming");
    expect(selectionWindowState(y, new Date("2026-11-20T12:00:00Z"))).toBe("open");
    expect(selectionWindowState(y, new Date("2026-12-01T12:00:00Z"))).toBe("closed");
    expect(selectionWindowState({ selectionOpenAt: null, selectionCloseAt: null })).toBe("unset");
  });

  it("a year that is not there: neither guard refuses — what follows says so", async () => {
    findYear.mockResolvedValue(null);
    await expect(assertSelectionOpen("gone")).resolves.toBeUndefined();
    await expect(assertSelectionNotClosed("gone")).resolves.toBeUndefined();
  });

  it("withdrawing: refused only once it closed", async () => {
    const past = selectionBounds("2020-01-01", "2020-01-31");
    findYear.mockResolvedValueOnce({ title: "2019/2020", ...past });
    await expect(assertSelectionNotClosed("y")).rejects.toMatchObject({ statusCode: 400, errorCode: "TOPIC_SELECTION_CLOSED" });
    findYear.mockResolvedValueOnce({ title: "2099/2100", ...selectionBounds("2099-01-01", "2099-01-31") });
    await expect(assertSelectionNotClosed("y")).resolves.toBeUndefined();
  });
});
