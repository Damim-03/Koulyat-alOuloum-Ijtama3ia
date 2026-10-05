import { client } from "../../../lib/api/client";

const BASE = "/messages";

/* ── types (mirror the backend responses) ─────────────────── */
export interface MessageUserLite {
  id: string;
  firstName: string | null;
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  gender?: string | null;
  role: string;
  email?: string | null;
}

export interface MessageRecipientEntry {
  id?: string;
  userId?: string;
  readAt: string | null;
  user: MessageUserLite;
}

/** One message as the current user may see it (see `shapeMany` server-side). */
export interface ThreadMessage {
  id: string;
  senderId: string;
  subject: string | null;
  body: string;
  broadcast: string | null;
  threadId: string | null;
  replyToId: string | null;
  createdAt: string;
  sender: MessageUserLite;
  /** I wrote it. */
  mine: boolean;
  /** When I read it — for messages I received. */
  readAt: string | null;
  recipientsCount: number;
  /** For messages I sent. */
  readCount?: number;
  /** Mine: everyone with read times. Received direct: the other recipients. */
  recipients?: MessageRecipientEntry[];
  /** Client-only: an optimistic reply still on its way, or one that failed. */
  pending?: "sending" | "failed";
}

export interface ThreadResponse {
  message: ThreadMessage;
  thread: ThreadMessage[];
  rootId: string;
  subject: string | null;
}

/** Inbox rows are MessageRecipient records wrapping the message. */
export interface InboxItem {
  id: string;
  userId: string;
  readAt: string | null;
  message: {
    id: string;
    senderId: string;
    subject: string | null;
    body: string;
    broadcast: string | null;
    threadId: string | null;
    replyToId: string | null;
    createdAt: string;
    sender: MessageUserLite;
  };
}

export interface SentItem {
  id: string;
  senderId: string;
  subject: string | null;
  body: string;
  broadcast: string | null;
  threadId: string | null;
  replyToId: string | null;
  createdAt: string;
  recipients: MessageRecipientEntry[];
  _count: { recipients: number };
  readCount: number;
}

/** Kept for older imports. */
export type AppMessage = SentItem;

export interface MessagesPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type MessagesFilter = "all" | "unread" | "broadcast" | "direct";

export interface MessagesListParams {
  page?: number;
  limit?: number;
  search?: string;
  filter?: MessagesFilter;
  [key: string]: unknown;
}

export interface MessagesSummary {
  unread: number;
  inbox: number;
  sent: number;
}

export type ContactRelation = "admin" | "supervisor" | "teammate" | "professor" | "student";

export interface Contact extends MessageUserLite {
  relation: ContactRelation;
  detail: string | null;
  /** Registration number / university email — administration only. */
  handle: string | null;
  recent: boolean;
}

export type ContactRole = "admin" | "professor" | "student";

export interface ContactsResult {
  items: Contact[];
  /** How many match in each role — whichever role is being shown. */
  counts: Record<ContactRole, number>;
}

export interface SendMessageInput {
  recipientIds: string[];
  subject?: string;
  body: string;
}

export interface AudienceInput {
  target: "all" | "students" | "professors" | "admins";
  facultyId?: string;
  departmentId?: string;
  filiereId?: string;
  specializationId?: string;
  academicYearId?: string;
  level?: "licence" | "master" | "doctorate";
  project?: "with" | "without";
}

export interface BroadcastInput extends AudienceInput {
  subject?: string;
  body: string;
}

/* ── chats ─────────────────────────────────────────────────── */
/** The person on the other side of a chat. */
export interface ChatUser extends MessageUserLite {
  detail: string | null;
  /** Registration number — administration only. */
  handle: string | null;
  active: boolean;
  online: boolean;
  lastLoginAt: string | null;
}

export interface Conversation {
  user: ChatUser;
  unread: number;
  last: {
    id: string;
    subject: string | null;
    preview: string;
    broadcast: string | null;
    createdAt: string;
    mine: boolean;
    read: boolean;
  } | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  subject: string | null;
  body: string;
  broadcast: string | null;
  threadId: string | null;
  replyToId: string | null;
  createdAt: string;
  mine: boolean;
  /** Mine: when they read it. Theirs: when I did. */
  readAt: string | null;
  recipientsCount: number;
  /** Client-only, for a message still on its way or one that failed. */
  pending?: "sending" | "failed";
}

export interface ChatPage {
  user: ChatUser;
  canWrite: boolean;
  hasMore: boolean;
  items: ChatMessage[];
}

/* ── api ───────────────────────────────────────────────────── */
export const messagesApi = {
  listInbox: (params?: MessagesListParams) =>
    client.get<MessagesPage<InboxItem>>(`${BASE}/inbox`, { params }).then((r) => r.data),

  listSent: (params?: MessagesListParams) =>
    client.get<MessagesPage<SentItem>>(`${BASE}/sent`, { params }).then((r) => r.data),

  summary: () => client.get<MessagesSummary>(`${BASE}/summary`).then((r) => r.data),

  unreadCount: () =>
    client.get<{ count: number }>(`${BASE}/unread-count`).then((r) => r.data.count),

  getThread: (id: string) => client.get<ThreadResponse>(`${BASE}/${id}`).then((r) => r.data),

  /** Kept for older callers: the message alone. */
  getMessage: (id: string) =>
    client.get<ThreadResponse>(`${BASE}/${id}`).then((r) => r.data.message),

  /** Without `role`, each role gets its own `limit`. */
  contacts: (search?: string, role?: ContactRole, limit = 12) =>
    client
      .get<ContactsResult>(`${BASE}/contacts`, { params: { search: search || undefined, role, limit } })
      .then((r) => r.data),

  audience: (params: AudienceInput) =>
    client
      .get<{ count: number; sample: MessageUserLite[] }>(`${BASE}/audience`, { params })
      .then((r) => r.data),

  sendMessage: (data: SendMessageInput) =>
    client.post<{ message: ThreadMessage }>(`${BASE}`, data).then((r) => r.data.message),

  reply: (id: string, data: { body: string; all?: boolean }) =>
    client.post<{ message: ThreadMessage }>(`${BASE}/${id}/reply`, data).then((r) => r.data.message),

  broadcast: (data: BroadcastInput) =>
    client.post<{ id: string; recipients: number }>(`${BASE}/broadcast`, data).then((r) => r.data),

  markRead: (id: string) => client.patch(`${BASE}/${id}/read`).then((r) => r.data),

  markUnread: (id: string) => client.patch(`${BASE}/${id}/unread`).then((r) => r.data),

  markAllRead: () => client.patch(`${BASE}/read-all`).then((r) => r.data),

  conversations: () =>
    client
      .get<{ items: Conversation[]; unread: number }>(`${BASE}/conversations`, { params: { limit: 80 } })
      .then((r) => r.data),

  chat: (userId: string, before?: string) =>
    client
      .get<ChatPage>(`${BASE}/chat/${userId}`, { params: { before, limit: 40 } })
      .then((r) => r.data),

  markChatRead: (userId: string) => client.patch(`${BASE}/chat/${userId}/read`).then((r) => r.data),

  /** Removes it from my inbox only; the sender's copy stays. */
  deleteFromInbox: (id: string) => client.delete(`${BASE}/${id}`).then((r) => r.data),
};
