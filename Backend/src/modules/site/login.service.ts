import { prisma } from "../../core/prisma/client";
import { loginPageSchema, type LoginPageDTO } from "./site.validation";

const SLUG = "login-page";

/**
 * نصوص لوحة الترحيب في صفحة الدخول كما حفظتها الإدارة — أو `null` إن لم
 * تُحفظ قطّ، فتعرض الواجهة نصّها الافتراضيّ.
 *
 * والمحفوظ يمرّ بالمخطّط عند القراءة كما في «عن المنصة»: صفٌّ لا يطابقه
 * يُعامَل كأنّه غير موجود بدل أن يكسر الصفحة بحقلٍ ناقص.
 */
export const getLoginPageService = async (): Promise<LoginPageDTO | null> => {
  const row = await prisma.siteContent.findUnique({ where: { slug: SLUG } });
  if (!row) return null;
  const parsed = loginPageSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
};

export const saveLoginPageService = async (data: LoginPageDTO) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, value },
    update: { value },
  });
  return getLoginPageService();
};
