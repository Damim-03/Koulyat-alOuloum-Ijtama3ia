import { prisma } from "../prisma/client";
import { HttpException } from "../utils/appErros";
import { HTTPSTATUS } from "../config/http/http.config";
import { ErrorCodeEnum } from "../enums/error-code.enum";

/**
 * ============================================================
 * PER-ACCOUNT SIGN-IN THROTTLE
 * ============================================================
 *
 * The IP limiter (`authLimiter`) stops one machine from guessing. It does
 * nothing against many machines guessing the same account — and a student's
 * first password may be their birth date: a few thousand candidates, behind a
 * registration number printed on their card. So failures are also counted per
 * identifier, wherever they come from.
 *
 * - Five failures lock the identifier; each lock doubles the last (15 min,
 *   30 min, 1 h …) up to six hours, and a successful sign-in clears it all.
 *   That leaves a few dozen guesses a day against any one account.
 * - The key is the identifier typed, not the account found, and unknown
 *   identifiers are counted the same way: a lock never tells anyone which
 *   registration numbers or emails exist.
 * - While locked, the password is not even checked. Otherwise "locked" for a
 *   wrong password and "welcome" for the right one would still answer guesses.
 *
 * The cost of the design is that someone can keep a known account locked by
 * failing on purpose. The lock is bounded, and an administrator's password
 * reset clears it at once.
 */

const MAX_FAILURES = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 6 * 60 * 60 * 1000;
/** Failures further apart than this start the count again. */
const FAILURE_WINDOW_MS = 60 * 60 * 1000;
/** A quiet day forgets earlier locks, so the next one starts short again. */
const LOCK_MEMORY_MS = 24 * 60 * 60 * 1000;

export type ThrottleKind = "student" | "professor" | "admin";

/** `student:2022…` — case and surrounding space never make a second key. */
export const throttleKey = (kind: ThrottleKind, identifier: string) =>
  `${kind}:${identifier.trim().toLowerCase()}`.slice(0, 191);

const lockedError = (until: Date) => {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
  return new HttpException(
    `Too many failed attempts on this account. Try again in ${minutes} minute(s).`,
    HTTPSTATUS.TOO_MANY_REQUESTS,
    ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS,
  );
};

/** Throws 429 while the identifier is locked. Call before anything else. */
export async function assertNotLocked(key: string) {
  const row = await prisma.loginThrottle.findUnique({
    where: { key },
    select: { lockedUntil: true },
  });
  if (row?.lockedUntil && row.lockedUntil > new Date()) throw lockedError(row.lockedUntil);
}

/**
 * Counts one failure; the fifth locks. Returns the lock, if this failure
 * caused one, so the caller can answer with it straight away.
 */
export async function recordFailure(key: string): Promise<Date | null> {
  const now = new Date();
  const row = await prisma.loginThrottle.findUnique({ where: { key } });

  const quietFor = row ? now.getTime() - row.lastFailureAt.getTime() : Infinity;
  const failures = (row && quietFor < FAILURE_WINDOW_MS ? row.failures : 0) + 1;
  const lockCount = row && quietFor < LOCK_MEMORY_MS ? row.lockCount : 0;

  let lockedUntil: Date | null = null;
  let nextFailures = failures;
  let nextLockCount = lockCount;
  if (failures >= MAX_FAILURES) {
    lockedUntil = new Date(now.getTime() + Math.min(BASE_LOCK_MS * 2 ** lockCount, MAX_LOCK_MS));
    nextFailures = 0;
    nextLockCount = lockCount + 1;
  }

  await prisma.loginThrottle.upsert({
    where: { key },
    create: { key, failures: nextFailures, lockCount: nextLockCount, lockedUntil, lastFailureAt: now },
    update: { failures: nextFailures, lockCount: nextLockCount, lockedUntil, lastFailureAt: now },
  });

  // Keys that stopped failing a day ago protect nothing; drop a few each time
  // instead of running a scheduler.
  if (Math.random() < 0.05) void pruneThrottle();

  return lockedUntil;
}

/** A successful sign-in, or an administrator's reset, forgets everything. */
export async function clearFailures(...keys: string[]) {
  if (keys.length === 0) return;
  await prisma.loginThrottle.deleteMany({ where: { key: { in: keys } } });
}

/**
 * Records a failure and throws: the lock if this failure caused one, the
 * caller's own error otherwise.
 */
export async function failSignIn(key: string, error: Error): Promise<never> {
  const lockedUntil = await recordFailure(key);
  throw lockedUntil ? lockedError(lockedUntil) : error;
}

async function pruneThrottle() {
  try {
    await prisma.loginThrottle.deleteMany({
      where: {
        lastFailureAt: { lt: new Date(Date.now() - LOCK_MEMORY_MS) },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
    });
  } catch {
    // Housekeeping must never fail a sign-in.
  }
}
