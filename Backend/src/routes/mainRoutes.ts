import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import professorRoutes from "../modules/professor/professor.routes";
import adminRoutes from "../modules/admin/admin.routes";
import commonRoutes from "../modules/common/common.routes";
import studentRoutes from "../modules/student/student.routes";

const mainRoute: Router = Router();

mainRoute.use("/auth", authRoutes);

mainRoute.use("/admin", adminRoutes);

mainRoute.use("/professor", professorRoutes);

mainRoute.use("/student", studentRoutes);

mainRoute.use("/common", commonRoutes);



export default mainRoute;