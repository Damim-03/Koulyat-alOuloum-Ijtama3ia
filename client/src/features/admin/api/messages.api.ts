import { client } from "../../../lib/api/client";

const BASE = "/messages";

/* ── types (mirror the backend responses) ─────────────────── */
export interface MessageUserLite {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: string;
}

export interface MessageRecipientEntry {
    id: string;
    userId: string;
    readAt: string | null;
    user: MessageUserLite;
}

export interface AppMessage {
    id: string;
    senderId: string;
    subject: string | null;
    body: string;
    broadcast: string | null;
    createdAt: string;
    sender: MessageUserLite;
    recipients?: MessageRecipientEntry[];
    _count?: { recipients: number };
}

/** Inbox rows are MessageRecipient records wrapping the message. */
export interface InboxItem {
    id: string;
    userId: string;
    readAt: string | null;
    message: AppMessage;
}

export interface MessagesPage<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

export interface MessagesListParams {
    page?: number;
    limit?: number;
    search?: string;
    unread?: boolean;
    [key: string]: unknown;
}

export interface SendMessageInput {
    recipientIds: string[];
    subject?: string;
    body: string;
}

export interface BroadcastInput {
    target: "all" | "students" | "professors";
    specializationId?: string;
    subject?: string;
    body: string;
}

/* ── api ───────────────────────────────────────────────────── */
export const messagesApi = {
    // inbox / sent
    listInbox: (params?: MessagesListParams) =>
        client
            .get<MessagesPage<InboxItem>>(`${BASE}/inbox`, { params })
            .then((r) => r.data),

    listSent: (params?: MessagesListParams) =>
        client
            .get<MessagesPage<AppMessage>>(`${BASE}/sent`, { params })
            .then((r) => r.data),

    unreadCount: () =>
        client
            .get<{ count: number }>(`${BASE}/unread-count`)
            .then((r) => r.data.count),

    getMessage: (id: string) =>
        client
            .get<{ message: AppMessage }>(`${BASE}/${id}`)
            .then((r) => r.data.message),

    // sending
    sendMessage: (data: SendMessageInput) =>
        client
            .post<{ message: AppMessage }>(`${BASE}`, data)
            .then((r) => r.data.message),

    broadcast: (data: BroadcastInput) =>
        client
            .post<{ id: string; recipients: number }>(`${BASE}/broadcast`, data)
            .then((r) => r.data),

    // read state
    markRead: (id: string) =>
        client.patch(`${BASE}/${id}/read`).then((r) => r.data),

    markAllRead: () => client.patch(`${BASE}/read-all`).then((r) => r.data),

    // remove from my inbox only
    deleteFromInbox: (id: string) =>
        client.delete(`${BASE}/${id}`).then((r) => r.data),
};