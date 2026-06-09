import { Request, Response, NextFunction } from "express";

import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import { prisma } from "../../prisma/client";

import { config } from "../config/app.config";

import { RoleType } from "../enums/role.enum";

export type JwtUser = {
  userId: string;
  role: RoleType;
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

  let token: string | undefined;

  const authHeader = req.headers.authorization;

  //
  // Mobile → Bearer token
  //

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  //
  // Web → Cookie
  //
  else {
    token = req.cookies?.accessToken;
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

    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtUser;

    //
    // Validate user
    //

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

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
    // Attach user
    //

    req.user = {
      userId: user.id,
      role: user.role as RoleType,
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
