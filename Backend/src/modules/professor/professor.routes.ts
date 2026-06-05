import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { roleGuard } from "../../core/utils/roleGuard";
import { Permissions } from "../../core/enums/role.enum";
import {
  createTopicController,
  getMyTopicsController,
  getTopicByIdController,
  updateTopicController,
  deleteTopicController,
  getApplicationsController,
  acceptApplicationController,
  rejectApplicationController,
  getMyGroupsController,
  getGroupByIdController,
  createMilestoneController,
  getMilestonesController,
  updateMilestoneController,
  deleteMilestoneController,
} from "./professor.controller";

const professorRoutes = Router();

professorRoutes.use(authMiddleware);
professorRoutes.use(roleGuard([Permissions.LOGIN]));

//
// Topics
//
professorRoutes.post(
  "/topics",
  roleGuard([Permissions.CREATE_TOPICS]),
  createTopicController
);

professorRoutes.get(
  "/topics",
  roleGuard([Permissions.VIEW_TOPICS]),
  getMyTopicsController
);

professorRoutes.get(
  "/topics/:id",
  roleGuard([Permissions.VIEW_TOPICS]),
  getTopicByIdController
);

professorRoutes.put(
  "/topics/:id",
  roleGuard([Permissions.UPDATE_OWN_TOPICS]),
  updateTopicController
);

professorRoutes.delete(
  "/topics/:id",
  roleGuard([Permissions.DELETE_OWN_TOPICS]),
  deleteTopicController
);

//
// Applications
//
professorRoutes.get(
  "/applications",
  roleGuard([Permissions.VIEW_TOPIC_APPLICATIONS]),
  getApplicationsController
);

professorRoutes.patch(
  "/applications/:id/accept",
  roleGuard([Permissions.ACCEPT_APPLICATIONS]),
  acceptApplicationController
);

professorRoutes.patch(
  "/applications/:id/reject",
  roleGuard([Permissions.REJECT_APPLICATIONS]),
  rejectApplicationController
);

//
// Project Groups
//
professorRoutes.get(
  "/groups",
  roleGuard([Permissions.VIEW_GROUPS]),
  getMyGroupsController
);

professorRoutes.get(
  "/groups/:groupId",
  roleGuard([Permissions.VIEW_GROUPS]),
  getGroupByIdController
);

//
// Milestones
//
professorRoutes.post(
  "/groups/:groupId/milestones",
  roleGuard([Permissions.CREATE_MILESTONES]),
  createMilestoneController
);

professorRoutes.get(
  "/groups/:groupId/milestones",
  roleGuard([Permissions.VIEW_MILESTONES]),
  getMilestonesController
);

professorRoutes.put(
  "/milestones/:id",
  roleGuard([Permissions.UPDATE_MILESTONES]),
  updateMilestoneController
);

professorRoutes.delete(
  "/milestones/:id",
  roleGuard([Permissions.DELETE_MILESTONES]),
  deleteMilestoneController
);

export default professorRoutes;