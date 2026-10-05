import { prisma } from "../../core/prisma/client";
import {
  BadRequestException,
  NotFoundException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import type {
  CreateHomeSlideDTO,
  CreateHomeSlidesBatchDTO,
  SlidePlacementDTO,
  UpdateHomeSlideDTO,
} from "./site.validation";

/**
 * سقفُ الشرائح في كلّ موضع، مُفعَّلةً ومعطَّلة.
 *
 * كلّ صورةٍ يحمّلها كلّ زائرٍ للصفحة، فالقائمة الطويلة تُبطئ أوّل ما يراه
 * الناس من المنصّة — وما بعد العاشرة لا يكاد يبلغه أحدٌ في الدوران.
 */
export const MAX_HOME_SLIDES = 12;

const ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** الفارغ والـ`null` مسحٌ؛ والغائب لا يُمَسّ. */
const normalizeCaption = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? v : null;

const notFound = () =>
  new NotFoundException("الصورة غير موجودة", ErrorCodeEnum.RESOURCE_NOT_FOUND);

//
// ─── للزائر ──────────────────────────────────────────────────
//

/** المفعَّلة وحدها في موضعها، بترتيبها، وبما يُعرض فقط. */
export const listPublicHomeSlidesService = (placement: SlidePlacementDTO = "home") =>
  prisma.homeSlide.findMany({
    where: { placement, isActive: true },
    orderBy: ORDER,
    select: { id: true, imageUrl: true, caption: true },
  });

//
// ─── للإدارة ─────────────────────────────────────────────────
//

export const listHomeSlidesService = (placement: SlidePlacementDTO = "home") =>
  prisma.homeSlide.findMany({ where: { placement }, orderBy: ORDER });

export const createHomeSlideService = async (data: CreateHomeSlideDTO) => {
  const [slide] = await createHomeSlidesService({
    slides: [{ imageUrl: data.imageUrl, caption: data.caption }],
    isActive: data.isActive,
    placement: data.placement,
  });
  return slide;
};

/**
 * يضيف ما اختارته الإدارة دفعةً واحدة، بترتيب اختيارها، في آخر الدور:
 * الإضافة لا تقلب ما رُتِّب قبلها.
 *
 * وفي معاملةٍ واحدة: إمّا تُضاف كلّها أو لا شيء. نصفُ دفعةٍ مضافٌ ونصفها
 * مردود يترك الإدارة لا تدري ما الذي دخل — والسقف يُفحص للدفعة كلّها لا
 * لصورةٍ صورة، فلا تتجاوزه دفعةٌ بدأت تحته.
 */
export const createHomeSlidesService = (data: CreateHomeSlidesBatchDTO) =>
  prisma.$transaction(async (tx) => {
    const placement = data.placement ?? "home";
    const count = await tx.homeSlide.count({ where: { placement } });
    const room = MAX_HOME_SLIDES - count;

    if (data.slides.length > room)
      throw new BadRequestException(
        room <= 0
          ? `بلغت الحدّ الأقصى (${MAX_HOME_SLIDES} صورة) — احذف صورةً قبل إضافة أخرى`
          : `المساحة المتبقّية ${room} من ${MAX_HOME_SLIDES} — اختر عدداً أقلّ من الصور`,
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const last = await tx.homeSlide.aggregate({
      where: { placement },
      _max: { sortOrder: true },
    });
    const first = (last._max.sortOrder ?? -1) + 1;

    const created = [];
    for (const [i, s] of data.slides.entries())
      created.push(
        await tx.homeSlide.create({
          data: {
            imageUrl: s.imageUrl,
            caption: normalizeCaption(s.caption) ?? null,
            isActive: data.isActive ?? true,
            placement,
            sortOrder: first + i,
          },
        }),
      );
    return created;
  });

export const updateHomeSlideService = async (
  id: string,
  data: UpdateHomeSlideDTO,
) => {
  const slide = await prisma.homeSlide.findUnique({ where: { id } });
  if (!slide) throw notFound();

  return prisma.homeSlide.update({
    where: { id },
    data: {
      imageUrl: data.imageUrl,
      caption: normalizeCaption(data.caption),
      isActive: data.isActive,
    },
  });
};

/**
 * يكتب الترتيب الكامل دفعةً واحدة.
 *
 * والمُرسَل يجب أن يكون الشرائح كلّها، كلٌّ مرّة: ترتيبٌ جزئيّ يترك
 * الغائبة على أرقامها القديمة فتتداخل مع الجديدة، ويصير الدوران غيرَ ما
 * رأته الإدارة على شاشتها — وغالباً لأنّ زميلاً أضاف صورةً في الأثناء.
 * والترتيب لموضعٍ واحد: صورةٌ من موضعٍ آخر في القائمة تردّها كلّها.
 */
export const reorderHomeSlidesService = async (
  ids: string[],
  placement: SlidePlacementDTO = "home",
) => {
  const existing = await prisma.homeSlide.findMany({
    where: { placement },
    select: { id: true },
  });
  const known = new Set(existing.map((s) => s.id));

  const sameSet =
    ids.length === known.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id));

  if (!sameSet)
    throw new BadRequestException(
      "تغيّرت قائمة الصور منذ فتحها — أعد تحميل الصفحة ثمّ رتّبها",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.$transaction(
    ids.map((id, sortOrder) =>
      prisma.homeSlide.update({ where: { id }, data: { sortOrder } }),
    ),
  );

  return listHomeSlidesService(placement);
};

export const deleteHomeSlideService = async (id: string) => {
  const slide = await prisma.homeSlide.findUnique({ where: { id } });
  if (!slide) throw notFound();

  await prisma.homeSlide.delete({ where: { id } });
  return { message: "تم حذف الصورة" };
};
