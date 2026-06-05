import { z } from "zod";

// ─── TOPICS ────────────────────────────────────────────────────
export const createTopicSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  maxStudents: z.number().min(1).max(10),
  specializationId: z.string().min(1, "Specialization is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
});

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  maxStudents: z.number().min(1).max(10).optional(),
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
export type CreateTopicDTO = z.infer<typeof createTopicSchema>;
export type UpdateTopicDTO = z.infer<typeof updateTopicSchema>;
export type ListApplicationsDTO = z.infer<typeof listApplicationsSchema>;
export type CreateMilestoneDTO = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneDTO = z.infer<typeof updateMilestoneSchema>;