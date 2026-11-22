import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

import { config } from "../config/app.config";
import { tr } from "../i18n";

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 *
 * There was one global limiter: 200 requests / 15 min / IP. That is
 * simultaneously too tight for a logged-in admin loading dashboards (it
 * really did make pages render as empty in testing) and far too loose for a
 * login form — 200 password guesses per quarter hour, per IP, unnoticed.
 *
 * So: a roomy global floor for ordinary traffic, and a strict layer on the
 * endpoints where an attacker gets something for guessing.
 */

const shared: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // The limiter reads req.ip, which is only trustworthy because
  // `trust proxy` is set to the real hop count in app.ts.
  message: () => ({ message: tr("auth.tooManyRequests") }),
};

/** Ordinary API traffic. Generous enough that a real session never trips it. */
export const globalLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 1000 : 5000,
});

/**
 * Credential endpoints. Counts only failures, so a user who signs in
 * correctly is never penalised for a colleague on the same NAT address.
 *
 * A 428 — "solve the short check first" (modules/auth/captcha) — is not a
 * failure: no password was compared, and counting it would spend a student's
 * attempts on the step that asks them to prove they are one.
 */
export const makeAuthLimiter = (max: number) =>
  rateLimit({
    ...shared,
    windowMs: 15 * 60 * 1000,
    max,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode < 400 || res.statusCode === 428,
    message: () => ({ message: tr("auth.tooManyAttempts") }),
  });

export const authLimiter = makeAuthLimiter(config.AUTH_RATE_LIMIT_MAX);

/**
 * Sign-in checks handed out. Each costs the server next to nothing and the
 * solver about a second, so the ceiling is loose — wide enough for a campus
 * behind one address while the alarm asks everyone — but it stops one
 * machine from stockpiling them to solve in parallel.
 */
export const challengeLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 600 : 3000,
});

/** Token refresh: frequent for legitimate clients, but not unbounded. */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: 60,
});

/**
 * Public document verification. No login, and the short barcode on a printed
 * sheet is only ten random digits wide — small enough that an unbounded
 * endpoint is a guessing machine. Legitimate use is a handful of scans, so a
 * low ceiling costs nothing and closes that door.
 */
export const verifyLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 60 : 600,
});

/**
 * Who is counted: the account when the request is signed in, the address
 * otherwise. A university lab sits behind one NAT address, so a per-address
 * ceiling on writes lumps thirty students into one budget — and lets one of
 * them spend it for the rest. Mounted after `authMiddleware`, `req.user` is
 * the account the database confirmed, not anything the client claims.
 */
export const accountOrIp = (req: Request): string =>
  req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;

/** Writes that fan out (uploads, imports, bulk actions), per account. */
export const writeLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  max: config.IS_PRODUCTION ? 60 : 300,
  keyGenerator: accountOrIp,
});

/**
 * Messages, per account. Each one lands in other people's inboxes (up to 200
 * of them), so the ceiling sits well below what anyone types by hand, and far
 * above what a conversation needs.
 */
export const messageLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  max: config.IS_PRODUCTION ? 20 : 300,
  keyGenerator: accountOrIp,
});

/**
 * The links sent by email (modules/auth/email-links): asking for a reset,
 * using one, opening a verification link. Per address — there is no account
 * yet — and tight: a person needs two or three, a script trying tokens or
 * flooding mailboxes needs thousands. Each account is capped again per hour.
 */
export const emailLinkLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 15 : 500,
});

/**
 * «نسيت كلمة المرور» through the administration (modules/password-request),
 * per address — there is no account yet:
 *
 * - looking a number up (whether such a student exists): a student types
 *   theirs once or twice; walking the register takes thousands;
 * - sending the request with the card's photo: a few, the photo retaken;
 * - following it: the waiting page asks every few seconds, for as long as the
 *   administration takes — roomy, since a token is 256 random bits and cannot
 *   be guessed anyway.
 */
export const studentLookupLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 60 : 600,
});
export const passwordRequestLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 8 : 300,
});
// Students on the university's network share its address: a few dozen may be waiting at once.
export const passwordRequestPollLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 3000 : 6000,
});

/**
 * A test of the emails' templates («واجهة الموقع ← رسائل البريد»), per
 * account: it goes to the administrator's own address only, but it goes
 * through the university's mail server — a few tries, not a stream.
 */
export const mailTestLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 10 : 300,
  keyGenerator: accountOrIp,
});

/**
 * Files attached to messages, per account. Each may be 25 MB and lands on
 * the university's disk: forty in a quarter of an hour is eight messages of
 * five files — more than a conversation needs, far less than filling a disk.
 */
export const attachmentLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 40 : 600,
  keyGenerator: accountOrIp,
});

/**
 * Looking a student up by registration number answers with a name. Fine for
 * the handful of teammates a request needs; walked number after number, it
 * reads out the whole register. Per account, so one student cannot.
 */
export const lookupLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: config.IS_PRODUCTION ? 40 : 600,
  keyGenerator: accountOrIp,
});
