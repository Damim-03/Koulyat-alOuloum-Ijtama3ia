import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { HTTPSTATUS } from "../config/http/http.config";
import { AppError } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { config } from "../config/app.config";

/**
 * ============================================================
 * ERROR HANDLER
 * ============================================================
 *
 * The 500 branch used to return `error.message` to the caller. For a Prisma
 * failure that string carries table and column names; for a filesystem error
 * it carries absolute server paths; for a driver error it can carry the
 * connection target. All of it was being handed to unauthenticated clients.
 *
 * Now every unexpected error returns a fixed message plus a correlation id.
 * The real error is logged once, server-side, against that same id — so
 * support can still trace an incident without the response describing the
 * inside of the machine.
 */

/** Strings that must never appear in a log line. */
const REDACT_KEYS =
  /(password|passwd|secret|token|authorization|cookie|refreshToken|accessToken)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/**
 * أسماء الحقول التي انتهك الطلبُ تفرّدَها.
 *
 * موضع الاسم يختلف باختلاف المُشغِّل: بعضها يضعه في `meta.target` جاهزاً،
 * وسائق MariaDB يضعه في اسم الفهرس داخل خطأ المُهايئ (`User_email_key`)
 * وفي نصّ الرسالة. فيُقرأ من المواضع الثلاثة بدل اختيار واحد والرهان عليه —
 * وهو نفس الدرس المسجَّل في `isReservationClash` بوحدة الطالب.
 *
 * واسم الفهرس بصيغة `Model_field_key` أو `Model_a_b_key` للمركَّب، فتُستخرج
 * منه الحقول بإسقاط اسم النموذج ولاحقة `_key`.
 */
function uniqueFieldsOf(error: unknown): string[] {
  const err = error as {
    meta?: { target?: unknown; driverAdapterError?: unknown };
    message?: string;
  };

  const target = err?.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];

  const blob = `${JSON.stringify(err?.meta ?? "")} ${err?.message ?? ""}`;
  const index = blob.match(/([A-Za-z0-9_]+)_key/)?.[1];
  if (!index) return [];

  // `User_email` ⇒ ["email"]  ·  `Student_userId_registrationNumber` ⇒ اثنان
  const [, ...parts] = index.split("_");
  return parts.length ? parts : [index];
}

/**
 * أسماء الحقول التي أشارت إلى صفٍّ غير موجود.
 *
 * اسم القيد بصيغة `Model_field_fkey` أو `..._fk`، فيُستخرج منه اسم الحقل
 * كما يُستخرج من اسم الفهرس في `uniqueFieldsOf`.
 */
function foreignKeyFieldsOf(error: unknown): string[] {
  const err = error as {
    meta?: { field_name?: unknown };
    message?: string;
  };

  const named = err?.meta?.field_name;
  if (typeof named === "string" && named) return [named];

  const blob = `${JSON.stringify(err?.meta ?? "")} ${err?.message ?? ""}`;
  const constraint = blob.match(/([A-Za-z0-9_]+?)_fk(?:ey)?/)?.[1];
  if (!constraint) return [];

  const [, ...parts] = constraint.split("_");
  return parts.length ? parts : [constraint];
}

export const errorHandler: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  _next: NextFunction,
): any => {
  // 1) Malformed JSON body
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON format, please check your request body",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    });
  }

  // 2) Body/upload too large, too many files, unexpected field
  if (error instanceof MulterError) {
    const tooBig = error.code === "LIMIT_FILE_SIZE";
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: tooBig ? "File is too large" : "Invalid upload",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    });
  }

  if ((error as { type?: string })?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    });
  }

  // 3) Validation failures — field paths only, never the submitted values
  if (error instanceof ZodError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Validation error",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
      fields: error.issues.map((i) => i.path.join(".")).filter(Boolean),
    });
  }

  // 4) CORS rejection
  if (error instanceof Error && error.message === "CORS not allowed") {
    return res.status(HTTPSTATUS.FORBIDDEN).json({
      message: "Origin not allowed",
      errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    });
  }

  // 5) Deliberate application errors carry messages written for users
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
    });
  }

  /*
   * 6) تعارض تفرّد في القاعدة (Prisma P2002).
   *
   * بريدٌ مسجَّل، أو رقم تسجيل مستعمَل، أو رمز كلّية مكرّر — كلّها كانت تسقط
   * إلى 500 «Internal Server Error» مع رقم حادثة. والمستخدم لم يُخطئ في
   * النظام بل في حقل، فيستحقّ أن يُقال له أيّ حقل.
   *
   * والمخطّط فيه ٢٣ حقلاً فريداً، ولا يُفحص منها يدوياً إلا اثنان — فالفحص
   * في الخدمات وحده لا يكفي، ولا يغطّي السباق بين طلبين متزامنين يجتازان
   * الفحص معاً. القاعدة هي الحَكَم الأخير، وهذا الفرع يترجم حكمها.
   *
   * ولا يُذكر في الردّ إلا **اسم الحقل** لا قيمته: «البريد مستعمَل» تكفي،
   * وإعادة القيمة تُثبت للمهاجم أن ما جرّبه مسجَّل.
   */
  if ((error as { code?: string })?.code === "P2002") {
    const fields = uniqueFieldsOf(error);

    return res.status(HTTPSTATUS.CONFLICT).json({
      message: fields.length
        ? `القيمة مستعمَلة بالفعل: ${fields.join("، ")}`
        : "القيمة مستعمَلة بالفعل",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
      fields,
    });
  }

  /*
   * تعارض مفتاح أجنبي (P2003): معرّفٌ أرسله العميل لا يقابل صفّاً.
   *
   * أستاذٌ غير موجود في لجنة، أو قسمٌ محذوف في تخصّص، أو سنةٌ دراسية زالت —
   * كلّها كانت 500. والخدمات تتحقّق من المراجع في مواضع كثيرة لكن لا في
   * كلّها، والقاعدة هي الحَكَم الأخير: هذا الفرع يترجم حكمها إلى 400 بدل
   * «خطأ في الخادم».
   *
   * ولا يُعاد المعرّف في الردّ — اسم الحقل يكفي.
   */
  if ((error as { code?: string })?.code === "P2003") {
    const fields = foreignKeyFieldsOf(error);

    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: fields.length
        ? `مرجعٌ غير موجود: ${fields.join("، ")}`
        : "أحد المراجع المُرسَلة غير موجود",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
      fields,
    });
  }

  // 7) Anything else: log privately, answer generically
  const incidentId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      level: "error",
      incidentId,
      method: req.method,
      path: req.originalUrl?.split("?")[0],
      userId: req.user?.userId ?? null,
      name: error?.name,
      message: error?.message,
      // Stacks stay out of production logs' structured field but are printed
      // below in development where they are actually read.
      meta: redact((error as { meta?: unknown })?.meta),
    }),
  );

  if (!config.IS_PRODUCTION && error?.stack) {
    console.error(error.stack);
  }

  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "Internal Server Error",
    errorCode: ErrorCodeEnum.INTERNAL_SERVER_ERROR,
    incidentId,
  });
};
