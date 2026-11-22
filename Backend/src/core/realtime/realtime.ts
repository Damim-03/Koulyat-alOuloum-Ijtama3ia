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
  | "group-requests"
  | "projects"
  | "defenses"
  | "milestones"
  | "messages"
  | "notifications"
  | "university-domains"
  | "dashboard"
  | "sessions";

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

/**
 * A named event with its own payload, to particular people.
 *
 * `data:changed` carries no rows on purpose, and most screens only need to
 * refetch. A new message is the exception: the recipient should be told *who*
 * wrote and *what about* the moment it lands — a toast cannot wait for a
 * refetch. One emit to all the rooms at once, however many recipients.
 */
export const emitEvent = (userIds: string[], event: string, payload: unknown) => {
  if (!io || userIds.length === 0) return;
  io.to([...new Set(userIds)].map(room.user)).emit(event, payload);
};

/** Whether the person has at least one live connection right now. */
export const isOnline = (userId: string) =>
  (io?.sockets.adapter.rooms.get(room.user(userId))?.size ?? 0) > 0;

const sidOf = (s: { data: unknown }) => (s.data as { sid?: string }).sid;

/**
 * Cuts live connections: every one of an account's, or only those of the
 * given sessions. A socket is authenticated once, at its handshake, so without
 * this a signed-out or suspended session kept hearing change events until the
 * tab closed.
 *
 * Each is told `session:revoked` first, so the page on the other end signs out
 * the moment it happens — not at its next request, minutes later. `except`
 * spares one session: the device that changed the password carries on.
 */
export const disconnectSessions = async (
  userId: string,
  sids?: (string | undefined)[],
  except?: string,
) => {
  if (!io) return;
  try {
    const sockets = await io.in(room.user(userId)).fetchSockets();
    for (const s of sockets) {
      const sid = sidOf(s);
      if (except && sid === except) continue;
      if (sids && !sids.includes(sid)) continue;
      s.emit("session:revoked", {});
      s.disconnect(true);
    }
  } catch {
    // A failed disconnect must never fail the sign-out that asked for it.
  }
  // Anyone looking at the account's list of devices sees it change.
  emitToUsers([userId], "sessions", "deleted");
};

/**
 * Re-labels the live connections of one session as another's — when a
 * session is replaced but its device carries on (a password change), so that
 * signing the new session out later reaches this connection too.
 */
export const moveSessionSockets = async (userId: string, from: string | undefined, to: string) => {
  if (!io || !from) return;
  try {
    const sockets = await io.in(room.user(userId)).fetchSockets();
    for (const s of sockets) if (sidOf(s) === from) (s.data as { sid?: string }).sid = to;
  } catch {
    // Best effort: at worst this connection is cut by a later sign-out-all.
  }
};

/** The sessions of an account that have a live connection right now. */
export const liveSessionIds = async (userId: string): Promise<Set<string>> => {
  const live = new Set<string>();
  if (!io) return live;
  try {
    const sockets = await io.in(room.user(userId)).fetchSockets();
    for (const s of sockets) {
      const sid = sidOf(s);
      if (sid) live.add(sid);
    }
  } catch {
    // Presence is a nicety; an empty set just shows nobody as online.
  }
  return live;
};
