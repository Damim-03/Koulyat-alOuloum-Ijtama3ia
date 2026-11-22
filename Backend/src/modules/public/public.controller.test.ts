/**
 * ما تفعله وحدات التحكّم العامّة حين تسقط الخدمة — بلا قاعدة ولا خادم.
 *
 * العطل غير المتوقّع لا يُستدعى من HTTP بسهولة، وهو ما يجب أن يصل `next`
 * فيكتبه معالج الأخطاء ردّاً بـ500 ورقم حادثة — لا أن يبقى وعداً مرفوضاً.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./public.service");

import * as svc from "./public.service";
import {
  getPublicTopicController,
  getPublicTopicFiltersController,
  listPublicDepartmentsController,
  listPublicSpecializationsController,
  listPublicTopicsController,
} from "./public.controller";

const req = {
  query: {},
  params: { id: "t-1" },
  user: { userId: "u-1", role: "student", refId: "s-1" },
} as unknown as Request;

const fakeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock };
};

const down = new Error("database connection lost");

describe.each([
  ["listPublicTopicsController", listPublicTopicsController, "listPublicTopicsService"],
  ["getPublicTopicController", getPublicTopicController, "getPublicTopicService"],
  ["listPublicSpecializationsController", listPublicSpecializationsController, "listPublicSpecializationsService"],
  ["getPublicTopicFiltersController", getPublicTopicFiltersController, "getPublicTopicFiltersService"],
  ["listPublicDepartmentsController", listPublicDepartmentsController, "listPublicDepartmentsService"],
] as const)("%s", (_name, controller, service) => {
  it("عطلٌ في الخدمة يصل معالج الأخطاء كما هو، ولا يُكتب ردّ", async () => {
    (svc[service] as jest.Mock).mockRejectedValueOnce(down);
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await controller(req, res, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.status).not.toHaveBeenCalled();
  });
});
