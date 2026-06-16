import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type ListParams } from "../api/admin.api";

const KEYS = {
  stats: ["admin", "stats"] as const,
  users: (p?: object) => ["admin", "users", p ?? {}] as const,
  students: (p?: object) => ["admin", "students", p ?? {}] as const,
  professors: (p?: object) => ["admin", "professors", p ?? {}] as const,
  faculties: ["admin", "faculties"] as const,
  departments: ["admin", "departments"] as const,
  specializations: ["admin", "specializations"] as const,
  academicYears: ["admin", "academic-years"] as const,
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
export function useUsers(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.users(params),
    queryFn: () => adminApi.listUsers(params),
  });
}
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("تم إنشاء المستخدم");
    },
    onError: () => toast.error("تعذّر إنشاء المستخدم"),
  });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("تم تحديث المستخدم");
    },
    onError: () => toast.error("تعذّر التحديث"),
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
      toast.success("تم تحديث الحالة");
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
  });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("تم حذف المستخدم");
    },
    onError: () => toast.error("تعذّر الحذف"),
  });
}

// ─── STUDENTS ───
export function useStudents(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.students(params),
    queryFn: () => adminApi.listStudents(params),
  });
}
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createStudent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success("تم إضافة الطالب");
    },
    onError: () => toast.error("تعذّر إضافة الطالب"),
  });
}
export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success("تم تحديث الطالب");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteStudent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success("تم حذف الطالب");
    },
    onError: () => toast.error("تعذّر الحذف"),
  });
}

// ─── PROFESSORS ───
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
      toast.success("تم إضافة الأستاذ");
    },
    onError: () => toast.error("تعذّر إضافة الأستاذ"),
  });
}
export function useUpdateProfessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateProfessor(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      toast.success("تم تحديث الأستاذ");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteProfessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProfessor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      toast.success("تم حذف الأستاذ");
    },
    onError: () => toast.error("تعذّر الحذف"),
  });
}

// ─── FACULTIES ───
export function useFaculties() {
  return useQuery({
    queryKey: KEYS.faculties,
    queryFn: adminApi.listFaculties,
  });
}
export function useCreateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createFaculty(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success("تم إضافة الكلية");
    },
    onError: () => toast.error("تعذّر الإضافة"),
  });
}
export function useUpdateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateFaculty(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success("تم التحديث");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFaculty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success("تم الحذف");
    },
    onError: () => toast.error("تعذّر الحذف"),
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
      toast.success("تم إضافة القسم");
    },
    onError: () => toast.error("تعذّر الإضافة"),
  });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDepartment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success("تم التحديث");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success("تم الحذف");
    },
    onError: () => toast.error("تعذّر الحذف"),
  });
}

// ─── SPECIALIZATIONS ───
export function useSpecializations() {
  return useQuery({
    queryKey: KEYS.specializations,
    queryFn: adminApi.listSpecializations,
  });
}
export function useCreateSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createSpecialization(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success("تم إضافة التخصص");
    },
    onError: () => toast.error("تعذّر الإضافة"),
  });
}
export function useUpdateSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateSpecialization(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success("تم التحديث");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteSpecialization(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success("تم الحذف");
    },
    onError: () => toast.error("تعذّر الحذف"),
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
      toast.success("تم إضافة السنة الدراسية");
    },
    onError: () => toast.error("تعذّر الإضافة"),
  });
}
export function useUpdateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateAcademicYear(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success("تم التحديث");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useActivateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.activateAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success("تم تفعيل السنة الدراسية");
    },
    onError: () => toast.error("تعذّر التفعيل"),
  });
}
export function useDeleteAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      toast.success("تم الحذف");
    },
    onError: () => toast.error("تعذّر الحذف"),
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
      toast.success("تم اعتماد الموضوع");
    },
    onError: () => toast.error("تعذّر الاعتماد"),
  });
}
export function useRejectTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectTopic(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success("تم رفض الموضوع");
    },
    onError: () => toast.error("تعذّر الرفض"),
  });
}
export function useArchiveTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.archiveTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success("تم أرشفة الموضوع");
    },
    onError: () => toast.error("تعذّر الأرشفة"),
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
      toast.success("تم قبول الطلب");
    },
    onError: () => toast.error("تعذّر قبول الطلب"),
  });
}
export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectApplication(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "applications"] });
      toast.success("تم رفض الطلب");
    },
    onError: () => toast.error("تعذّر رفض الطلب"),
  });
}

// ─── PROJECTS ───
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
      toast.success("تم تغيير المشرف");
    },
    onError: () => toast.error("تعذّر تغيير المشرف"),
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
      toast.success("تم إضافة الطالب");
    },
    onError: () => toast.error("تعذّر إضافة الطالب"),
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
      toast.success("تم جدولة المناقشة");
    },
    onError: () => toast.error("تعذّر الجدولة"),
  });
}
export function useUpdateDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDefense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      toast.success("تم التحديث");
    },
    onError: () => toast.error("تعذّر التحديث"),
  });
}
export function useDeleteDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDefense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      toast.success("تم الحذف");
    },
    onError: () => toast.error("تعذّر الحذف"),
  });
}
