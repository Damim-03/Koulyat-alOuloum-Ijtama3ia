import { Router } from "express";
import {
  studentLoginController,
  professorLoginController,
  adminLoginController,
  refreshTokenController,
} from "./auth.controller";

const authRoutes = Router();

authRoutes.post("/student/login",   studentLoginController);
authRoutes.post("/professor/login", professorLoginController);
authRoutes.post("/admin/login",     adminLoginController);
authRoutes.post("/refresh",         refreshTokenController);

export default authRoutes;