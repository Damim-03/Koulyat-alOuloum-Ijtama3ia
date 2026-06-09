import { client } from "../../../lib/api/client";
import type { LoginResponse, MeResponse } from "../../../types/auth";
import type {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "../validation/auth.schema";

export const authApi = {
  studentLogin: (data: StudentLoginDTO) =>
    client.post<LoginResponse>("/auth/student/login", data).then((r) => r.data),

  professorLogin: (data: ProfessorLoginDTO) =>
    client
      .post<LoginResponse>("/auth/professor/login", data)
      .then((r) => r.data),

  adminLogin: (data: AdminLoginDTO) =>
    client.post<LoginResponse>("/auth/admin/login", data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    client
      .post<{ accessToken: string }>("/auth/refresh", { refreshToken })
      .then((r) => r.data),

  me: () => client.get<MeResponse>("/auth/me").then((r) => r.data),
};
