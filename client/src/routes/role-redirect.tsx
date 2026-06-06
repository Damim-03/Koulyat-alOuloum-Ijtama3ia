import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { Role } from "../types/enums";
import { PATHS } from "./paths";

export function RoleRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to={PATHS.login} replace />;

  switch (user.role) {
    case Role.PROFESSOR:
      return <Navigate to={PATHS.professor.root} replace />;
    case Role.STUDENT:
      return <Navigate to={PATHS.student.root} replace />;
    case Role.ADMIN:
    case Role.OWNER:
      return <Navigate to={PATHS.admin.root} replace />;
    default:
      return <Navigate to={PATHS.unauthorized} replace />;
  }
}
