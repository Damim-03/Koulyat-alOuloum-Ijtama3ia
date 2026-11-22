import type { TeamSizeRule, TeamSizes } from "../../../lib/team-size";
import type { SpecLevel } from "../../../lib/spec-level";
import { keepPreviousData, useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type ListParams, type TopicTypeInput } from "../api/admin.api";
import { serverMessage } from "../../../lib/api/error";
import type {
  AcademicStructurePayload,
  AuditLogParams,
  ProposalWindow,
  SelectionWindow,
  TeamSizeState,
  TopicQuotaState,
  TitlesListParams,
} from "../../../types/admin";
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
  proposalWindow: (yearId?: string) => ["admin", "proposal-window", yearId ?? ""] as const,
  selectionWindow: (yearId?: string) => ["admin", "selection-window", yearId ?? ""] as const,
  teamSize: (yearId?: string) => ["admin", "team-size", yearId ?? ""] as const,
  topicQuota: (yearId?: string) => ["admin", "topic-quota", yearId ?? ""] as const,
  teamSizePreview: (yearId: string, rules: string) => ["admin", "team-size", yearId, "preview", rules] as const,
  dashboard: ["admin", "dashboard"] as const,
  topics: (p?: object) => ["admin", "topics", p ?? {}] as const,
  projects: (p?: object) => ["admin", "projects", p ?? {}] as const,
  defenses: (p?: object) => ["admin", "defenses", p ?? {}] as const,
  topicTypes: (departmentId?: string) => ["admin", "topic-types", departmentId ?? ""] as const,
};

/**
 * Every level of the academic structure counts the levels below it — a
 * faculty its departments and specializations, a department its domains — so
 * a change anywhere in the chain refreshes all of them, not just its own list.
 */
function refreshStructure(qc: QueryClient) {
  for (const k of ["faculties", "departments", "domains", "filieres", "specializations"])
    qc.invalidateQueries({ queryKey: ["admin", k] });
}

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
/**
 * توثيق حسابٍ قائم.
 *
 * ويُبطِل مفتاحَي القائمة والتفصيل معاً: صفحة المستخدمين تُرشَّح بالتوثيق،
 * فلو بقي مخزونها على حاله لظلّ الحساب في نتيجة «غير الموثّقين» بعد توثيقه.
 */
export function useSetUserVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) =>
      adminApi.setUserVerification(id, isVerified),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      toast.success(t("toast.verificationUpdated"));
    },
    onError: () => toast.error(t("toast.verificationUpdateFailed")),
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
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast.success(t("toast.domainAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDomain(id, data),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDomain(id),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}

// ─── STUDENTS ───
/**
 * `enabled` لمقاعد الإسناد: المقعد يبحث برقمٍ يُكتب حرفاً حرفاً، فلا يُطلب
 * شيءٌ قبل أن يستقرّ النصّ. والقيمة الافتراضية تُبقي كل نداءٍ قائمٍ كما هو.
 */
export function useStudents(params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: KEYS.students(params),
    queryFn: () => adminApi.listStudents(params),
    enabled,
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
// ── استيراد الطلبة من Excel ──
// بلا toast: النافذة تعرض النتيجة كاملة — التقرير صفّاً صفّاً، أو الحسابات.
export function useStudentImportPreview() {
  return useMutation({
    mutationFn: (file: File) => adminApi.previewStudentImport(file),
  });
}
export function useImportStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminApi.importStudents(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: KEYS.stats });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

// ── استيراد الأساتذة من Excel — كالطلبة ──
export function useProfessorImportPreview() {
  return useMutation({
    mutationFn: (file: File) => adminApi.previewProfessorImport(file),
  });
}
export function useImportProfessors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminApi.importProfessors(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "professors"] });
      qc.invalidateQueries({ queryKey: KEYS.stats });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useTopicImportPreview() {
  return useMutation({
    mutationFn: (file: File) => adminApi.previewTopicImport(file),
  });
}
export function useImportTopics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminApi.importTopics(file),
    onSuccess: () => {
      // مواضيع وحدها: لا مجموعات ولا طلبة — فقوائمها والعدّادات التي تقرؤها.
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: KEYS.stats });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useAssignedTopicImportPreview() {
  return useMutation({
    mutationFn: (file: File) => adminApi.previewAssignedTopicImport(file),
  });
}
export function useImportAssignedTopics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminApi.importAssignedTopics(file),
    onSuccess: () => {
      // كـ«إنشاء موضوع وإسناده»: مواضيع ومجموعاتٌ وطلبةٌ صار لهم مشروع.
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: KEYS.stats });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
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
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.facultyAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateFaculty(id, data),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFaculty(id),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.faculties });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
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
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.departmentAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDepartment(id, data),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.departments });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}

