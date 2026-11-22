import { Request, Response, NextFunction } from "express";

import { JwtUser } from "../middleware/auth.middleware";

import { PermissionType, RoleType } from "../enums/role.enum";

import { RolePermissions } from "../enums/role.enum";
import { tr } from "../i18n";

export const roleGuard =
  (requiredPermissions: PermissionType[], mode: "ALL" | "ANY" = "ANY") =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({
        message: tr("auth.unauthorized"),
      });
    }

    //
    // Role permissions
    //

    const permissions = RolePermissions[user.role as RoleType];

    if (!permissions) {
      return res.status(403).json({
        message: tr("access.invalidRole"),
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
        message: tr("access.forbidden"),
      });
    }

    return next();
  };

//
// ADMIN ONLY
//

/**
 * كان هنا حارسان: `ownerOnly` لثلاثة مسارات حذف، و`adminOrOwner` لما دونها.
 * ويوم أُلغي دور `owner` صارا شيئاً واحداً — فبقاؤهما اسمين لشرطٍ واحد
 * يُوهم بمستويين لا وجود لهما.
 *
 * والحذف الذي كان محجوزاً للمالك انتقل إلى المدير بقرارٍ صريح، لا بإهمال:
 * لولا ذلك لَما استطاع أحدٌ حذف حساب.
 */
export const adminOnly =
  () => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({
        message: tr("auth.unauthorized"),
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        message: tr("access.adminOnly"),
      });
    }

    return next();
  };

//
// EXACT ROLE
//

/**
 * Restricts a router to specific roles.
 *
 * `roleGuard([Permissions.LOGIN])` was being used as the entry gate on the
 * /professor and /student routers, but LOGIN is granted to every role — so
 * the gate admitted any authenticated user and the only thing keeping a
 * student out of professor endpoints was the per-route permission plus the
 * service-layer ownership checks. This makes the intended boundary explicit
 * at the router, which is where it is easiest to audit.
 */
export const requireRole =
  (...allowed: RoleType[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtUser }).user;

    if (!user) {
      return res.status(401).json({ message: tr("auth.unauthorized") });
    }

    if (allowed.includes(user.role as RoleType)) {
      return next();
    }

    return res.status(403).json({
      message: tr("access.forbidden"),
    });
  };
