import { z } from "zod";
import { t } from "i18next";

// Mirrors backend auth.validation.ts so the client rejects the same
// input the server would, before a round-trip.

export const studentLoginSchema = z.object({
  registrationNumber: z.string().min(1, { error: () => t("validation.regNumberRequired") }),
  password: z.string().min(1, { error: () => t("validation.passwordRequired") }),
});

export const professorLoginSchema = z.object({
  // الصيغة فقط: النطاقات المسموح بها تديرها الإدارة في القاعدة، وصفحة الدخول
  // لا تستطيع الاستعلام عنها قبل المصادقة. بريد بنطاق غير مسجَّل لن يطابق أي
  // أستاذ فيُردّ بـ "بيانات الدخول غير صحيحة".
  universityEmail: z.string().email({ error: () => t("validation.emailInvalid") }),
  password: z.string().min(1, { error: () => t("validation.passwordRequired") }),
});

export const adminLoginSchema = z.object({
  email: z.string().email({ error: () => t("validation.emailInvalid") }),
  password: z.string().min(1, { error: () => t("validation.passwordRequired") }),
});

export type StudentLoginDTO = z.infer<typeof studentLoginSchema>;
export type ProfessorLoginDTO = z.infer<typeof professorLoginSchema>;
export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
export type LoginDTO = StudentLoginDTO | ProfessorLoginDTO | AdminLoginDTO;