/**
 * وحدات تحكّم الطالب — بلا قاعدة ولا خادم.
 *
 * ما لا يُستدعى من HTTP بسهولة: عطلٌ غير متوقّع في الخدمة يجب أن يصل `next`
 * فيكتبه معالج الأخطاء ردّاً بـ500 ورقم حادثة؛ واستعلامٌ لا يطابق المخطّط يُردّ
 * بـ400 قبل أن تُنادى الخدمة أصلاً.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./student.service");

import * as svc from "./student.service";
import * as ctl from "./student.controller";
import { tr } from "../../core/i18n";

const req = (over: Partial<Request> = {}) =>
  ({
    body: {},
    query: { registration: "202039000001" },
    params: { id: "x-1" },
    user: { userId: "u-1", role: "student", refId: "s-1" },
    ...over,
  }) as unknown as Request;

const fakeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock };
};

const down = new Error("database connection lost");

describe("عطلٌ في الخدمة يصل معالج الأخطاء كما هو، ولا يُكتب ردّ", () => {
  it.each([
    ["browseTopicsController", "browseTopicsService", { query: {} }],
    ["lookupStudentController", "lookupStudentByRegistrationService", {}],
    ["getMyGroupRequestsController", "getMyGroupRequestsService", {}],
    ["getMyProjectController", "getMyProjectService", {}],
    ["getStudentDashboardController", "getStudentDashboardService", {}],
  ] as const)("%s", async (controller, service, over) => {
    (svc[service] as jest.Mock).mockRejectedValueOnce(down);
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await ctl[controller](req(over as Partial<Request>), res, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("browseTopicsController", () => {
  /** معاملٌ مكرَّر في الرابط (?specializationId=a&specializationId=b) يصل قائمةً لا نصّاً. */
  it("استعلامٌ لا يطابق المخطّط ⇒ 400 قبل أن تُنادى الخدمة", async () => {
    const next = jest.fn() as unknown as NextFunction & jest.Mock;
    await ctl.browseTopicsController(req({ query: { specializationId: ["a", "b"] } as never }), fakeRes(), next);

    expect(svc.browseTopicsService).not.toHaveBeenCalled();
    expect(next.mock.calls[0]![0]).toMatchObject({ statusCode: 400, message: tr("request.validation") });
  });
});
