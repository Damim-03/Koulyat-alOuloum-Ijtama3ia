import { z } from "zod";

//
// ─── SHARED ───────────────────────────────────────────────────
//

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  // Generic status filter used by lists that support it (applications,
  // group-requests). Lists that don't use it simply ignore the field.
  status: z.string().trim().optional(),
});
export type ListQueryDTO = z.infer<typeof listQuerySchema>;

const RoleEnum = z.enum(["owner", "admin", "professor", "student"]);
const StatusEnum = z.enum(["active", "suspended"]);
const LevelEnum = z.enum(["licence", "master", "doctorate"]);

//
// ─── USERS ────────────────────────────────────────────────────
//

export const listUsersSchema = listQuerySchema.extend({
  role: RoleEnum.optional(),
  status: StatusEnum.optional(),
});
export type ListUsersDTO = z.infer<typeof listUsersSchema>;

// Admin can create admin/professor/student base accounts.
export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().trim().min(3).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: RoleEnum,
});
export type CreateUserDTO = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().trim().min(3).optional(),
});
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;

export const updateUserStatusSchema = z.object({
  status: StatusEnum,
});
export type UpdateUserStatusDTO = z.infer<typeof updateUserStatusSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;

//
// ─── STUDENTS ─────────────────────────────────────────────────
//

export const listStudentsSchema = listQuerySchema.extend({
  specializationId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  // Hierarchical filters — only one level is applied at a time (most
  // specific wins: specializationId > filiereId > departmentId > facultyId).
  filiereId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
});
export type ListStudentsDTO = z.infer<typeof listStudentsSchema>;

export const createStudentSchema = z.object({
  // user side
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  password: z.string().min(6),
  // student side
  registrationNumber: z.string().trim().min(1),
  // The student is attached to a specialization; the form selects it by
  // cascading faculty → department → filiere → specialization, but only the
  // final specializationId is persisted (the chain is derivable from it).
  specializationId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});
export type CreateStudentDTO = z.infer<typeof createStudentSchema>;

// Full edit: every editable field on the student + their user account.
export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  registrationNumber: z.string().trim().min(1).optional(),
  specializationId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});
export type UpdateStudentDTO = z.infer<typeof updateStudentSchema>;

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

export const listProfessorsSchema = listQuerySchema.extend({
  filiereId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  // exact-tag match over the grade array (optional UI filter)
  grade: z.string().trim().optional(),
});
export type ListProfessorsDTO = z.infer<typeof listProfessorsSchema>;

export const createProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
  employeeNumber: z.string().trim().min(1),
  universityEmail: z
    .string()
    .regex(
      /^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/,
      "Must be a valid @univ-eloued.dz email",
    ),
  departmentId: z.string().uuid(),
  grade: z.array(z.string().trim().min(1)).max(20).optional(), // ← جديد
  tags: z.array(z.string().trim().min(1)).max(20).optional(), // ← جديد
});
export type CreateProfessorDTO = z.infer<typeof createProfessorSchema>;

export const updateProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().nullable().optional(), // ← جديد
  phone: z.string().trim().min(1).nullable().optional(), // ← جديد
  avatarUrl: z.string().url().nullable().optional(), // ← جديد
  universityEmail: z
    .string()
    .regex(/^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/)
    .optional(),
  departmentId: z.string().uuid().optional(),
  grade: z.array(z.string().trim().min(1)).max(20).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
});
export type UpdateProfessorDTO = z.infer<typeof updateProfessorSchema>;

//
// ─── DOMAINS ──────────────────────────────────────────────────
//
export const listDomainsSchema = z.object({
  departmentId: z.string().uuid().optional(),
});
export type ListDomainsDTO = z.infer<typeof listDomainsSchema>;

export const createDomainSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  departmentId: z.string().uuid(),
});
export type CreateDomainDTO = z.infer<typeof createDomainSchema>;

export const updateDomainSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
});
export type UpdateDomainDTO = z.infer<typeof updateDomainSchema>;

//
// ─── FACULTIES ────────────────────────────────────────────────
//

export const createFacultySchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
});
export type CreateFacultyDTO = z.infer<typeof createFacultySchema>;

