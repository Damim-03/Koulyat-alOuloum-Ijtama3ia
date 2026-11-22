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
  /**
   * What the account must do before anything else (see AccountSetupGate):
   * replace a password the administration handed out; for an administrator,
   * set up two-step verification.
   */
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSetupRequired?: boolean;
  /**
   * A student with the handed-out password, while activation is on: the
   * setup screen goes in two stages — a password of their own, then the
   * photos that verify the account, which they may skip.
   */
  activationRequired?: boolean;
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

/**
 * An administrator with two-step verification: the password earns this
 * five-minute ticket, which the code from the app turns into a session
 * (POST /auth/admin/login/2fa).
 */
export interface TwoFactorChallenge {
  message: string;
  twoFactorRequired: true;
  challenge: string;
}

export type LoginResult = LoginResponse | TwoFactorChallenge;

export const needsSecondStep = (r: LoginResult): r is TwoFactorChallenge =>
  "twoFactorRequired" in r && r.twoFactorRequired === true;

// Shape returned by GET /auth/me
export interface MeResponse {
  user: AuthUser;
}
