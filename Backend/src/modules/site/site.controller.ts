import { Request, Response, NextFunction } from "express";

import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  createHomeSlideSchema,
  createHomeSlidesBatchSchema,
  createNewsSchema,
  directorMessageSchema,
  updateNewsSchema,
  reorderHomeSlidesSchema,
  slideIdParamSchema,
  slidePlacementQuerySchema,
  aboutPageSchema,
  loginPageSchema,
  updateHomeSlideSchema,
  type SlidePlacementDTO,
} from "./site.validation";
import {
  createHomeSlideService,
  createHomeSlidesService,
  deleteHomeSlideService,
  listHomeSlidesService,
  listPublicHomeSlidesService,
  reorderHomeSlidesService,
  updateHomeSlideService,
} from "./site.service";
import {
  createNewsService,
  deleteNewsService,
  listNewsService,
  listPublicNewsService,
  updateNewsService,
} from "./news.service";
import {
  getDirectorMessageService,
  getPublicDirectorMessageService,
  saveDirectorMessageService,
} from "./director.service";
import {
  getAboutPageService,
  saveAboutPageService,
} from "./about.service";
import { getLoginPageService, saveLoginPageService } from "./login.service";

function parse<T>(schema: { safeParse: (v: unknown) => any }, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" | ");
    throw new BadRequestException(
      `Validation error → ${issues}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
  return parsed.data as T;
}

const idOf = (req: Request) =>
  parse<{ id: string }>(slideIdParamSchema, req.params).id;

// ─── للزائر: بلا تسجيل دخول ────────────────────────────────────
/**
 * `?placement=about` لمعرض «عن المنصة»، و`aboutHero` لخلفية رأسها، و`login`
 * لخلفية صفحة الدخول؛ والصفحة الرئيسية ما لم يُذكر.
 */
const placementOf = (req: Request) =>
  parse<{ placement: SlidePlacementDTO }>(slidePlacementQuerySchema, req.query).placement;

export const listPublicHomeSlidesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slides = await listPublicHomeSlidesService(placementOf(req));
    return res.status(HTTPSTATUS.OK).json({ slides });
  } catch (e) {
    next(e);
  }
};

// ─── للإدارة ───────────────────────────────────────────────────
export const listHomeSlidesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slides = await listHomeSlidesService(placementOf(req));
    return res.status(HTTPSTATUS.OK).json({ slides });
  } catch (e) {
    next(e);
  }
};

export const createHomeSlideController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(createHomeSlideSchema, req.body);
    const slide = await createHomeSlideService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Slide created", slide });
  } catch (e) {
    next(e);
  }
};

export const createHomeSlidesBatchController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(createHomeSlidesBatchSchema, req.body);
    const slides = await createHomeSlidesService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Slides created", slides });
  } catch (e) {
    next(e);
  }
};

export const updateHomeSlideController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(updateHomeSlideSchema, req.body);
    const slide = await updateHomeSlideService(idOf(req), data as never);
    return res.status(HTTPSTATUS.OK).json({ message: "Slide updated", slide });
  } catch (e) {
    next(e);
  }
};

export const reorderHomeSlidesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ids, placement } = parse<{ ids: string[]; placement: SlidePlacementDTO }>(
      reorderHomeSlidesSchema,
      req.body,
    );
    const slides = await reorderHomeSlidesService(ids, placement);
    return res.status(HTTPSTATUS.OK).json({ slides });
  } catch (e) {
    next(e);
  }
};

export const deleteHomeSlideController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteHomeSlideService(idOf(req));
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── آخر الأخبار ──────────────────────────────────────────────
//

export const listPublicNewsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const news = await listPublicNewsService();
    return res.status(HTTPSTATUS.OK).json({ news });
  } catch (e) {
    next(e);
  }
};

export const listNewsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const news = await listNewsService();
    return res.status(HTTPSTATUS.OK).json({ news });
  } catch (e) {
    next(e);
  }
};

export const createNewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(createNewsSchema, req.body);
    const item = await createNewsService(data as never);
    return res.status(HTTPSTATUS.CREATED).json({ message: "News created", item });
  } catch (e) {
    next(e);
  }
};

export const updateNewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(updateNewsSchema, req.body);
    const item = await updateNewsService(idOf(req), data as never);
    return res.status(HTTPSTATUS.OK).json({ message: "News updated", item });
  } catch (e) {
    next(e);
  }
};

export const deleteNewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteNewsService(idOf(req));
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── كلمة رئيس القسم ─────────────────────────────────────────
//

export const getPublicDirectorMessageController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getPublicDirectorMessageService();
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

export const getDirectorMessageController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const director = await getDirectorMessageService();
    return res.status(HTTPSTATUS.OK).json({ director });
  } catch (e) {
    next(e);
  }
};

export const saveDirectorMessageController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(directorMessageSchema, req.body);
    const director = await saveDirectorMessageService(data as never);
    return res.status(HTTPSTATUS.OK).json({ message: "Saved", director });
  } catch (e) {
    next(e);
  }
};

//
// ─── صفحة «عن المنصة» ────────────────────────────────────────
//

/** للزائر وللإدارة سواء: لا شيء فيها يُخفى. و`null` ⇐ النصّ الافتراضيّ. */
export const getAboutPageController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const content = await getAboutPageService();
    return res.status(HTTPSTATUS.OK).json({ content });
  } catch (e) {
    next(e);
  }
};

export const saveAboutPageController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(aboutPageSchema, req.body);
    const content = await saveAboutPageService(data as never);
    return res.status(HTTPSTATUS.OK).json({ message: "Saved", content });
  } catch (e) {
    next(e);
  }
};

//
// ─── لوحة الترحيب في صفحة الدخول ─────────────────────────────
//

/** للزائر وللإدارة سواء — تُقرأ قبل تسجيل الدخول. و`null` ⇐ النصّ الافتراضيّ. */
export const getLoginPageController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const content = await getLoginPageService();
    return res.status(HTTPSTATUS.OK).json({ content });
  } catch (e) {
    next(e);
  }
};

export const saveLoginPageController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parse(loginPageSchema, req.body);
    const content = await saveLoginPageService(data as never);
    return res.status(HTTPSTATUS.OK).json({ message: "Saved", content });
  } catch (e) {
    next(e);
  }
};
