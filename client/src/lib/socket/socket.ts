import { io, type Socket } from "socket.io-client";
import { env } from "../../config/env";
import { useAuthStore } from "../../store/auth.store";

// Payload shape is a placeholder — align with what your backend actually
// emits once the notification events are defined server-side.
export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message?: string;
  createdAt: string;
}

/** What the server says changed. Carries no rows — the client refetches. */
export interface ChangePayload {
  resource: string;
  action?: "created" | "updated" | "deleted";
  id?: string;
  at: string;
}

/** A message that has just landed — enough to show it without a refetch. */
export interface NewMessagePayload {
  id: string;
  threadId: string | null;
  subject: string | null;
  preview: string;
  broadcast: string | null;
  createdAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    firstNameLatin?: string | null;
    lastNameLatin?: string | null;
    avatarUrl: string | null;
    gender: string | null;
    role: string;
  };
}

// Events the server sends to the client.
export interface ServerToClientEvents {
  "data:changed": (payload: ChangePayload) => void;
  notification: (payload: NotificationPayload) => void;
  "message:new": (payload: NewMessagePayload) => void;
  /** Someone is (or stopped) writing to me. */
  typing: (payload: { from: string; active: boolean }) => void;
}

// The client no longer asks to join rooms: the server derives them from the
// authenticated handshake, so there is nothing left to send.
// The one thing a client says: whom it is typing to. Who it is comes from the
// authenticated handshake.
export interface ClientToServerEvents {
  typing: (payload: { to: string; active: boolean }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  const options = {
    autoConnect: false, // we connect manually once authenticated
    withCredentials: true,
    transports: ["websocket"],
    // Read at connect time (not at module load) so a reconnect after a token
    // refresh presents the current token rather than the one from page load.
    auth: (cb: (data: { token: string }) => void) =>
      cb({ token: useAuthStore.getState().accessToken ?? "" }),
  };

  // عنوانٌ فارغ = نفس أصل الصفحة، فيعمل السوكيت أينما فُتح التطبيق: محلياً،
  // أو عبر نفق، أو من هاتفٍ على الشبكة. والعنوان المطلق يبقى ممكناً لمن
  // ينشر الـAPI على نطاقٍ آخر.
  return env.VITE_SOCKET_URL ? io(env.VITE_SOCKET_URL, options) : io(options);
}