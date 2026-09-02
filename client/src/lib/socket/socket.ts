import { io, type Socket } from "socket.io-client";
import { env } from "../../config/env";

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

// Events the client sends to the server.
export interface ClientToServerEvents {
  "join-room": (userId: string) => void;
  join: (payload: { userId: string; role?: string }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  return io(env.VITE_SOCKET_URL, {
    autoConnect: false, // we connect manually once authenticated
    withCredentials: true,
    transports: ["websocket"],
  });
}