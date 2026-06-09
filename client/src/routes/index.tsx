import { Routes, Route, Navigate } from "react-router-dom";
import { Role } from "../types/enums";
import { DEFAULT_LANG } from "../i18n/i18n";
import { LanguageLayout } from "../i18n/locales/components/language-layout";
import PublicLayout from "../components/layout/public-layout";
import { ProtectedRoute } from "./guards/protected-route";
import { RoleRoute } from "./guards/role-route";
import { PublicOnlyRoute } from "./guards/public-only-route";
import { RoleRedirect } from "./role-redirect";

import { LoginPage } from "../features/auth/pages/LoginPage";
import { UnauthorizedPage } from "../features/auth/pages/unauthorized-page";
import { HomePage } from "../features/home/pages/HomePage";

// Layouts (role-based)
import { ProfessorLayout } from "../components/layout/role-layouts/Professor-layout";
import { StudentLayout } from "../components/layout/role-layouts/Student-layout";
import { AdminLayout } from "../components/layout/role-layouts/Admin-layout";

// Professor pages
import { ProfessorDashboardPage } from "../features/professor/pages/dashboard.page";
import { ProfessorTopicsPage } from "../features/professor/pages/topics.page";
//import { ProfessorTopicDetailPage } from "../features/professor/pages/topic-detail.page";
import { ProfessorApplicationsPage } from "../features/professor/pages/applications.page";
import { ProfessorMilestonesPage } from "../features/professor/pages/milestones.page";

// Student pages
import { StudentDashboardPage } from "../features/student/pages/dashboard.page";
import { StudentBrowseTopicsPage } from "../features/student/pages/browse-topics.page";

// Admin pages
import { AdminDashboardPage } from "../features/admin/pages/dashboard.page";

export function AppRouter() {
  return (
    <Routes>
      {/* جميع المسارات تحت /:lang */}
      <Route path="/:lang" element={<LanguageLayout />}>
        {/* الصفحات العامة (مع Navbar + Footer) */}
        <Route element={<PublicLayout />}>
          {/* الصفحة الرئيسية */}
          <Route index element={<HomePage />} />

          {/* غير مصرح */}
          <Route path="403" element={<UnauthorizedPage />} />
        </Route>

        {/* تسجيل الدخول (بدون layout — تصميم خاص) */}
        <Route
          path="login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        {/* إعادة التوجيه حسب الدور */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <RoleRedirect />
            </ProtectedRoute>
          }
        />

        {/* ==================== PROFESSOR ==================== */}
        <Route
          path="professor"
          element={
            <ProtectedRoute>
              <RoleRoute roles={[Role.PROFESSOR]}>
                <ProfessorLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<ProfessorDashboardPage />} />
          <Route path="topics" element={<ProfessorTopicsPage />} />
          {/* <Route path="topics/:id" element={<ProfessorTopicDetailPage />} /> */}
          <Route path="applications" element={<ProfessorApplicationsPage />} />
          <Route path="milestones" element={<ProfessorMilestonesPage />} />
        </Route>

        {/* ==================== STUDENT ==================== */}
        <Route
          path="student"
          element={
            <ProtectedRoute>
              <RoleRoute roles={[Role.STUDENT]}>
                <StudentLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboardPage />} />
          <Route path="topics" element={<StudentBrowseTopicsPage />} />
        </Route>

        {/* ==================== ADMIN ==================== */}
        <Route
          path="admin"
          element={
            <ProtectedRoute>
              <RoleRoute roles={[Role.ADMIN, Role.OWNER]}>
                <AdminLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
        </Route>
      </Route>

      {/* أي رابط بدون لغة → اللغة الافتراضية */}
      <Route path="*" element={<Navigate to={`/${DEFAULT_LANG}`} replace />} />
    </Routes>
  );
}
