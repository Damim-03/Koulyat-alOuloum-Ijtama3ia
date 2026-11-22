import type { CookieOptions, Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { config } from "../config/app.config";

/**
 * ============================================================
 * THE REFRESH-TOKEN COOKIE
 * ============================================================
 *
 * The web client used to keep its seven-day refresh token in localStorage,
 * where any script on the page can read it: one XSS would have meant a week
 * of someone else's account, from anywhere. In an httpOnly cookie the browser
 * sends it, and no script ever sees it.
 *
 * Scoped to the auth routes (`/api/auth`), so ordinary API calls never carry
 * it, and SameSite keeps other sites from sending it. Requests from origins
 * outside the CORS allow-list are refused before any route runs.
 */

export const REFRESH_COOKIE = "refresh_token";

/**
 * Whether the browser reached us over HTTPS. Behind a proxy that ends TLS the
 * connection itself is plain HTTP, and the proxy says so in X-Forwarded-Proto.
 *
 * That header is read even when the proxy is not trusted (TRUST_PROXY_HOPS):
 * all a forged value can do is mark the forger's own cookie Secure, which
 * only costs them their own session on plain HTTP.
 */
export function isHttpsRequest(req: Pick<Request, "secure" | "headers">): boolean {
  if (req.secure) return true;
  const proto = req.headers["x-forwarded-proto"];
  const first = (Array.isArray(proto) ? proto[0] : proto)?.split(",")[0]?.trim().toLowerCase();
  return first === "https";
}

const base = (req: Request): CookieOptions => ({
  httpOnly: true,
  secure:
    // SameSite=None is refused by browsers without Secure.
    config.AUTH_COOKIE_SAMESITE === "none" ||
    (config.AUTH_COOKIE_SECURE === "auto" ? isHttpsRequest(req) : config.AUTH_COOKIE_SECURE),
  sameSite: config.AUTH_COOKIE_SAMESITE,
  path: config.AUTH_COOKIE_PATH,
});

/** Sets the cookie to live exactly as long as the token inside it. */
export function setRefreshCookie(res: Response, refreshToken: string) {
  const exp = (jwt.decode(refreshToken) as { exp?: number } | null)?.exp;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base(res.req),
    ...(exp ? { maxAge: Math.max(0, exp * 1000 - Date.now()) } : {}),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, base(res.req));
}

export function readRefreshCookie(req: Request): string | undefined {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof v === "string" && v.length > 0 && v.length < 4096 ? v : undefined;
}

/**
 * ============================================================
 * THE BROWSER'S OWN ID — for "a sign-in from a new device"
 * ============================================================
 *
 * A random id each browser keeps, beside the refresh cookie and as hidden
 * from scripts. It outlives sign-outs, so the next sign-in from the same
 * browser is recognised and a sign-in from any other one is not. It proves
 * nothing and opens nothing — it only tells "seen before" from "new".
 */
export const DEVICE_COOKIE = "device_id";
const DEVICE_ID = /^[A-Za-z0-9_-]{22,64}$/;
/** About 400 days — the longest a browser keeps a cookie anyway. */
const DEVICE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

export function readDeviceId(req: Request): string | undefined {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[DEVICE_COOKIE];
  return typeof v === "string" && DEVICE_ID.test(v) ? v : undefined;
}

/** This browser's id — given one now if it had none — kept for another 400 days. */
export function ensureDeviceId(req: Request, res: Response): string {
  const id = readDeviceId(req) ?? crypto.randomBytes(24).toString("base64url");
  res.cookie(DEVICE_COOKIE, id, { ...base(req), maxAge: DEVICE_MAX_AGE_MS });
  return id;
}
