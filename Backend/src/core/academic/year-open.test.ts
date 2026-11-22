/**
 * السنة المغلقة سجلٌّ لا مكان عمل: لا يُضاف إليها شيء. وما لا سنة له لا
 * يُسأل عنه أصلاً — تعديلٌ لا يمسّ السنة يمرّ بلا نداء.
 */
jest.mock("../prisma/client", () => ({ prisma: { academicYear: { findUnique: jest.fn() } } }));

import { prisma } from "../prisma/client";
import { tr } from "../i18n";
import { assertYearOpen } from "./year-open";

const findUnique = (prisma as unknown as { academicYear: { findUnique: jest.Mock } }).academicYear.findUnique;

describe("assertYearOpen", () => {
  beforeEach(() => findUnique.mockReset());

  it("بلا سنة ⇒ يمرّ ولا يسأل القاعدة", async () => {
    await expect(assertYearOpen(undefined)).resolves.toBeUndefined();
    await expect(assertYearOpen(null)).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("سنةٌ مؤرشفة ⇒ 400 يسمّيها؛ ومفتوحة ⇒ يمرّ", async () => {
    findUnique.mockResolvedValueOnce({ title: "2025/2026", archivedAt: new Date("2026-07-01") });
    await expect(assertYearOpen("y0")).rejects.toMatchObject({
      statusCode: 400,
      message: tr("year.archivedNoWrite", { title: "2025/2026" }),
    });

    findUnique.mockResolvedValueOnce({ title: "2026/2027", archivedAt: null });
    await expect(assertYearOpen("y1")).resolves.toBeUndefined();
  });
});
