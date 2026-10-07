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
// Signs out this session only. No `authMiddleware`: the session is named by
// the Bearer token *or* the refresh cookie, so signing out still works after
// the access token has expired — and revoking needs no more than proof of the
// session itself.
authRoutes.post("/logout", logoutController);
// Signs out every device on the account.
authRoutes.post("/logout-all", authMiddleware, logoutAllController);

export default authRoutes;
