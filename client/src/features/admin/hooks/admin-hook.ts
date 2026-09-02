import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type ListParams } from "../api/admin.api";
import { serverMessage } from "../../../lib/api/error";
import type { AcademicStructurePayload } from "../../../types/admin";
import { t } from "i18next";

const KEYS = {
  stats: ["admin", "stats"] as const,
  users: (p?: object) => ["admin", "users", p ?? {}] as const,
  students: (p?: object) => ["admin", "students", p ?? {}] as const,
  professors: (p?: object) => ["admin", "professors", p ?? {}] as const,
  faculties: ["admin", "faculties"] as const,
  departments: ["admin", "departments"] as const,
  specializations: ["admin", "specializations"] as const,
  academicYears: ["admin", "academic-years"] as const,
  dashboard: ["admin", "dashboard"] as const,
  topics: (p?: object) => ["admin", "topics", p ?? {}] as const,
  applications: (p?: object) => ["admin", "applications", p ?? {}] as const,
  projects: (p?: object) => ["admin", "projects", p ?? {}] as const,
  defenses: (p?: object) => ["admin", "defenses", p ?? {}] as const,
};

// ─── STATS ───
export function useAdminStats() {
  return useQuery({ queryKey: KEYS.stats, queryFn: adminApi.getStats });
}

// ─── USERS ───
export function useUser(id: string | null) {
  return useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.getUser(id as string),
    enabled: !!id,
  });
}

export function useUsers(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.users(params),
    queryFn: () => adminApi.listUsers(params),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminApi.resetUserPassword(id, password),
    onSuccess: () => toast.success(t("toast.passwordChanged")),
    onError: () => toast.error(t("toast.passwordChangeFailed")),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("toast.userCreated"));
    },
    onError: () => toast.error(t("toast.userCreateFailed")),
  });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("toast.userUpdated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "suspended";
    }) => adminApi.setUserStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("toast.statusUpdated"));
    },
    onError: () => toast.error(t("toast.statusUpdateFailed")),
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: adminApi.getDashboard,
    staleTime: 60_000,
  });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("toast.userDeleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── DOMAINS (الميادين) ───
export function useDomains(departmentId?: string) {
  return useQuery({
    queryKey: ["admin", "domains", departmentId ?? null],
    queryFn: () => adminApi.listDomains(departmentId),
  });
}
export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createDomain(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast.success(t("toast.domainAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDomain(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDomain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── STUDENTS ───
export function useStudents(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.students(params),
    queryFn: () => adminApi.listStudents(params),
  });
}

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: ["admin", "student", id],
    queryFn: () => adminApi.getStudent(id as string),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createStudent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success(t("toast.studentAdded"));
    },
    onError: () => toast.error(t("toast.studentAddFailed")),
  });
}
export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success(t("toast.studentUpdated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteStudent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success(t("toast.studentDeleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── PROFESSORS ───

export function useProfessor(id: string | null) {
  return useQuery({
    queryKey: ["admin", "professor", id],
    queryFn: () => adminApi.getProfessor(id as string),
    enabled: !!id,
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => adminApi.uploadImage(file),
    onError: () => toast.error(t("toast.imageUploadFailed")),
  });
}

export function useProfessors(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.professors(params),
    queryFn: () => adminApi.listProfessors(params),
  });
}
export function useCreateProfessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createProfessor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      toast.success(t("toast.professorAdded"));
    },
    onError: () => toast.error(t("toast.professorAddFailed")),
  });
}
export function useUpdateProfessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateProfessor(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      qc.invalidateQueries({ queryKey: ["admin", "professor", v.id] });
      toast.success(t("toast.professorUpdated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteProfessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProfessor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      toast.success(t("toast.professorDeleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── FACULTIES ───
export function useFaculties() {
  return useQuery({
    queryKey: ["admin", "faculties"],
    queryFn: () => adminApi.listFaculties(),
  });
}
export function useCreateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createFaculty(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.facultyAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateFaculty(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFaculty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── DEPARTMENTS ───
export function useDepartments() {
  return useQuery({
    queryKey: KEYS.departments,
    queryFn: adminApi.listDepartments,
  });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createDepartment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.departmentAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDepartment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── SPECIALIZATIONS ───
export function useSpecializations() {
  return useQuery({
    queryKey: KEYS.specializations,
    queryFn: adminApi.listSpecializations,
  });
}

export function useFilieresByDomain(domainId?: string) {
  return useQuery({
    queryKey: ["admin", "filieres", "by-domain", domainId ?? null],
    queryFn: () => adminApi.listFilieresByDomain(domainId),
    enabled: !!domainId,
  });
}
export function useCreateFiliere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createFiliere(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.filiereAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateFiliere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateFiliere(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteFiliere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFiliere(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

export function useFilieres() {
  return useQuery({
    queryKey: ["admin", "filieres"],
    queryFn: () => adminApi.listFilieres(), // بلا وسيط → كل الشُّعب (نُصفّيها محلياً)
  });
}

export function useCreateSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createSpecialization(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.specializationAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateSpecialization(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteSpecialization(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── ACADEMIC YEARS ───
export function useAcademicYears() {
  return useQuery({
    queryKey: KEYS.academicYears,
    queryFn: adminApi.listAcademicYears,
  });
}
export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createAcademicYear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success(t("toast.yearAdded"));
    },
    onError: () => toast.error(t("toast.addFailed")),
  });
}
export function useUpdateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateAcademicYear(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useActivateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.activateAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success(t("toast.yearActivated"));
    },
    onError: () => toast.error(t("toast.activateFailed")),
  });
}
export function useDeleteAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

// ─── TOPICS ───
export function useAdminTopics(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.topics(params),
    queryFn: () => adminApi.listTopics(params),
  });
}
export function useAdminTopic(id: string) {
  return useQuery({
    queryKey: ["admin", "topic", id],
    queryFn: () => adminApi.getTopic(id),
    enabled: !!id,
  });
}
export function useApproveTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.topicApproved"));
    },
    onError: () => toast.error(t("toast.approveFailed")),
  });
}
export function useRejectTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectTopic(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.topicRejected"));
    },
    onError: () => toast.error(t("toast.rejectFailed")),
  });
}
export function useArchiveTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.archiveTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.topicArchived"));
    },
    onError: () => toast.error(t("toast.archiveFailed")),
  });
}

