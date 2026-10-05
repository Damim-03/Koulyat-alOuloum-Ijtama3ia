import { prisma } from "../../core/prisma/client";
import { aboutPageSchema, type AboutPageDTO } from "./site.validation";

const SLUG = "about-page";

/**
 * نصوص صفحة «عن المنصة» كما حفظتها الإدارة — أو `null` إن لم تُحفظ قطّ،
 * فتعرض الواجهة نصّها الافتراضيّ.
 *
 * والمحفوظ يمرّ بالمخطّط عند القراءة كما في «كلمة رئيس القسم»: صفٌّ لا
 * يطابقه يُعامَل كأنّه غير موجود بدل أن يكسر الصفحة بحقلٍ ناقص.
 */
export const getAboutPageService = async (): Promise<AboutPageDTO | null> => {
  const row = await prisma.siteContent.findUnique({ where: { slug: SLUG } });
  if (!row) return null;
  const parsed = aboutPageSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
};

export const saveAboutPageService = async (data: AboutPageDTO) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, value },
    update: { value },
  });
  return getAboutPageService();
};