// ─── TOPIC TYPES ───
/** A department's types; the forms' lists (`topic-lookups`) refresh with them. */
export function useTopicTypes(departmentId?: string) {
  return useQuery({
    queryKey: KEYS.topicTypes(departmentId),
    queryFn: () => adminApi.listTopicTypes(departmentId),
    enabled: !!departmentId,
  });
}
function refreshTopicTypes(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["admin", "topic-types"] });
  qc.invalidateQueries({ queryKey: ["topic-lookups"] });
}
export function useCreateTopicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TopicTypeInput) => adminApi.createTopicType(data),
    onSuccess: () => {
      refreshTopicTypes(qc);
      toast.success(t("topicTypes.added"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateTopicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<TopicTypeInput, "departmentId">> }) => adminApi.updateTopicType(id, data),
    onSuccess: () => {
      refreshTopicTypes(qc);
      // The topics carry the type's name, code and colour.
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("topicTypes.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteTopicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteTopicType(id),
    onSuccess: () => {
      refreshTopicTypes(qc);
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
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
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.filiereAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateFiliere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateFiliere(id, data),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteFiliere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFiliere(id),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: ["admin", "filieres"] });
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
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
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.specializationAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}
export function useUpdateSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateSpecialization(id, data),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteSpecialization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteSpecialization(id),
    onSuccess: () => {
      refreshStructure(qc);
      qc.invalidateQueries({ queryKey: KEYS.specializations });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}

// ─── ACADEMIC YEARS ───
export function useAcademicYears() {
  return useQuery({
    queryKey: KEYS.academicYears,
    queryFn: adminApi.listAcademicYears,
  });
}
/** فترة اقتراح المواضيع لسنة، وحالها، ومن اقترح من الأساتذة. */
export function useProposalWindow(yearId?: string) {
  return useQuery({
    queryKey: KEYS.proposalWindow(yearId),
    queryFn: () => adminApi.proposalWindow(yearId!),
    enabled: !!yearId,
  });
}
/** بعد الحفظ أو الإلغاء: الفترة كما ردّها الخادم، والسنوات التي تحملها (والأستاذ يقرؤها منها). */
function onWindowSaved(qc: QueryClient, data: ProposalWindow) {
  qc.setQueryData(KEYS.proposalWindow(data.year.id), data);
  qc.invalidateQueries({ queryKey: KEYS.academicYears });
  qc.invalidateQueries({ queryKey: ["common", "academic-years"] });
}
export function useSetProposalWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, ...body }: { yearId: string; opensOn: string; closesOn: string; opensTime?: string; closesTime?: string }) =>
      adminApi.setProposalWindow(yearId, body),
    onSuccess: (data) => {
      onWindowSaved(qc, data);
      toast.success(t("admin.proposals.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.proposals.failed"))),
  });
}
export function useClearProposalWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => adminApi.clearProposalWindow(yearId),
    onSuccess: (data) => {
      onWindowSaved(qc, data);
      toast.success(t("admin.proposals.cleared"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.proposals.failed"))),
  });
}
/** عدد الطلبة في كلّ موضوعٍ لسنة، وكم موضوعاً يطابقه. */
export function useTeamSize(yearId?: string) {
  return useQuery({
    queryKey: KEYS.teamSize(yearId),
    queryFn: () => adminApi.teamSize(yearId!),
    enabled: !!yearId,
  });
}
/** What the rules would do to the year's topics — the last answer kept while the next is asked. */
export function useTeamSizePreview(yearId: string, rules: TeamSizes) {
  return useQuery({
    queryKey: KEYS.teamSizePreview(yearId, JSON.stringify(rules)),
    queryFn: () => adminApi.teamSizePreview(yearId, rules),
    placeholderData: (previous) => previous,
  });
}
/** بعد الحفظ أو الإلغاء: العدد كما ردّه الخادم، والسنوات التي تحمله، والمواضيع التي تغيّرت أعدادها. */
function onTeamSizeSaved(qc: QueryClient, data: TeamSizeState) {
  qc.setQueryData(KEYS.teamSize(data.year.id), data);
  qc.removeQueries({ queryKey: ["admin", "team-size", data.year.id, "preview"] });
  qc.invalidateQueries({ queryKey: KEYS.academicYears });
  qc.invalidateQueries({ queryKey: ["admin", "topics"] });
}
export function useSetTeamSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, ...body }: { yearId: string; rules: Record<SpecLevel, TeamSizeRule | null>; applyToExisting: boolean }) =>
      adminApi.setTeamSize(yearId, body),
    onSuccess: (data) => {
      onTeamSizeSaved(qc, data);
      toast.success(data.applied.changed ? t("admin.teamSize.savedApplied", { n: data.applied.changed }) : t("admin.teamSize.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.teamSize.failed"))),
  });
}
export function useClearTeamSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => adminApi.clearTeamSize(yearId),
    onSuccess: (data) => {
      onTeamSizeSaved(qc, data);
      toast.success(t("admin.teamSize.cleared"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.teamSize.failed"))),
  });
}
/** حدّ المواضيع لكلّ أستاذ في سنة، والأساتذة منه: من اقترح، ومن بلغه، ومن تجاوزه. */
export function useTopicQuota(yearId?: string) {
  return useQuery({
    queryKey: KEYS.topicQuota(yearId),
    queryFn: () => adminApi.topicQuota(yearId!),
    enabled: !!yearId,
  });
}
function onTopicQuotaSaved(qc: QueryClient, data: TopicQuotaState) {
  qc.setQueryData(KEYS.topicQuota(data.year.id), data);
  qc.invalidateQueries({ queryKey: KEYS.academicYears });
}
export function useSetTopicQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, max }: { yearId: string; max: number }) => adminApi.setTopicQuota(yearId, max),
    onSuccess: (data) => {
      onTopicQuotaSaved(qc, data);
      toast.success(t("admin.topicQuota.saved", { n: data.year.maxTopicsPerProfessor }));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.topicQuota.failed"))),
  });
}
export function useClearTopicQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => adminApi.clearTopicQuota(yearId),
    onSuccess: (data) => {
      onTopicQuotaSaved(qc, data);
      toast.success(t("admin.topicQuota.cleared"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.topicQuota.failed"))),
  });
}
/** مهلة اختيار المواضيع لسنة، وحالها، ومن طلب من الطلبة. */
export function useSelectionWindow(yearId?: string) {
  return useQuery({
    queryKey: KEYS.selectionWindow(yearId),
    queryFn: () => adminApi.selectionWindow(yearId!),
    enabled: !!yearId,
  });
}
/** بعد الحفظ أو الإلغاء: المهلة كما ردّها الخادم، والسنوات التي تحملها. */
function onSelectionSaved(qc: QueryClient, data: SelectionWindow) {
  qc.setQueryData(KEYS.selectionWindow(data.year.id), data);
  qc.invalidateQueries({ queryKey: KEYS.academicYears });
}
export function useSetSelectionWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, ...body }: { yearId: string; opensOn: string; closesOn: string; opensTime?: string; closesTime?: string }) =>
      adminApi.setSelectionWindow(yearId, body),
    onSuccess: (data) => {
      onSelectionSaved(qc, data);
      toast.success(t("admin.selection.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.selection.failed"))),
  });
}
export function useClearSelectionWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => adminApi.clearSelectionWindow(yearId),
    onSuccess: (data) => {
      onSelectionSaved(qc, data);
      toast.success(t("admin.selection.cleared"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.selection.failed"))),
  });
}
export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createAcademicYear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      // The archive and the years panel read the same years with their figures.
      qc.invalidateQueries({ queryKey: ["admin", "archive"] });
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
      // The archive and the years panel read the same years with their figures.
      qc.invalidateQueries({ queryKey: ["admin", "archive"] });
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
      // The archive and the years panel read the same years with their figures.
      qc.invalidateQueries({ queryKey: ["admin", "archive"] });
      toast.success(t("toast.yearActivated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.activateFailed"))),
  });
}
export function useDeleteAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.academicYears });
      // The archive and the years panel read the same years with their figures.
      qc.invalidateQueries({ queryKey: ["admin", "archive"] });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}

