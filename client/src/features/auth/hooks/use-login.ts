import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../store/auth.store";
import type { LoginRole } from "../../../types/enums";
import { needsSecondStep, type LoginResult } from "../../../types/auth";
import type { LoginDTO } from "../validation/auth.schema";

const services = {
  student: authApi.studentLogin,
  professor: authApi.professorLogin,
  admin: authApi.adminLogin,
} as const;

export function useLogin(role: LoginRole) {
  const login = useAuthStore((s) => s.login);

  return useMutation<LoginResult, unknown, LoginDTO>({
    mutationFn: (data) =>
      (services[role] as (d: LoginDTO) => Promise<LoginResult>)(data),
    onSuccess: (res) => {
      // An administrator with two-step verification is not in yet: the form
      // asks for the code (see TwoFactorStep).
      if (needsSecondStep(res)) return;
      // The refresh token stays in its httpOnly cookie; only the short-lived
      // access token is kept, in memory.
      login(res.user, { accessToken: res.accessToken });
    },
  });
}

/** The code from the authenticator app, for the ticket the password earned. */
export function useTwoFactorLogin() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: authApi.adminTwoFactor,
    onSuccess: (res) => login(res.user, { accessToken: res.accessToken }),
  });
}
