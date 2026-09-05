import { z } from "zod";
import { t } from "i18next";

//
// ─── USERS ────────────────────────────────────────────────────
//

// Optional everywhere: the administration may simply not know, and an
// account with no gender falls back to initials rather than to a guess.
const gender = z.enum(["male", "female"]).optional().or(z.literal(""));
const genderNullable = z.enum(["male", "female"]).nullable().optional().or(z.literal(""));

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, { error: () => t("validation.firstNameRequired") }).optional().or(z.literal("")),
    lastName: z.string().trim().min(1, { error: () => t("validation.lastNameRequired") }).optional().or(z.literal("")),
    email: z.string().email({ error: () => t("validation.emailInvalid") }).optional().or(z.literal("")),
    username: z.string().trim().min(3, { error: () => t("validation.usernameMin") }).optional().or(z.literal("")),
    password: z.string().min(6, { error: () => t("validation.passwordMin") }),
    role: z.enum(["owner", "admin", "professor", "student"]),
    gender,
  })
  .refine((d) => !!d.email || !!d.username, {
    error: () => t("validation.emailOrUsername"),
    path: ["email"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email({ error: () => t("validation.emailInvalid") }).optional().or(z.literal("")),
  username: z.string().trim().min(3).optional().or(z.literal("")),
  gender: genderNullable,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6, { error: () => t("validation.passwordMin") }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

//
// ─── STUDENTS ─────────────────────────────────────────────────
//

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email({ error: () => t("validation.emailInvalid") }).optional().or(z.literal("")),
  password: z.string().min(6, { error: () => t("validation.passwordMin") }),
  gender,
  registrationNumber: z.string().trim().min(1, { error: () => t("validation.regNumberRequired") }),
  specializationId: z.string().uuid({ error: () => t("validation.pickSpecialization") }),
  academicYearId: z.string().uuid({ error: () => t("validation.pickYear") }),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  gender: genderNullable,
  specializationId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

// الصيغة فقط — النطاق المسموح به يُفرض في الخلفية مقابل جدول النطاقات
// الجامعية، حتى يسري أي نطاق تضيفه الإدارة فوراً دون تعديل هنا.
const universityEmail = z
  .string()
  .regex(/^[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, { error: () => t("validation.universityEmailInvalid") });

export const createProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email({ error: () => t("validation.emailInvalid") }).optional().or(z.literal("")),
  password: z.string().min(6, { error: () => t("validation.passwordMin") }),
  // يُولَّد في الخلفية (13 رقماً فريدة) — لا تُدخله الإدارة.
  employeeNumber: z
    .string()
    .trim()
    .regex(/^\d{13}$/, { error: () => t("validation.employeeNumberDigits") })
    .optional()
    .or(z.literal("")),
  gender,
  universityEmail,
  departmentId: z.string().uuid({ error: () => t("admin.selectDepartment") }),
});
export type CreateProfessorInput = z.infer<typeof createProfessorSchema>;

export const updateProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  gender: genderNullable,
  universityEmail: universityEmail.optional(),
  departmentId: z.string().uuid().optional(),
});
export type UpdateProfessorInput = z.infer<typeof updateProfessorSchema>;

//
// ─── FACULTIES ────────────────────────────────────────────────
//

export const facultySchema = z.object({
  name: z.string().trim().min(1, { error: () => t("validation.nameRequired") }),
  code: z.string().trim().min(1, { error: () => t("validation.codeRequired") }),
  /** Optional: empty means no cover. */
  coverUrl: z.string().trim().optional().or(z.literal("")),
});
export type FacultyInput = z.infer<typeof facultySchema>;

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//

export const departmentSchema = z.object({
  name: z.string().trim().min(1, { error: () => t("validation.nameRequired") }),
  code: z.string().trim().min(1, { error: () => t("validation.codeRequired") }),
  facultyId: z.string().uuid({ error: () => t("admin.selectFaculty") }),
  /** Optional: empty means no cover. */
  coverUrl: z.string().trim().optional().or(z.literal("")),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//

export const specializationSchema = z.object({
  name: z.string().trim().min(1, { error: () => t("validation.nameRequired") }),
  level: z.enum(["licence", "master", "doctorate"]),
  departmentId: z.string().uuid({ error: () => t("admin.selectDepartment") }),
  /** Optional: empty means no cover. */
  coverUrl: z.string().trim().optional().or(z.literal("")),
});
export type SpecializationInput = z.infer<typeof specializationSchema>;

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//

export const academicYearSchema = z.object({
  title: z.string().trim().min(1, { error: () => t("validation.titleRequired") }),
  isActive: z.boolean().optional(),
});
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

//
// ─── DEFENSES ─────────────────────────────────────────────────
//

export const createDefenseSchema = z.object({
  groupId: z.string().uuid({ error: () => t("validation.pickProject") }),
  date: z.string().min(1, { error: () => t("validation.dateRequired") }),
  room: z.string().trim().min(1, { error: () => t("validation.roomRequired") }),
  grade: z.coerce.number().min(0).max(20).optional(),
});
export type CreateDefenseInput = z.infer<typeof createDefenseSchema>;
// ما يمسكه النموذج قبل التحويل: z.coerce يجعل الإدخال يختلف عن الإخراج.
export type CreateDefenseFormValues = z.input<typeof createDefenseSchema>;

export const updateDefenseSchema = z.object({
  date: z.string().min(1).optional(),
  room: z.string().trim().min(1).optional(),
  grade: z.coerce.number().min(0).max(20).optional(),
});
export type UpdateDefenseInput = z.infer<typeof updateDefenseSchema>;