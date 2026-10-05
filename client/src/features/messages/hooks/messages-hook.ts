import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { serverMessage } from "../../../lib/api/error";
import {
  messagesApi,
  type AudienceInput,
  type BroadcastInput,
  type ContactRole,
  type InboxItem,
  type MessagesListParams,
  type MessagesPage,
  type MessagesSummary,
  type SendMessageInput,
  type ThreadMessage,
  type ThreadResponse,
} from "../api/messages.api";

/**
 * Every key starts with "messages", so one realtime event — which the server
 * sends to the sender and recipients only — refreshes whatever is on screen.
 */
export const MSG_KEYS = {
  all: ["messages"] as const,
  inbox: (p?: object) => ["messages", "inbox", p ?? {}] as const,
  sent: (p?: object) => ["messages", "sent", p ?? {}] as const,
  summary: ["messages", "summary"] as const,
  unread: ["messages", "unread"] as const,
  thread: (id: string | null) => ["messages", "thread", id] as const,
  contacts: (s: string, role?: string) => ["messages", "contacts", s, role ?? "all"] as const,
  audience: (p: object) => ["messages", "audience", p] as const,
};

/* ── queries ───────────────────────────────────────────────── */
export function useInbox(params?: MessagesListParams, enabled = true) {
  return useQuery({
    queryKey: MSG_KEYS.inbox(params),
    queryFn: () => messagesApi.listInbox(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSentMessages(params?: MessagesListParams, enabled = true) {
  return useQuery({
    queryKey: MSG_KEYS.sent(params),
    queryFn: () => messagesApi.listSent(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Unread / inbox / sent. Realtime keeps it current; the slow interval is only
 * a safety net for a dropped socket.
 */
export function useMessagesSummary(enabled = true) {
  return useQuery({
    queryKey: MSG_KEYS.summary,
    queryFn: messagesApi.summary,
    refetchInterval: 120_000,
    enabled,
  });
}

/** Kept for older callers. */
export function useUnreadMessagesCount() {
  const q = useMessagesSummary();
  return { ...q, data: q.data?.unread ?? 0 };
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: MSG_KEYS.thread(id),
    queryFn: () => messagesApi.getThread(id as string),
    enabled: !!id,
    retry: (count, e) => !(e as { response?: { status?: number } })?.response?.status && count < 2,
  });
}

/** Kept for older callers. */
export function useMessage(id: string | null) {
  const q = useThread(id);
  return { ...q, data: q.data?.message };
}

export function useContacts(search: string, enabled = true, role?: ContactRole) {
  return useQuery({
    queryKey: MSG_KEYS.contacts(search, role),
    // One role: a longer list of it. All: a share for each.
    queryFn: () => messagesApi.contacts(search, role, role ? 30 : 8),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAudience(params: AudienceInput, enabled = true) {
  return useQuery({
    queryKey: MSG_KEYS.audience(params),
    queryFn: () => messagesApi.audience(params),
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

/* ── cache helpers ─────────────────────────────────────────── */
type InboxPage = MessagesPage<InboxItem>;

/** Applies `fn` to every cached inbox page, returning a snapshot to undo. */
function patchInbox(qc: QueryClient, fn: (items: InboxItem[]) => InboxItem[]) {
  const snapshot = qc.getQueriesData<InboxPage>({ queryKey: ["messages", "inbox"] });
  for (const [key, page] of snapshot) {
    if (page) qc.setQueryData<InboxPage>(key, { ...page, items: fn(page.items) });
  }
  return snapshot;
}

function patchSummary(qc: QueryClient, fn: (s: MessagesSummary) => MessagesSummary) {
  const prev = qc.getQueryData<MessagesSummary>(MSG_KEYS.summary);
  if (prev) qc.setQueryData(MSG_KEYS.summary, fn(prev));
  return prev;
}

function restore(qc: QueryClient, snapshot?: [readonly unknown[], unknown][], summary?: MessagesSummary) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
  if (summary) qc.setQueryData(MSG_KEYS.summary, summary);
}

/* ── mutations ─────────────────────────────────────────────── */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageInput) => messagesApi.sendMessage(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", "sent"] });
      qc.invalidateQueries({ queryKey: MSG_KEYS.summary });
      toast.success(t("toast.messageSent"));
    },
    // The server says *why* — "not related to you", "suspended account" — and
    // that is the one thing the sender needs to fix it.
    onError: (e) => toast.error(serverMessage(e, t("toast.messageSendFailed"))),
  });
}

export function useBroadcastMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BroadcastInput) => messagesApi.broadcast(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["messages", "sent"] });
      qc.invalidateQueries({ queryKey: MSG_KEYS.summary });
      toast.success(t("toast.broadcastSent", { count: res.recipients }));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.broadcastFailed"))),
  });
}

/**
 * A reply appears in the conversation the instant it is sent, marked as
 * sending; it is replaced by the stored message, or marked failed with the
 * text kept for a retry.
 */
export function useReplyMessage(threadKeyId: string | null, me?: ThreadMessage["sender"]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, body, all }: { parentId: string; body: string; all?: boolean; tempId: string }) =>
      messagesApi.reply(parentId, { body, all }),
    onMutate: async ({ body, tempId, parentId }) => {
      const key = MSG_KEYS.thread(threadKeyId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ThreadResponse>(key);
      if (prev && me) {
        const optimistic: ThreadMessage = {
          id: tempId,
          senderId: me.id,
          subject: null,
          body,
          broadcast: null,
          threadId: prev.rootId,
          replyToId: parentId,
          createdAt: new Date().toISOString(),
          sender: me,
          mine: true,
          readAt: null,
          recipientsCount: 0,
          readCount: 0,
          recipients: [],
          pending: "sending",
        };
        qc.setQueryData<ThreadResponse>(key, { ...prev, thread: [...prev.thread, optimistic] });
      }
    },
    onSuccess: (message, { tempId }) => {
      const key = MSG_KEYS.thread(threadKeyId);
      const cur = qc.getQueryData<ThreadResponse>(key);
      if (cur)
        qc.setQueryData<ThreadResponse>(key, {
          ...cur,
          thread: cur.thread.map((m) => (m.id === tempId ? { ...message, pending: undefined } : m)),
        });
      qc.invalidateQueries({ queryKey: ["messages", "sent"] });
      qc.invalidateQueries({ queryKey: MSG_KEYS.summary });
    },
    onError: (e, { tempId }) => {
      const key = MSG_KEYS.thread(threadKeyId);
      const cur = qc.getQueryData<ThreadResponse>(key);
      if (cur)
        qc.setQueryData<ThreadResponse>(key, {
          ...cur,
          thread: cur.thread.map((m) => (m.id === tempId ? { ...m, pending: "failed" } : m)),
        });
      toast.error(serverMessage(e, t("toast.messageSendFailed")));
    },
  });
}

