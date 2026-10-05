import { prisma } from "../../core/prisma/client";
import {
  BadRequestException,
  NotFoundException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import type { CreateNewsDTO, UpdateNewsDTO } from "./site.validation";

/**
 * سقفُ الأخبار، منشورةً ومخفيّة.
 *
 * الشريط يدور بها كلّها، وما بعد العشرين لا يبلغه زائرٌ قبل أن يغادر —
 * والقديم يُحذف أو يُخفى لا يتراكم.
 */
export const MAX_NEWS = 30;

/** الأحدث أوّلاً، وفي اليوم الواحد ما أُضيف أخيراً. */
const ORDER = [{ date: "desc" as const }, { createdAt: "desc" as const }];

/** `YYYY-MM-DD` ⇐ منتصف ليل ذلك اليوم بتوقيت غرينتش، كما يُخزَّن عمود `DATE`. */
const dayOf = (v: string) => new Date(`${v}T00:00:00.000Z`);

const notFound = () =>
  new NotFoundException("الخبر غير موجود", ErrorCodeEnum.RESOURCE_NOT_FOUND);

//
// ─── للزائر ──────────────────────────────────────────────────
//

export const listPublicNewsService = () =>
  prisma.newsItem.findMany({
    where: { isActive: true },
    orderBy: ORDER,
    select: {
      id: true,
      text: true,
      textFr: true,
      textEn: true,
      date: true,
      linkUrl: true,
    },
  });

//
// ─── للإدارة ─────────────────────────────────────────────────
//

export const listNewsService = () => prisma.newsItem.findMany({ orderBy: ORDER });

export const createNewsService = async (data: CreateNewsDTO) => {
  if ((await prisma.newsItem.count()) >= MAX_NEWS)
    throw new BadRequestException(
      `بلغت الحدّ الأقصى (${MAX_NEWS} خبراً) — احذف خبراً قديماً قبل إضافة آخر`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  return prisma.newsItem.create({
    data: {
      text: data.text,
      textFr: data.textFr ?? null,
      textEn: data.textEn ?? null,
      date: dayOf(data.date),
      linkUrl: data.linkUrl ?? null,
      isActive: data.isActive ?? true,
    },
  });
};

export const updateNewsService = async (id: string, data: UpdateNewsDTO) => {
  if (!(await prisma.newsItem.findUnique({ where: { id } }))) throw notFound();

  return prisma.newsItem.update({
    where: { id },
    data: {
      text: data.text,
      textFr: data.textFr,
      textEn: data.textEn,
      date: data.date ? dayOf(data.date) : undefined,
      linkUrl: data.linkUrl,
      isActive: data.isActive,
    },
  });
};

export const deleteNewsService = async (id: string) => {
  if (!(await prisma.newsItem.findUnique({ where: { id } }))) throw notFound();
  await prisma.newsItem.delete({ where: { id } });
  return { message: "تم حذف الخبر" };
};