export function useUnarchiveTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.unarchiveTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.topicUnarchived"));
    },
    onError: () => toast.error(t("toast.unarchiveFailed")),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.topicDeleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

export function usePublishTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.publishTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic"] });
      toast.success(t("toast.topicPublished"));
    },
    onError: () => toast.error(t("toast.publishFailed")),
  });
}
export function useUnpublishTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.unpublishTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic"] });
      toast.success(t("toast.topicUnpublished"));
    },
    onError: () => toast.error(t("toast.unpublishFailed")),
  });
}

export function useCreateAssignedTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createAssignedTopic,
    onSuccess: () => {
      // إنشاء موضوع مُسنَد يُنشئ أيضاً مجموعة/مشروعاً ويُشغِّل الطلبة،
      // فنُبطل ذاكرة كل القوائم المتأثّرة لا الموضوع والطلبة فقط.
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success(t("toast.topicCreatedAssigned"));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? t("toast.topicCreateFailed")),
  });
}

export function useUpdateAssignedTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateAssignedTopic(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic", v.id] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success(
        t("admin.topicUpdated", { defaultValue: t("admin.topicUpdated") }),
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? t("toast.topicUpdateFailed")),
  });
}

// ─── APPLICATIONS ───
export function useAdminApplications(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.applications(params),
    queryFn: () => adminApi.listApplications(params),
  });
}
export function useAcceptApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.acceptApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "applications"] });
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      toast.success(t("toast.requestAccepted"));
    },
    onError: () => toast.error(t("toast.acceptFailed")),
  });
}
export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectApplication(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "applications"] });
      toast.success(t("toast.requestRejected"));
    },
    onError: () => toast.error(t("toast.rejectRequestFailed")),
  });
}

// ─── GROUP REQUESTS ───

export function useRemoveGroupRequestMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      studentId,
    }: {
      requestId: string;
      studentId: string;
    }) => adminApi.removeGroupRequestMember(requestId, studentId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "groupRequests"] });
      qc.invalidateQueries({
        queryKey: ["admin", "groupRequest", v.requestId],
      });
      toast.success(t("toast.studentRemoved"));
    },
    onError: () => toast.error(t("toast.removeFailed")),
  });
}
export function useSetGroupRequestLeader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      studentId,
    }: {
      requestId: string;
      studentId: string;
    }) => adminApi.setGroupRequestLeader(requestId, studentId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "groupRequests"] });
      qc.invalidateQueries({
        queryKey: ["admin", "groupRequest", v.requestId],
      });
      toast.success(t("toast.leaderChanged"));
    },
    onError: () => toast.error(t("toast.leaderChangeFailed")),
  });
}

