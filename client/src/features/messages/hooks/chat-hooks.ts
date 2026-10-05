import { useCallback, useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { serverMessage } from "../../../lib/api/error";
import { useSocket } from "../../../app/socket-context";
import { messagesApi, type ChatMessage, type ChatPage } from "../api/messages.api";

/**
 * Chats: the messages exchanged with one person, as a messenger shows them.
 * Keys start with "messages", so the realtime event that the server sends to
 * both sides of a message refreshes the list, the chat and the badge at once.
 */
export const CHAT_KEYS = {
  list: ["messages", "conversations"] as const,
  chat: (userId: string | null) => ["messages", "chat", userId] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: CHAT_KEYS.list,
    queryFn: messagesApi.conversations,
    // Online dots; messages themselves arrive through the socket.
    refetchInterval: 60_000,
  });
}

/** The newest page first; older pages are fetched as the reader scrolls up. */
export function useChat(userId: string | null) {
  return useInfiniteQuery({
    queryKey: CHAT_KEYS.chat(userId),
    queryFn: ({ pageParam }) => messagesApi.chat(userId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: ChatPage) => (last.hasMore ? last.items[0]?.createdAt : undefined),
    enabled: !!userId,
    // Presence in the header.
    refetchInterval: 30_000,
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => messagesApi.markChatRead(userId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CHAT_KEYS.list });
      qc.invalidateQueries({ queryKey: ["messages", "summary"] });
    },
  });
}

type ChatData = InfiniteData<ChatPage, string | undefined>;

function patchNewest(qc: ReturnType<typeof useQueryClient>, userId: string, fn: (items: ChatMessage[]) => ChatMessage[]) {
  const key = CHAT_KEYS.chat(userId);
  const cur = qc.getQueryData<ChatData>(key);
  if (!cur?.pages.length) return;
  const [newest, ...rest] = cur.pages;
  qc.setQueryData<ChatData>(key, { ...cur, pages: [{ ...newest, items: fn(newest.items) }, ...rest] });
}

/**
 * Sending in a chat: the bubble is drawn the instant Enter is pressed, with a
 * clock; the stored message replaces it, or it turns red with a retry.
 */
export function useSendChat(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body }: { body: string; tempId: string }) =>
      messagesApi.sendMessage({ recipientIds: [userId as string], body }),
    onMutate: async ({ body, tempId }) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: CHAT_KEYS.chat(userId) });
      patchNewest(qc, userId, (items) => [
        ...items,
        {
          id: tempId,
          senderId: "me",
          subject: null,
          body,
          broadcast: null,
          threadId: null,
          replyToId: null,
          createdAt: new Date().toISOString(),
          mine: true,
          readAt: null,
          recipientsCount: 1,
          pending: "sending",
        },
      ]);
    },
    onSuccess: (m, { tempId }) => {
      if (!userId) return;
      patchNewest(qc, userId, (items) =>
        items.map((x) =>
          x.id === tempId
            ? { ...x, id: m.id, senderId: m.senderId, createdAt: String(m.createdAt), pending: undefined }
            : x,
        ),
      );
      qc.invalidateQueries({ queryKey: CHAT_KEYS.list });
      qc.invalidateQueries({ queryKey: ["messages", "summary"] });
    },
    onError: (e, { tempId }) => {
      if (userId) patchNewest(qc, userId, (items) => items.map((x) => (x.id === tempId ? { ...x, pending: "failed" } : x)));
      toast.error(serverMessage(e, t("toast.messageSendFailed")));
    },
  });
}

export function useDiscardFailed(userId: string | null) {
  const qc = useQueryClient();
  return useCallback(
    (tempId: string) => userId && patchNewest(qc, userId, (items) => items.filter((x) => x.id !== tempId)),
    [qc, userId],
  );
}

/**
 * "Typing…" both ways. `notify()` is throttled — one event every few
 * seconds while keys are pressed, and a stop when the text is sent or
 * cleared; the other side's hint fades by itself if the stop never comes.
 */
export function useTyping(otherId: string | null) {
  const socket = useSocket();
  const [theirs, setTheirs] = useState(false);
  const last = useRef(0);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket || !otherId) return;
    const on = (p: { from: string; active: boolean }) => {
      if (p.from !== otherId) return;
      setTheirs(p.active);
      if (fade.current) clearTimeout(fade.current);
      if (p.active) fade.current = setTimeout(() => setTheirs(false), 5000);
    };
    socket.on("typing", on);
    return () => {
      socket.off("typing", on);
      if (fade.current) clearTimeout(fade.current);
    };
  }, [socket, otherId]);

  const notify = useCallback(
    (active: boolean) => {
      if (!socket || !otherId) return;
      const now = Date.now();
      if (active && now - last.current < 2500) return;
      last.current = active ? now : 0;
      socket.emit("typing", { to: otherId, active });
    },
    [socket, otherId],
  );

  // A new message from them ends their "typing".
  const clearTheirs = useCallback(() => setTheirs(false), []);

  return { theirs, notify, clearTheirs };
}

/**
 * Everyone typing to me right now — for the chat list, which shows
 * "typing…" in place of the last line, as a messenger does. A hint with no
 * stop fades after a few seconds.
 */
export function useTypingPeople() {
  const socket = useSocket();
  const [typing, setTyping] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!socket) return;
    const map = timers.current;
    const set = (id: string, on: boolean) =>
      setTyping((prev) => {
        if (prev.has(id) === on) return prev;
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
    const handler = (p: { from: string; active: boolean }) => {
      const old = map.get(p.from);
      if (old) clearTimeout(old);
      set(p.from, p.active);
      if (p.active) map.set(p.from, setTimeout(() => set(p.from, false), 5000));
    };
    socket.on("typing", handler);
    return () => {
      socket.off("typing", handler);
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [socket]);

  return typing;
}
