import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { listPublicTopicsSchema } from "./public.validation";
import {
  listPublicTopicsService,
  getPublicTopicService,
  listPublicSpecializationsService,
  listPublicDepartmentsService,
} from "./public.service";

export const listPublicTopicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = listPublicTopicsSchema.safeParse(req.query);
  if (!parsed.success) {
    return next(
      new BadRequestException(
        "Validation error",
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  }
  try {
    const data = await listPublicTopicsService(parsed.data);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getPublicTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await getPublicTopicService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ topic });
  } catch (e) {
    next(e);
  }
};

export const listPublicSpecializationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departmentId = (req.query.departmentId as string) || undefined;
    const specializations =
      await listPublicSpecializationsService(departmentId);
    return res.status(HTTPSTATUS.OK).json({ specializations });
  } catch (e) {
    next(e);
  }
};

export const listPublicDepartmentsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departments = await listPublicDepartmentsService();
    return res.status(HTTPSTATUS.OK).json({ departments });
  } catch (e) {
    next(e);
  }
};
