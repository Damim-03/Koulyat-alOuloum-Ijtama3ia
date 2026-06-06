import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { PATHS } from "../routes/paths";

export function useAuth() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logoutStore = useAuthStore((s) => s.logout);

  const logout = () => {
    logoutStore();
    navigate(PATHS.login, { replace: true });
  };

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated,
    logout,
  };
}