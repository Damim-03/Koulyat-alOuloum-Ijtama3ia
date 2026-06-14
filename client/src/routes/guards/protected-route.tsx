import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { useLanguage } from "../../hooks/use-language";
import { PATHS } from "../paths";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { localePath } = useLanguage();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={localePath(PATHS.login)} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}