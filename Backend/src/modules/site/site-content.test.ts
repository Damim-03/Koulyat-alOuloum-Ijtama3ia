/**
 * محتوى الموقع المحفوظ — بلا قاعدة بيانات.
 *
 * كلّ صفحةٍ تحرّرها الإدارة تُحفظ JSON في صفٍّ واحد. ولم تُحفظ قطّ ⇒ الواجهة
 * تعرض نصوصها الافتراضية. والمحفوظ الذي لا يطابق المخطّط (كُتب يدوياً، أو
 * بإصدارٍ أقدم) يُعامَل كأنّه لم يُحفظ — بدل أن يصل الصفحة ناقصاً فيكسرها.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: { siteContent: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

import { prisma } from "../../core/prisma/client";
import { getAboutPageService } from "./about.service";
import { getDirectorMessageService } from "./director.service";
import { getLoginPageService } from "./login.service";
import { getSiteTextsService, saveSiteTextsService } from "./texts.service";

const db = prisma as unknown as { siteContent: { findUnique: jest.Mock; upsert: jest.Mock } };
const NO_TEXTS = { ar: {}, fr: {}, en: {}, hidden: [] };

describe("محتوى الموقع المحفوظ", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each<[string, () => Promise<unknown>, unknown]>([
    ["عن المنصة", getAboutPageService, null],
    ["لوحة الدخول", getLoginPageService, null],
    ["كلمة رئيس القسم", getDirectorMessageService, null],
    ["نصوص الموقع", getSiteTextsService, NO_TEXTS],
  ])("%s: لم يُحفظ قطّ، أو المحفوظ لا يطابق ⇒ الافتراضيّ", async (_l, get, fallback) => {
    db.siteContent.findUnique.mockResolvedValueOnce(null);
    expect(await get()).toEqual(fallback);

    db.siteContent.findUnique.mockResolvedValueOnce({ slug: "x", value: { ar: 42 } });
    expect(await get()).toEqual(fallback);
  });

  it("نصوص الموقع تُحفظ بمفتاحها، وتُقرأ كما حُفظت", async () => {
    const texts = { ar: { "hero.title": "عنوان" }, fr: {}, en: {}, hidden: [] };
    db.siteContent.findUnique.mockResolvedValueOnce({ slug: "site-texts", value: texts });

    expect(await saveSiteTextsService(texts)).toEqual(texts);
    expect(db.siteContent.upsert).toHaveBeenCalledWith({
      where: { slug: "site-texts" },
      create: { slug: "site-texts", value: texts },
      update: { value: texts },
    });
  });
});
