import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import {
    messagesApi,
    type MessagesListParams,
    type SendMessageInput,
    type BroadcastInput,
} from "../api/messages.api";

const KEYS = {
    inbox: (p?: object) => ["messages", "inbox", p ?? {}] as const,
    sent: (p?: object) => ["messages", "sent", p ?? {}] as const,
    unread: ["messages", "unread"] as const,
    one: (id: string | null) => ["messages", "one", id] as const,
};

/* ── queries ───────────────────────────────────────────────── */
export function useInbox(params?: MessagesListParams) {
    return useQuery({
        queryKey: KEYS.inbox(params),
        queryFn: () => messagesApi.listInbox(params),
    });
}

export function useSentMessages(params?: MessagesListParams) {
    return useQuery({
        queryKey: KEYS.sent(params),
        queryFn: () => messagesApi.listSent(params),
    });
}

/** Unread badge — refreshes periodically so new mail shows up. */
export function useUnreadMessagesCount() {
    return useQuery({
        queryKey: KEYS.unread,
        queryFn: messagesApi.unreadCount,
        refetchInterval: 60_000,
    });
}

export function useMessage(id: string | null) {
    return useQuery({
        queryKey: KEYS.one(id),
        queryFn: () => messagesApi.getMessage(id as string),
        enabled: !!id,
    });
}

/* ── mutations ─────────────────────────────────────────────── */
export function useSendMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: SendMessageInput) => messagesApi.sendMessage(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["messages", "sent"] });
            toast.success(t("toast.messageSent"));
        },
        onError: () => toast.error(t("toast.messageSendFailed")),
    });
}

export function useBroadcastMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: BroadcastInput) => messagesApi.broadcast(data),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["messages", "sent"] });
            toast.success(t("toast.broadcastSent", { count: res.recipients }));
        },
        onError: () => toast.error(t("toast.broadcastFailed")),
    });
}

export function useMarkMessageRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => messagesApi.markRead(id),
        // Optimistic: drop the unread badge immediately.
        onMutate: async () => {
            await qc.cancelQueries({ queryKey: KEYS.unread });
            const prev = qc.getQueryData<number>(KEYS.unread);
            if (typeof prev === "number" && prev > 0)
                qc.setQueryData(KEYS.unread, prev - 1);
            return { prev };
        },
        onError: (_e, _id, ctx) => {
            if (ctx && typeof ctx.prev === "number")
                qc.setQueryData(KEYS.unread, ctx.prev);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["messages", "inbox"] });
            qc.invalidateQueries({ queryKey: KEYS.unread });
        },
    });
}

export function useMarkAllMessagesRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => messagesApi.markAllRead(),
        onSuccess: () => {
            qc.setQueryData(KEYS.unread, 0);
            qc.invalidateQueries({ queryKey: ["messages", "inbox"] });
            toast.success(t("toast.allMarkedRead"));
        },
        onError: () => toast.error(t("toast.operationFailed")),
    });
}

export function useDeleteInboxMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => messagesApi.deleteFromInbox(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["messages", "inbox"] });
            qc.invalidateQueries({ queryKey: KEYS.unread });
            toast.success(t("toast.messageRemovedFromInbox"));
        },
        onError: () => toast.error(t("toast.deleteFailed")),
    });
}