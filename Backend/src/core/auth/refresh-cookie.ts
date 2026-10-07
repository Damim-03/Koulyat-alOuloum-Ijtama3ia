import type { CookieOptions, Request, Response } from "express";
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

const base = (): CookieOptions => ({
  httpOnly: true,
  // SameSite=None is refused by browsers without Secure.
  secure: config.AUTH_COOKIE_SECURE || config.AUTH_COOKIE_SAMESITE === "none",
  sameSite: config.AUTH_COOKIE_SAMESITE,
  path: config.AUTH_COOKIE_PATH,
});

/** Sets the cookie to live exactly as long as the token inside it. */
export function setRefreshCookie(res: Response, refreshToken: string) {
  const exp = (jwt.decode(refreshToken) as { exp?: number } | null)?.exp;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base(),
    ...(exp ? { maxAge: Math.max(0, exp * 1000 - Date.now()) } : {}),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, base());
}

export function readRefreshCookie(req: Request): string | undefined {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof v === "string" && v.length > 0 && v.length < 4096 ? v : undefined;
}
