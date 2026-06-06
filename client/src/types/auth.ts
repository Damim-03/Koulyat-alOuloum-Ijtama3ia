import type { Role } from "./enums";

export interface AuthUser {
  id: string;
  role: Role | string;
  registrationNumber?: string;
  universityEmail?: string;
  email?: string;
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