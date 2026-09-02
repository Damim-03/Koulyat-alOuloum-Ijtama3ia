import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import professorRoutes from "../modules/professor/professor.routes";
import adminRoutes from "../modules/admin/admin.routes";
import commonRoutes from "../modules/common/common.routes";
import studentRoutes from "../modules/student/student.routes";
import publicRoutes from "../modules/public/public.routes";
import messagesRoutes from "../modules/messages/messages.routes";
import { realtimeBroadcast } from "../core/middleware/realtime.middleware";

const mainRoute: Router = Router();

// Every successful write announces itself to connected clients.
mainRoute.use(realtimeBroadcast);

mainRoute.use("/auth", authRoutes);

mainRoute.use("/messages", messagesRoutes);

mainRoute.use("/admin", adminRoutes);

mainRoute.use("/professor", professorRoutes);

mainRoute.use("/student", studentRoutes);

mainRoute.use("/common", commonRoutes);

mainRoute.use("/public", publicRoutes);

export default mainRoute;
