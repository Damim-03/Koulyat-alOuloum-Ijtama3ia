import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { useLanguage } from "../../hooks/use-language";
import { PATHS } from "../paths";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { localePath } = useLanguage();
  if (isAuthenticated)
    return <Navigate to={localePath(PATHS.dashboard)} replace />;
  return <>{children}</>;
}
