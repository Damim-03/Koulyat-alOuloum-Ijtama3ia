import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
    sendMessageSchema,
    broadcastMessageSchema,
    listMessagesSchema,
} from "./messages.validation";
import * as svc from "./messages.service";

/* Current user id — same tolerant extraction used elsewhere in the app. */
function currentUserId(req: Request): string {
    const id =
        (req as any).user?.id ?? (req as any).user?.userId ?? (req as any).userId;
    if (!id)
        throw new BadRequestException(
            "Unauthenticated",
            ErrorCodeEnum.VALIDATION_ERROR,
        );
    return id as string;
}

/* ── send (direct) ─────────────────────────────────────────── */
export const sendMessageController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const dto = sendMessageSchema.parse(req.body);
        const message = await svc.sendMessageService(currentUserId(req), dto);
        return res.status(HTTPSTATUS.CREATED).json({ message });
    } catch (e) {
        next(e);
    }
};

/* ── broadcast (admin/owner — guarded in routes) ───────────── */
export const broadcastMessageController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const dto = broadcastMessageSchema.parse(req.body);
        const result = await svc.broadcastMessageService(currentUserId(req), dto);
        return res.status(HTTPSTATUS.CREATED).json(result);
    } catch (e) {
        next(e);
    }
};

/* ── inbox / sent ──────────────────────────────────────────── */
export const listInboxController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const q = listMessagesSchema.parse(req.query);
        const result = await svc.listInboxService(currentUserId(req), q);
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};

export const listSentController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const q = listMessagesSchema.parse(req.query);
        const result = await svc.listSentService(currentUserId(req), q);
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};

/* ── unread count / read / read-all ────────────────────────── */
export const unreadCountController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await svc.unreadCountService(currentUserId(req));
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};

export const markMessageReadController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await svc.markMessageReadService(
            currentUserId(req),
            req.params.id as string,
        );
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};

export const markAllReadController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await svc.markAllReadService(currentUserId(req));
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};

/* ── single message / delete from inbox ────────────────────── */
export const getMessageController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const message = await svc.getMessageService(
            currentUserId(req),
            req.params.id as string,
        );
        return res.status(HTTPSTATUS.OK).json({ message });
    } catch (e) {
        next(e);
    }
};

export const deleteInboxMessageController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await svc.deleteInboxMessageService(
            currentUserId(req),
            req.params.id as string,
        );
        return res.status(HTTPSTATUS.OK).json(result);
    } catch (e) {
        next(e);
    }
};