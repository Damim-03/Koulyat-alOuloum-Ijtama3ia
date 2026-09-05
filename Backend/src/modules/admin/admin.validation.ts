import { z } from "zod";
import { entityId } from "../../core/validation/id";

//
// ─── SHARED ───────────────────────────────────────────────────
//

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  professorId: entityId.optional(),
  facultyId: entityId.optional(),
  departmentId: entityId.optional(),
  filiereId: entityId.optional(),
  specializationId: entityId.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // Generic status filter used by lists that support it (group-requests,
  // topics). Lists that don't use it simply ignore the field.
  status: z.string().trim().optional(),
});
export type ListQueryDTO = z.infer<typeof listQuerySchema>;

const RoleEnum = z.enum(["owner", "admin", "professor", "student"]);
const StatusEnum = z.enum(["active", "suspended"]);
const LevelEnum = z.enum(["licence", "master", "doctorate"]);

//
// ─── USERS ────────────────────────────────────────────────────
//

/**
 * Password policy for anything that SETS a password.
 * - 8 is the practical floor for a human-chosen secret.
 * - 72 is bcrypt's hard limit: bytes past it are silently ignored, so a
 *   longer value would look stronger than it is.
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const listUsersSchema = listQuerySchema.extend({
  role: RoleEnum.optional(),
  status: StatusEnum.optional(),
  // `search` matches the person's name; these two target one field each, so
  // an admin can look someone up by the identifier they have at hand.
  email: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
});
export type ListUsersDTO = z.infer<typeof listUsersSchema>;

// Admin can create admin/professor/student base accounts.
export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().trim().min(3).optional(),
  password: passwordSchema,
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
  password: passwordSchema,
});
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;

//
// ─── STUDENTS ─────────────────────────────────────────────────
//

export const listStudentsSchema = listQuerySchema.extend({
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(),
  // Hierarchical filters — only one level is applied at a time (most
  // specific wins: specializationId > filiereId > departmentId > facultyId).
  filiereId: entityId.optional(),
  departmentId: entityId.optional(),
  facultyId: entityId.optional(),
  unassigned: z.enum(["true", "false"]).optional(),
  // `search` matches the student's name; this one targets the number alone.
  registrationNumber: z.string().trim().optional(),
  /**
   * One box that matches name, registration number, university email or
   * username — for pickers, where the user has a single string and does not
   * know which field it belongs to. The separate fields above stay as they
   * are, because the students page deliberately keeps them apart.
   */
  quickSearch: z.string().trim().min(1).max(120).optional(),
});
export type ListStudentsDTO = z.infer<typeof listStudentsSchema>;

export const createStudentSchema = z.object({
  // user side
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  password: passwordSchema,
  // student side
  registrationNumber: z.string().trim().min(1),
  // The student is attached to a specialization; the form selects it by
  // cascading faculty → department → filiere → specialization, but only the
  // final specializationId is persisted (the chain is derivable from it).
  specializationId: entityId,
  academicYearId: entityId,
});
export type CreateStudentDTO = z.infer<typeof createStudentSchema>;

// Full edit: every editable field on the student + their user account.
export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  // null = امسح القيمة (مثل حذف الصورة). كما في updateProfessorSchema.
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  registrationNumber: z.string().trim().min(1).optional(),
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(),
});
export type UpdateStudentDTO = z.infer<typeof updateStudentSchema>;

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

/**
 * Projects list. The endpoint previously parsed the generic listQuerySchema
 * and the service used only page/limit, so every filter a caller sent was
 * silently dropped — the page had no way to find one project among many.
 */
/**
 * Milestones, administration side.
 *
 * Deliberately the same shape the professor endpoints accept, so a timeline
 * built by either party is identical in the database and neither can create
 * something the other cannot edit.
 */
export const adminCreateMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  deadline: z.coerce.date(),
  /** Position in the timeline; assigned automatically when omitted. */
  order: z.number().int().min(1).max(200).optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "overdue"])
    .optional(),
});
export type AdminCreateMilestoneDTO = z.infer<typeof adminCreateMilestoneSchema>;

export const adminUpdateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    deadline: z.coerce.date().optional(),
    order: z.number().int().min(1).max(200).optional(),
    status: z
      .enum(["pending", "in_progress", "completed", "overdue"])
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "لا يوجد ما يُحدَّث",
  });
export type AdminUpdateMilestoneDTO = z.infer<typeof adminUpdateMilestoneSchema>;

/** Milestones of one group, optionally narrowed. */
export const listMilestonesSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "overdue"])
    .optional(),
});
export type ListMilestonesDTO = z.infer<typeof listMilestonesSchema>;

export const listProjectsSchema = listQuerySchema.extend({
  /** Matches the topic title, or a member's name / registration number. */
  search: z.string().trim().max(200).optional(),
  professorId: entityId.optional(),
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(),
  filiereId: entityId.optional(),
  departmentId: entityId.optional(),
  facultyId: entityId.optional(),
  /** "scheduled" / "completed" / "cancelled", or "none" for no defense yet. */
  defense: z
    .enum(["none", "scheduled", "completed", "cancelled"])
    .optional(),
  sort: z.enum(["newest", "oldest", "defenseSoon"]).optional(),
});
export type ListProjectsDTO = z.infer<typeof listProjectsSchema>;

