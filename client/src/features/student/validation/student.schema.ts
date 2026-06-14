import { z } from "zod";

// Mirrors backend student.validation (createGroupRequestSchema).
export const createGroupRequestSchema = z.object({
  topicId: z.string().min(1, "الموضوع مطلوب"),
  priority: z.coerce.number().int().min(1, "1 على الأقل").max(10),
  memberRegistrationNumbers: z
    .array(z.string().trim().min(1, "رقم التسجيل مطلوب"))
    .max(9, "عدد كبير من الأعضاء")
    .optional()
    .default([]),
});
export type CreateGroupRequestInput = z.infer<typeof createGroupRequestSchema>;