import { z } from "zod";
import { t } from "i18next";

// ─── TOPICS ────────────────────────────────────────────────────
// Mirrors backend professor.validation (createTopicSchema / updateTopicSchema),
// including the requirements[] and objectives[] project-detail fields.

export const topicReferenceSchema = z.object({
  title: z.string().trim().min(1, { error: () => t("validation.referenceTitleRequired") }),
  url: z.string().trim().url({ error: () => t("validation.urlInvalid") }),
});

export const createTopicSchema = z.object({
  title: z.string().min(1, { error: () => t("validation.titleRequired") }),
  description: z.string().min(1, { error: () => t("validation.descriptionRequired") }),
  maxStudents: z.coerce.number().min(1, { error: () => t("validation.atLeastOne") }).max(10, { error: () => t("validation.atMostTen") }),
  specializationId: z.string().min(1, { error: () => t("validation.specializationRequired") }),
  academicYearId: z.string().min(1, { error: () => t("validation.academicYearRequired") }),
  // Repeatable detail lists. Empty rows are stripped in the form before submit.
  requirements: z
    .array(z.string().trim().min(1, { error: () => t("validation.noEmptyLine") }))
    .optional()
    .default([]),
  objectives: z
    .array(z.string().trim().min(1, { error: () => t("validation.noEmptyLine") }))
    .optional()
    .default([]),
  references: z.array(topicReferenceSchema).max(20).optional().default([]),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
// ما يمسكه النموذج قبل التحويل (coerce / default).
export type CreateTopicFormValues = z.input<typeof createTopicSchema>;

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  maxStudents: z.coerce.number().min(1).max(10).optional(),
  requirements: z.array(z.string().trim().min(1)).optional(),
  objectives: z.array(z.string().trim().min(1)).optional(),
});
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

// ─── MILESTONES ────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  title: z.string().min(1, { error: () => t("validation.titleRequired") }),
  description: z.string().optional(),
  deadline: z.string().min(1, { error: () => t("validation.dateRequired") }),
  order: z.coerce.number().int().min(1, { error: () => t("validation.orderRequired") }),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type CreateMilestoneFormValues = z.input<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.string().optional(),
  order: z.coerce.number().int().min(1).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
