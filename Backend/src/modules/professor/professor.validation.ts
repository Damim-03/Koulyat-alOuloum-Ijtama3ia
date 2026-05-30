import { z } from "zod";

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

export type CreateTopicDTO = z.infer<typeof createTopicSchema>;
export type UpdateTopicDTO = z.infer<typeof updateTopicSchema>;