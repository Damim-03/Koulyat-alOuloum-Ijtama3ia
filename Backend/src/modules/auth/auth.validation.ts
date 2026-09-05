import { z } from "zod";

export const studentLoginSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required"),
  password: z.string().min(1, "Password is required").max(200),
});

export const professorLoginSchema = z.object({
  // الصيغة فقط. النطاقات المسموح بها صارت في جدول UniversityDomain، ولا يمكن
  // الاستعلام عنه هنا (التحقّق يسبق المصادقة). لا حاجة أصلاً: بريد بنطاق غير
  // مسموح به لن يطابق أي أستاذ، فيُردّ بـ "بيانات اعتماد غير صحيحة".
  universityEmail: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type StudentLoginDTO = z.infer<typeof studentLoginSchema>;
export type ProfessorLoginDTO = z.infer<typeof professorLoginSchema>;
export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
