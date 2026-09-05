import crypto from "node:crypto";

import { prisma } from "../prisma/client";
import type { AppTokenPayload } from "./tokens";

/**
 * ============================================================
 * SESSION REVOCATION
 * ============================================================
 *
 * Two levers, deliberately kept separate:
 *
 *  - `sid` — one id per sign-in, carried by that session's token pair.
 *    Signing out revokes just that session, so logging out of a phone does
 *    not sign you out of the desktop.
 *
 *  - `tokenVersion` — one counter per account. Bumping it invalidates every
 *    token ever issued to the user. This is the "sign out everywhere" lever
 *    and the one to reach for after a suspected compromise.
 *
 * Before this existed there was no revocation at all: signing out cleared the
 * browser and left the token valid for its full lifetime. The account-wide
 * counter came first; per-session revocation is added on top of it, not in
 * place of it, so nothing that was possible before is lost.
 */

export const newSessionId = () => crypto.randomUUID();

/** True when this token's session has been signed out individually. */
export async function isSessionRevoked(sid: string | undefined) {
  // Tokens minted before per-session revocation shipped carry no `sid`. They
  // stay valid until they expire and remain covered by tokenVersion, so an
  // absent sid is not by itself a reason to reject.
  if (!sid) return false;

  const hit = await prisma.revokedSession.findUnique({
    where: { id: sid },
    select: { id: true },
  });
  return hit !== null;
}

/**
 * Revokes one session. `exp` is the token's own expiry, stored so the row can
 * be pruned once it can no longer protect anything.
 */
export async function revokeSession(payload: AppTokenPayload) {
  if (!payload.sid) return;

  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // conservative fallback

  await prisma.revokedSession.upsert({
    where: { id: payload.sid },
    create: { id: payload.sid, userId: payload.userId, expiresAt },
    update: {},
  });
}

/** Signs out every session on the account by advancing its token generation. */
export async function revokeAllSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * Drops rows whose tokens have expired anyway. Called opportunistically after
 * a logout: the work is proportional to how much has expired since the last
 * logout, which keeps the table small without a scheduler.
 */
export async function pruneExpiredSessions() {
  try {
    await prisma.revokedSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Housekeeping must never fail a sign-out.
  }
}
