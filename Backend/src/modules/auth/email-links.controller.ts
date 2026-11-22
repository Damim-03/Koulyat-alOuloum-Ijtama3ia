import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { tr } from "../../core/i18n";
import { deviceOf } from "../../core/auth/device";
import { mailEnabled } from "../../core/mail/mailer";
import {
  checkResetTokenService,
  requestPasswordResetService,
  resetPasswordService,
  verifyEmailService,
} from "./email-links";

/**
 * The public end of the email links (./email-links): asking for a reset,
 * using one, and opening a verification link. No session — the person
 * cannot sign in, or opened the mail on another device.
 */

/** 256 random bits in base64url: 43 characters. Anything else is not ours. */
const token = z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/);
const forgotSchema = z.object({ identifier: z.string().trim().min(1).max(191) });
const tokenSchema = z.object({ token });
const resetSchema = z.object({ token, password: z.string().min(1).max(200) });

function body<T>(schema: z.ZodType<T>, req: Request): T {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new BadRequestException(tr("request.validation"), ErrorCodeEnum.VALIDATION_ERROR);
  return r.data;
}

const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(HTTPSTATUS.OK).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

/** `GET /auth/password/available` — whether "forgot my password" can work on this server. */
export const resetAvailableController = handle(async () => ({ available: mailEnabled() }));

/** `POST /auth/password/forgot` — `{ identifier }`: a registration number or an email. */
export const forgotPasswordController = handle((req) =>
  requestPasswordResetService(body(forgotSchema, req).identifier, deviceOf(req)),
);

/** `POST /auth/password/reset/check` — `{ token }`: whether the page may show the form. */
export const checkResetController = handle((req) => checkResetTokenService(body(tokenSchema, req).token));

/** `POST /auth/password/reset` — `{ token, password }`. */
export const resetPasswordController = handle((req) => {
  const { token: raw, password } = body(resetSchema, req);
  return resetPasswordService(raw, password, deviceOf(req));
});

/** `POST /auth/email/verify` — `{ token }`. */
export const verifyEmailController = handle((req) => verifyEmailService(body(tokenSchema, req).token, deviceOf(req)));
