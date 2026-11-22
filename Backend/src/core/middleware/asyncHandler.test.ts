/**
 * `asyncHandler` — ما يرميه مسارٌ غير متزامن يبلغ معالج الأخطاء، لا يُترك
 * وعداً مرفوضاً بلا ردّ. (والمسار الذي يجيب يمرّ به اختبار /api/health.)
 */
import type { NextFunction, Request, Response } from "express";

import { asyncHandler } from "./asyncHandler.middleware";

describe("asyncHandler", () => {
  it("مسارٌ يرمي ⇒ يصل خطؤه إلى next", async () => {
    const boom = new Error("database connection lost");
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await asyncHandler(async () => {
      throw boom;
    })({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(boom);
  });
});
