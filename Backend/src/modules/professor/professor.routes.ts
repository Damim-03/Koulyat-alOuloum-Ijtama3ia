import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { roleGuard, requireRole } from "../../core/utils/roleGuard";
import { Permissions } from "../../core/enums/role.enum";
import { writeLimiter } from "../../core/middleware/rateLimit.middleware";
import { auditBefore, auditWrites } from "../../core/audit/audit";
import {
  createTopicController,
  createTopicWithGroupController,
  searchStudentsController,
  topicQuotaController,
  getMyTopicsController,
  getTopicByIdController,
  updateTopicController,
  deleteTopicController,
  getMyGroupsController,
  getGroupByIdController,
  createMilestoneController,
  getMilestonesController,
  updateMilestoneController,
  deleteMilestoneController,
  getDashboardController,
} from "./professor.controller";

const professorRoutes = Router();

professorRoutes.use(authMiddleware);
professorRoutes.use(requireRole("professor"));
// What a professor changes — topics, milestones — is in the audit log (core/audit).
professorRoutes.use(auditWrites);
professorRoutes.param("id", auditBefore);

//
// Dashboard — one read for the whole first screen
//
professorRoutes.get(
  "/dashboard",
  roleGuard([Permissions.VIEW_SUPERVISED_PROJECTS]),
  getDashboardController,
);

//
// Topics
//
professorRoutes.post(
  "/topics",
  roleGuard([Permissions.CREATE_TOPICS]),
  writeLimiter,
  createTopicController,
);

// How many topics he may still send for a year — the administration's limit and his count.
professorRoutes.get(
  "/topic-quota",
  roleGuard([Permissions.CREATE_TOPICS]),
  topicQuotaController,
);

// Naming the students for a proposed team. A search, not a listing —
// see searchStudentsService.
professorRoutes.get(
  "/students/search",
  roleGuard([Permissions.CREATE_TOPICS]),
  searchStudentsController,
);

// A topic proposed together with its team. Still needs approval — see
// createTopicWithGroupService.
professorRoutes.post(
  "/topics/with-group",
  roleGuard([Permissions.CREATE_TOPICS]),
  writeLimiter,
  createTopicWithGroupController,
);

professorRoutes.get(
  "/topics",
  roleGuard([Permissions.VIEW_TOPICS]),
  getMyTopicsController,
);

professorRoutes.get(
  "/topics/:id",
  roleGuard([Permissions.VIEW_TOPICS]),
  getTopicByIdController,
);

professorRoutes.put(
  "/topics/:id",
  roleGuard([Permissions.UPDATE_OWN_TOPICS]),
  updateTopicController,
);

professorRoutes.delete(
  "/topics/:id",
  roleGuard([Permissions.DELETE_OWN_TOPICS]),
  deleteTopicController,
);

//
// Project Groups
//
professorRoutes.get(
  "/groups",
  roleGuard([Permissions.VIEW_GROUPS]),
  getMyGroupsController,
);

professorRoutes.get(
  "/groups/:groupId",
  roleGuard([Permissions.VIEW_GROUPS]),
  getGroupByIdController,
);

//
// Milestones
//
professorRoutes.post(
  "/groups/:groupId/milestones",
  roleGuard([Permissions.CREATE_MILESTONES]),
  createMilestoneController,
);

professorRoutes.get(
  "/groups/:groupId/milestones",
  roleGuard([Permissions.VIEW_MILESTONES]),
  getMilestonesController,
);

professorRoutes.put(
  "/milestones/:id",
  roleGuard([Permissions.UPDATE_MILESTONES]),
  updateMilestoneController,
);

professorRoutes.delete(
  "/milestones/:id",
  roleGuard([Permissions.DELETE_MILESTONES]),
  deleteMilestoneController,
);

export default professorRoutes;
