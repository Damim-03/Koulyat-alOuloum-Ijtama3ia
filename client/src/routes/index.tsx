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
import { ProfessorDashboardPage } from "../features/professor/pages/Professor-dashboard.page";
import { ProfessorTopicsPage } from "../features/professor/pages/topics.page";
import { ProfessorTopicDetailPage } from "../features/professor/pages/topic-detail.page";
import { ProfessorProjectsPage } from "../features/professor/pages/Professor-projects.page";
import { ProfessorProjectDetailPage } from "../features/professor/pages/project-detail.page";

// Student pages
import { StudentDashboardPage } from "../features/student/pages/dashboard.page";
import { StudentBrowseTopicsPage } from "../features/student/pages/browse-topics.page";

// Admin pages
import { AdminDashboardPage } from "../features/admin/pages/dashboard.page";
import { AdminStudentsPage } from "../features/admin/pages/Student.page";
import { AdminUsersPage } from "../features/admin/pages/Users.page";
import { AdminProfessorsPage } from "../features/admin/pages/professors.page";
import { AdminAcademicStructurePage } from "../features/admin/pages/academic.page";
import { AdminTopicsPage } from "../features/admin/pages/topics.page";
import { AdminDefensesPage } from "../features/admin/pages/defenses.page";
import { AdminApplicationsPage } from "../features/admin/pages/applications.page";
import { AdminFacultiesPage } from "../features/admin/pages/faculties.page";
import { AdminProjectsPage } from "../features/admin/pages/projects.page";
import { ProfessorMilestonesPage } from "../features/professor/pages/Professor-milestones.page";
import { StudentMyRequestsPage } from "../features/student/pages/my-requests.page";
import { StudentMyProjectPage } from "../features/student/pages/my-project.page";
import { StudentTopicDetailPage } from "../features/student/pages/topic-detail.page";
import { AdminTopicDetailPage } from "../features/admin/pages/topic-detail.page";
import { AdminGroupRequestsPage } from "../features/admin/pages/group-requests.page";
import { PublicTopicDetailPage } from "../features/public/pages/public-topic-detail.page";
import { PublicTopicsPage } from "../features/public/pages/public-topics.page";
import { AdminUserDetailPage } from "../features/admin/pages/user-detail.page";
import { AdminStudentDetailPage } from "../features/admin/pages/student-detail.page";
import { AdminProfessorDetailPage } from "../features/admin/pages/professor-detail-page";
import { FacultyDetailPage } from "../features/admin/pages/FacultyDetailPage";
import { DomainDetailPage } from "../features/admin/pages/DomainDetailPage";
//import { DepartmentDetailPage } from "../features/admin/pages/DepartmentDetailPage";
import { FiliereDetailPage } from "../features/admin/pages/FiliereDetailPage";
import { DepartmentDetailPage } from "../features/admin/pages/DepartmentDetailPage";
import { SpecializationDetailPage } from "../features/admin/pages/SpecializationDetailPage";
import { AdminArchivePage } from "../features/admin/pages/AdminArchivePage";
import { AdminUnassignedStudentsPage } from "../features/admin/pages/unassigned-students.page";

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
          <Route path="defenses" element={<AdminDefensesPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="projects" element={<AdminProjectsPage />} />
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
        </Route>
      </Route>

      {/* أي رابط بدون لغة → اللغة الافتراضية */}
      <Route path="*" element={<Navigate to={`/${DEFAULT_LANG}`} replace />} />
    </Routes>
  );
}
