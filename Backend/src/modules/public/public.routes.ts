import { Router } from "express";
import {
  listPublicTopicsController,
  getPublicTopicController,
  listPublicSpecializationsController,
  listPublicDepartmentsController,
} from "./public.controller";

// NO auth middleware here — these endpoints are intentionally public so the
// landing page can list published topics to visitors before they log in.
const publicRoutes = Router();

publicRoutes.get("/topics", listPublicTopicsController);
publicRoutes.get("/topics/:id", getPublicTopicController);
publicRoutes.get("/departments", listPublicDepartmentsController);
publicRoutes.get("/specializations", listPublicSpecializationsController);

export default publicRoutes;
