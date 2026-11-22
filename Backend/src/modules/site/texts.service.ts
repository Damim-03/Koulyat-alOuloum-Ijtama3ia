import { prisma } from "../../core/prisma/client";
import { siteTextsSchema, type SiteTextsDTO } from "./site.validation";

const SLUG = "site-texts";

const EMPTY: SiteTextsDTO = { ar: {}, fr: {}, en: {}, hidden: [] };

/**
 * نصوص الموقع كما غيّرتها الإدارة — العبارات التي تحلّ محلّ نصوص الواجهة
 * الافتراضية بمفاتيحها، لكلّ لغة: عناوين الصفحة الرئيسية، والقوائم، والتذييل،
 * والقوائم الجانبية… — وما أخفته منها (`hidden`).
 *
 * والمحفوظ يمرّ بالمخطّط عند القراءة كما في «عن المنصة»: صفٌّ لا يطابقه
 * يُعامَل كأنّه فارغ — فتعود الواجهة إلى نصوصها — بدل أن يصل منه ما لا يصحّ.
 */
export const getSiteTextsService = async (): Promise<SiteTextsDTO> => {
  const row = await prisma.siteContent.findUnique({ where: { slug: SLUG } });
  if (!row) return EMPTY;
  const parsed = siteTextsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : EMPTY;
};

export const saveSiteTextsService = async (data: SiteTextsDTO) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, value },
    update: { value },
  });
  return getSiteTextsService();
};
