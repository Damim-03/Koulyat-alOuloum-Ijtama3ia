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

// Events the server sends to the client.
export interface ServerToClientEvents {
  "data:changed": (payload: ChangePayload) => void;
  notification: (payload: NotificationPayload) => void;
}

// The client no longer asks to join rooms: the server derives them from the
// authenticated handshake, so there is nothing left to send.
export type ClientToServerEvents = Record<string, never>;

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  return io(env.VITE_SOCKET_URL, {
    autoConnect: false, // we connect manually once authenticated
    withCredentials: true,
    transports: ["websocket"],
    // Read at connect time (not at module load) so a reconnect after a token
    // refresh presents the current token rather than the one from page load.
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? "" }),
  });
}