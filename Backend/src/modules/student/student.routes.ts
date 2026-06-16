import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { roleGuard } from "../../core/utils/roleGuard";
import { Permissions } from "../../core/enums/role.enum";
import {
  browseTopicsController,
  getTopicByIdController,
  lookupStudentController,
  createGroupRequestController,
  getMyGroupRequestsController,
  cancelGroupRequestController,
  getMyProjectController,
} from "./student.controller";

const studentRoutes = Router();

studentRoutes.use(authMiddleware);
studentRoutes.use(roleGuard([Permissions.LOGIN]));

//
// Browse published topics
//
studentRoutes.get(
  "/topics",
  roleGuard([Permissions.VIEW_TOPICS]),
  browseTopicsController,
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
  lookupStudentController,
);

//
// Group requests (assemble team + submit to admin)
//
studentRoutes.post(
  "/group-requests",
  roleGuard([Permissions.APPLY_TO_TOPIC]),
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
