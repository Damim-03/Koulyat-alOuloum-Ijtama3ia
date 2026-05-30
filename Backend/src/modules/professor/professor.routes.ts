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

export default professorRoutes;