import { RoleType } from "../core/enums/role.enum";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: RoleType;
      };
    }
  }
}

export {};
