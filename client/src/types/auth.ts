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
  /** The name in Latin script — what French and English show. */
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
  avatarUrl?: string;
  /** Decides the default avatar when there is no photo. */
  gender?: Gender | null;
}

export interface AuthTokens {
  accessToken: string;
  /** Sent for non-browser clients; the web app relies on the httpOnly cookie. */
  refreshToken?: string;
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
