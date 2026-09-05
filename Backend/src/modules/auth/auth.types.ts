import { RoleType } from "../../core/enums/role.enum";

export interface JwtPayload {
  userId: string; // always the User.id
  role: RoleType;
  refId: string; // studentId | professorId | userId (admin)
  /** User.tokenVersion at issue time; a mismatch revokes the whole account. */
  tokenVersion: number;
  /** One id per sign-in, so a single session can be signed out on its own. */
  sid?: string;
}
