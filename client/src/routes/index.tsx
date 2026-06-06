import { Routes, Route, Navigate } from "react-router-dom";
import { Role } from "../types/enums";
import { PATHS } from "./paths";
import { ProtectedRoute } from "./guards/protected-route";
import { RoleRoute } from "./guards/role-route";
import { PublicOnlyRoute } from "./guards/public-only-route";
import { RoleRedirect } from "./role-redirect";

import { LoginPage } from "../features/auth/pages/LoginPage";
import { UnauthorizedPage } from "../features/auth/pages/unauthorized-page";
import { ProfessorDashboardPage } from "../features/professor/pages/dashboard.page";
import { StudentDashboardPage } from "../features/student/pages/dashboard.page";
import { AdminDashboardPage } from "../features/admin/pages/dashboard.page";

export function AppRouter() {
  return (
    <Routes>
      {/* public */}
      <Route
        path={PATHS.login}
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route path={PATHS.unauthorized} element={<UnauthorizedPage />} />

      {/* "/" -> role-appropriate home */}
      <Route
        path={PATHS.home}
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

      {/* professor */}
      <Route
        path={`${PATHS.professor.root}/*`}
        element={
          <ProtectedRoute>
            <RoleRoute roles={[Role.PROFESSOR]}>
              <ProfessorDashboardPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* student */}
      <Route
        path={`${PATHS.student.root}/*`}
        element={
          <ProtectedRoute>
            <RoleRoute roles={[Role.STUDENT]}>
              <StudentDashboardPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* admin / owner */}
      <Route
        path={`${PATHS.admin.root}/*`}
        element={
          <ProtectedRoute>
            <RoleRoute roles={[Role.ADMIN, Role.OWNER]}>
              <AdminDashboardPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to={PATHS.home} replace />} />
    </Routes>
  );
}
