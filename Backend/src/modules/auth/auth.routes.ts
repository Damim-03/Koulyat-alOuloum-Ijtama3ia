import { Router } from "express";
import { authController } from "../auth/auth.controller";

const authRoutes = Router();

authRoutes.get("/auth", authController);

export default authRoutes;
