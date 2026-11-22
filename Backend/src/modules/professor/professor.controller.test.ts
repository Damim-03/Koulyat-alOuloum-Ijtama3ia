/**
 * وحدات تحكّم الأستاذ — بلا قاعدة ولا خادم.
 *
 * ما لا يُستدعى من HTTP بسهولة: عطلٌ غير متوقّع في الخدمة يجب أن يصل `next`
 * فيكتبه معالج الأخطاء ردّاً بـ500 ورقم حادثة؛ وجسمٌ لا يطابق المخطّط يُردّ
 * بـ400 قبل أن تُنادى الخدمة أصلاً.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./professor.service");

import * as svc from "./professor.service";
import * as ctl from "./professor.controller";
import { tr } from "../../core/i18n";

const req = (over: Partial<Request> = {}) =>
  ({
    body: {},
    query: { q: "خالد" },
    params: { id: "t-1", groupId: "g-1" },
    user: { userId: "u-1", role: "professor", refId: "p-1" },
    ...over,
  }) as unknown as Request;

const fakeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

const validTopic = {
  title: "موضوع",
  description: "وصف",
  maxStudents: 3,
  specializationId: "spec-1",
  academicYearId: "y-1",
};

const down = new Error("database connection lost");

describe("عطلٌ في الخدمة يصل معالج الأخطاء كما هو، ولا يُكتب ردّ", () => {
  it.each([
    ["createTopicController", "createTopicService", { body: validTopic }],
    ["getMyTopicsController", "getMyTopicsService", {}],
    ["getMyGroupsController", "getMyGroupsService", {}],
    ["searchStudentsController", "searchStudentsService", {}],
  ] as const)("%s", async (controller, service, over) => {
    (svc[service] as jest.Mock).mockRejectedValueOnce(down);
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await ctl[controller](req(over as Partial<Request>), res, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("جسمٌ لا يطابق المخطّط ⇒ 400 قبل أن تُنادى الخدمة", () => {
  it.each([
    ["updateTopicController", "updateTopicService", { maxStudents: 99 }],
    ["createMilestoneController", "createMilestoneService", { title: "", order: 0 }],
  ] as const)("%s", async (controller, service, body) => {
    const res = fakeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await ctl[controller](req({ body }), res, next);

    expect(svc[service]).not.toHaveBeenCalled();
    expect(next.mock.calls[0]![0]).toMatchObject({ statusCode: 400, message: tr("request.validation") });
  });
});

describe("getTopicByIdController", () => {
  it("موضوعه ⇒ 200 به ملفوفاً في { topic }", async () => {
    const topic = { id: "t-1", title: "موضوع" };
    (svc.getTopicByIdService as jest.Mock).mockResolvedValueOnce(topic);
    const res = fakeRes();

    await ctl.getTopicByIdController(req(), res, jest.fn());

    expect(svc.getTopicByIdService).toHaveBeenCalledWith("u-1", "t-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ topic });
  });
});
