/**
 * وحدات تحكّم الإدارة — بلا قاعدة ولا خادم.
 *
 * مئةٌ وعشر وحدات تحكّم بقالبٍ واحد: تقرأ الطلب، تنادي الخدمة، تجيب. وما
 * يحرسه هذا الملف ما لا يصنعه اختبار API إلا بقاعدةٍ معطوبة: أيّاً كان ما
 * يسقط داخلها — جسمٌ لا يطابق المخطّط، أو خدمةٌ ترمي — يصل `next` مرّةً
 * واحدة، فيكتبه معالج الأخطاء ردّاً كاملاً. لا جسمٌ نصفيّ، ولا طلبٌ معلّق.
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./admin.service");
jest.mock("./defenses.service");
jest.mock("./archive.service");
jest.mock("./student-export.service");
jest.mock("./topic-export.service");
jest.mock("./proposal-window.service");
jest.mock("./selection-window.service");
// Every service a controller calls is mocked: a real one would open the database and keep Jest from exiting.
jest.mock("./team-size.service");
jest.mock("./topic-quota.service");
jest.mock("../notification/notification.service");
jest.mock("../../core/middleware/upload.middleware");

import * as svc from "./admin.service";
import * as defenses from "./defenses.service";
import * as archive from "./archive.service";
import * as exportSvc from "./student-export.service";
import * as topicExport from "./topic-export.service";
import * as proposals from "./proposal-window.service";
import * as selection from "./selection-window.service";
import * as teamSize from "./team-size.service";
import * as topicQuota from "./topic-quota.service";
import * as notifications from "../notification/notification.service";
import * as ctl from "./admin.controller";

type Controller = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const down = new Error("database connection lost");
for (const mod of [svc, defenses, archive, exportSvc, topicExport, proposals, selection, teamSize, topicQuota, notifications])
  for (const fn of Object.values(mod)) if (jest.isMockFunction(fn)) fn.mockRejectedValue(down);

/** وحدات التحكّم غير المتزامنة كلّها — والرفع وحده متزامنٌ بلا خدمة، يمرّ به اختبار الـAPI. */
const controllers = Object.entries(ctl).filter(
  ([, fn]) => typeof fn === "function" && fn.constructor.name === "AsyncFunction",
) as [string, Controller][];

describe("admin.controller — ما يسقط يصل next", () => {
  it("كلّها مشمولة", () => {
    expect(controllers.length).toBe(113);
  });

  it.each(controllers)("%s", async (_name, controller) => {
    const req = {
      body: {},
      query: {},
      params: { id: "x1", groupId: "g1", studentId: "s1" },
      user: { userId: "a1", role: "admin", refId: "a1" },
    } as unknown as Request;
    const res = { status: jest.fn(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await controller(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(Error);
    // ولا جسمٌ أُرسل. (رمز الحالة قد يُضبط قبل انتظار الخدمة، ويكتب المعالج فوقه.)
    expect(res.json).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
