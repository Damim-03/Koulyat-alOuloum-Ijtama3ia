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

// Events the server sends to the client.
export interface ServerToClientEvents {
  notification: (payload: NotificationPayload) => void;
  "application:new": (payload: NotificationPayload) => void;
  "milestone:updated": (payload: NotificationPayload) => void;
}

// Events the client sends to the server.
export interface ClientToServerEvents {
  "join-room": (userId: string) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  return io(env.VITE_SOCKET_URL, {
    autoConnect: false, // we connect manually once authenticated
    withCredentials: true,
    transports: ["websocket"],
  });
}