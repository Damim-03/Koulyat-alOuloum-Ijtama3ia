import { RoleType } from "../core/enums/role.enum";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: RoleType;
        /** Profile id: Student.id | Professor.id | User.id for admins. */
        refId: string;
      };
    }
  }
}

export {};
