import type { NextFunction, Request, Response } from "express";
import { HTTPSTATUS } from "../../../core/config/http/http.config";
import { BadRequestException } from "../../../core/utils/appErros";
import { ErrorCodeEnum } from "../../../core/enums/error-code.enum";
import { looksLikeXlsx } from "../../../core/middleware/upload.middleware";
import type { ImportReport } from "./report";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** الملف المرفوع، بعد التحقّق من أنّه أرشيف xlsx فعلاً لا اسمٌ فقط. */
function uploadedXlsx(req: Request): Buffer {
  const buf = req.file?.buffer;
  if (!buf)
    throw new BadRequestException("لم يُرفع ملفّ — أرفق ملفّ Excel.", ErrorCodeEnum.VALIDATION_ERROR);
  if (!looksLikeXlsx(buf))
    throw new BadRequestException("الملف ليس ملفّ Excel صالحاً (xlsx).", ErrorCodeEnum.VALIDATION_ERROR);
  return buf;
}

type Outcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | ({ ok: true } & Record<string, unknown>);

/**
 * الطرق الثلاث لكلّ استيراد: النموذج، والمعاينة (لا كتابة)، والاستيراد (الدفعة
 * كلّها أو لا أحد — وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً).
 */
export function importControllers(opts: {
  fileName: string;
  template: () => Promise<Buffer>;
  validate: (buf: Buffer) => Promise<{ report: ImportReport; annotatedFile?: string }>;
  run: (buf: Buffer) => Promise<Outcome>;
}) {
  const template = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const buf = await opts.template();
      res.setHeader("Content-Type", XLSX_TYPE);
      res.setHeader("Content-Disposition", `attachment; filename="${opts.fileName}"`);
      res.setHeader("Cache-Control", "no-store");
      return res.status(HTTPSTATUS.OK).send(buf);
    } catch (e) {
      next(e);
    }
  };

  const preview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { report, annotatedFile } = await opts.validate(uploadedXlsx(req));
      return res.status(HTTPSTATUS.OK).json({ report, annotatedFile });
    } catch (e) {
      next(e);
    }
  };

  const run = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outcome = await opts.run(uploadedXlsx(req));
      if (!outcome.ok)
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: "الملف فيه أخطاء — صحّحها ثم أعد الرفع. لم يُستورد أحد.",
          errorCode: ErrorCodeEnum.VALIDATION_ERROR,
          report: outcome.report,
          annotatedFile: outcome.annotatedFile,
        });
      // كلمات المرور المولَّدة تُعاد مرّةً واحدة لتُوزَّع — لا تُحفظ ولا تُسجَّل.
      const { ok: _ok, ...body } = outcome;
      res.setHeader("Cache-Control", "no-store");
      return res.status(HTTPSTATUS.CREATED).json(body);
    } catch (e) {
      next(e);
    }
  };

  return { template, preview, run };
}
