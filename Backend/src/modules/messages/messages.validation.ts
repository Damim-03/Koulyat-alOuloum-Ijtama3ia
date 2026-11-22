import { z } from "zod";
import { entityId } from "../../core/validation/id";
import { zmsg } from "../../core/i18n/zod";
import { tr } from "../../core/i18n";
import { MAX_FILES } from "./attachments";

const subject = z.string().trim().max(200).optional();
/**
 * A message may be a file alone: then its text may be empty. The files are
 * drafts uploaded first (./attachments); how many one message carries is
 * checked again where they are claimed.
 */
const optionalBody = z.string().trim().max(5000).optional().default("");
const attachmentIds = z
  .array(entityId)
  .max(MAX_FILES, { error: () => tr("messages.tooManyFiles", { max: MAX_FILES }) })
  .optional();
const textOrFiles = (v: { body: string; attachmentIds?: string[] }) => v.body.length > 0 || (v.attachmentIds?.length ?? 0) > 0;
const textOrFilesIssue = { ...zmsg("messages.bodyOrFile"), path: ["body"] };

/**
 * A query-string boolean. `z.coerce.boolean()` turned the string "false" into
 * `true` — any non-empty string is truthy — so `?unread=false` showed only the
 * unread messages.
 */
const booleanish = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const sendMessageSchema = z
  .object({
    recipientIds: z.array(entityId).min(1).max(200),
    subject,
    body: optionalBody,
    attachmentIds,
  })
  .refine(textOrFiles, textOrFilesIssue);
export type SendMessageDTO = z.infer<typeof sendMessageSchema>;

export const replyMessageSchema = z
  .object({
    body: optionalBody,
    attachmentIds,
    /** Also to the other recipients of the message answered (direct only). */
    all: z.boolean().optional(),
  })
  .refine(textOrFiles, textOrFilesIssue);
export type ReplyMessageDTO = z.infer<typeof replyMessageSchema>;

/** New text for a message already sent; whether it may be empty depends on its files. */
export const editMessageSchema = z.object({ body: z.string().trim().max(5000) });
export type EditMessageDTO = z.infer<typeof editMessageSchema>;

/**
 * Who a broadcast reaches. The academic filters narrow students (and, for
 * faculty/department, professors); the most specific one given wins.
 */
const audienceShape = {
  target: z.enum(["all", "students", "professors", "admins"]),
  facultyId: entityId.optional(),
  departmentId: entityId.optional(),
  filiereId: entityId.optional(),
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(),
  level: z.enum(["licence", "master", "doctorate"]).optional(),
  /** Students in a project, or still without one. */
  project: z.enum(["with", "without"]).optional(),
};

export const audienceSchema = z.object(audienceShape);
export type AudienceDTO = z.infer<typeof audienceSchema>;

export const broadcastMessageSchema = z
  .object({ ...audienceShape, subject, body: optionalBody, attachmentIds })
  .refine(textOrFiles, textOrFilesIssue);
export type BroadcastMessageDTO = z.infer<typeof broadcastMessageSchema>;

export const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  filter: z.enum(["all", "unread", "broadcast", "direct"]).optional(),
  /** Kept for older clients; `filter=unread` says the same. */
  unread: booleanish.optional(),
});
export type ListMessagesDTO = z.infer<typeof listMessagesSchema>;

export const contactsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  /** One role only; without it, each role gets its own `limit`. */
  role: z.enum(["admin", "professor", "student"]).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(12),
});
export type ContactsDTO = z.infer<typeof contactsSchema>;

export const chatSchema = z.object({
  /** Older than this — for scrolling back through the conversation. */
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});
export type ChatDTO = z.infer<typeof chatSchema>;

export const presenceSchema = z.object({
  ids: z
    .string()
    .max(4000)
    .transform((v) => v.split(",").map((x) => x.trim()).filter(Boolean)),
});
