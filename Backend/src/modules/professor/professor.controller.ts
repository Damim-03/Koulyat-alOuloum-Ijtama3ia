import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { createMilestoneSchema, createTopicSchema, listApplicationsSchema, updateMilestoneSchema, updateTopicSchema } from "./professor.validation";
import {
  createTopicService,
  getMyTopicsService,
  getTopicByIdService,
  updateTopicService,
  deleteTopicService,
  getGroupByIdService,
  getMyGroupsService,
  acceptApplicationService,
  createMilestoneService,
  deleteMilestoneService,
  getApplicationsService,
  getMilestonesService,
  rejectApplicationService,
  updateMilestoneService,
} from "./professor.service";

export const createTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = createTopicSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException(
        "Validation error",
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  }
  try {
    const topic = await createTopicService(req.user!.userId, parsed.data);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Topic created", topic });
  } catch (error) {
    next(error);
  }
};

export const getMyTopicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topics = await getMyTopicsService(req.user!.userId);
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

export const updateTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = updateTopicSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException(
        "Validation error",
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  }
  try {
    const topic = await updateTopicService(
      req.user!.userId,
      req.params.id as string,
      parsed.data,
    );
    return res.status(HTTPSTATUS.OK).json({ message: "Topic updated", topic });
  } catch (error) {
    next(error);
  }
};

export const deleteTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteTopicService(
      req.user!.userId,
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

//
// ─── PROJECT GROUPS ───────────────────────────────────────────
//

export const getMyGroupsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const groups = await getMyGroupsService(req.user!.userId);
    return res.status(HTTPSTATUS.OK).json({ groups });
  } catch (error) {
    next(error);
  }
};

export const getGroupByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const group = await getGroupByIdService(
      req.user!.userId,
      req.params.groupId as string,
    );
    return res.status(HTTPSTATUS.OK).json({ group });
  } catch (error) {
    next(error);
  }
};

//
// ─── APPLICATIONS ─────────────────────────────────────────────
//

export const getApplicationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = listApplicationsSchema.safeParse(req.query);
  if (!parsed.success) {
    return next(
      new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
    );
  }
  try {
    const applications = await getApplicationsService(
      req.user!.userId,
      parsed.data,
    );
    return res.status(HTTPSTATUS.OK).json({ applications });
  } catch (error) {
    next(error);
  }
};

export const acceptApplicationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await acceptApplicationService(
      req.user!.userId,
      req.params.id as string,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Application accepted", application });
  } catch (error) {
    next(error);
  }
};

export const rejectApplicationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await rejectApplicationService(
      req.user!.userId,
      req.params.id as string,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Application rejected", application });
  } catch (error) {
    next(error);
  }
};

//
// ─── MILESTONES ───────────────────────────────────────────────
//

export const createMilestoneController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = createMilestoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
    );
  }
  try {
    const milestone = await createMilestoneService(
      req.user!.userId,
      req.params.groupId as string,
      parsed.data,
    );
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Milestone created", milestone });
  } catch (error) {
    next(error);
  }
};

export const getMilestonesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const milestones = await getMilestonesService(
      req.user!.userId,
      req.params.groupId as string,
    );
    return res.status(HTTPSTATUS.OK).json({ milestones });
  } catch (error) {
    next(error);
  }
};

export const updateMilestoneController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = updateMilestoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
    );
  }
  try {
    const milestone = await updateMilestoneService(
      req.user!.userId,
      req.params.id as string,
      parsed.data,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Milestone updated", milestone });
  } catch (error) {
    next(error);
  }
};

export const deleteMilestoneController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteMilestoneService(
      req.user!.userId,
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