export function useGroupRequests(params?: ListParams) {
  return useQuery({
    queryKey: ["admin", "group-requests", params ?? {}],
    queryFn: () => adminApi.listGroupRequests(params),
  });
}
export function useGroupRequest(id: string | null) {
  return useQuery({
    queryKey: ["admin", "group-request", id],
    queryFn: () => adminApi.getGroupRequest(id as string),
    enabled: !!id,
  });
}
export function useAcceptGroupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.acceptGroupRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "group-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      toast.success(t("toast.requestAcceptedGroupCreated"));
    },
    onError: () => toast.error(t("toast.acceptFailed")),
  });
}
export function useRejectGroupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectGroupRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "group-requests"] });
      toast.success(t("toast.requestRejected"));
    },
    onError: () => toast.error(t("toast.rejectRequestFailed")),
  });
}

// ─── PROJECTS ───

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      studentId,
    }: {
      groupId: string;
      studentId: string;
    }) => adminApi.removeProjectMember(groupId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.studentRemovedFromProject"));
    },
    onError: () => toast.error(t("toast.removeFailed")),
  });
}

export function useAdminProjects(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.projects(params),
    queryFn: () => adminApi.listProjects(params),
  });
}
export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["admin", "project", id],
    queryFn: () => adminApi.getProject(id as string),
    enabled: !!id,
  });
}
export function useChangeSupervisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, professorId }: { id: string; professorId: string }) =>
      adminApi.changeSupervisor(id, professorId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project", v.id] });
      toast.success(t("toast.supervisorChanged"));
    },
    onError: () => toast.error(t("toast.supervisorChangeFailed")),
  });
}
export function useAssignStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, studentId }: { id: string; studentId: string }) =>
      adminApi.assignStudent(id, studentId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project", v.id] });
      toast.success(t("toast.studentAdded"));
    },
    onError: () => toast.error(t("toast.studentAddFailed")),
  });
}

// ─── DEFENSES ───
export function useAdminDefenses(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.defenses(params),
    queryFn: () => adminApi.listDefenses(params),
  });
}
export function useCreateDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createDefense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      toast.success(t("toast.defenseScheduled"));
    },
    onError: () => toast.error(t("toast.scheduleFailed")),
  });
}
export function useUpdateDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDefense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      toast.success(t("toast.updated"));
    },
    onError: () => toast.error(t("toast.updateFailed")),
  });
}
export function useDeleteDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDefense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      toast.success(t("toast.deleted"));
    },
    onError: () => toast.error(t("toast.deleteFailed")),
  });
}

//
// ─── UNIVERSITY EMAIL DOMAINS ─────────────────────────────────
//

export function useUniversityDomains() {
  return useQuery({
    queryKey: ["admin", "university-domains"],
    queryFn: () => adminApi.listUniversityDomains(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUniversityDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => adminApi.createUniversityDomain(domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "university-domains"] });
      toast.success(t("toast.universityDomainAdded"));
    },
    onError: (error) => toast.error(serverMessage(error, t("toast.universityDomainAddFailed"))),
  });
}

export function useDeleteUniversityDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteUniversityDomain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "university-domains"] });
      toast.success(t("toast.universityDomainDeleted"));
    },
    onError: (error) => toast.error(serverMessage(error, t("toast.universityDomainDeleteFailed"))),
  });
}

//
// ─── ACADEMIC STRUCTURE WIZARD ────────────────────────────────
//

export function useCreateAcademicStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AcademicStructurePayload) =>
      adminApi.createAcademicStructure(payload),
    onSuccess: (result) => {
      // The wizard can touch every level, so refresh all of them.
      for (const key of [
        "faculties",
        "departments",
        "domains",
        "filieres",
        "specializations",
      ]) {
        qc.invalidateQueries({ queryKey: ["admin", key] });
      }
      const c = result.created;
      toast.success(
        t("toast.structureCreated", {
          departments: c.departments,
          domains: c.domains,
          filieres: c.filieres,
          specializations: c.specializations,
        }),
      );
    },
    onError: (error) =>
      toast.error(serverMessage(error, t("toast.structureCreateFailed"))),
  });
}
