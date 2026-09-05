import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { PATHS } from "../routes/paths";
import { authApi } from "../features/auth/api/auth.api";

export function useAuth() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logoutStore = useAuthStore((s) => s.logout);

  // Deliberately not awaited: signing out must feel instant and must still
  // happen if the request fails (offline, expired token, server down).
  const finishLogout = () => {
    logoutStore();
    navigate(PATHS.login, { replace: true });
  };

  /** Signs out here. Other devices on the account stay signed in. */
  const logout = () => {
    void authApi.logout().catch(() => undefined);
    finishLogout();
  };

  /** Signs out everywhere — for a lost device or a token believed stolen. */
  const logoutEverywhere = () => {
    void authApi.logoutAll().catch(() => undefined);
    finishLogout();
  };

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated,
    logout,
    logoutEverywhere,
  };
}
