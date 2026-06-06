import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import type { Role } from "../../types/enums";
import { PATHS } from "../paths";

interface Props {
  roles: Role[];
  children: ReactNode;
}

export function RoleRoute({ roles, children }: Props) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to={PATHS.login} replace />;
  if (!roles.includes(user.role as Role)) {
    return <Navigate to={PATHS.unauthorized} replace />;
  }
  return <>{children}</>;
}