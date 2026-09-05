import { Router } from "express";
import {
  studentLoginController,
  professorLoginController,
  adminLoginController,
  refreshTokenController,
  getMeController,
  logoutController,
  logoutAllController,
} from "./auth.controller";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import {
  authLimiter,
  refreshLimiter,
} from "../../core/middleware/rateLimit.middleware";

const authRoutes = Router();

authRoutes.post("/student/login", authLimiter, studentLoginController);
authRoutes.post("/professor/login", authLimiter, professorLoginController);
authRoutes.post("/admin/login", authLimiter, adminLoginController);
authRoutes.post("/refresh", refreshLimiter, refreshTokenController);
authRoutes.get("/me", authMiddleware, getMeController);
// Signs out this session only.
authRoutes.post("/logout", authMiddleware, logoutController);
// Signs out every device on the account.
authRoutes.post("/logout-all", authMiddleware, logoutAllController);

export default authRoutes;
