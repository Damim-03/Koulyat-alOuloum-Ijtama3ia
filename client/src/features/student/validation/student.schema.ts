import { z } from "zod";
import { t } from "i18next";

// Mirrors backend student.validation (createGroupRequestSchema).
export const createGroupRequestSchema = z.object({
  topicId: z.string().min(1, { error: () => t("validation.topicRequired") }),
  priority: z.coerce.number().int().min(1, { error: () => t("validation.atLeastOne") }).max(10),
  memberRegistrationNumbers: z
    .array(z.string().trim().min(1, { error: () => t("validation.regNumberRequired") }))
    .max(9, { error: () => t("validation.tooManyMembers") })
    .optional()
    .default([]),
});
export type CreateGroupRequestInput = z.infer<typeof createGroupRequestSchema>;
// ما يمسكه النموذج قبل التحويل (coerce / default).
export type CreateGroupRequestFormValues = z.input<
  typeof createGroupRequestSchema
>;