import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { roleGuard, requireRole } from "../../core/utils/roleGuard";
import { Permissions } from "../../core/enums/role.enum";
import { lookupLimiter, writeLimiter } from "../../core/middleware/rateLimit.middleware";
import { auditBefore, auditWrites } from "../../core/audit/audit";
import {
  browseTopicsController,
  getTopicByIdController,
  lookupStudentController,
  createGroupRequestController,
  getMyGroupRequestsController,
  cancelGroupRequestController,
  getMyProjectController,
  getStudentDashboardController,
  selectionWindowController,
} from "./student.controller";

const studentRoutes = Router();

studentRoutes.use(authMiddleware);
studentRoutes.use(requireRole("student"));
// What a student changes — their group requests — is in the audit log (core/audit).
studentRoutes.use(auditWrites);
studentRoutes.param("id", auditBefore);

//
// Dashboard — one read for the whole first screen
//
studentRoutes.get(
  "/dashboard",
  roleGuard([Permissions.VIEW_OWN_APPLICATIONS]),
  getStudentDashboardController,
);

//
// Browse published topics
//
studentRoutes.get(
  "/topics",
  roleGuard([Permissions.VIEW_TOPICS]),
  browseTopicsController,
);
// The deadline to choose topics for the student's year (core/academic/selection-window).
studentRoutes.get(
  "/selection-window",
  roleGuard([Permissions.VIEW_TOPICS]),
  selectionWindowController,
);
studentRoutes.get(
  "/topics/:id",
  roleGuard([Permissions.VIEW_TOPICS]),
  getTopicByIdController,
);

//
// Student lookup (live teammate search by registration number)
//
studentRoutes.get(
  "/students/lookup",
  roleGuard([Permissions.APPLY_TO_TOPIC]),
  lookupLimiter,
  lookupStudentController,
);

//
// Group requests (assemble team + submit to admin)
//
studentRoutes.post(
  "/group-requests",
  roleGuard([Permissions.APPLY_TO_TOPIC]),
  writeLimiter,
  createGroupRequestController,
);
studentRoutes.get(
  "/group-requests",
  roleGuard([Permissions.VIEW_OWN_APPLICATIONS]),
  getMyGroupRequestsController,
);
studentRoutes.delete(
  "/group-requests/:id",
  roleGuard([Permissions.CANCEL_APPLICATION]),
  cancelGroupRequestController,
);

//
// My project (after acceptance)
//
studentRoutes.get(
  "/my-project",
  roleGuard([Permissions.VIEW_PROJECT]),
  getMyProjectController,
);

export default studentRoutes;
