/**
 * وحدة تحكّم الرسائل — رسالة التحقّق.
 *
 * رسالةٌ كتبها المخطّط للمستخدم (عبر `zmsg`) تُقال كما هي. ورسالة Zod
 * الافتراضية («Invalid input…») ليست جملةً لأحد: يُقال بدلها أيّ الحقول لم
 * يصحّ، بلغة الطلب.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./messages.service");

import * as svc from "./messages.service";
import { tr } from "../../core/i18n";
import { sendMessageController } from "./messages.controller";

const send = async (body: unknown) => {
  const next = jest.fn() as unknown as NextFunction & jest.Mock;
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  await sendMessageController(
    { body, user: { userId: "u1", role: "student", refId: "s1" } } as unknown as Request,
    res as unknown as Response,
    next,
  );
  return next.mock.calls[0]![0] as { statusCode: number; message: string };
};

describe("messages.controller — التحقّق", () => {
  it("رسالة Zod الافتراضية ⇒ تُسمّى الحقول بدلها، ولا تُنادى الخدمة", async () => {
    const err = await send({ body: "مرحباً" });
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("recipientIds");
    expect(svc.sendMessageService).not.toHaveBeenCalled();
  });

  it("ورسالةٌ كتبها المخطَّط تُقال كما هي، بلا أسماء حقول", async () => {
    const err = await send({ recipientIds: ["00000000-0000-4000-8000-000000000000"], body: "   " });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe(tr("messages.bodyOrFile"));
    expect(svc.sendMessageService).not.toHaveBeenCalled();
  });
});
