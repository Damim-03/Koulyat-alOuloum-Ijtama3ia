import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { prisma } from "../prisma/client";
import { signTokenPair, type AppTokenPayload } from "./tokens";
import { newSessionId } from "./sessions";
import { parseUserAgent, type DeviceInfo, type SessionDevice } from "./device";
import { emitToUsers } from "../realtime/realtime";
import { config } from "../config/app.config";

/**
 * ============================================================
 * REFRESH TOKEN ROTATION
 * ============================================================
 *
 * A refresh token used to stay the same for its whole seven days, so a copy
 * taken once kept working for a week beside the real one, and nothing could
 * tell them apart.
 *
 * Now every refresh replaces the token, and the session row remembers the id
 * (`jti`) of the current one. If an older id comes back after it was replaced,
 * two parties hold this session — and there is no telling which is the owner —
 * so the whole session is revoked. The owner signs in again; the thief's copy
 * is dead either way.
 *
 * Two tabs refreshing at the same moment would look exactly like that, so the
 * token replaced a moment ago is still honoured for a short grace period: it
 * gets a new access token, and no new refresh token (the browser already holds
 * the one the other tab received, in the shared cookie).
 *
 * And a session cannot be stretched forever by refreshing: thirty days after
 * sign-in, it ends. An administrator's sooner — ADMIN_SESSION_HOURS after
 * sign-in, or ADMIN_IDLE_MINUTES after its last request (`lastSeenAt`), both
 * decided here, by the server, whatever the browser does.
 */

const GRACE_MS = 60 * 1000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const isAdmin = (role: string) => role === "admin";

/** How long a session of this role may last at all. */
export const maxAgeMs = (role: string) =>
  isAdmin(role) ? config.ADMIN_SESSION_HOURS * 60 * 60 * 1000 : SESSION_MAX_AGE_MS;

/** How long it may sit unused — administrators only. */
export const idleLimitMs = (role: string) =>
  isAdmin(role) ? config.ADMIN_IDLE_MINUTES * 60 * 1000 : Infinity;

/** Why a session can no longer be used, or null while it can. */
export function sessionLapse(
  role: string,
  row: { createdAt: Date; lastSeenAt: Date },
  now: number = Date.now(),
): "expired" | "idle" | null {
  if (now - row.createdAt.getTime() > maxAgeMs(role)) return "expired";
  if (now - row.lastSeenAt.getTime() > idleLimitMs(role)) return "idle";
  return null;
}

export const newJti = () => crypto.randomBytes(18).toString("base64url");

