import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import professorRoutes from "../modules/professor/professor.routes";
import adminRoutes from "../modules/admin/admin.routes";
import commonRoutes from "../modules/common/common.routes";
import studentRoutes from "../modules/student/student.routes";
import publicRoutes from "../modules/public/public.routes";
import messagesRoutes from "../modules/messages/messages.routes";
import accountRoutes from "../modules/account/account.routes";
import siteRoutes from "../modules/site/site.routes";
import supervisionRoutes, {
  verifyRoutes,
} from "../modules/supervision/supervision.routes";
import { realtimeBroadcast } from "../core/middleware/realtime.middleware";

const mainRoute: Router = Router();

// Every successful write announces itself to connected clients.
mainRoute.use(realtimeBroadcast);

mainRoute.use("/auth", authRoutes);

mainRoute.use("/messages", messagesRoutes);

// The signed-in person's own account, for every role.
mainRoute.use("/account", accountRoutes);

mainRoute.use("/admin", adminRoutes);

mainRoute.use("/professor", professorRoutes);

mainRoute.use("/student", studentRoutes);

mainRoute.use("/common", commonRoutes);

mainRoute.use("/public", publicRoutes);

// واجهة الموقع للزائر — بلا تسجيل دخول، انظر `siteRoutes`.
mainRoute.use("/site", siteRoutes);

mainRoute.use("/supervision-documents", supervisionRoutes);

// التحقّق من ورقةٍ مطبوعة: عامٌّ بلا تسجيل دخول — انظر `verifyRoutes`.
mainRoute.use("/verify", verifyRoutes);

export default mainRoute;
