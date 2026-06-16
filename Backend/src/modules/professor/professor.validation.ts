import { z } from "zod";

// A single helpful reference for students: a title + a valid URL.
const referenceSchema = z.object({
  title: z.string().trim().min(1, "عنوان المرجع مطلوب"),
  url: z.string().trim().url("رابط غير صحيح"),
});

// ─── TOPICS ────────────────────────────────────────────────────
export const createTopicSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  maxStudents: z.number().min(1).max(10),
  specializationId: z.string().min(1, "Specialization is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  // Rich project details — sent by the professor, reviewed by admin.
  requirements: z.array(z.string().trim().min(1)).optional().default([]),
  objectives: z.array(z.string().trim().min(1)).optional().default([]),
  // Reference links (articles, videos…) that help students.
  references: z
    .array(referenceSchema)
    .max(20, "عدد كبير من المراجع")
    .optional()
    .default([]),
});

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  maxStudents: z.number().min(1).max(10).optional(),
  requirements: z.array(z.string().trim().min(1)).optional(),
  objectives: z.array(z.string().trim().min(1)).optional(),
  references: z
    .array(referenceSchema)
    .max(20, "عدد كبير من المراجع")
    .optional(),
});

// ─── APPLICATIONS ──────────────────────────────────────────────
export const listApplicationsSchema = z.object({
  topicId: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
});

// ─── MILESTONES ────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  deadline: z.coerce.date(),
  order: z.number().int().min(1),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  order: z.number().int().min(1).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
});

// ─── TYPES ─────────────────────────────────────────────────────
export type TopicReference = z.infer<typeof referenceSchema>;
export type CreateTopicDTO = z.infer<typeof createTopicSchema>;
export type UpdateTopicDTO = z.infer<typeof updateTopicSchema>;
export type ListApplicationsDTO = z.infer<typeof listApplicationsSchema>;
export type CreateMilestoneDTO = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneDTO = z.infer<typeof updateMilestoneSchema>;
