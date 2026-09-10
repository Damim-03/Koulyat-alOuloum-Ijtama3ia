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

/**
 * A topic proposed together with the team meant to take it.
 *
 * The members are registration numbers rather than ids: the professor has no
 * endpoint that lists students, and this is the same shape the student's own
 * group request uses.
 */
export const createTopicWithGroupSchema = createTopicSchema.extend({
  memberRegistrationNumbers: z
    .array(z.string().trim().min(1))
    .min(1, "أضف طالباً واحداً على الأقل")
    .max(10),
  leaderRegistrationNumber: z.string().trim().min(1, "اختر المرسِل"),
});
export type CreateTopicWithGroupDTO = z.infer<
  typeof createTopicWithGroupSchema
>;

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
  // The edit dialog has always offered these two, and zod dropped them
  // silently — the professor moved a topic to another specialization, was
  // told it was saved, and nothing had changed. A rejected topic is often
  // rejected for exactly this, so correcting it has to actually work.
  // `updateTopicService` checks that each id exists before writing.
  specializationId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
});

// ─── APPLICATIONS ──────────────────────────────────────────────

/**
 * Student lookup for the "propose a topic with a team" dialog.
 *
 * `q` is required and at least two characters: an empty query must not turn
 * this into a roster listing.
 */
export const searchStudentsSchema = z.object({
  q: z.string().trim().min(2, "اكتب حرفين على الأقل"),
  specializationId: z.string().trim().min(1).optional(),
});
export type SearchStudentsDTO = z.infer<typeof searchStudentsSchema>;

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
export type CreateMilestoneDTO = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneDTO = z.infer<typeof updateMilestoneSchema>;
