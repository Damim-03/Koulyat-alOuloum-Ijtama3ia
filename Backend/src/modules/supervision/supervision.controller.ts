import { Request, Response, NextFunction } from "express";

import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  documentIdParamSchema,
  listDocumentsSchema,
  topicIdParamSchema,
  verifyParamSchema,
} from "./supervision.validation";
import {
  getSupervisionDocumentService,
  issueSupervisionDocumentService,
  listSupervisionDocumentsService,
  previewSupervisionDocumentService,
  revokeSupervisionDocumentService,
  verifySupervisionDocumentService,
} from "./supervision.service";

const invalid = (next: NextFunction) =>
  next(
    new BadRequestException("Validation error", ErrorCodeEnum.VALIDATION_ERROR),
  );

const actorOf = (req: Request) => ({
  userId: req.user!.userId,
  role: req.user!.role,
});

// ─── معاينة قبل الإصدار ────────────────────────────────────────
export const previewSupervisionDocumentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = topicIdParamSchema.safeParse(req.params);
  if (!parsed.success) return invalid(next);

  try {
    const data = await previewSupervisionDocumentService(
      parsed.data.topicId,
      actorOf(req),
    );
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (error) {
    next(error);
  }
};

// ─── الإصدار ───────────────────────────────────────────────────
export const issueSupervisionDocumentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = topicIdParamSchema.safeParse(req.params);
  if (!parsed.success) return invalid(next);

  try {
    const { document, created } = await issueSupervisionDocumentService(
      parsed.data.topicId,
      actorOf(req),
    );
    // ٢٠٠ لا ٢٠١ حين تُعاد الفعّالة: لم يُنشأ شيء.
    return res
      .status(created ? HTTPSTATUS.CREATED : HTTPSTATUS.OK)
      .json({ document, created });
  } catch (error) {
    next(error);
  }
};

// ─── وثيقةٌ بعينها ─────────────────────────────────────────────
export const getSupervisionDocumentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = documentIdParamSchema.safeParse(req.params);
  if (!parsed.success) return invalid(next);

  try {
    const document = await getSupervisionDocumentService(
      parsed.data.id,
      actorOf(req),
    );
    return res.status(HTTPSTATUS.OK).json({ document });
  } catch (error) {
    next(error);
  }
};

// ─── قائمة الإدارة ─────────────────────────────────────────────
export const listSupervisionDocumentsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = listDocumentsSchema.safeParse(req.query);
  if (!parsed.success) return invalid(next);

  try {
    const data = await listSupervisionDocumentsService(parsed.data);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (error) {
    next(error);
  }
};

// ─── الإلغاء ───────────────────────────────────────────────────
export const revokeSupervisionDocumentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = documentIdParamSchema.safeParse(req.params);
  if (!parsed.success) return invalid(next);

  try {
    const document = await revokeSupervisionDocumentService(parsed.data.id);
    return res.status(HTTPSTATUS.OK).json({ document });
  } catch (error) {
    next(error);
  }
};

// ─── التحقّق العامّ (بلا تسجيل دخول) ───────────────────────────
export const verifySupervisionDocumentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = verifyParamSchema.safeParse(req.params);
  // رمزٌ مشوَّه = وثيقةٌ غير موجودة. ولا يُقال «صيغة خاطئة»: ذلك يُرشد من
  // يجرّب الرموز إلى شكل الرمز الصحيح.
  if (!parsed.success)
    return res.status(HTTPSTATUS.NOT_FOUND).json({ found: false });

  try {
    const result = await verifySupervisionDocumentService(parsed.data.token);
    return res
      .status(result.found ? HTTPSTATUS.OK : HTTPSTATUS.NOT_FOUND)
      .json(result);
  } catch (error) {
    next(error);
  }
};
