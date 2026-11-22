/**
 * قوائم الهيكل المشتركة — عطلٌ في الخدمة يصل `next`، فيكتبه معالج الأخطاء
 * ردّاً كاملاً. (والقوائم نفسها تمرّ بها اختبارات الـAPI.)
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./common.service");

import * as svc from "./common.service";
import * as ctl from "./common.controller";

type Controller = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const down = new Error("database connection lost");

describe("common.controller — عطلٌ في الخدمة", () => {
  it.each<[string, Controller, unknown]>([
    ["الكليات", ctl.listFacultiesController, svc.listFacultiesService],
    ["الأقسام", ctl.listDepartmentsController, svc.listDepartmentsService],
    ["التخصّصات", ctl.listSpecializationsController, svc.listSpecializationsService],
    ["السنوات", ctl.listAcademicYearsController, svc.listAcademicYearsService],
  ])("%s ⇒ يصل next", async (_l, controller, service) => {
    (service as jest.Mock).mockRejectedValueOnce(down);
    const next = jest.fn() as unknown as NextFunction & jest.Mock;
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);

    await controller({ query: {} } as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(down);
    expect(res.json).not.toHaveBeenCalled();
  });
});
