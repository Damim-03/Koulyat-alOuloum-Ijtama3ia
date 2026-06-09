import { z } from "zod";

// ─── TOPICS ────────────────────────────────────────────────────
// mirrors backend professor.validation (createTopicSchema)
export const createTopicSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().min(1, "الوصف مطلوب"),
  maxStudents: z.coerce.number().min(1).max(10),
  specializationId: z.string().min(1, "التخصص مطلوب"),
  academicYearId: z.string().min(1, "السنة الجامعية مطلوبة"),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  maxStudents: z.coerce.number().min(1).max(10).optional(),
});
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

// ─── MILESTONES ────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  deadline: z.string().min(1, "التاريخ مطلوب"),
  order: z.coerce.number().int().min(1),
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