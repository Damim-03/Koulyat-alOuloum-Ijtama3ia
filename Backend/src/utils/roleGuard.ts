import { Request, Response, NextFunction } from "express";

import { JwtUser } from "../middleware/auth.middleware";

import { PermissionType, RoleType } from "../core/enums/role.enum";

import { RolePermissions } from "../core/enums/role.enum";

export const roleGuard =
  (requiredPermissions: PermissionType[], mode: "ALL" | "ANY" = "ANY") =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    //
    // OWNER bypass
    //

    if (user.role === "OWNER") {
      return next();
    }

    //
    // Role permissions
    //

    const permissions = RolePermissions[user.role as RoleType];

    if (!permissions) {
      return res.status(403).json({
        message: "Invalid role",
      });
    }

    //
    // Permission check
    //

    const hasPermission =
      mode === "ALL"
        ? requiredPermissions.every((permission) =>
            permissions.includes(permission),
          )
        : requiredPermissions.some((permission) =>
            permissions.includes(permission),
          );

    if (!hasPermission) {
      return res.status(403).json({
        message: "You do not have permission to access this resource",
      });
    }

    return next();
  };

//
// OWNER ONLY
//

export const ownerOnly =
  () => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (user.role !== "OWNER") {
      return res.status(403).json({
        message: "Forbidden: only OWNER can access this resource",
      });
    }

    return next();
  };

//
// ADMIN OR OWNER
//

export const adminOrOwner =
  () => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Forbidden: only OWNER or ADMIN can access this resource",
      });
    }

    return next();
  };