// ─── THE ARCHIVE ───
// The keys name "academic-years" too, so a year added, renamed or activated
// anywhere refreshes the archive; and a live record names what it is built
// from, so it follows the work while the year is open.
const ARCHIVE_KEY = ["admin", "archive"] as const;

export function useArchiveYears() {
  return useQuery({
    queryKey: [...ARCHIVE_KEY, "years", "academic-years"],
    queryFn: adminApi.listArchiveYears,
  });
}

export function useYearRecord(id: string | null) {
  return useQuery({
    queryKey: [...ARCHIVE_KEY, "record", id, "students", "topics", "projects", "defenses"],
    queryFn: () => adminApi.getYearRecord(id as string),
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useYearReadiness(id: string | null) {
  return useQuery({
    queryKey: [...ARCHIVE_KEY, "readiness", id],
    queryFn: () => adminApi.getYearReadiness(id as string),
    enabled: !!id,
  });
}

function useArchiveRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ARCHIVE_KEY });
    qc.invalidateQueries({ queryKey: KEYS.academicYears });
    qc.invalidateQueries({ queryKey: ["common", "academic-years"] });
  };
}

export function useCloseYear() {
  const refresh = useArchiveRefresh();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; confirmTitle: string; note?: string; nextYearId?: string; nextYearTitle?: string }) =>
      adminApi.closeYear(id, data),
    onSuccess: () => {
      refresh();
      toast.success(t("admin.yearArchive.closed"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.yearArchive.closeFailed"))),
  });
}

