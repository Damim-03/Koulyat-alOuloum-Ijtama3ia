import type { NextFunction, Request, Response } from "express";
import { HTTPSTATUS } from "../../../core/config/http/http.config";
import { BadRequestException } from "../../../core/utils/appErros";
import { ErrorCodeEnum } from "../../../core/enums/error-code.enum";
import { looksLikeXlsx, xlsxExpandsSafely } from "../../../core/middleware/upload.middleware";
import type { ImportReport } from "./report";
import { tr } from "../../../core/i18n";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * الملف المرفوع، بعد التحقّق من أنّه أرشيف xlsx فعلاً لا اسمٌ فقط — وأنّ فكّه
 * لا يتجاوز ما يحتمله الخادم، قبل أن يصل إلى ExcelJS.
 */
async function uploadedXlsx(req: Request): Promise<Buffer> {
  const buf = req.file?.buffer;
  if (!buf)
    throw new BadRequestException(tr("upload.noExcel"), ErrorCodeEnum.VALIDATION_ERROR);
  if (!looksLikeXlsx(buf))
    throw new BadRequestException(tr("upload.notXlsx"), ErrorCodeEnum.VALIDATION_ERROR);
  if (!(await xlsxExpandsSafely(buf)))
    throw new BadRequestException(tr("upload.xlsxUnsafe"), ErrorCodeEnum.VALIDATION_ERROR);
  return buf;
}

type Outcome =
  | { ok: false; report: ImportReport; annotatedFile?: string }
  | ({ ok: true } & Record<string, unknown>);

/**
 * الطرق الثلاث لكلّ استيراد: النموذج، والمعاينة (لا كتابة)، والاستيراد (الدفعة
 * كلّها أو لا شيء — وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً).
 */
export function importControllers(opts: {
  fileName: string;
  template: () => Promise<Buffer>;
  validate: (buf: Buffer) => Promise<{ report: ImportReport; annotatedFile?: string }>;
  run: (buf: Buffer) => Promise<Outcome>;
  /** ما يُقال حين يُردّ ملفٌّ فيه خطأ — «لم يُستورد أحد» للحسابات. */
  /** ما يُقال حين يُردّ الملف لأخطائه — مفتاحٌ يُترجم عند الردّ. */
  rejected?: "imp.rejected.accounts" | "imp.rejected.topics" | "imp.rejected.assigned";
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
      const { report, annotatedFile } = await opts.validate(await uploadedXlsx(req));
      return res.status(HTTPSTATUS.OK).json({ report, annotatedFile });
    } catch (e) {
      next(e);
    }
  };

  const run = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outcome = await opts.run(await uploadedXlsx(req));
      if (!outcome.ok)
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: tr(opts.rejected ?? "imp.rejected.accounts"),
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
