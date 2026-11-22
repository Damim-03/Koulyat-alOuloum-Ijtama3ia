/**
 * وحدات تحكّم الموقع — بلا قاعدة ولا خادم.
 *
 * عطلٌ غير متوقّع في الخدمة يصل `next`، فيكتبه معالج الأخطاء ردّاً بـ500 ورقم
 * حادثة — لا طلبٌ معلّقٌ بلا ردّ. (والمسارات نفسها تمرّ بها اختبارات الـAPI.)
 */
import type { NextFunction, Request, Response } from "express";

jest.mock("./site.service");
jest.mock("./news.service");
jest.mock("./director.service");
jest.mock("./about.service");
jest.mock("./login.service");
jest.mock("./texts.service");

import * as slides from "./site.service";
import * as news from "./news.service";
import * as director from "./director.service";
import * as about from "./about.service";
import * as login from "./login.service";
import * as texts from "./texts.service";
import * as ctl from "./site.controller";

type Controller = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const fakeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
};
const down = new Error("database connection lost");

describe("site.controller — عطلٌ في الخدمة", () => {
  it.each<[string, Controller, unknown, Partial<Request>]>([
    ["صور الإدارة", ctl.listHomeSlidesController, slides.listHomeSlidesService, {}],
    ["تعديل صورة", ctl.updateHomeSlideController, slides.updateHomeSlideService, { params: { id: "s1" } }],
    ["الأخبار للزائر", ctl.listPublicNewsController, news.listPublicNewsService, {}],
    ["الأخبار للإدارة", ctl.listNewsController, news.listNewsService, {}],
    ["تعديل خبر", ctl.updateNewsController, news.updateNewsService, { params: { id: "n1" } }],
    ["كلمة رئيس القسم للزائر", ctl.getPublicDirectorMessageController, director.getPublicDirectorMessageService, {}],
    ["كلمة رئيس القسم للإدارة", ctl.getDirectorMessageController, director.getDirectorMessageService, {}],
    ["عن المنصة", ctl.getAboutPageController, about.getAboutPageService, {}],
    ["لوحة الدخول", ctl.getLoginPageController, login.getLoginPageService, {}],
    ["نصوص الموقع", ctl.getSiteTextsController, texts.getSiteTextsService, {}],
    ["حفظ نصوص الموقع", ctl.saveSiteTextsController, texts.saveSiteTextsService, {}],
  ])("%s ⇒ يصل next", async (_l, controller, service, over) => {
    (service as jest.Mock).mockRejectedValueOnce(down);
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await controller({ body: {}, query: {}, params: {}, ...over } as Request, fakeRes(), next);

    expect(next).toHaveBeenCalledWith(down);
  });
});
