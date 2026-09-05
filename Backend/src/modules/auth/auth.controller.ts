import { Request, Response, NextFunction } from "express";

import {
  studentLoginSchema,
  professorLoginSchema,
  adminLoginSchema,
  refreshTokenSchema,
} from "./auth.validation";
import {
  studentLoginService,
  professorLoginService,
  adminLoginService,
  refreshTokenService,
  getMeService,
  logoutService,
  logoutAllService,
} from "./auth.service";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";

const handleLogin =
  (schema: any, service: any) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        new BadRequestException(
          "Validation error",
          ErrorCodeEnum.VALIDATION_ERROR,
        ),
      );
    }
    try {
      const result = await service(parsed.data);
      return res.status(HTTPSTATUS.OK).json({
        message: "Login successful",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

export const refreshTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new BadRequestException(
        "Refresh token is required",
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  }

  try {
    const result = await refreshTokenService(parsed.data.refreshToken);
    return res.status(HTTPSTATUS.OK).json({
      message: "Token refreshed",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const studentLoginController = handleLogin(
  studentLoginSchema,
  studentLoginService,
);

export const professorLoginController = handleLogin(
  professorLoginSchema,
  professorLoginService,
);

export const adminLoginController = handleLogin(
  adminLoginSchema,
  adminLoginService,
);

export const getMeController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.userId;
    const result = await getMeService(userId);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Revokes the session this very token belongs to — not the account.
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.substring(7).trim()
      : undefined;
    const result = await logoutService(token);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const logoutAllController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await logoutAllService(req.user!.userId);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
