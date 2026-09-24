import rateLimit, { type Options } from "express-rate-limit";

import { config } from "../config/app.config";

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
  message: { message: "Too many requests, please try again later." },
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
 */
export const makeAuthLimiter = (max: number) =>
  rateLimit({
    ...shared,
    windowMs: 15 * 60 * 1000,
    max,
    skipSuccessfulRequests: true,
    message: {
      message: "Too many failed attempts. Please try again in a few minutes.",
    },
  });

export const authLimiter = makeAuthLimiter(config.AUTH_RATE_LIMIT_MAX);

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

/** Writes that fan out (uploads, messages, bulk actions). */
export const writeLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  max: config.IS_PRODUCTION ? 60 : 300,
});