export function useReopenYear() {
  const refresh = useArchiveRefresh();
  return useMutation({
    mutationFn: ({ id, activate }: { id: string; activate?: boolean }) => adminApi.reopenYear(id, { activate }),
    onSuccess: () => {
      refresh();
      toast.success(t("admin.yearArchive.reopened"));
    },
    onError: (e) => toast.error(serverMessage(e, t("admin.yearArchive.reopenFailed"))),
  });
}

// ─── TOPICS ───
/** The list of titles; under the topics key, so a change to any topic refreshes it. */
export function useTopicTitlesList(params: TitlesListParams, enabled = true) {
  return useQuery({
    queryKey: ["admin", "topics", "titles-list", params],
    queryFn: () => adminApi.topicTitlesList(params),
    enabled,
  });
}

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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.approveFailed"));
    },
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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.rejectFailed"));
    },
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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.archiveFailed"));
    },
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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.unarchiveFailed"));
    },
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic"] });
      toast.success(t("toast.topicDeleted"));
    },
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.deleteFailed"));
    },
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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.publishFailed"));
    },
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
    onError: (e: unknown) => {
      // الخادم يشرح المنع (فريق ينتظر، مجموعة تشكّلت، أرشفه بدل حذفه)؛
      // النصّ العام يمحو ذلك ويترك المستخدم بلا مخرج.
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.unpublishFailed"));
    },
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createTopic,
    onSuccess: () => {
      // No group and no students, so only the topic lists and the counters
      // that read them go stale.
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success(t("toast.topicCreated"));
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.topicCreateFailed"));
    },
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
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.topicCreateFailed"));
    },
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
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.topicUpdateFailed"));
    },
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
      qc.invalidateQueries({ queryKey: ["admin", "group-requests"] });
      qc.invalidateQueries({
        queryKey: ["admin", "group-request", v.requestId],
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
      qc.invalidateQueries({ queryKey: ["admin", "group-requests"] });
      qc.invalidateQueries({
        queryKey: ["admin", "group-request", v.requestId],
      });
      toast.success(t("toast.leaderChanged"));
    },
    onError: () => toast.error(t("toast.leaderChangeFailed")),
  });
}

