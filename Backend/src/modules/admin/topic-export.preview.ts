import type { NextFunction, Request, Response } from "express";

import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage } from "../../core/i18n";
import { exportTopicsSchema } from "./admin.validation";
import { previewTopicsService } from "./topic-export.service";

/**
 * `GET /admin/topics/export/preview` — the topics' Excel file before it is
 * downloaded: its first rows, as it will draw them (same query as the file).
 */
export const previewTopicsExportController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = exportTopicsSchema.safeParse(req.query);
    if (!parsed.success) throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
    return res.status(HTTPSTATUS.OK).json({ preview: await previewTopicsService(parsed.data) });
  } catch (e) {
    next(e);
  }
};
