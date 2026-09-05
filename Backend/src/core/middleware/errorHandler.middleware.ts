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

  // 6) Anything else: log privately, answer generically
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
