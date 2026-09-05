import { Routes, Route, Navigate } from "react-router-dom";
import { Role } from "../types/enums";
import { DEFAULT_LANG, SUPPORTED_LANGS, type LangCode } from "../i18n/i18n";
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
import { ProfessorDashboardPage } from "../features/professor/pages/Professor-dashboard.page";
import { ProfessorTopicsPage } from "../features/professor/pages/topics.page";
import { ProfessorTopicDetailPage } from "../features/professor/pages/topic-detail.page";
import { ProfessorProjectsPage } from "../features/professor/pages/Professor-projects.page";
import { ProfessorProjectDetailPage } from "../features/professor/pages/project-detail.page";

// Student pages
import { StudentDashboardPage } from "../features/student/pages/dashboard.page";
import { StudentBrowseTopicsPage } from "../features/student/pages/browse-topics.page";

// Admin pages
import { AdminStudentsPage } from "../features/admin/pages/students/student.page";
import { AdminUsersPage } from "../features/admin/pages/users/Users.page";
import { AdminProfessorsPage } from "../features/admin/pages/professors/professors.page";
import { AdminAcademicStructurePage } from "../features/admin/pages/academic/academic.page";
import { AdminTopicsPage } from "../features/admin/pages/topics/topics.page";
import { AdminDefensesPage } from "../features/admin/pages/defenses/defenses.page";
import { AdminFacultiesPage } from "../features/admin/pages/faculties/faculties.page";
import { ProfessorMilestonesPage } from "../features/professor/pages/Professor-milestones.page";
import { StudentMyRequestsPage } from "../features/student/pages/my-requests.page";
import { StudentMyProjectPage } from "../features/student/pages/my-project.page";
import { StudentTopicDetailPage } from "../features/student/pages/topic-detail.page";
import { AdminTopicDetailPage } from "../features/admin/pages/topics/topic-detail.page";
import { PublicTopicDetailPage } from "../features/public/pages/public-topic-detail.page";
import { PublicTopicsPage } from "../features/public/pages/public-topics.page";
import { AdminUserDetailPage } from "../features/admin/pages/users/user-detail.page";
import { AdminStudentDetailPage } from "../features/admin/pages/students/student-detail.page";
import { FacultyDetailPage } from "../features/admin/pages/faculties/faculty-detail.page";
import { DomainDetailPage } from "../features/admin/pages/domain/domain-detail.page";
//import { DepartmentDetailPage } from "../features/admin/pages/DepartmentDetailPage";
import { FiliereDetailPage } from "../features/admin/pages/filters/filter-detail.page";
import { DepartmentDetailPage } from "../features/admin/pages/departments/department-detail.page";
import { AdminUnassignedStudentsPage } from "../features/admin/pages/filters/unassigned-students.page";
import { AdminArchivePage } from "../features/admin/pages/archive/archive.Page";
import { AdminDashboardPage } from "../features/admin/pages/dashboard/dashboard.page";
import { SpecializationDetailPage } from "../features/admin/pages/filters/specialization-detail.Page";
import { AdminGroupRequestDetailPage } from "../features/admin/pages/groups/group-requests-details.page";
import { AdminGroupRequestsPage } from "../features/admin/pages/groups/group-requests.page";
import { AdminProfessorDetailPage } from "../features/admin/pages/professors/professor-detail-page";
import { AdminProjectsPage } from "../features/admin/pages/projects/projects.page";
import { AdminProjectDetailPage } from "../features/admin/pages/projects/project-detail.page";
import {AdminMessagesPage} from "../features/admin/pages/messages/messages.page.tsx";

export function AppRouter() {
  return (
    <Routes>
      {/* جميع المسارات تحت /:lang */}
      <Route path="/:lang" element={<LanguageLayout />}>
        {/* الصفحات العامة (مع Navbar + Footer) */}
        <Route element={<PublicLayout />}>
          {/* الصفحة الرئيسية */}
          <Route index element={<HomePage />} />
          <Route path="topics" element={<PublicTopicsPage />} /> {/* ← */}
          <Route path="topics/:id" element={<PublicTopicDetailPage />} />{" "}
          {/* ← */}
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
              <RoleRoute roles={[Role.PROFESSOR, Role.OWNER]}>
                <ProfessorLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<ProfessorDashboardPage />} />
          <Route path="topics" element={<ProfessorTopicsPage />} />
          <Route path="topics/:id" element={<ProfessorTopicDetailPage />} />
          {/* طلبات الالتحاق انتقل قرارها إلى الإدارة — أُزيل مسار الأستاذ */}
          <Route path="milestones" element={<ProfessorMilestonesPage />} />
          <Route path="groups" element={<ProfessorProjectsPage />} />
          <Route
            path="groups/:groupId"
            element={<ProfessorProjectDetailPage />}
          />
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
          <Route path="topics/:id" element={<StudentTopicDetailPage />} />
          <Route path="requests" element={<StudentMyRequestsPage />} />
          <Route path="project" element={<StudentMyProjectPage />} />
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
          <Route path="students" element={<AdminStudentsPage />} />
          <Route path="students/:id" element={<AdminStudentDetailPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="professors" element={<AdminProfessorsPage />} />
          <Route path="professors/:id" element={<AdminProfessorDetailPage />} />
          <Route
            path="specializations"
            element={<AdminAcademicStructurePage />}
          />
          <Route path="topics" element={<AdminTopicsPage />} />
          <Route path="topics/:id" element={<AdminTopicDetailPage />} />
          <Route path="group-requests" element={<AdminGroupRequestsPage />} />
          <Route
            path="group-requests/:id"
            element={<AdminGroupRequestDetailPage />}
          />
          <Route path="defenses" element={<AdminDefensesPage />} />
          <Route path="projects" element={<AdminProjectsPage />} />
          <Route
            path="projects/:id"
            element={<AdminProjectDetailPage />}
          />
          <Route path="academic-years" element={<AdminArchivePage />} />
          <Route
            path="specializations/:specializationId"
            element={<SpecializationDetailPage />}
          />
          <Route path="faculties" element={<AdminFacultiesPage />} />
          <Route path="faculties/:facultyId" element={<FacultyDetailPage />} />
          <Route
            path="faculties/:facultyId/departments/:departmentId"
            element={<DepartmentDetailPage />}
          />
          <Route
            path="faculties/:facultyId/departments/:departmentId/domains/:domainId"
            element={<DomainDetailPage />}
          />
          <Route
            path="faculties/:facultyId/departments/:departmentId/domains/:domainId/filieres/:filiereId"
            element={<FiliereDetailPage />}
          />
          <Route
            path="students/unassigned"
            element={<AdminUnassignedStudentsPage />}
          />
          <Route path="messages" element={<AdminMessagesPage />} />
        </Route>
      </Route>

      {/* Unknown link → home, in the language the visitor was already using. */}
      <Route path="*" element={<UnknownRouteRedirect />} />
    </Routes>
  );
}

/**
 * Sends an unmatched URL to the home page — keeping the language prefix when
 * the URL carries a supported one, so a wrong link never switches the visitor
 * back to the default language.
 */
function UnknownRouteRedirect() {
  const first = window.location.pathname.split("/").filter(Boolean)[0];
  const lang = SUPPORTED_LANGS.includes(first as LangCode)
    ? (first as LangCode)
    : DEFAULT_LANG;
  return <Navigate to={`/${lang}`} replace />;
}
