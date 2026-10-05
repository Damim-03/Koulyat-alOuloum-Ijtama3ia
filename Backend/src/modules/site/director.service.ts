import { prisma } from "../../core/prisma/client";
import { directorMessageSchema, type DirectorMessageDTO } from "./site.validation";

const SLUG = "director-message";

/**
 * «كلمة رئيس القسم» كما هي محفوظة — أو `null` إن لم تُحفظ قطّ.
 *
 * والمحفوظ يمرّ بالمخطّط نفسه عند القراءة: عمود JSON لا يفرض بنيةً، وصفٌّ
 * كُتب يدوياً أو بإصدارٍ أقدم يجب ألّا يصل إلى الصفحة بحقلٍ ناقص فيكسرها.
 * فما لا يطابق يُعامَل كأنّه غير موجود، وتعرض الواجهة نصّها الافتراضيّ.
 */
export const getDirectorMessageService = async (): Promise<DirectorMessageDTO | null> => {
  const row = await prisma.siteContent.findUnique({ where: { slug: SLUG } });
  if (!row) return null;
  const parsed = directorMessageSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
};

/** للزائر: المحتوى إن كان ظاهراً، وإلّا ما يقول إنّه مخفيّ. */
export const getPublicDirectorMessageService = async () => {
  const content = await getDirectorMessageService();
  if (content && !content.isVisible) return { visible: false, content: null };
  return { visible: true, content };
};

export const saveDirectorMessageService = async (data: DirectorMessageDTO) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, value },
    update: { value },
  });
  return getDirectorMessageService();
};
