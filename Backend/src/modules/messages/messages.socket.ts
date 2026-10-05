import type { Server } from "socket.io";
import { room } from "../../core/realtime/realtime";
import type { AuthedSocket } from "../../core/realtime/socket-auth";
import { mayWrite } from "./messages.service";

/**
 * "Typing…", relayed from one person to the one they are writing to.
 *
 * The client may only say *who* it is typing to; who it is comes from the
 * authenticated handshake. And it reaches that person only if the sender may
 * write to them at all — otherwise any account could flash "typing" at anyone.
 * The answer is cached for a few minutes, so a burst of keystrokes costs one
 * lookup.
 */
const ALLOW_TTL = 5 * 60_000;
const allowCache = new Map<string, { ok: boolean; at: number }>();

async function allowed(from: string, to: string) {
  const key = `${from}>${to}`;
  const hit = allowCache.get(key);
  if (hit && Date.now() - hit.at < ALLOW_TTL) return hit.ok;
  const ok = await mayWrite(from, to);
  allowCache.set(key, { ok, at: Date.now() });
  if (allowCache.size > 5000) allowCache.clear();
  return ok;
}

export function installMessageEvents(io: Server) {
  io.on("connection", (socket) => {
    const me = (socket as AuthedSocket).user?.userId;
    if (!me) return;

    socket.on("typing", async (payload: unknown) => {
      const p = payload as { to?: unknown; active?: unknown } | null;
      const to = typeof p?.to === "string" ? p.to : null;
      if (!to || to === me || to.length > 64) return;
      try {
        if (!(await allowed(me, to))) return;
        io.to(room.user(to)).emit("typing", { from: me, active: p?.active !== false });
      } catch {
        // A typing hint is never worth an error.
      }
    });
  });
}
