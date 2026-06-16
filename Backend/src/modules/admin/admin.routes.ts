import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { adminOrOwner, ownerOnly } from "../../core/utils/roleGuard";
import {
  // stats
  getOverviewStatsController,
  // users
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  updateUserStatusController,
  resetUserPasswordController,
  deleteUserController,
  // students
  listStudentsController,
  getStudentController,
  createStudentController,
  updateStudentController,
  deleteStudentController,
  // professors
  listProfessorsController,
  getProfessorController,
  createProfessorController,
  updateProfessorController,
  deleteProfessorController,
  // faculties
  listFacultiesController,
  createFacultyController,
  updateFacultyController,
  deleteFacultyController,
  // departments
  listDepartmentsController,
  createDepartmentController,
  updateDepartmentController,
  deleteDepartmentController,
  // specializations
  listSpecializationsController,
  createSpecializationController,
  updateSpecializationController,
  deleteSpecializationController,
  // academic years
  listAcademicYearsController,
  createAcademicYearController,
  updateAcademicYearController,
  activateAcademicYearController,
  deleteAcademicYearController,
  // topics
  listTopicsController,
  getTopicController,
  approveTopicController,
  rejectTopicController,
  archiveTopicController,
  // applications
  listApplicationsController,
  acceptApplicationController,
  rejectApplicationController,
  // projects
  listProjectsController,
  getProjectController,
  changeSupervisorController,
  assignStudentController,
  listGroupMilestonesController,
  // defenses
  listDefensesController,
  createDefenseController,
  updateDefenseController,
  deleteDefenseController,
} from "./admin.controller";

const adminRoutes = Router();

// All admin routes require auth + admin (or owner) role.
adminRoutes.use(authMiddleware);
adminRoutes.use(adminOrOwner());

//
// ─── STATS ────────────────────────────────────────────────────
//
adminRoutes.get("/stats/overview", getOverviewStatsController);

//
// ─── USERS ────────────────────────────────────────────────────
//
adminRoutes.get("/users", listUsersController);
adminRoutes.get("/users/:id", getUserController);
adminRoutes.post("/users", createUserController);
adminRoutes.patch("/users/:id", updateUserController);
adminRoutes.patch("/users/:id/status", updateUserStatusController);
adminRoutes.post("/users/:id/reset-password", resetUserPasswordController);
adminRoutes.delete("/users/:id", ownerOnly(), deleteUserController);

//
// ─── STUDENTS ─────────────────────────────────────────────────
//
adminRoutes.get("/students", listStudentsController);
adminRoutes.get("/students/:id", getStudentController);
adminRoutes.post("/students", createStudentController);
adminRoutes.patch("/students/:id", updateStudentController);
adminRoutes.delete("/students/:id", ownerOnly(), deleteStudentController);

//
// ─── PROFESSORS ───────────────────────────────────────────────
//
adminRoutes.get("/professors", listProfessorsController);
adminRoutes.get("/professors/:id", getProfessorController);
adminRoutes.post("/professors", createProfessorController);
adminRoutes.patch("/professors/:id", updateProfessorController);
adminRoutes.delete("/professors/:id", ownerOnly(), deleteProfessorController);

//
// ─── FACULTIES ────────────────────────────────────────────────
//
adminRoutes.get("/faculties", listFacultiesController);
adminRoutes.post("/faculties", createFacultyController);
adminRoutes.patch("/faculties/:id", updateFacultyController);
adminRoutes.delete("/faculties/:id", deleteFacultyController);

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//
adminRoutes.get("/departments", listDepartmentsController);
adminRoutes.post("/departments", createDepartmentController);
adminRoutes.patch("/departments/:id", updateDepartmentController);
adminRoutes.delete("/departments/:id", deleteDepartmentController);

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//
adminRoutes.get("/specializations", listSpecializationsController);
adminRoutes.post("/specializations", createSpecializationController);
adminRoutes.patch("/specializations/:id", updateSpecializationController);
adminRoutes.delete("/specializations/:id", deleteSpecializationController);

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//
adminRoutes.get("/academic-years", listAcademicYearsController);
adminRoutes.post("/academic-years", createAcademicYearController);
adminRoutes.patch("/academic-years/:id", updateAcademicYearController);
adminRoutes.patch(
  "/academic-years/:id/activate",
  activateAcademicYearController,
);
adminRoutes.delete("/academic-years/:id", deleteAcademicYearController);

//
// ─── TOPICS ───────────────────────────────────────────────────
//
adminRoutes.get("/topics", listTopicsController);
adminRoutes.get("/topics/:id", getTopicController);
adminRoutes.patch("/topics/:id/approve", approveTopicController);
adminRoutes.patch("/topics/:id/reject", rejectTopicController);
adminRoutes.patch("/topics/:id/archive", archiveTopicController);

//
// ─── APPLICATIONS ─────────────────────────────────────────────
//
adminRoutes.get("/applications", listApplicationsController);
adminRoutes.patch("/applications/:id/accept", acceptApplicationController);
adminRoutes.patch("/applications/:id/reject", rejectApplicationController);

//
// ─── PROJECTS ─────────────────────────────────────────────────
//
adminRoutes.get("/projects", listProjectsController);
adminRoutes.get("/projects/:id", getProjectController);
adminRoutes.patch("/projects/:id/supervisor", changeSupervisorController);
adminRoutes.post("/projects/:id/assign", assignStudentController);
adminRoutes.get("/projects/:groupId/milestones", listGroupMilestonesController);

//
// ─── DEFENSES ─────────────────────────────────────────────────
//
adminRoutes.get("/defenses", listDefensesController);
adminRoutes.post("/defenses", createDefenseController);
adminRoutes.patch("/defenses/:id", updateDefenseController);
adminRoutes.delete("/defenses/:id", deleteDefenseController);

export default adminRoutes;
