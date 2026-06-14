import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  listTopicsSchema,
  createGroupRequestSchema,
} from "./student.validation";
import {
  browseTopicsService,
  getTopicByIdService,
  createGroupRequestService,
  getMyGroupRequestsService,
  cancelGroupRequestService,
  getMyProjectService,
} from "./student.service";

// ─── BROWSE TOPICS ─────────────────────────────────────────────
export const browseTopicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = listTopicsSchema.safeParse(req.query);
  if (!parsed.success) {
    return next(
      new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
    );
  }
  try {
    const topics = await browseTopicsService(req.user!.userId, parsed.data);
    return res.status(HTTPSTATUS.OK).json({ topics });
  } catch (error) {
    next(error);
  }
};

export const getTopicByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await getTopicByIdService(
      req.user!.userId,
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json({ topic });
  } catch (error) {
    next(error);
  }
};

// ─── GROUP REQUESTS ────────────────────────────────────────────
export const createGroupRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = createGroupRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
    );
  }
  try {
    const request = await createGroupRequestService(
      req.user!.userId,
      parsed.data,
    );
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "تم إرسال طلب المجموعة للإدارة", request });
  } catch (error) {
    next(error);
  }
};

export const getMyGroupRequestsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requests = await getMyGroupRequestsService(req.user!.userId);
    return res.status(HTTPSTATUS.OK).json({ requests });
  } catch (error) {
    next(error);
  }
};

export const cancelGroupRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await cancelGroupRequestService(
      req.user!.userId,
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

// ─── MY PROJECT ────────────────────────────────────────────────
export const getMyProjectController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const project = await getMyProjectService(req.user!.userId);
    return res.status(HTTPSTATUS.OK).json({ project });
  } catch (error) {
    next(error);
  }
};