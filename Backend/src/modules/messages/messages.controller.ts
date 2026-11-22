import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  sendMessageSchema,
  replyMessageSchema,
  broadcastMessageSchema,
  audienceSchema,
  listMessagesSchema,
  contactsSchema,
  chatSchema,
  presenceSchema,
  editMessageSchema,
} from "./messages.validation";
import * as svc from "./messages.service";
import { deleteDraftService, openAttachmentService, saveUploadService } from "./attachments";
import { issuesMessage } from "../../core/i18n";
import { isZodDefaultMessage } from "../../core/i18n/zod";

/* Current user id — authMiddleware sets `req.user` on every messages route. */
const currentUserId = (req: Request): string => req.user!.userId;

/**
 * Validation failures read as a sentence, not as a zod dump: a message the
 * schema wrote is said as it is; zod's own general one ("expected array…", in
 * whatever language) names the fields instead.
 */
function parse<T>(schema: { safeParse: (v: unknown) => any }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    // A failed parse has at least one issue, and zod gives each a message.
    const first = r.error.issues[0];
    throw new BadRequestException(
      isZodDefaultMessage(first) ? issuesMessage(r.error.issues) : first.message,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
  return r.data as T;
}

type Handler = (req: Request) => Promise<unknown>;
const handle =
  (fn: Handler, status: number = HTTPSTATUS.OK) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.status(status).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

const idOf = (req: Request) => req.params.id as string;

/* ── send / reply / broadcast ──────────────────────────────── */
export const sendMessageController = handle(
  async (req) => ({
    message: await svc.sendMessageService(currentUserId(req), parse(sendMessageSchema, req.body)),
  }),
  HTTPSTATUS.CREATED,
);

export const replyMessageController = handle(
  async (req) => ({
    message: await svc.replyMessageService(
      currentUserId(req),
      idOf(req),
      parse(replyMessageSchema, req.body),
    ),
  }),
  HTTPSTATUS.CREATED,
);

export const broadcastMessageController = handle(
  (req) => svc.broadcastMessageService(currentUserId(req), parse(broadcastMessageSchema, req.body)),
  HTTPSTATUS.CREATED,
);

export const audiencePreviewController = handle((req) =>
  svc.audiencePreviewService(currentUserId(req), parse(audienceSchema, req.query)),
);

export const contactsController = handle((req) =>
  svc.contactsService(currentUserId(req), parse(contactsSchema, req.query)),
);

/* ── inbox / sent / counters ───────────────────────────────── */
export const listInboxController = handle((req) =>
  svc.listInboxService(currentUserId(req), parse(listMessagesSchema, req.query)),
);

export const listSentController = handle((req) =>
  svc.listSentService(currentUserId(req), parse(listMessagesSchema, req.query)),
);

export const unreadCountController = handle((req) => svc.unreadCountService(currentUserId(req)));

export const summaryController = handle((req) => svc.summaryService(currentUserId(req)));

/* ── read state ────────────────────────────────────────────── */
export const markMessageReadController = handle((req) =>
  svc.markMessageReadService(currentUserId(req), idOf(req)),
);

export const markMessageUnreadController = handle((req) =>
  svc.markMessageUnreadService(currentUserId(req), idOf(req)),
);

export const markAllReadController = handle((req) => svc.markAllReadService(currentUserId(req)));

/* ── one message (with its conversation) / delete from inbox ── */
export const getMessageController = handle((req) =>
  svc.getMessageService(currentUserId(req), idOf(req)),
);

export const deleteInboxMessageController = handle((req) =>
  svc.deleteInboxMessageService(currentUserId(req), idOf(req)),
);

/* ── chats ─────────────────────────────────────────────────── */
export const conversationsController = handle((req) =>
  svc.conversationsService(
    currentUserId(req),
    Math.min(100, Math.max(1, Number(req.query.limit) || 60)),
  ),
);

export const chatController = handle((req) =>
  svc.chatService(currentUserId(req), req.params.userId as string, parse(chatSchema, req.query)),
);

export const markChatReadController = handle((req) =>
  svc.markChatReadService(currentUserId(req), req.params.userId as string),
);

export const presenceController = handle(async (req) =>
  svc.presenceService(currentUserId(req), req.user!.role, parse<{ ids: string[] }>(presenceSchema, req.query).ids),
);

/* ── edit (everyone, briefly) / withdraw for everyone (administration) ── */

/** `PATCH /messages/:id` — `{ body }`, within EDIT_WINDOW_MS of sending. */
export const editMessageController = handle(async (req) => ({
  message: await svc.editMessageService(currentUserId(req), idOf(req), parse(editMessageSchema, req.body)),
}));

/** `DELETE /messages/:id/for-everyone` — an administrator's own message. */
export const deleteForEveryoneController = handle((req) => svc.deleteForEveryoneService(currentUserId(req), idOf(req)));

/* ── files attached to messages (./attachments) ────────────── */

/** `POST /messages/attachments` — one file; it stays a draft until a message carries it. */
export const uploadAttachmentController = handle(
  async (req) => ({ attachment: await saveUploadService(currentUserId(req), req.file) }),
  HTTPSTATUS.CREATED,
);

/** `DELETE /messages/attachments/:id` — a draft taken back before sending. */
export const deleteAttachmentController = handle((req) => deleteDraftService(currentUserId(req), idOf(req)));

/**
 * `GET /messages/attachments/:id` — the file, to whoever may read its message.
 *
 * Downloaded, never rendered on this origin: `attachment`, `nosniff` and a
 * sandbox. `?inline=1` shows an image in place (the chat's thumbnails), and
 * images only — a PDF or a document is always a download.
 */
export const openAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await openAttachmentService(currentUserId(req), idOf(req));
    const inline = req.query.inline === "1" && a.mimeType.startsWith("image/");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (inline) res.setHeader("Content-Disposition", "inline");
    else res.attachment(a.fileName);
    // After `attachment()`, which would otherwise guess it from the name.
    res.setHeader("Content-Type", a.mimeType);
    res.sendFile(a.file, { dotfiles: "deny", cacheControl: false, lastModified: false, etag: false }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (e) {
    next(e);
  }
};