export const updateFacultySchema = createFacultySchema.partial();
export type UpdateFacultyDTO = z.infer<typeof updateFacultySchema>;

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  facultyId: z.string().uuid(),
});
export type CreateDepartmentDTO = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  facultyId: z.string().uuid().optional(),
});
export type UpdateDepartmentDTO = z.infer<typeof updateDepartmentSchema>;

//
// ─── FILIERES ─────────────────────────────────────────────────
//

export const createFiliereSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().min(1),
    departmentId: z.string().uuid().optional(),
    domainId: z.string().uuid().optional(),
  })
  .refine((d) => d.departmentId || d.domainId, {
    message: "departmentId or domainId is required",
  });
export type CreateFiliereDTO = z.infer<typeof createFiliereSchema>;

export const updateFiliereSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  domainId: z.string().uuid().optional(),
});
export type UpdateFiliereDTO = z.infer<typeof updateFiliereSchema>;

export const listFilieresSchema = z.object({
  domainId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});
export type ListFilieresDTO = z.infer<typeof listFilieresSchema>;

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//

export const createSpecializationSchema = z.object({
  name: z.string().trim().min(1),
  level: LevelEnum,
  filiereId: z.string().uuid(),
});
export type CreateSpecializationDTO = z.infer<
  typeof createSpecializationSchema
>;

export const updateSpecializationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  level: LevelEnum.optional(),
  filiereId: z.string().uuid().optional(),
});
export type UpdateSpecializationDTO = z.infer<
  typeof updateSpecializationSchema
>;

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//

export const createAcademicYearSchema = z.object({
  title: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});
export type CreateAcademicYearDTO = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = z.object({
  title: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAcademicYearDTO = z.infer<typeof updateAcademicYearSchema>;

//
// ─── TOPICS ───────────────────────────────────────────────────
//

export const listTopicsSchema = listQuerySchema.extend({
  status: z
    .enum(["pending", "approved", "rejected", "open", "full", "archived"])
    .optional(),
  professorId: z.string().uuid().optional(),
  specializationId: z.string().uuid().optional(),
});
export type ListTopicsDTO = z.infer<typeof listTopicsSchema>;

export const rejectTopicSchema = z.object({
  reason: z.string().trim().optional(),
});
export type RejectTopicDTO = z.infer<typeof rejectTopicSchema>;

//
// ─── PROJECT ASSIGNMENT ───────────────────────────────────────
//

export const changeSupervisorSchema = z.object({
  professorId: z.string().uuid(),
});
export type ChangeSupervisorDTO = z.infer<typeof changeSupervisorSchema>;

export const assignStudentSchema = z.object({
  studentId: z.string().uuid(),
});
export type AssignStudentDTO = z.infer<typeof assignStudentSchema>;

//
// ─── DEFENSES ─────────────────────────────────────────────────
//

const DefenseStatusEnum = z.enum(["scheduled", "completed", "cancelled"]);
const CommitteeRoleEnum = z.enum(["president", "supervisor", "examiner"]);

// A single committee member entry (professor + their role).
const committeeMemberSchema = z.object({
  professorId: z.string().uuid(),
  role: CommitteeRoleEnum,
});

export const createDefenseSchema = z.object({
  groupId: z.string().uuid(),
  date: z.string().datetime({ message: "date must be ISO datetime" }),
  room: z.string().trim().min(1),
  grade: z.number().min(0).max(20).optional(),
  status: DefenseStatusEnum.optional(),
  notes: z.string().trim().optional(),
  // Optional committee assigned at scheduling time.
  committee: z.array(committeeMemberSchema).optional(),
});
export type CreateDefenseDTO = z.infer<typeof createDefenseSchema>;

export const updateDefenseSchema = z.object({
  date: z.string().datetime().optional(),
  room: z.string().trim().min(1).optional(),
  grade: z.number().min(0).max(20).optional(),
  status: DefenseStatusEnum.optional(),
  notes: z.string().trim().optional(),
  // When provided, the committee is fully replaced with this list.
  committee: z.array(committeeMemberSchema).optional(),
});
export type UpdateDefenseDTO = z.infer<typeof updateDefenseSchema>;

//
// ─── NOTIFICATIONS (admin's own bell) ─────────────────────────
//

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  // "true" → only unread notifications.
  unread: z.coerce.boolean().optional().default(false),
});
export type ListNotificationsDTO = z.infer<typeof listNotificationsSchema>;