/** When a freshly signed refresh token expires. */
const expiryOf = (refreshToken: string) => {
  const exp = (jwt.decode(refreshToken) as { exp?: number } | null)?.exp;
  return exp ? new Date(exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

type Identity = Omit<AppTokenPayload, "typ" | "exp" | "sid" | "jti">;

/**
 * Starts a session: a new `sid`, a token pair carrying it, and the row that
 * remembers the refresh token's id — and the device it was opened from. Every
 * sign-in goes through here. The caller may pick the `sid` when it needs to
 * know it (a password change moves its own live connection onto it).
 */
export async function openSession(
  identity: Identity,
  device?: SessionDevice,
  sid: string = newSessionId(),
) {
  const jti = newJti();
  const tokens = signTokenPair({ ...identity, sid, jti });
  await prisma.authSession.create({
    data: {
      id: sid,
      userId: identity.userId,
      refreshJti: jti,
      expiresAt: expiryOf(tokens.refreshToken),
      userAgent: device?.userAgent ?? null,
      ip: device?.ip ?? null,
    },
  });
  // A new device appears at once in the account's list, wherever it is open.
  emitToUsers([identity.userId], "sessions", "created");
  return tokens;
}

export type Rotation =
  /** Use these; the refresh token is new. */
  | { kind: "rotated"; tokens: { accessToken: string; refreshToken: string } }
  /** A concurrent refresh already rotated: an access token only. */
  | { kind: "grace"; tokens: { accessToken: string } }
  /** A replaced token came back, or the session ran out: refuse. */
  | { kind: "refused"; reason: "replayed" | "expired" | "idle" };

/**
 * Exchanges a verified refresh token for the next one.
 *
 * `identity` is re-read from the database by the caller (role, tokenVersion),
 * never taken from the token.
 */
export async function rotateSession(
  presented: AppTokenPayload,
  identity: Identity,
  device?: SessionDevice,
): Promise<Rotation> {
  // A token from before sessions carried an id: start a session for it.
  if (!presented.sid) return { kind: "rotated", tokens: await openSession(identity, device) };

  const sid = presented.sid;
  const row = await prisma.authSession.findUnique({ where: { id: sid } });
  const now = Date.now();

  const lapse = row ? sessionLapse(identity.role, row, now) : null;
  if (lapse) {
    await closeSessions([sid]);
    return { kind: "refused", reason: lapse };
  }
  // An administrator's session is always opened with a row. Without one it
  // was signed out, or is older than these limits: start again.
  if (!row && isAdmin(identity.role)) return { kind: "refused", reason: "expired" };

  const current = !row || !presented.jti ? undefined : presented.jti === row.refreshJti;
  const justReplaced =
    !!row && !!presented.jti && presented.jti === row.prevJti && now - row.rotatedAt.getTime() < GRACE_MS;

  if (justReplaced) {
    const { accessToken } = signTokenPair({ ...identity, sid });
    return { kind: "grace", tokens: { accessToken } };
  }

  // A row exists and this is not its current token: replayed.
  // (A token with no id, for a session that has one, is older still.)
  if (row && current !== true) {
    // Pre-rotation tokens arriving just after the session adopted rotation are
    // the same double-tab race, not a theft.
    if (!presented.jti && now - row.rotatedAt.getTime() < GRACE_MS) {
      const { accessToken } = signTokenPair({ ...identity, sid });
      return { kind: "grace", tokens: { accessToken } };
    }
    return { kind: "refused", reason: "replayed" };
  }

  const jti = newJti();
  const tokens = signTokenPair({ ...identity, sid, jti });
  const expiresAt = expiryOf(tokens.refreshToken);
  // Where the session was last seen. A missing value keeps the stored one.
  const seen = { ...(device?.userAgent ? { userAgent: device.userAgent } : {}), ...(device?.ip ? { ip: device.ip } : {}) };

  if (row) {
    // Conditional on the id still being current: of two simultaneous
    // refreshes, exactly one rotates.
    const { count } = await prisma.authSession.updateMany({
      where: { id: sid, refreshJti: row.refreshJti },
      data: {
        refreshJti: jti,
        prevJti: row.refreshJti,
        rotatedAt: new Date(now),
        lastSeenAt: new Date(now),
        expiresAt,
        ...seen,
      },
    });
    if (count === 0) {
      const { accessToken } = signTokenPair({ ...identity, sid });
      return { kind: "grace", tokens: { accessToken } };
    }
  } else {
    // A session from before rotation, or one whose row was pruned: adopt it.
    await prisma.authSession.upsert({
      where: { id: sid },
      create: { id: sid, userId: identity.userId, refreshJti: jti, expiresAt, ...seen },
      update: { refreshJti: jti, prevJti: null, rotatedAt: new Date(now), expiresAt, ...seen },
    });
  }

  return { kind: "rotated", tokens };
}

/** Forgets sessions (sign-out); their tokens are revoked separately. */
export async function closeSessions(sids: string[]) {
  if (sids.length === 0) return;
  await prisma.authSession.deleteMany({ where: { id: { in: sids } } });
}

/** Every session of an account — "sign out everywhere", password changes. */
export async function closeUserSessions(userId: string, keep?: string) {
  await prisma.authSession.deleteMany({
    where: { userId, ...(keep ? { NOT: { id: keep } } : {}) },
  });
}

export interface SessionView {
  id: string;
  device: DeviceInfo;
  ip: string | null;
  createdAt: Date;
  /** The last refresh — within one access-token lifetime of the last request. */
  lastActiveAt: Date;
}

/** An account's open sessions, most recently active first. */
export async function listUserSessions(userId: string): Promise<SessionView[]> {
  const rows = await prisma.authSession.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { rotatedAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, rotatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    device: parseUserAgent(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt,
    lastActiveAt: r.rotatedAt,
  }));
}

/**
 * Ends one session of an account: its tokens are refused from the next
 * request on, and its row is gone. False when the account has no such session.
 */
export async function endUserSession(userId: string, sid: string): Promise<boolean> {
  const row = await prisma.authSession.findFirst({
    where: { id: sid, userId },
    select: { expiresAt: true },
  });
  if (!row) return false;
  // The row's expiry is its refresh token's, which outlives every access token
  // of the session — so the denylist entry covers them all.
  await prisma.revokedSession.upsert({
    where: { id: sid },
    create: { id: sid, userId, expiresAt: row.expiresAt },
    update: {},
  });
  await closeSessions([sid]);
  return true;
}

/**
 * Every session of an account but one, ended as `endUserSession` ends one:
 * refused from the next request, its row gone. Returns their ids, for the
 * caller to disconnect.
 */
export async function endOtherSessions(userId: string, keep: string | undefined): Promise<string[]> {
  const rows = await prisma.authSession.findMany({
    where: { userId, ...(keep ? { NOT: { id: keep } } : {}) },
    select: { id: true, expiresAt: true },
  });
  for (const r of rows) {
    await prisma.revokedSession.upsert({
      where: { id: r.id },
      create: { id: r.id, userId, expiresAt: r.expiresAt },
      update: {},
    });
  }
  await closeSessions(rows.map((r) => r.id));
  return rows.map((r) => r.id);
}

/**
 * Notes that a session was just used — an administrator's, at most once a
 * minute, so its idle limit counts from its last request.
 */
export async function touchSession(sid: string, lastSeenAt: Date) {
  if (Date.now() - lastSeenAt.getTime() < 60 * 1000) return;
  try {
    await prisma.authSession.updateMany({ where: { id: sid }, data: { lastSeenAt: new Date() } });
  } catch {
    // Bookkeeping must never fail a request.
  }
}

/** Rows whose refresh token has expired protect nothing. */
export async function pruneAuthSessions() {
  try {
    await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Housekeeping must never fail a request.
  }
}
