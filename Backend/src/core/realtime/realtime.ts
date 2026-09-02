import type { Server } from "socket.io";

/**
 * Realtime fan-out.
 *
 * The server broadcasts *what changed*, never the changed rows. Clients react
 * by invalidating the matching queries and refetching, so there is no second
 * copy of the data to drift out of sync — and payloads stay tiny.
 *
 * The io instance is injected from app.ts rather than imported, so nothing in
 * the modules has to import the app (which would be circular).
 */

let io: Server | null = null;

export const setRealtimeServer = (server: Server) => {
  io = server;
};

export const room = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
};

/** Domain areas a client can be watching. Matches the query-key vocabulary. */
export type Resource =
  | "users"
  | "students"
  | "professors"
  | "faculties"
  | "departments"
  | "domains"
  | "filieres"
  | "specializations"
  | "academic-years"
  | "topics"
  | "applications"
  | "group-requests"
  | "projects"
  | "defenses"
  | "milestones"
  | "messages"
  | "notifications"
  | "university-domains"
  | "dashboard";

export interface ChangePayload {
  resource: Resource | string;
  /** Best-effort hint; clients refetch regardless. */
  action?: "created" | "updated" | "deleted";
  id?: string;
  at: string;
}

/** Everyone who is connected — structural data that any role may be showing. */
export const broadcastChange = (
  resource: Resource | string,
  action?: ChangePayload["action"],
  id?: string,
) => {
  io?.emit("data:changed", {
    resource,
    action,
    id,
    at: new Date().toISOString(),
  } satisfies ChangePayload);
};

/** Scoped to particular people — e.g. the members of one group. */
export const emitToUsers = (
  userIds: string[],
  resource: Resource | string,
  action?: ChangePayload["action"],
  id?: string,
) => {
  if (!io || userIds.length === 0) return;
  const payload: ChangePayload = {
    resource,
    action,
    id,
    at: new Date().toISOString(),
  };
  for (const userId of userIds) {
    io.to(room.user(userId)).emit("data:changed", payload);
  }
};

/** A bell notification for one person, pushed the moment it is created. */
export const pushNotification = (userId: string, notification: unknown) => {
  io?.to(room.user(userId)).emit("notification", notification);
};
