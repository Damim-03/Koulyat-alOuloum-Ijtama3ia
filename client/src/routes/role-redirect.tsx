import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useLanguage } from "../hooks/use-language";
import { Role } from "../types/enums";
import { PATHS } from "./paths";

export function RoleRedirect() {
  const user = useAuthStore((s) => s.user);
  const { localePath } = useLanguage();
  if (!user) return <Navigate to={localePath(PATHS.login)} replace />;

  const role = String(user.role).toLowerCase();
  switch (role) {
    case Role.PROFESSOR:
      return <Navigate to={localePath(PATHS.professor.root)} replace />;
    case Role.STUDENT:
      return <Navigate to={localePath(PATHS.student.root)} replace />;
    case Role.ADMIN:
    case Role.OWNER:
      return <Navigate to={localePath(PATHS.admin.root)} replace />;
    default:
      return <Navigate to={localePath(PATHS.unauthorized)} replace />;
  }
}
