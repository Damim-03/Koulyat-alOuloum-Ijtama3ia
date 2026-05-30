import { RoleType } from "../../core/enums/role.enum";

export interface JwtPayload {
  userId: string; // always the User.id
  role: RoleType;
  refId: string; // studentId | professorId | userId (admin)
}
