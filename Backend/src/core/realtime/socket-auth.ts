import type { Server, Socket } from "socket.io";
import { z } from "zod";

import { prisma } from "../prisma/client";
import { verifyToken } from "../auth/tokens";
import { isSessionRevoked } from "../auth/sessions";
import { endUserSession, sessionLapse } from "../auth/refresh-sessions";
import { RoleType } from "../enums/role.enum";
import { disconnectSessions, emitToUsers, room } from "./realtime";

/**
 * ============================================================
 * SOCKET.IO AUTHENTICATION
 * ============================================================
 *
 * The previous implementation accepted rooms from the client:
 *
 *   socket.on("join-room", (userId) => socket.join(room.user(userId)));
 *   socket.on("join", (p) => { socket.join(room.user(p.userId));
 *                              socket.join(room.role(p.role)); });
 *
 * Anyone who could open a socket — no token required — could therefore join
 * `user:<any id>` and `role:admin` and receive every notification and change
 * event meant for those audiences. Connections are now authenticated during
 * the handshake and the server, not the client, decides the rooms.
 *
 * The wire protocol is unchanged: clients still receive `data:changed` and
 * `notification` with the same small invalidation payloads. The legacy
 * `join` / `join-room` events are still accepted so an older client keeps
 * working, but they are now no-ops that ignore whatever they are given.
 */

export interface SocketUser {
  userId: string;
  role: RoleType;
  refId: string;
}

export type AuthedSocket = Socket & { user?: SocketUser };

/** Handshake shape. Bearer form is tolerated so clients can reuse the header. */
const handshakeAuthSchema = z.object({
  token: z.string().min(1).max(4096).optional(),
});

function extractToken(socket: Socket): string | null {
  // Socket.IO always fills `auth` — `{}` when the client sent none.
  const parsed = handshakeAuthSchema.safeParse(socket.handshake.auth);
  const fromAuth = parsed.success ? parsed.data.token : undefined;

  const raw =
    fromAuth ??
    (typeof socket.handshake.headers.authorization === "string"
      ? socket.handshake.headers.authorization
      : undefined);

  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  return token.trim() || null;
}

/**
 * Handshake gate. Rejects anonymous, malformed, expired and revoked tokens,
 * and re-reads the role from the database so a demoted account cannot keep
 * listening to a privileged role room for the life of its token.
 */
export async function socketAuthMiddleware(
  socket: AuthedSocket,
  next: (err?: Error) => void,
) {
  try {
    const token = extractToken(socket);
    if (!token) return next(new Error("UNAUTHORIZED"));

    const decoded = verifyToken(token, "access");

    const [user, sessionRevoked] = await Promise.all([
      prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        status: true,
        tokenVersion: true,
        student: { select: { id: true } },
        professor: { select: { id: true } },
      },
      }),
      isSessionRevoked(decoded.sid),
    ]);

    if (!user) return next(new Error("UNAUTHORIZED"));
    if (user.status !== "active") return next(new Error("FORBIDDEN"));
    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion || sessionRevoked) {
      return next(new Error("UNAUTHORIZED"));
    }
    // An administrator's session is timed by the server (auth.middleware):
    // past its hours, idle too long, or without a row at all, a request is
    // refused — and so is a connection. Otherwise a tab left open kept
    // hearing the administration's notifications long after its session
    // had ended for every request.
    if (user.role === "admin") {
      const row =
        decoded.role === "admin" && decoded.sid
          ? await prisma.authSession.findUnique({
              where: { id: decoded.sid },
              select: { createdAt: true, lastSeenAt: true },
            })
          : null;
      if (!row || sessionLapse("admin", row)) return next(new Error("UNAUTHORIZED"));
    }
    // Remembered so signing this session out can cut this connection too,
    // and so the sweep below can find whose session a connection belongs to.
    (socket.data as { sid?: string }).sid = decoded.sid;
    (socket.data as { userId?: string }).userId = user.id;

    socket.user = {
      userId: user.id,
      role: user.role as RoleType,
      refId: user.student?.id ?? user.professor?.id ?? user.id,
    };

    return next();
  } catch {
    // Never leak why: expired, forged and unknown all look the same.
    return next(new Error("UNAUTHORIZED"));
  }
}

/**
 * Joins the rooms this connection is entitled to. Called once per connection;
 * the client has no say in it.
 */
