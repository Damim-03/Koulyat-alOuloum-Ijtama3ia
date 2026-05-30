import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import professorRoutes from "../modules/professor/professor.routes";

const mainRoute: Router = Router();

mainRoute.use("/auth", authRoutes);

mainRoute.use("/professor", professorRoutes);



export default mainRoute;