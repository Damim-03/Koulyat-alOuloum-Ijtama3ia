import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { prisma } from "../prisma/client";
import { signTokenPair, type AppTokenPayload } from "./tokens";
import { newSessionId } from "./sessions";

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
 * sign-in, it ends.
 */

const GRACE_MS = 60 * 1000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const newJti = () => crypto.randomBytes(18).toString("base64url");

/** When a freshly signed refresh token expires. */
const expiryOf = (refreshToken: string) => {
  const exp = (jwt.decode(refreshToken) as { exp?: number } | null)?.exp;
  return exp ? new Date(exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

type Identity = Omit<AppTokenPayload, "typ" | "exp" | "sid" | "jti">;

/**
 * Starts a session: a new `sid`, a token pair carrying it, and the row that
 * remembers the refresh token's id. Every sign-in goes through here.
 */
export async function openSession(identity: Identity) {
  const sid = newSessionId();
  const jti = newJti();
  const tokens = signTokenPair({ ...identity, sid, jti });
  await prisma.authSession.create({
    data: { id: sid, userId: identity.userId, refreshJti: jti, expiresAt: expiryOf(tokens.refreshToken) },
  });
  return tokens;
}

export type Rotation =
  /** Use these; the refresh token is new. */
  | { kind: "rotated"; tokens: { accessToken: string; refreshToken: string } }
  /** A concurrent refresh already rotated: an access token only. */
  | { kind: "grace"; tokens: { accessToken: string } }
  /** A replaced token came back, or the session ran out: refuse. */
  | { kind: "refused" };

/**
 * Exchanges a verified refresh token for the next one.
 *
 * `identity` is re-read from the database by the caller (role, tokenVersion),
 * never taken from the token.
 */
export async function rotateSession(presented: AppTokenPayload, identity: Identity): Promise<Rotation> {
  // A token from before sessions carried an id: start a session for it.
  if (!presented.sid) return { kind: "rotated", tokens: await openSession(identity) };

  const sid = presented.sid;
  const row = await prisma.authSession.findUnique({ where: { id: sid } });
  const now = Date.now();

  if (row && now - row.createdAt.getTime() > SESSION_MAX_AGE_MS) {
    await closeSessions([sid]);
    return { kind: "refused" };
  }

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
    return { kind: "refused" };
  }

  const jti = newJti();
  const tokens = signTokenPair({ ...identity, sid, jti });
  const expiresAt = expiryOf(tokens.refreshToken);

  if (row) {
    // Conditional on the id still being current: of two simultaneous
    // refreshes, exactly one rotates.
    const { count } = await prisma.authSession.updateMany({
      where: { id: sid, refreshJti: row.refreshJti },
      data: { refreshJti: jti, prevJti: row.refreshJti, rotatedAt: new Date(now), expiresAt },
    });
    if (count === 0) {
      const { accessToken } = signTokenPair({ ...identity, sid });
      return { kind: "grace", tokens: { accessToken } };
    }
  } else {
    // A session from before rotation, or one whose row was pruned: adopt it.
    await prisma.authSession.upsert({
      where: { id: sid },
      create: { id: sid, userId: identity.userId, refreshJti: jti, expiresAt },
      update: { refreshJti: jti, prevJti: null, rotatedAt: new Date(now), expiresAt },
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

/** Rows whose refresh token has expired protect nothing. */
export async function pruneAuthSessions() {
  try {
    await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Housekeeping must never fail a request.
  }
}