export function joinAuthorizedRooms(socket: AuthedSocket) {
  // Only sockets the handshake gate admitted connect, and it sets the user.
  const user = socket.user!;

  socket.join(room.user(user.userId));
  socket.join(room.role(user.role));

  // Historically the frontend joined a bare-id room using the *profile* id
  // (Student.id / Professor.id) while the server emitted to User.id, so those
  // messages never arrived. Joining the profile room server-side keeps any
  // existing emit targeting either id working.
  if (user.refId !== user.userId) socket.join(room.user(user.refId));
}

/**
 * ============================================================
 * EVENTS FROM THE CLIENT — a budget per connection
 * ============================================================
 *
 * A client has little to say: "typing…", at most once every 2.5 s
 * (chat-hooks.ts). Each "typing" costs the server a permission lookup, so an
 * unbounded stream of them — to a different person each time, past the cache
 * — was a way to keep the database busy from one open tab.
 *
 * A token bucket: a burst of BURST events, refilled at PER_SECOND. Beyond it
 * an event is dropped — not refused with an error: `next(err)` makes
 * Socket.IO emit "error" on the socket, which with no listener throws and
 * takes the process down. A client that keeps flooding is disconnected.
 */
const BURST = 20;
const PER_SECOND = 2;
const CUT_AFTER_DROPS = 100;

export function limitClientEvents(socket: Socket, now: () => number = Date.now) {
  let tokens = BURST;
  let at = now();
  let dropped = 0;
  socket.use((_packet, next) => {
    const t = now();
    tokens = Math.min(BURST, tokens + ((t - at) / 1000) * PER_SECOND);
    at = t;
    if (tokens >= 1) {
      tokens -= 1;
      return next();
    }
    if (++dropped >= CUT_AFTER_DROPS) socket.disconnect(true);
  });
}

/**
 * ============================================================
 * ADMINISTRATORS' CONNECTIONS — the session's clock
 * ============================================================
 *
 * The handshake checks an administrator's session once. A connection then
 * lives on with no request behind it, so once a minute every administrator's
 * connection is held against its session: past ADMIN_SESSION_HOURS, or idle
 * past ADMIN_IDLE_MINUTES (`lastSeenAt` moves with each HTTP request), the
 * session ends — as auth.middleware would end it on the next request — and
 * the page is told at once.
 */
const SWEEP_EVERY_MS = 60 * 1000;

export async function sweepAdminConnections(io: Server) {
  try {
    const sockets = await io.in(room.role("admin")).fetchSockets();
    const owner = new Map<string, string>(); // sid → userId
    for (const s of sockets) {
      // The handshake admits an administrator only with a session row.
      const { sid, userId } = s.data as { sid: string; userId: string };
      owner.set(sid, userId);
    }
    if (owner.size === 0) return;

    const rows = await prisma.authSession.findMany({
      where: { id: { in: [...owner.keys()] } },
      select: { id: true, createdAt: true, lastSeenAt: true },
    });
    const alive = new Set(rows.filter((r) => !sessionLapse("admin", r)).map((r) => r.id));

    for (const [sid, userId] of owner) {
      if (alive.has(sid)) continue;
      await endUserSession(userId, sid);
      await disconnectSessions(userId, [sid]);
    }
  } catch {
    // A missed sweep is caught by the next one, and by the next request.
  }
}

/** Wires authentication and room assignment onto a Socket.IO server. */
export function installSocketSecurity(io: Server) {
  io.use((socket, next) => {
    void socketAuthMiddleware(socket as AuthedSocket, next);
  });

  // `unref`: the sweep never keeps a process alive that has nothing else to do.
  setInterval(() => void sweepAdminConnections(io), SWEEP_EVERY_MS).unref();

  io.on("connection", (socket) => {
    const authed = socket as AuthedSocket;
    limitClientEvents(socket);
    joinAuthorizedRooms(authed);

    // A device coming online or going away shows in the account's list of
    // devices, wherever it is open.
    const userId = authed.user!.userId;
    emitToUsers([userId], "sessions", "updated");
    socket.on("disconnect", () => emitToUsers([userId], "sessions", "updated"));

    // Accepted for backwards compatibility, deliberately inert: room
    // membership is decided by the handshake, not by the client.
    socket.on("join", () => undefined);
    socket.on("join-room", () => undefined);
  });
}
