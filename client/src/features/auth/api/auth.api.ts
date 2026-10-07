import { client } from "../../../lib/api/client";
import type { LoginResponse, MeResponse } from "../../../types/auth";
import type {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "../validation/auth.schema";

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
    client.post<LoginResponse>("/auth/admin/login", data).then((r) => r.data),

  me: () => client.get<MeResponse>("/auth/me").then((r) => r.data),

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
