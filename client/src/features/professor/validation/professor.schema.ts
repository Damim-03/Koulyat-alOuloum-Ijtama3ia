import { z } from "zod";

// ─── TOPICS ────────────────────────────────────────────────────
// Mirrors backend professor.validation (createTopicSchema / updateTopicSchema),
// including the requirements[] and objectives[] project-detail fields.

export const topicReferenceSchema = z.object({
  title: z.string().trim().min(1, "عنوان المرجع مطلوب"),
  url: z.string().trim().url("رابط غير صحيح"),
});

export const createTopicSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().min(1, "الوصف مطلوب"),
  maxStudents: z.coerce.number().min(1, "1 على الأقل").max(10, "10 كحد أقصى"),
  specializationId: z.string().min(1, "التخصص مطلوب"),
  academicYearId: z.string().min(1, "السنة الجامعية مطلوبة"),
  // Repeatable detail lists. Empty rows are stripped in the form before submit.
  requirements: z
    .array(z.string().trim().min(1, "لا يمكن ترك السطر فارغاً"))
    .optional()
    .default([]),
  objectives: z
    .array(z.string().trim().min(1, "لا يمكن ترك السطر فارغاً"))
    .optional()
    .default([]),
  references: z.array(topicReferenceSchema).max(20).optional().default([]),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

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
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  deadline: z.string().min(1, "التاريخ مطلوب"),
  order: z.coerce.number().int().min(1, "الترتيب مطلوب"),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.string().optional(),
  order: z.coerce.number().int().min(1).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