export const listProfessorsSchema = listQuerySchema.extend({
  /**
   * One box that matches name, university email, username, account email or
   * employee number. `search` stays name-only, because the professors page
   * deliberately gives each identifier its own field; this is for pickers
   * where the user has one string and does not know which field it is.
   */
  quickSearch: z.string().trim().min(1).max(120).optional(),
  filiereId: entityId.optional(),
  departmentId: entityId.optional(),
  facultyId: entityId.optional(),
  // exact-tag match over the grade array (optional UI filter)
  grade: z.string().trim().optional(),
  // `search` matches the professor's name; these two target one field each.
  employeeNumber: z.string().trim().optional(),
  email: z.string().trim().optional(),
});
export type ListProfessorsDTO = z.infer<typeof listProfessorsSchema>;

export const createProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  password: passwordSchema,
  // اختياري: إن لم يُرسَل، تولّده الخدمة تلقائيًا (13 رقماً فريدة).
  employeeNumber: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "الرقم الوظيفي يجب أن يتكوّن من 13 رقماً")
    .optional(),
  // الصيغة فقط هنا؛ النطاق المسموح به يُفرض في الخدمة مقابل جدول
  // UniversityDomain حتى تستطيع الإدارة إضافة نطاقات دون تعديل الشيفرة.
  universityEmail: z.string().email("بريد إلكتروني غير صالح"),
  departmentId: entityId,
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
  // كما في الإنشاء: النطاق يُفرض في الخدمة مقابل UniversityDomain.
  universityEmail: z.string().email("بريد إلكتروني غير صالح").optional(),
  departmentId: entityId.optional(),
  grade: z.array(z.string().trim().min(1)).max(20).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
});
export type UpdateProfessorDTO = z.infer<typeof updateProfessorSchema>;

//
// ─── DOMAINS ──────────────────────────────────────────────────
//
export const listDomainsSchema = z.object({
  departmentId: entityId.optional(),
});
export type ListDomainsDTO = z.infer<typeof listDomainsSchema>;

export const createDomainSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  departmentId: entityId,
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type CreateDomainDTO = z.infer<typeof createDomainSchema>;

export const updateDomainSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  departmentId: entityId.optional(),
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type UpdateDomainDTO = z.infer<typeof updateDomainSchema>;

//
// ─── FACULTIES ────────────────────────────────────────────────
//

//
// ─── ACADEMIC STRUCTURE (معالج الهيكل الأكاديمي) ──────────────
//
// شجرة كاملة تُنشأ في معاملة واحدة: كلية ← أقسام ← ميادين ← شعب ← تخصّصات.
// الأبناء يشيرون إلى آبائهم بمفتاح مؤقّت (kind: "new") لأنّ المعرّفات لم
// تُنشأ بعد، أو بمعرّف حقيقي (kind: "existing") للربط بصفّ قائم.
//

const structureRefSchema = z.object({
  kind: z.enum(["new", "existing"]),
  value: z.string().min(1),
});

const nameCode = {
  name: z.string().trim().min(1, "الاسم مطلوب"),
  code: z.string().trim().min(1, "الرمز مطلوب"),
};

