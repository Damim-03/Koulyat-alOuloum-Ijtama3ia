import { z } from "zod";

// ─── BROWSE PUBLISHED TOPICS (public home page) ────────────────
// Same filters as the student browse page, plus pagination because the
// public landing page shows paged cards.
export const listPublicTopicsSchema = z.object({
  departmentId: z.string().optional(),
  specializationId: z.string().optional(),
  academicYearId: z.string().optional(),
  search: z.string().optional(),
  // "available" → approved/open, "reserved" → full. Omitted → all visible.
  availability: z.enum(["available", "reserved"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListPublicTopicsDTO = z.infer<typeof listPublicTopicsSchema>;
