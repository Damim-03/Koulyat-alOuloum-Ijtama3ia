import { Router } from "express";
import {
  listPublicTopicsController,
  getPublicTopicController,
  listPublicSpecializationsController,
  listPublicDepartmentsController,
} from "./public.controller";

// ⚠️ تحقّق فقط من اسم ملفّ الميدل-وير: استورد authMiddleware من حيث يستورده
//    admin/professor (غالبًا auth.middleware.ts داخل core/middleware).
import { authMiddleware } from "../../core/middleware/auth.middleware";

// These endpoints now REQUIRE a valid access token. An unauthenticated request
// gets 401 and never receives any topic/department data — so nothing leaks in
// the browser's Network tab for visitors. (Topics are members-only.)
const publicRoutes = Router();

// Apply auth to every route in this module.
publicRoutes.use(authMiddleware);

publicRoutes.get("/topics", listPublicTopicsController);
publicRoutes.get("/topics/:id", getPublicTopicController);
publicRoutes.get("/departments", listPublicDepartmentsController);
publicRoutes.get("/specializations", listPublicSpecializationsController);

export default publicRoutes;