export function useGroupRequests(params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: ["admin", "group-requests", params ?? {}],
    queryFn: () => adminApi.listGroupRequests(params),
    enabled,
  });
}
/** Under the same key prefix, so accepting or rejecting refreshes it too. */
/** The audit log. The previous page stays on screen while the next one loads. */
export function useAuditLogs(params: AuditLogParams) {
  return useQuery({
    queryKey: ["admin", "audit-logs", params],
    queryFn: () => adminApi.auditLogs(params),
    placeholderData: keepPreviousData,
  });
}

/** Who appears in the audit log, the most active first — the «who» filter. */
export function useAuditActors() {
  return useQuery({ queryKey: ["admin", "audit-logs", "actors"], queryFn: adminApi.auditActors, staleTime: 60_000 });
}

/** The countries the audit log's addresses are in — the «where from» filter. */
export function useAuditCountries() {
  return useQuery({ queryKey: ["admin", "audit-logs", "countries"], queryFn: adminApi.auditCountries, staleTime: 60_000 });
}

/** The last 24 hours of the audit log, at a glance. */
export function useAuditSummary() {
  return useQuery({ queryKey: ["admin", "audit-logs", "summary"], queryFn: adminApi.auditSummary, staleTime: 60_000 });
}

export function useGroupRequestsByTopic(params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: ["admin", "group-requests", "by-topic", params ?? {}],
    queryFn: () => adminApi.listGroupRequestsByTopic(params),
    enabled,
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

/**
 * حذفُ طلبٍ منتهٍ من السجلّ.
 *
 * ورسالةُ الخطأ تُعرض كما جاءت من الخادم لا مُستبدَلةً بعبارةٍ عامّة: هو
 * وحده يعرف **لماذا** رُفض الحذف — أطلبٌ ينتظر قراراً أم مشروعٌ قائم — وكلٌّ
 * منهما يُحيل المسؤول إلى بابٍ مختلف.
 */
export function useDeleteGroupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteGroupRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "group-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic"] });
      toast.success(t("toast.deleted"));
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(msg ?? t("toast.deleteFailed"));
    },
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
      qc.invalidateQueries({ queryKey: ["admin", "project"] });
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      toast.success(t("toast.studentRemovedFromProject"));
    },
    // الخادم يرفض إزالة آخر عضو ويشرح أن الإجراء المقصود هو «فسخ المشروع».
    // نصّ عام هنا يُخفي ذلك ويترك المستخدم أمام «فشلت الإزالة» بلا مخرج.
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.removeFailed"));
    },
  });
}

export function useDissolveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, reason }: { groupId: string; reason?: string }) =>
      adminApi.dissolveProject(groupId, reason),
    onSuccess: () => {
      // الفسخ يمسّ المشروع والموضوع والطلبة والعدّادات معاً.
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project"] });
      qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      qc.invalidateQueries({ queryKey: ["admin", "topic"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success(
        t("toast.projectDissolved", { defaultValue: "فُسخت المذكرة" }),
      );
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(
        msg || t("toast.dissolveFailed", { defaultValue: "تعذّر فسخ المذكرة" }),
      );
    },
  });
}

