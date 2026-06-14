import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { useLanguage } from "../../hooks/use-language";
import type { Role } from "../../types/enums";
import { PATHS } from "../paths";

interface Props {
  roles: Role[];
  children: ReactNode;
}

export function RoleRoute({ roles, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const { localePath } = useLanguage();

  if (!user) return <Navigate to={localePath(PATHS.login)} replace />;

  const role = String(user.role).toLowerCase() as Role;
  if (!roles.includes(role)) {
    return <Navigate to={localePath(PATHS.unauthorized)} replace />;
  }
  return <>{children}</>;
}