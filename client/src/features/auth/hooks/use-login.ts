import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../store/auth.store";
import type { LoginRole } from "../../../types/enums";
import type { LoginResponse } from "../../..//types/auth";
import type { LoginDTO } from "../validation/auth.schema";

const services = {
  student: authApi.studentLogin,
  professor: authApi.professorLogin,
  admin: authApi.adminLogin,
} as const;

export function useLogin(role: LoginRole) {
  const login = useAuthStore((s) => s.login);

  return useMutation<LoginResponse, unknown, LoginDTO>({
    mutationFn: (data) =>
      (services[role] as (d: LoginDTO) => Promise<LoginResponse>)(data),
    onSuccess: (res) => {
      // The refresh token stays in its httpOnly cookie; only the short-lived
      // access token is kept, in memory.
      login(res.user, { accessToken: res.accessToken });
    },
  });
}
