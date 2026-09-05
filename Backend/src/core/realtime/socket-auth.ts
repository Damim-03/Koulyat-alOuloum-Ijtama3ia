import type { Server, Socket } from "socket.io";
import { z } from "zod";

import { prisma } from "../prisma/client";
import { verifyToken } from "../auth/tokens";
import { isSessionRevoked } from "../auth/sessions";
import { RoleType } from "../enums/role.enum";
import { room } from "./realtime";

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
  const parsed = handshakeAuthSchema.safeParse(socket.handshake.auth ?? {});
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
  const user = socket.user;
  if (!user) return;

  socket.join(room.user(user.userId));
  socket.join(room.role(user.role));

  // Historically the frontend joined a bare-id room using the *profile* id
  // (Student.id / Professor.id) while the server emitted to User.id, so those
  // messages never arrived. Joining the profile room server-side keeps any
  // existing emit targeting either id working.
  if (user.refId !== user.userId) socket.join(room.user(user.refId));
}

/** Wires authentication and room assignment onto a Socket.IO server. */
export function installSocketSecurity(io: Server) {
  io.use((socket, next) => {
    void socketAuthMiddleware(socket as AuthedSocket, next);
  });

  io.on("connection", (socket) => {
    const authed = socket as AuthedSocket;
    joinAuthorizedRooms(authed);

    // Accepted for backwards compatibility, deliberately inert: room
    // membership is decided by the handshake, not by the client.
    socket.on("join", () => undefined);
    socket.on("join-room", () => undefined);
  });
}
