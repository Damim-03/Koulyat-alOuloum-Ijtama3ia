import { z } from "zod";

//
// ─── USERS ────────────────────────────────────────────────────
//

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, "الاسم الأول مطلوب").optional().or(z.literal("")),
    lastName: z.string().trim().min(1, "اللقب مطلوب").optional().or(z.literal("")),
    email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
    username: z.string().trim().min(3, "اسم المستخدم 3 أحرف على الأقل").optional().or(z.literal("")),
    password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
    role: z.enum(["owner", "admin", "professor", "student"]),
  })
  .refine((d) => !!d.email || !!d.username, {
    message: "يجب إدخال بريد إلكتروني أو اسم مستخدم",
    path: ["email"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  username: z.string().trim().min(3).optional().or(z.literal("")),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

//
// ─── STUDENTS ─────────────────────────────────────────────────
//

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  registrationNumber: z.string().trim().min(1, "رقم التسجيل مطلوب"),
  specializationId: z.string().uuid("اختر تخصصاً"),
  academicYearId: z.string().uuid("اختر سنة دراسية"),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  specializationId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

const universityEmail = z
  .string()
  .regex(/^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/, "يجب أن يكون بريداً جامعياً (@univ-eloued.dz)");

export const createProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  employeeNumber: z.string().trim().min(1, "الرقم الوظيفي مطلوب"),
  universityEmail,
  departmentId: z.string().uuid("اختر قسماً"),
});
export type CreateProfessorInput = z.infer<typeof createProfessorSchema>;

export const updateProfessorSchema = z.object({
  firstName: z.string().trim().min(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1).optional().or(z.literal("")),
  universityEmail: universityEmail.optional(),
  departmentId: z.string().uuid().optional(),
});
export type UpdateProfessorInput = z.infer<typeof updateProfessorSchema>;

//
// ─── FACULTIES ────────────────────────────────────────────────
//

export const facultySchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  code: z.string().trim().min(1, "الرمز مطلوب"),
});
export type FacultyInput = z.infer<typeof facultySchema>;

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  code: z.string().trim().min(1, "الرمز مطلوب"),
  facultyId: z.string().uuid("اختر كلية"),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//

export const specializationSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  level: z.enum(["licence", "master", "doctorate"]),
  departmentId: z.string().uuid("اختر قسماً"),
});
export type SpecializationInput = z.infer<typeof specializationSchema>;

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//

export const academicYearSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب"),
  isActive: z.boolean().optional(),
});
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

//
// ─── DEFENSES ─────────────────────────────────────────────────
//

export const createDefenseSchema = z.object({
  groupId: z.string().uuid("اختر مشروعاً"),
  date: z.string().min(1, "التاريخ مطلوب"),
  room: z.string().trim().min(1, "القاعة مطلوبة"),
  grade: z.coerce.number().min(0).max(20).optional(),
});
export type CreateDefenseInput = z.infer<typeof createDefenseSchema>;

export const updateDefenseSchema = z.object({
  date: z.string().min(1).optional(),
  room: z.string().trim().min(1).optional(),
  grade: z.coerce.number().min(0).max(20).optional(),
});
export type UpdateDefenseInput = z.infer<typeof updateDefenseSchema>;