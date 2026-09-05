import { Request, Response, NextFunction } from "express";

import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import { prisma } from "../prisma/client";

import { RoleType } from "../enums/role.enum";
import { verifyToken } from "../auth/tokens";
import { isSessionRevoked } from "../auth/sessions";

export type JwtUser = {
  userId: string;
  role: RoleType;
  /** Profile id: Student.id | Professor.id | User.id for admins. */
  refId: string;
};

export interface AuthenticatedRequest extends Request {
  user?: JwtUser;
}

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
      message: "Unauthorized",
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
    const [user, sessionRevoked] = await Promise.all([
      prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        role: true,
        status: true,
        tokenVersion: true,
        student: { select: { id: true } },
        professor: { select: { id: true } },
      },
      }),
      isSessionRevoked(decoded.sid),
    ]);

    //
    // Invalid user
    //

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    //
    // Suspended user
    //

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account has been suspended",
      });
    }

    //
    // Revoked session (logout / forced sign-out bumps the generation)
    //

    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion || sessionRevoked) {
      return res.status(401).json({
        message: "Session has been revoked",
      });
    }

    //
    // Attach user. Role and ids come from the database, never from the
    // token body, so a stale token cannot carry a stale privilege.
    //

    req.user = {
      userId: user.id,
      role: user.role as RoleType,
      refId: user.student?.id ?? user.professor?.id ?? user.id,
    };

    return next();
  } catch (error) {
    //
    // Token expired
    //

    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    //
    // Invalid token
    //

    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    //
    // Unknown error
    //

    return res.status(500).json({
      message: "Authentication failed",
    });
  }
};
