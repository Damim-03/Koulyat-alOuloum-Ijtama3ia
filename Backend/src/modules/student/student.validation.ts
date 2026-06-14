import { z } from "zod";

// ─── BROWSE TOPICS ─────────────────────────────────────────────
export const listTopicsSchema = z.object({
  specializationId: z.string().optional(),
  academicYearId: z.string().optional(),
  search: z.string().optional(),
});

// ─── GROUP REQUESTS ────────────────────────────────────────────
// The leader submits ONE request for a topic: their own registration
// number plus their teammates', and a choice priority.
export const createGroupRequestSchema = z.object({
  topicId: z.string().min(1, "الموضوع مطلوب"),
  priority: z.coerce.number().int().min(1).max(10).default(1),
  // Registration numbers of teammates (NOT including the leader; the
  // leader is taken from the authenticated user).
  memberRegistrationNumbers: z
    .array(z.string().trim().min(1))
    .max(9, "عدد كبير جداً من الأعضاء")
    .optional()
    .default([]),
});

export type ListTopicsDTO = z.infer<typeof listTopicsSchema>;
export type CreateGroupRequestDTO = z.infer<typeof createGroupRequestSchema>;