import { z } from "zod";

export const sendMessageSchema = z.object({
    recipientIds: z.array(z.string().uuid()).min(1).max(200),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(5000),
});
export type SendMessageDTO = z.infer<typeof sendMessageSchema>;

export const broadcastMessageSchema = z.object({
    target: z.enum(["all", "students", "professors"]),
    // Optional narrowing: broadcast to one specialization's students only.
    specializationId: z.string().uuid().optional(),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(5000),
});
export type BroadcastMessageDTO = z.infer<typeof broadcastMessageSchema>;

export const listMessagesSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().optional(),
    unread: z.coerce.boolean().optional(),
});
export type ListMessagesDTO = z.infer<typeof listMessagesSchema>;