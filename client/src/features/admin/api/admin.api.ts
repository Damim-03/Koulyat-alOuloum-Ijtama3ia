import { client } from "../../../lib/api/client";
import type {
  OverviewStats,
  Paginated,
  UserLite,
  Student,
  Professor,
  Faculty,
  Department,
  Specialization,
  AcademicYear,
  AdminTopic,
  AdminApplication,
  AdminProject,
  AdminDefense,
  AdminGroupRequest,
} from "../../../types/admin";

const BASE = "/admin";

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

export const adminApi = {
  // ── Stats ──
  getStats: () =>
    client
      .get<{ stats: OverviewStats }>(`${BASE}/stats/overview`)
      .then((r) => r.data.stats),

  // ── Users ──
  listUsers: (params?: ListParams) =>
    client
      .get<Paginated<UserLite>>(`${BASE}/users`, { params })
      .then((r) => r.data),
  getUser: (id: string) =>
    client
      .get<{ user: UserLite }>(`${BASE}/users/${id}`)
      .then((r) => r.data.user),
  createUser: (data: unknown) =>
    client
      .post<{ user: UserLite }>(`${BASE}/users`, data)
      .then((r) => r.data.user),
  updateUser: (id: string, data: unknown) =>
    client
      .patch<{ user: UserLite }>(`${BASE}/users/${id}`, data)
      .then((r) => r.data.user),
  setUserStatus: (id: string, status: "active" | "suspended") =>
    client.patch(`${BASE}/users/${id}/status`, { status }).then((r) => r.data),
  resetUserPassword: (id: string, password: string) =>
    client
      .post(`${BASE}/users/${id}/reset-password`, { password })
      .then((r) => r.data),
  deleteUser: (id: string) =>
    client.delete(`${BASE}/users/${id}`).then((r) => r.data),

  // ── Students ──
  listStudents: (params?: ListParams) =>
    client
      .get<Paginated<Student>>(`${BASE}/students`, { params })
      .then((r) => r.data),
  getStudent: (id: string) =>
    client
      .get<{ student: Student }>(`${BASE}/students/${id}`)
      .then((r) => r.data.student),
  createStudent: (data: unknown) =>
    client
      .post<{ student: Student }>(`${BASE}/students`, data)
      .then((r) => r.data.student),
  updateStudent: (id: string, data: unknown) =>
    client
      .patch<{ student: Student }>(`${BASE}/students/${id}`, data)
      .then((r) => r.data.student),
  deleteStudent: (id: string) =>
    client.delete(`${BASE}/students/${id}`).then((r) => r.data),

  // ── Professors ──
  listProfessors: (params?: ListParams) =>
    client
      .get<Paginated<Professor>>(`${BASE}/professors`, { params })
      .then((r) => r.data),
  getProfessor: (id: string) =>
    client
      .get<{ professor: Professor }>(`${BASE}/professors/${id}`)
      .then((r) => r.data.professor),
  createProfessor: (data: unknown) =>
    client
      .post<{ professor: Professor }>(`${BASE}/professors`, data)
      .then((r) => r.data.professor),
  updateProfessor: (id: string, data: unknown) =>
    client
      .patch<{ professor: Professor }>(`${BASE}/professors/${id}`, data)
      .then((r) => r.data.professor),
  deleteProfessor: (id: string) =>
    client.delete(`${BASE}/professors/${id}`).then((r) => r.data),

  // ── Faculties ──
  listFaculties: () =>
    client
      .get<{ faculties: Faculty[] }>(`${BASE}/faculties`)
      .then((r) => r.data.faculties),
  createFaculty: (data: unknown) =>
    client
      .post<{ faculty: Faculty }>(`${BASE}/faculties`, data)
      .then((r) => r.data.faculty),
  updateFaculty: (id: string, data: unknown) =>
    client
      .patch<{ faculty: Faculty }>(`${BASE}/faculties/${id}`, data)
      .then((r) => r.data.faculty),
  deleteFaculty: (id: string) =>
    client.delete(`${BASE}/faculties/${id}`).then((r) => r.data),

  // ── Departments ──
  listDepartments: () =>
    client
      .get<{ departments: Department[] }>(`${BASE}/departments`)
      .then((r) => r.data.departments),
  createDepartment: (data: unknown) =>
    client
      .post<{ department: Department }>(`${BASE}/departments`, data)
      .then((r) => r.data.department),
  updateDepartment: (id: string, data: unknown) =>
    client
      .patch<{ department: Department }>(`${BASE}/departments/${id}`, data)
      .then((r) => r.data.department),
  deleteDepartment: (id: string) =>
    client.delete(`${BASE}/departments/${id}`).then((r) => r.data),

  // ── Specializations ──
  listSpecializations: () =>
    client
      .get<{ specializations: Specialization[] }>(`${BASE}/specializations`)
      .then((r) => r.data.specializations),
  createSpecialization: (data: unknown) =>
    client
      .post<{ specialization: Specialization }>(`${BASE}/specializations`, data)
      .then((r) => r.data.specialization),
  updateSpecialization: (id: string, data: unknown) =>
    client
      .patch<{
        specialization: Specialization;
      }>(`${BASE}/specializations/${id}`, data)
      .then((r) => r.data.specialization),
  deleteSpecialization: (id: string) =>
    client.delete(`${BASE}/specializations/${id}`).then((r) => r.data),

  // ── Academic Years ──
  listAcademicYears: () =>
    client
      .get<{ academicYears: AcademicYear[] }>(`${BASE}/academic-years`)
      .then((r) => r.data.academicYears),
  createAcademicYear: (data: unknown) =>
    client
      .post<{ academicYear: AcademicYear }>(`${BASE}/academic-years`, data)
      .then((r) => r.data.academicYear),
  updateAcademicYear: (id: string, data: unknown) =>
    client
      .patch<{
        academicYear: AcademicYear;
      }>(`${BASE}/academic-years/${id}`, data)
      .then((r) => r.data.academicYear),
  activateAcademicYear: (id: string) =>
    client
      .patch<{
        academicYear: AcademicYear;
      }>(`${BASE}/academic-years/${id}/activate`)
      .then((r) => r.data.academicYear),
  deleteAcademicYear: (id: string) =>
    client.delete(`${BASE}/academic-years/${id}`).then((r) => r.data),

  // ── Topics ──
  listTopics: (params?: ListParams) =>
    client
      .get<Paginated<AdminTopic>>(`${BASE}/topics`, { params })
      .then((r) => r.data),
  getTopic: (id: string) =>
    client
      .get<{ topic: AdminTopic }>(`${BASE}/topics/${id}`)
      .then((r) => r.data.topic),
  approveTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/approve`).then((r) => r.data),
  rejectTopic: (id: string, reason?: string) =>
    client.patch(`${BASE}/topics/${id}/reject`, { reason }).then((r) => r.data),
  archiveTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/archive`).then((r) => r.data),

  // ── Applications ──
  listApplications: (params?: ListParams) =>
    client
      .get<Paginated<AdminApplication>>(`${BASE}/applications`, { params })
      .then((r) => r.data),
  acceptApplication: (id: string) =>
    client.patch(`${BASE}/applications/${id}/accept`).then((r) => r.data),
  rejectApplication: (id: string, reason?: string) =>
    client
      .patch(`${BASE}/applications/${id}/reject`, { reason })
      .then((r) => r.data),

  // ── Group Requests ──
  listGroupRequests: (params?: ListParams) =>
    client
      .get<Paginated<AdminGroupRequest>>(`${BASE}/group-requests`, { params })
      .then((r) => r.data),
  getGroupRequest: (id: string) =>
    client
      .get<{ groupRequest: AdminGroupRequest }>(`${BASE}/group-requests/${id}`)
      .then((r) => r.data.groupRequest),
  acceptGroupRequest: (id: string) =>
    client.patch(`${BASE}/group-requests/${id}/accept`).then((r) => r.data),
  rejectGroupRequest: (id: string, reason?: string) =>
    client
      .patch(`${BASE}/group-requests/${id}/reject`, { reason })
      .then((r) => r.data),

  // ── Projects ──
  listProjects: (params?: ListParams) =>
    client
      .get<Paginated<AdminProject>>(`${BASE}/projects`, { params })
      .then((r) => r.data),
  getProject: (id: string) =>
    client
      .get<{ project: AdminProject }>(`${BASE}/projects/${id}`)
      .then((r) => r.data.project),
  changeSupervisor: (id: string, professorId: string) =>
    client
      .patch(`${BASE}/projects/${id}/supervisor`, { professorId })
      .then((r) => r.data),
  assignStudent: (id: string, studentId: string) =>
    client
      .post(`${BASE}/projects/${id}/assign`, { studentId })
      .then((r) => r.data),

  // ── Defenses ──
  listDefenses: (params?: ListParams) =>
    client
      .get<Paginated<AdminDefense>>(`${BASE}/defenses`, { params })
      .then((r) => r.data),
  createDefense: (data: unknown) =>
    client
      .post<{ defense: AdminDefense }>(`${BASE}/defenses`, data)
      .then((r) => r.data.defense),
  updateDefense: (id: string, data: unknown) =>
    client
      .patch<{ defense: AdminDefense }>(`${BASE}/defenses/${id}`, data)
      .then((r) => r.data.defense),
  deleteDefense: (id: string) =>
    client.delete(`${BASE}/defenses/${id}`).then((r) => r.data),
};
