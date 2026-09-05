import type { Gender, Role } from "./enums";

export interface AuthUser {
  id: string;
  role: Role | string;
  registrationNumber?: string;
  universityEmail?: string;
  email?: string;
  // profile fields — populated by GET /auth/me
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  /** Decides the default avatar when there is no photo. */
  gender?: Gender | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Shape returned by /auth/{student|professor|admin}/login
export interface LoginResponse extends AuthTokens {
  message: string;
  user: AuthUser;
}

// Shape returned by GET /auth/me
export interface MeResponse {
  user: AuthUser;
}
