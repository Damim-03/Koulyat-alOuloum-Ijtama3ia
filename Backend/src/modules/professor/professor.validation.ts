import { z } from "zod";
import { topicExtrasShape } from "../../core/topic/topic-extras";
import { zmsg } from "../../core/i18n/zod";

// A single helpful reference for students: a title + a valid URL.
//
// `http`/`https` only. `.url()` alone accepts any scheme the URL parser does —
// `javascript:` and `data:` included — and these links are rendered as anchors
// for students and staff to click.
const referenceSchema = z.object({
  title: z.string().trim().min(1, zmsg("v.referenceTitleRequired")),
  url: z
    .string()
    .trim()
    .max(2048)
    .url(zmsg("v.urlInvalid"))
    .refine((u) => /^https?:\/\//i.test(u), zmsg("v.urlScheme")),
});

// ─── TOPICS ────────────────────────────────────────────────────
export const createTopicSchema = z.object({
  title: z.string().min(1, zmsg("v.titleRequired")),
  description: z.string().min(1, zmsg("v.descriptionRequired")),
  maxStudents: z.number().min(1).max(10),
  /**
   * كم فريقاً يتقدّم إلى الموضوع معاً قبل أن يُغلق. و`null` بلا سقف.
   */
  maxRequests: z.number().int().min(1).max(50).nullable().optional(),
  specializationId: z.string().min(1, zmsg("v.specializationRequired")),
  academicYearId: z.string().min(1, zmsg("v.academicYearRequired")),
  // Rich project details — sent by the professor, reviewed by admin.
  requirements: z.array(z.string().trim().min(1)).optional().default([]),
  objectives: z.array(z.string().trim().min(1)).optional().default([]),
  // Reference links (articles, videos…) that help students.
  references: z
    .array(referenceSchema)
    .max(20, zmsg("v.tooManyReferences"))
    .optional()
    .default([]),
  // The co-supervisor, short description and type (core/topic/topic-extras).
  ...topicExtrasShape,
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
    .min(1, zmsg("v.addOneStudent"))
    .max(10),
  leaderRegistrationNumber: z.string().trim().min(1, zmsg("v.chooseSender")),
});
export type CreateTopicWithGroupDTO = z.infer<
  typeof createTopicWithGroupSchema
>;

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  maxStudents: z.number().min(1).max(10).optional(),
  /**
   * كم فريقاً يتقدّم إلى الموضوع معاً قبل أن يُغلق. و`null` بلا سقف.
   */
  maxRequests: z.number().int().min(1).max(50).nullable().optional(),
  requirements: z.array(z.string().trim().min(1)).optional(),
  objectives: z.array(z.string().trim().min(1)).optional(),
  references: z
    .array(referenceSchema)
    .max(20, zmsg("v.tooManyReferences"))
    .optional(),
  // The edit dialog has always offered these two, and zod dropped them
  // silently — the professor moved a topic to another specialization, was
  // told it was saved, and nothing had changed. A rejected topic is often
  // rejected for exactly this, so correcting it has to actually work.
  // `updateTopicService` checks that each id exists before writing.
  specializationId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  ...topicExtrasShape,
});

// ─── APPLICATIONS ──────────────────────────────────────────────

/**
 * Student lookup for the "propose a topic with a team" dialog.
 *
 * `q` is required and at least two characters: an empty query must not turn
 * this into a roster listing.
 */
/**
 * A registration number, or letters of the names in any order — one letter is
 * enough; or nothing, to list the specialization's students.
 */
/** The year whose topic limit is asked; none: the current year. */
export const topicQuotaQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
});

export const searchStudentsSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  specializationId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchStudentsDTO = z.infer<typeof searchStudentsSchema>;

// ─── MILESTONES ────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  title: z.string().min(1, zmsg("v.titleRequired")),
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
