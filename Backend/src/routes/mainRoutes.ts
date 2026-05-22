import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";

const mainRoute: Router = Router();

mainRoute.use("/auth", authRoutes);

export default mainRoute;