/** يعيّن مسؤول الفريق مباشرةً — في أيّ مرحلة، بما فيها بعد اكتمال العدد. */
export function useSetProjectLeader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      adminApi.setProjectLeader(groupId, studentId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project", v.groupId] });
      toast.success(t("toast.leaderChanged"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.leaderChangeFailed"))),
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
    // «هو المشرف الحالي» أو «غير موجود» أوضح من «تعذّر التغيير».
    onError: (e) => toast.error(serverMessage(e, t("toast.supervisorChangeFailed"))),
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
    // الحدّ الأقصى والمشروع الآخر يصلان برسالة الخادم لا بنصٍّ عامّ.
    onError: (e) => toast.error(serverMessage(e, t("toast.studentAddFailed"))),
  });
}

// ─── DEFENSES ───
export function useAdminDefenses(params?: ListParams) {
  return useQuery({
    queryKey: KEYS.defenses(params),
    queryFn: () => adminApi.listDefenses(params),
    // Filtering keeps the old rows on screen until the new ones arrive.
    placeholderData: keepPreviousData,
  });
}

/** One defence with everything its details page shows. */
export function useDefense(id: string | null) {
  return useQuery({
    queryKey: ["admin", "defense", id],
    queryFn: () => adminApi.getDefense(id as string),
    enabled: !!id,
  });
}

/** Would this slot clash with another scheduled defence? */
export function useDefenseConflicts(
  params: { date: string; durationMinutes?: number; room?: string; professorIds?: string; excludeId?: string } | null,
) {
  return useQuery({
    queryKey: ["admin", "defenses", "conflicts", params],
    queryFn: () => adminApi.defenseConflicts(params!),
    enabled: !!params?.date,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}
export function useCreateDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createDefense(data),
    onSuccess: () => {
      // المناقشة تظهر في المشروع وقائمته أيضاً، لا في صفحة المناقشات وحدها.
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      qc.invalidateQueries({ queryKey: ["admin", "defense"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project"] });
      toast.success(t("toast.defenseScheduled"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.scheduleFailed"))),
  });
}
export function useUpdateDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateDefense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      qc.invalidateQueries({ queryKey: ["admin", "defense"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project"] });
      toast.success(t("toast.updated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
export function useDeleteDefense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDefense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "defenses"] });
      qc.invalidateQueries({ queryKey: ["admin", "defense"] });
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "project"] });
      toast.success(t("toast.deleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
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

/* ── Milestones ──────────────────────────────────────────────────────
   Administration may now shape a project's timeline alongside the
   supervising professor, so these mirror the professor-side operations. */

export function useGroupMilestones(
  groupId: string | null,
  params?: ListParams,
) {
  return useQuery({
    queryKey: ["admin", "milestones", groupId, params ?? {}],
    queryFn: () => adminApi.listMilestones(groupId as string, params),
    enabled: !!groupId,
  });
}

/** Every milestone write refreshes the project it belongs to as well, since
 *  the detail page shows progress derived from it. */
function useMilestoneInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin", "milestones"] });
    qc.invalidateQueries({ queryKey: ["admin", "project"] });
    qc.invalidateQueries({ queryKey: ["admin", "projects"] });
  };
}

export function useCreateMilestone() {
  const invalidate = useMilestoneInvalidation();
  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: unknown }) =>
      adminApi.createMilestone(groupId, data),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.milestoneCreated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.milestoneFailed"))),
  });
}

export function useUpdateMilestone() {
  const invalidate = useMilestoneInvalidation();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateMilestone(id, data),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.milestoneUpdated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.milestoneFailed"))),
  });
}

export function useDeleteMilestone() {
  const invalidate = useMilestoneInvalidation();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteMilestone(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.milestoneDeleted"));
    },
    // The server refuses to delete a milestone that has submissions; that
    // message is the useful one, so it is shown rather than a generic failure.
    onError: (e) => toast.error(serverMessage(e, t("toast.milestoneFailed"))),
  });
}
