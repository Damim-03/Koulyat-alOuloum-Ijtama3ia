import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import {
  listFacultiesController,
  listDepartmentsController,
  listSpecializationsController,
  listAcademicYearsController,
} from "./common.controller";

const commonRoutes = Router();

// Any authenticated user (professor, student, admin) can read these
// lookups to populate dropdowns and filters.
commonRoutes.use(authMiddleware);

commonRoutes.get("/faculties", listFacultiesController);
commonRoutes.get("/departments", listDepartmentsController);
commonRoutes.get("/specializations", listSpecializationsController);
commonRoutes.get("/academic-years", listAcademicYearsController);

export default commonRoutes;