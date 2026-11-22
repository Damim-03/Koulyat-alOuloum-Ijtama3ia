import { client } from "../../../lib/api/client";
import type { LoginResponse, LoginResult, MeResponse } from "../../../types/auth";
import type {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "../validation/auth.schema";

/** A proof-of-work challenge (signed by the server) with its picture. */
export interface ImageChallenge {
  parameters: Record<string, unknown>;
  signature: string;
  codeChallenge: { image: string; length?: number };
}

/** A registration number looked up on «نسيت كلمة المرور»: the link by email, the administration, or a suspended account. */
export type StudentLookup = { found: false } | { found: true; via: "email" | "admin" | "blocked" };

/** A request to the administration, as the browser that sent it sees it. */
export type PasswordRequestState =
  | { status: "none" }
  | { status: "pending"; sentAt: string }
  | { status: "rejected"; reason: string | null; decidedAt: string | null }
  | { status: "approved"; password: string; registrationNumber: string | null; decidedAt: string | null };

const bearer = (token?: string | null) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

export const authApi = {
  studentLogin: (data: StudentLoginDTO) =>
    client.post<LoginResponse>("/auth/student/login", data).then((r) => r.data),

  professorLogin: (data: ProfessorLoginDTO) =>
    client
      .post<LoginResponse>("/auth/professor/login", data)
      .then((r) => r.data),

  adminLogin: (data: AdminLoginDTO) =>
    client.post<LoginResult>("/auth/admin/login", data).then((r) => r.data),

  /** The second step: the ticket from the password, and the app's code (or a recovery code). */
  adminTwoFactor: (data: { challenge: string; code: string }) =>
    client.post<LoginResponse>("/auth/admin/login/2fa", data).then((r) => r.data),

  /**
   * The sign-in check at its picture level (Backend modules/auth/captcha): a
   * proof of work to solve, and the picture whose code is typed.
   */
  imageChallenge: () =>
    client
      .get<ImageChallenge>("/auth/challenge", { params: { level: "image" } })
      .then((r) => r.data),

  /** The solved work and the typed code. Right: a pass for one sign-in. */
  verifyImageCode: (payload: string, code: string) =>
    client
      .post<{ verified: boolean; payload?: string; reason?: string }>("/auth/challenge/verify", { payload, code })
      .then((r) => r.data),

  me: () => client.get<MeResponse>("/auth/me").then((r) => r.data),

  /* ── links sent by email (Backend modules/auth/email-links) ── */

  /** Whether "forgot my password" can work here: the server sends mail. */
  resetAvailable: () => client.get<{ available: boolean }>("/auth/password/available").then((r) => r.data.available),

  /** A registration number or an email; the answer is the same whether it exists or not. */
  forgotPassword: (identifier: string) =>
    client.post<{ message: string }>("/auth/password/forgot", { identifier }).then((r) => r.data),

  /** Whether the link in hand can still set a password. */
  checkReset: (token: string) =>
    client.post<{ valid: boolean }>("/auth/password/reset/check", { token }).then((r) => r.data.valid),

  resetPassword: (token: string, password: string) =>
    client.post<{ message: string }>("/auth/password/reset", { token, password }).then((r) => r.data),

  /** The link that proves an address — opened signed in or not. */
  verifyEmail: (token: string) => client.post<{ message: string }>("/auth/email/verify", { token }).then((r) => r.data),

  /* ── forgot my password, through the administration (Backend modules/password-request) ── */

  /** Whether a student has this number, and which way their password comes back — never their name. */
  lookupStudent: (registrationNumber: string) =>
    client.post<StudentLookup>("/auth/password/student", { registrationNumber }).then((r) => r.data),

  /**
   * The number and the card's photo (multipart: `registrationNumber`, `qrNumber`, `card`);
   * the answer's `token` is how this browser follows the request.
   */
  sendPasswordRequest: (form: FormData) =>
    client.post<{ token: string; status: "pending"; sentAt: string }>("/auth/password/request", form).then((r) => r.data),

  /** Where the request this browser sent stands — the token in the body, never the address. */
  passwordRequestStatus: (token: string) =>
    client.post<PasswordRequestState>("/auth/password/request/status", { token }).then((r) => r.data),

  /** Done with it: copied, read, or withdrawn. */
  closePasswordRequest: (token: string) =>
    client.post<{ status: "none" }>("/auth/password/request/close", { token }).then((r) => r.data),

  /**
   * Revokes this session only — other devices stay signed in. The token is
   * passed in, read before the store is cleared: interceptors run after the
   * caller's synchronous code, by which time the store is already empty.
   * The refresh cookie names the session too, and is cleared by the answer.
   */
  logout: (accessToken?: string | null) =>
    client
      .post<{ message: string }>("/auth/logout", {}, bearer(accessToken))
      .then((r) => r.data),

  /** Revokes every session on the account. For a lost device or a stolen token. */
  logoutAll: (accessToken?: string | null) =>
    client
      .post<{ message: string }>("/auth/logout-all", {}, bearer(accessToken))
      .then((r) => r.data),
};