export const academicStructureSchema = z.object({
  faculty: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("new"), ...nameCode }),
    z.object({ kind: z.literal("existing"), id: entityId }),
  ]),

  departments: z
    .array(z.object({ key: z.string().min(1), ...nameCode }))
    .default([]),

  domains: z
    .array(
      z.object({
        key: z.string().min(1),
        ...nameCode,
        department: structureRefSchema,
      }),
    )
    .default([]),

  filieres: z
    .array(
      z.object({
        key: z.string().min(1),
        ...nameCode,
        department: structureRefSchema,
        domain: structureRefSchema.nullish(),
        specializations: z
          .array(
            z.object({
              name: z.string().trim().min(1, "اسم التخصّص مطلوب"),
              level: z.enum(["licence", "master", "doctorate"]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
export type AcademicStructureDTO = z.infer<typeof academicStructureSchema>;

//
// ─── UNIVERSITY DOMAINS ───────────────────────────────────────
//

// "univ-eloued.dz" — بدون "@" وبدون بروتوكول، ونقطة واحدة على الأقل.
export const createUniversityDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
      "نطاق غير صالح — مثال: univ-eloued.dz",
    ),
  isDefault: z.boolean().optional(),
});
export type CreateUniversityDomainDTO = z.infer<
  typeof createUniversityDomainSchema
>;

export const createFacultySchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
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
  facultyId: entityId,
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type CreateDepartmentDTO = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  facultyId: entityId.optional(),
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type UpdateDepartmentDTO = z.infer<typeof updateDepartmentSchema>;

//
// ─── FILIERES ─────────────────────────────────────────────────
//

export const createFiliereSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().min(1),
    departmentId: entityId.optional(),
    domainId: entityId.optional(),
    // Optional cover image. An empty string clears it; null is the same,
    // so the client can send either.
    coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  })
  .refine((d) => d.departmentId || d.domainId, {
    message: "departmentId or domainId is required",
  });
export type CreateFiliereDTO = z.infer<typeof createFiliereSchema>;

export const updateFiliereSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  departmentId: entityId.optional(),
  domainId: entityId.optional(),
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type UpdateFiliereDTO = z.infer<typeof updateFiliereSchema>;

export const listFilieresSchema = z.object({
  domainId: entityId.optional(),
  departmentId: entityId.optional(),
});
export type ListFilieresDTO = z.infer<typeof listFilieresSchema>;

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//

export const createSpecializationSchema = z.object({
  name: z.string().trim().min(1),
  level: LevelEnum,
  filiereId: entityId,
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type CreateSpecializationDTO = z.infer<
  typeof createSpecializationSchema
>;

export const updateSpecializationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  level: LevelEnum.optional(),
  filiereId: entityId.optional(),
  // Optional cover image. An empty string clears it; null is the same,
  // so the client can send either.
  coverUrl: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
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
  professorId: entityId.optional(),
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(), // ← أضِف هذا السطر
  facultyId: entityId.optional(),
  departmentId: entityId.optional(),
  filiereId: entityId.optional(),
});
export type ListTopicsDTO = z.infer<typeof listTopicsSchema>;

export const rejectTopicSchema = z.object({
  reason: z.string().trim().optional(),
});
export type RejectTopicDTO = z.infer<typeof rejectTopicSchema>;

export const createAssignedTopicSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    requirements: z.array(z.string().trim().min(1)).max(50).optional(),
    objectives: z.array(z.string().trim().min(1)).max(50).optional(),
    maxStudents: z.number().int().min(1).max(10),
    professorId: entityId,
    specializationId: entityId,
    academicYearId: entityId,
    memberStudentIds: z.array(entityId).min(1).max(10),
    leaderStudentId: entityId,
  })
  .refine((d) => d.memberStudentIds.includes(d.leaderStudentId), {
    message: "المرسِل يجب أن يكون ضمن الطلبة المُسنَدين",
    path: ["leaderStudentId"],
  })
  .refine(
    (d) => new Set(d.memberStudentIds).size === d.memberStudentIds.length,
    {
      message: "يوجد طالب مكرّر في القائمة",
      path: ["memberStudentIds"],
    },
  )
  .refine((d) => d.memberStudentIds.length <= d.maxStudents, {
    message: "عدد الطلبة المُسنَدين يتجاوز الحدّ الأقصى",
    path: ["memberStudentIds"],
  });
export type CreateAssignedTopicDTO = z.infer<typeof createAssignedTopicSchema>;

// كل الحقول اختيارية → تعديل جزئي مسموح. عند إرسال الطلبة تُستبدل المجموعة بالكامل.
export const updateAssignedTopicSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    requirements: z.array(z.string().trim().min(1)).max(50).optional(),
    objectives: z.array(z.string().trim().min(1)).max(50).optional(),
    maxStudents: z.number().int().min(1).max(10).optional(),
    professorId: entityId.optional(),
    specializationId: entityId.optional(),
    academicYearId: entityId.optional(),
    memberStudentIds: z.array(entityId).min(1).max(10).optional(),
    leaderStudentId: entityId.optional(),
  })
  .refine((d) => !d.memberStudentIds || !!d.leaderStudentId, {
    message: "leaderStudentId مطلوب عند تعديل الطلبة",
    path: ["leaderStudentId"],
  })
  .refine(
    (d) =>
      !d.memberStudentIds || d.memberStudentIds.includes(d.leaderStudentId!),
    { message: "المرسِل يجب أن يكون ضمن الطلبة", path: ["leaderStudentId"] },
  )
  .refine(
    (d) =>
      !d.memberStudentIds ||
      new Set(d.memberStudentIds).size === d.memberStudentIds.length,
    { message: "يوجد طالب مكرّر في القائمة", path: ["memberStudentIds"] },
  );
export type UpdateAssignedTopicDTO = z.infer<typeof updateAssignedTopicSchema>;

//
// ─── PROJECT ASSIGNMENT ───────────────────────────────────────
//

export const changeSupervisorSchema = z.object({
  professorId: entityId,
});
export type ChangeSupervisorDTO = z.infer<typeof changeSupervisorSchema>;

export const assignStudentSchema = z.object({
  studentId: entityId,
});
export type AssignStudentDTO = z.infer<typeof assignStudentSchema>;

//
// ─── DEFENSES ─────────────────────────────────────────────────
//

const DefenseStatusEnum = z.enum(["scheduled", "completed", "cancelled"]);
const CommitteeRoleEnum = z.enum(["president", "supervisor", "examiner"]);

// A single committee member entry (professor + their role).
const committeeMemberSchema = z.object({
  professorId: entityId,
  role: CommitteeRoleEnum,
});

export const createDefenseSchema = z.object({
  groupId: entityId,
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
