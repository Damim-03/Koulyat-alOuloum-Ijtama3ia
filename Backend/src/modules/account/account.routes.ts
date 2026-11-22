import { Router, type NextFunction, type Request, type Response } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { authLimiter, writeLimiter } from "../../core/middleware/rateLimit.middleware";
import { activationPhotosUpload, cardImageUpload } from "../../core/middleware/upload.middleware";
import { myActivationRequestController, submitActivationRequestController } from "../activation/activation-request";
import { setRefreshCookie } from "../../core/auth/refresh-cookie";
import { BadRequestException, HttpException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import {
  changeEmailSchema,
  changePasswordSchema,
  passwordOnlySchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
} from "./account.validation";
import * as svc from "./account.service";
import { issuesMessage, tr } from "../../core/i18n";
import { deviceOf } from "../../core/auth/device";
import { auditWrites } from "../../core/audit/audit";
import { entityId } from "../../core/validation/id";

/**
 * `/api/account` — the signed-in person's own account, whatever their role.
 * Each service applies what that role may change; these routes only parse,
 * limit and hand over.
 */
const accountRoutes = Router();
accountRoutes.use(authMiddleware);

const me = (req: Request) => req.user!.userId;

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new BadRequestException(
      issuesMessage(r.error!.issues),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return r.data as T;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Refuses before multer writes anything, for the roles with no photo to change. */
const photoRoles = (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === "student"
    ? next(new HttpException(tr("account.photoManaged"), HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED))
    : next();

accountRoutes.get(
  "/",
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.getAccountService(me(req)) })),
);
accountRoutes.patch(
  "/",
  writeLimiter,
  auditWrites,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.updateAccountService(me(req), req.body) })),
);
accountRoutes.post(
  "/avatar",
  writeLimiter,
  photoRoles,
  auditWrites,
  cardImageUpload,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.setAvatarService(me(req), req.file) })),
);
// The two changes that ask for the current password share the sign-in limiter,
// so they cannot be used to guess it.
accountRoutes.post(
  "/email",
  authLimiter,
  auditWrites,
  // `{ account, verification }`: the address saved, and whether the link that proves it left.
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json(await svc.changeEmailService(me(req), parse(changeEmailSchema, req.body)))),
);
accountRoutes.post(
  "/password",
  authLimiter,
  wrap(async (req, res) => {
    const result = await svc.changePasswordService(me(req), parse(changePasswordSchema, req.body), {
      sid: req.user!.sid,
      device: deviceOf(req),
    });
    // The new session's refresh token, where the web client keeps it.
    setRefreshCookie(res, result.refreshToken);
    return res.status(HTTPSTATUS.OK).json(result);
  }),
);

// Activation (modules/activation): the photos of the card and of the student
// holding it, with the password chosen — reviewed by the administration. The
// one thing a session opened with the handed-out password can do while
// activation is required (core/middleware/auth.middleware).
accountRoutes.get("/activation-request", myActivationRequestController);
accountRoutes.post("/activation-request", writeLimiter, activationPhotosUpload, submitActivationRequestController);

// The devices signed in to this account, and signing one of them out.
accountRoutes.get(
  "/sessions",
  wrap(async (req, res) =>
    res.status(HTTPSTATUS.OK).json({ sessions: await svc.listSessionsService(me(req), req.user!.sid) }),
  ),
);
accountRoutes.delete(
  "/sessions/:id",
  writeLimiter,
  wrap(async (req, res) =>
    res
      .status(HTTPSTATUS.OK)
      .json(await svc.endSessionService(me(req), parse(entityId, req.params.id), deviceOf(req))),
  ),
);

// Two-step verification (administrators). Every step that takes a password or
// a code shares the sign-in limiter, so none of them can be used to guess.
accountRoutes.post(
  "/2fa/setup",
  writeLimiter,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json(await svc.startTwoFactorSetupService(me(req)))),
);
accountRoutes.post(
  "/2fa/enable",
  authLimiter,
  wrap(async (req, res) =>
    res.status(HTTPSTATUS.OK).json(
      await svc.enableTwoFactorService(me(req), parse(twoFactorEnableSchema, req.body), {
        sid: req.user!.sid,
        device: deviceOf(req),
      }),
    ),
  ),
);
accountRoutes.post(
  "/2fa/disable",
  authLimiter,
  wrap(async (req, res) =>
    res
      .status(HTTPSTATUS.OK)
      .json(await svc.disableTwoFactorService(me(req), parse(twoFactorDisableSchema, req.body), deviceOf(req))),
  ),
);
accountRoutes.post(
  "/2fa/recovery-codes",
  authLimiter,
  wrap(async (req, res) =>
    res
      .status(HTTPSTATUS.OK)
      .json(await svc.regenerateRecoveryCodesService(me(req), parse(passwordOnlySchema, req.body), deviceOf(req))),
  ),
);

// A link to the account's own address, proving it theirs (modules/auth/email-links).
accountRoutes.post(
  "/email/verify-request",
  writeLimiter,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json(await svc.requestEmailVerification(me(req)))),
);

// "A sign-in from a new device" — until its owner says it was them.
accountRoutes.get(
  "/security-alerts",
  wrap(async (req, res) =>
    res.status(HTTPSTATUS.OK).json({ alerts: await svc.listSecurityAlertsService(me(req), req.user!.sid) }),
  ),
);
accountRoutes.post(
  "/security-alerts/ack-all",
  writeLimiter,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json(await svc.ackAllSecurityAlertsService(me(req)))),
);
accountRoutes.post(
  "/security-alerts/:id/ack",
  writeLimiter,
  wrap(async (req, res) =>
    res.status(HTTPSTATUS.OK).json(await svc.ackSecurityAlertService(me(req), parse(entityId, req.params.id))),
  ),
);

export default accountRoutes;
