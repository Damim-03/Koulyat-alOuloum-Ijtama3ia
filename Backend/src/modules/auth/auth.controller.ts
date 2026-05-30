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
