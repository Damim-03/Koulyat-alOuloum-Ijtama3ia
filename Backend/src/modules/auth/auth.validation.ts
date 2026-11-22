import { z } from "zod";
import { zmsg } from "../../core/i18n/zod";

/** A solved sign-in check, when one was asked for (./captcha) — base64, about a kilobyte. */
const altcha = z.string().max(8192).optional();

export const studentLoginSchema = z.object({
  registrationNumber: z.string().min(1, zmsg("student.registrationRequired")),
  password: z.string().min(1, zmsg("v.passwordRequired")).max(200),
  altcha,
});

export const professorLoginSchema = z.object({
  // الصيغة فقط. النطاقات المسموح بها صارت في جدول UniversityDomain، ولا يمكن
  // الاستعلام عنه هنا (التحقّق يسبق المصادقة). لا حاجة أصلاً: بريد بنطاق غير
  // مسموح به لن يطابق أي أستاذ، فيُردّ بـ "بيانات اعتماد غير صحيحة".
  universityEmail: z.string().email(zmsg("account.emailInvalid")),
  password: z.string().min(1, zmsg("v.passwordRequired")).max(200),
  altcha,
});

export const adminLoginSchema = z.object({
  email: z.string().email(zmsg("account.emailInvalid")),
  password: z.string().min(1, zmsg("v.passwordRequired")).max(200),
  altcha,
});

/** The second step of an administrator's sign-in. */
export const adminTwoFactorSchema = z.object({
  challenge: z.string().min(1).max(2048),
  // Six digits from the app, or a recovery code (xxxxx-xxxxx).
  code: z.string().trim().min(6).max(32),
});

/** In the body for non-browser clients; the web client sends the cookie instead. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(4096).optional(),
});

export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type StudentLoginDTO = z.infer<typeof studentLoginSchema>;
export type ProfessorLoginDTO = z.infer<typeof professorLoginSchema>;
export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
export type AdminTwoFactorDTO = z.infer<typeof adminTwoFactorSchema>;
