import { Request, Response, NextFunction } from "express";

import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import { prisma } from "../prisma/client";

import { RoleType } from "../enums/role.enum";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { config } from "../config/app.config";
import { verifyToken } from "../auth/tokens";
import { isSessionRevoked } from "../auth/sessions";
import { endUserSession, sessionLapse, touchSession } from "../auth/refresh-sessions";
import { disconnectSessions } from "../realtime/realtime";
import { tr } from "../i18n";

export type JwtUser = {
  userId: string;
  role: RoleType;
  /** Profile id: Student.id | Professor.id | User.id for admins. */
  refId: string;
  /** The session (`sid`) this request's token belongs to. */
  sid?: string;
};


export interface AuthenticatedRequest extends Request {
  user?: JwtUser;
}

/**
 * What an account that must first be put right may still reach: who am I, the
 * account page, changing the password, setting up two-step verification, and
 * signing out everywhere. Everything else answers 403 with the reason as its
 * code, and the client shows that screen instead.
 */
const SETUP_ROUTES: [method: string, path: RegExp][] = [
  ["GET", /\/auth\/me$/],
  ["POST", /\/auth\/logout-all$/],
  ["GET", /\/account$/],
  ["POST", /\/account\/password$/],
  ["*", /\/account\/2fa(\/[a-z-]+)?$/],
];

const matches = (req: Request, routes: [method: string, path: RegExp][]) => {
  const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, "");
  return routes.some(([method, re]) => (method === "*" || method === req.method) && re.test(path));
};
const isSetupRoute = (req: Request) => matches(req, SETUP_ROUTES);

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  //
  // Token extraction
  //

  // This API is Bearer-only. The previous cookie fallback was never written
  // to by any login route, but accepting a cookie would have made every
  // state-changing endpoint CSRF-reachable the moment one appeared.
  let token: string | undefined;

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  //
  // No token
  //

  if (!token) {
    return res.status(401).json({
      message: tr("auth.unauthorized"),
    });
  }

  try {
    //
    // Verify JWT
    //

    // Pinned algorithm + issuer + audience + token type (see core/auth/tokens).
    const decoded = verifyToken(token, "access");

    //
    // Validate user
    //

    // Both revocation checks run against the same round trip as the user
    // lookup, so per-session sign-out costs no extra latency.
    const [user, sessionRevoked, adminSession] = await Promise.all([
      prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        role: true,
        status: true,
        tokenVersion: true,
        mustChangePassword: true,
        totpEnabledAt: true,
        student: { select: { id: true } },
        professor: { select: { id: true } },
      },
      }),
      isSessionRevoked(decoded.sid),
      decoded.role === "admin" && decoded.sid
        ? prisma.authSession.findUnique({
            where: { id: decoded.sid },
            select: { createdAt: true, lastSeenAt: true },
          })
        : null,
    ]);

    //
    // Invalid user
    //

    if (!user) {
      return res.status(401).json({
        message: tr("auth.userNotFound"),
      });
    }

    //
    // Suspended user
    //

    if (user.status !== "active") {
      return res.status(403).json({
        message: tr("auth.suspended"),
      });
    }

    //
    // Revoked session (logout / forced sign-out bumps the generation)
    //

    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion || sessionRevoked) {
      return res.status(401).json({
        message: tr("auth.sessionRevoked"),
      });
    }

    //
    // An administrator's session, timed by the server: past its hours, or
    // unused for too long, it ends here — not only when the browser says so.
    // (No row means it was signed out, or predates these limits.)
    //

    if (user.role === "admin") {
      const lapse =
        decoded.role !== "admin" || !decoded.sid || !adminSession ? "expired" : sessionLapse("admin", adminSession);
      if (lapse) {
        if (decoded.sid && (await endUserSession(user.id, decoded.sid))) void disconnectSessions(user.id, [decoded.sid]);
        return res.status(401).json({
          message: tr(lapse === "idle" ? "auth.idleTimeout" : "auth.sessionRevoked"),
          errorCode: ErrorCodeEnum.AUTH_INVALID_TOKEN,
        });
      }
      void touchSession(decoded.sid!, adminSession!.lastSeenAt);
    }

    //
    // An account to put right first: a password the administration handed
    // out, or an administrator without two-step verification.
    //

    if (!isSetupRoute(req)) {
      if (user.mustChangePassword) {
        return res.status(403).json({
          message: tr("auth.passwordChangeRequired"),
          errorCode: ErrorCodeEnum.PASSWORD_CHANGE_REQUIRED,
        });
      }
      if (user.role === "admin" && config.REQUIRE_ADMIN_2FA && !user.totpEnabledAt) {
        return res.status(403).json({
          message: tr("auth.twoFactorSetupRequired"),
          errorCode: ErrorCodeEnum.TWO_FACTOR_SETUP_REQUIRED,
        });
      }
    }

    //
    // Attach user. Role and ids come from the database, never from the
    // token body, so a stale token cannot carry a stale privilege.
    //

    req.user = {
      userId: user.id,
      role: user.role as RoleType,
      refId: user.student?.id ?? user.professor?.id ?? user.id,
      sid: decoded.sid,
    };

    return next();
  } catch (error) {
    //
    // Token expired
    //

    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        message: tr("auth.tokenExpired"),
      });
    }

    //
    // Invalid token
    //

    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        message: tr("auth.invalidToken"),
      });
    }

    //
    // Unknown error
    //

    return res.status(500).json({
      message: tr("auth.failed"),
    });
  }
};
