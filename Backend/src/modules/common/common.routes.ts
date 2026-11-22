import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import {
  listFacultiesController,
  listDepartmentsController,
  listSpecializationsController,
  listAcademicYearsController,
} from "./common.controller";
import { listProfessorOptionsController, listTopicTypeOptionsController } from "./topic-lookups";
import { requireRole } from "../../core/utils/roleGuard";

const commonRoutes = Router();

// Any authenticated user (professor, student, admin) can read these
// lookups to populate dropdowns and filters.
commonRoutes.use(authMiddleware);

commonRoutes.get("/faculties", listFacultiesController);
commonRoutes.get("/departments", listDepartmentsController);
commonRoutes.get("/specializations", listSpecializationsController);
commonRoutes.get("/academic-years", listAcademicYearsController);
// What a topic form offers: the department's topic types, and the professors
// to pick a co-supervisor from — the latter for those who write topics only.
commonRoutes.get("/topic-types", listTopicTypeOptionsController);
commonRoutes.get("/professors", requireRole("professor", "admin"), listProfessorOptionsController);

export default commonRoutes;