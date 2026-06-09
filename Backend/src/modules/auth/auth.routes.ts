import { Router } from "express";
import {
  studentLoginController,
  professorLoginController,
  adminLoginController,
  refreshTokenController,
  getMeController,
} from "./auth.controller";
import { authMiddleware } from "../../core/middleware/auth.middleware";

const authRoutes = Router();

authRoutes.post("/student/login", studentLoginController);
authRoutes.post("/professor/login", professorLoginController);
authRoutes.post("/admin/login", adminLoginController);
authRoutes.post("/refresh", refreshTokenController);
authRoutes.get("/me", authMiddleware, getMeController);

export default authRoutes;
