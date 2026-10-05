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
} from "./messages.validation";
import * as svc from "./messages.service";

/* Current user id — same tolerant extraction used elsewhere in the app. */
function currentUserId(req: Request): string {
  const id =
    (req as any).user?.id ?? (req as any).user?.userId ?? (req as any).userId;
  if (!id)
    throw new BadRequestException("Unauthenticated", ErrorCodeEnum.VALIDATION_ERROR);
  return id as string;
}

/** Validation failures read as a sentence, not as a zod dump. */
function parse<T>(schema: { safeParse: (v: unknown) => any }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new BadRequestException(
      first?.message && !/^(Invalid|Expected|Required)/.test(first.message)
        ? first.message
        : `Validation error → ${r.error.issues
            .map((i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join(" | ")}`,
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
  svc.presenceService(parse<{ ids: string[] }>(presenceSchema, req.query).ids),
);
