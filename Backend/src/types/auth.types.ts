import { RoleType } from "../core/enums/role.enum";

export interface JwtPayload {
  userId: string;
  role: RoleType;
  refId: string;
}