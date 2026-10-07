import { Router, type NextFunction, type Request, type Response } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { authLimiter, writeLimiter } from "../../core/middleware/rateLimit.middleware";
import { cardImageUpload } from "../../core/middleware/upload.middleware";
import { setRefreshCookie } from "../../core/auth/refresh-cookie";
import { BadRequestException, HttpException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { changeEmailSchema, changePasswordSchema } from "./account.validation";
import * as svc from "./account.service";

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
      `Validation error → ${r.error!.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join(" | ")}`,
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
    ? next(new HttpException("لا يمكنك تغيير الصورة من حسابك — تديرها الإدارة.", HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED))
    : next();

accountRoutes.get(
  "/",
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.getAccountService(me(req)) })),
);
accountRoutes.patch(
  "/",
  writeLimiter,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.updateAccountService(me(req), req.body) })),
);
accountRoutes.post(
  "/avatar",
  writeLimiter,
  photoRoles,
  cardImageUpload,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.setAvatarService(me(req), req.file) })),
);
// The two changes that ask for the current password share the sign-in limiter,
// so they cannot be used to guess it.
accountRoutes.post(
  "/email",
  authLimiter,
  wrap(async (req, res) => res.status(HTTPSTATUS.OK).json({ account: await svc.changeEmailService(me(req), parse(changeEmailSchema, req.body)) })),
);
accountRoutes.post(
  "/password",
  authLimiter,
  wrap(async (req, res) => {
    const result = await svc.changePasswordService(me(req), parse(changePasswordSchema, req.body));
    // The new session's refresh token, where the web client keeps it.
    setRefreshCookie(res, result.refreshToken);
    return res.status(HTTPSTATUS.OK).json(result);
  }),
);

export default accountRoutes;
