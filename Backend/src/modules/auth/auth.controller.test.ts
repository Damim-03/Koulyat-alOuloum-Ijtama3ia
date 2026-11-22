/**
 * ما تفعله وحدات التحكّم حين تسقط الخدمة — بلا قاعدة ولا خادم.
 *
 * اختبارات الـAPI تمرّ بالمسار السعيد لهذه المسارات، والأخطاء التي تتوقّعها
 * الخدمة نفسها. أمّا العطل غير المتوقّع (قاعدةٌ انقطعت في منتصف الطلب) فلا
 * يُستدعى من HTTP بسهولة — وهو بالضبط ما يجب أن يصل `next` فيكتبه معالج الأخطاء
 * ردّاً بـ500 ورقم حادثة، لا أن يبقى وعداً مرفوضاً لا يلتقطه أحد فيُعلّق الطلب.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./auth.service");

import * as svc from "./auth.service";
import { getMeController, logoutAllController, logoutController } from "./auth.controller";

const fakeReq = (over: Partial<Request> = {}) =>
  ({
    headers: {},
    cookies: {},
    ip: "127.0.0.1",
    get: () => "jest",
    user: { userId: "u-1", role: "student", refId: "s-1", sid: "sid-1" },
    ...over,
  }) as unknown as Request;

const fakeRes = () => {
  const res = { status: jest.fn(), json: jest.fn(), clearCookie: jest.fn(), cookie: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock; clearCookie: jest.Mock };
};

const down = new Error("database connection lost");

describe.each([
  ["getMeController", getMeController, "getMeService"],
  ["logoutController", logoutController, "logoutService"],
  ["logoutAllController", logoutAllController, "logoutAllService"],
] as const)("%s", (_name, controller, service) => {
  it("عطلٌ في الخدمة يصل معالج الأخطاء كما هو، ولا يُكتب ردّ ولا يُمسح كوكي", async () => {
    (svc[service] as jest.Mock).mockRejectedValueOnce(down);
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await controller(fakeReq({ headers: { authorization: "Bearer t" } }), res, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.status).not.toHaveBeenCalled();
    // الخروج لم يتمّ: كوكي التحديث يبقى، فتعيد الصفحة المحاولة بدل جلسةٍ نصف مُنهاة.
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
