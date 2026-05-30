import { z } from "zod";

export const studentLoginSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required"),
  password: z.string().min(1, "Password is required"),
});

export const professorLoginSchema = z.object({
  universityEmail: z
    .string()
    .regex(
      /^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/,
      "Email must be a valid university email (@univ-eloued.dz)",
    ),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type StudentLoginDTO = z.infer<typeof studentLoginSchema>;
export type ProfessorLoginDTO = z.infer<typeof professorLoginSchema>;
export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
