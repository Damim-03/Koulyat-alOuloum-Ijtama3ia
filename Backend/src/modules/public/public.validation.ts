import { z } from "zod";

// ─── BROWSE PUBLISHED TOPICS (public home page) ────────────────
// Same filters as the student browse page, plus pagination because the
// public landing page shows paged cards.
export const listPublicTopicsSchema = z.object({
  departmentId: z.string().optional(),
  specializationId: z.string().optional(),
  academicYearId: z.string().optional(),
  // المشرف: الطالب يختار أستاذه كثيراً قبل أن يختار موضوعه.
  professorId: z.string().optional(),
  // حجم المجموعة: فريقٌ من ثلاثة يبحث عمّا يسع ثلاثة بالضبط.
  maxStudents: z.coerce.number().int().min(1).max(20).optional(),
  search: z.string().trim().max(120).optional(),
  // "available" → approved/open, "reserved" → full. Omitted → all visible.
  availability: z.enum(["available", "reserved"]).optional(),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListPublicTopicsDTO = z.infer<typeof listPublicTopicsSchema>;