/** Drops a failed optimistic reply from the conversation. */
export function discardPending(qc: QueryClient, threadKeyId: string | null, tempId: string) {
  const key = MSG_KEYS.thread(threadKeyId);
  const cur = qc.getQueryData<ThreadResponse>(key);
  if (cur) qc.setQueryData<ThreadResponse>(key, { ...cur, thread: cur.thread.filter((m) => m.id !== tempId) });
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.markRead(id),
    // The unread mark and badge go the moment the message is opened.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["messages", "inbox"] });
      const now = new Date().toISOString();
      let dropped = 0;
      const snapshot = patchInbox(qc, (items) =>
        items.map((it) => {
          if (it.message.id !== id || it.readAt) return it;
          dropped = 1;
          return { ...it, readAt: now };
        }),
      );
      const summary = patchSummary(qc, (s) => ({ ...s, unread: Math.max(0, s.unread - dropped) }));
      return { snapshot, summary };
    },
    onError: (_e, _id, ctx) => restore(qc, ctx?.snapshot, ctx?.summary),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: MSG_KEYS.summary });
      qc.invalidateQueries({ queryKey: ["messages", "inbox"] });
    },
  });
}

export function useMarkMessageUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.markUnread(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["messages", "inbox"] });
      const snapshot = patchInbox(qc, (items) =>
        items.map((it) => (it.message.id === id ? { ...it, readAt: null } : it)),
      );
      const summary = patchSummary(qc, (s) => ({ ...s, unread: s.unread + 1 }));
      return { snapshot, summary };
    },
    onError: (e, _id, ctx) => {
      restore(qc, ctx?.snapshot, ctx?.summary);
      toast.error(serverMessage(e, t("toast.operationFailed")));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useMarkAllMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => messagesApi.markAllRead(),
    onMutate: async () => {
      const now = new Date().toISOString();
      const snapshot = patchInbox(qc, (items) => items.map((it) => (it.readAt ? it : { ...it, readAt: now })));
      const summary = patchSummary(qc, (s) => ({ ...s, unread: 0 }));
      return { snapshot, summary };
    },
    onSuccess: () => toast.success(t("toast.allMarkedRead")),
    onError: (e, _v, ctx) => {
      restore(qc, ctx?.snapshot, ctx?.summary);
      toast.error(serverMessage(e, t("toast.operationFailed")));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useDeleteInboxMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.deleteFromInbox(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["messages", "inbox"] });
      let wasUnread = 0;
      const snapshot = patchInbox(qc, (items) =>
        items.filter((it) => {
          if (it.message.id !== id) return true;
          if (!it.readAt) wasUnread = 1;
          return false;
        }),
      );
      const summary = patchSummary(qc, (s) => ({
        ...s,
        inbox: Math.max(0, s.inbox - 1),
        unread: Math.max(0, s.unread - wasUnread),
      }));
      return { snapshot, summary };
    },
    onSuccess: () => toast.success(t("toast.messageRemovedFromInbox")),
    onError: (e, _id, ctx) => {
      restore(qc, ctx?.snapshot, ctx?.summary);
      toast.error(serverMessage(e, t("toast.deleteFailed")));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
