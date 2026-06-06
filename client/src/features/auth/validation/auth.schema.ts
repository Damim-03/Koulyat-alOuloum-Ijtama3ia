import { z } from "zod";

// Mirrors backend auth.validation.ts so the client rejects the same
// input the server would, before a round-trip.

export const studentLoginSchema = z.object({
  registrationNumber: z.string().min(1, "رقم التسجيل مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const professorLoginSchema = z.object({
  universityEmail: z
    .string()
    .regex(
      /^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/,
      "يجب أن يكون بريداً جامعياً صحيحاً (@univ-eloued.dz)",
    ),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export type StudentLoginDTO = z.infer<typeof studentLoginSchema>;
export type ProfessorLoginDTO = z.infer<typeof professorLoginSchema>;
export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
export type LoginDTO = StudentLoginDTO | ProfessorLoginDTO | AdminLoginDTO;