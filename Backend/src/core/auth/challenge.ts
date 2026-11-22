import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { config } from "../config/app.config";
import { ALGORITHM } from "./tokens";

/**
 * ============================================================
 * THE SECOND STEP OF A SIGN-IN
 * ============================================================
 *
 * An administrator with two-step verification gets no session for a right
 * password — only this: a five-minute ticket saying "this account's password
 * was just given", which the code from the authenticator app turns into a
 * session (`POST /auth/admin/login/2fa`).
 *
 * Its own type and audience, so it is never mistaken for an access token, and
 * the account's token generation, so a password changed in between voids it.
 */

const TYP = "2fa";
const EXPIRES_IN = "5m";
const audience = () => `${config.JWT_AUDIENCE}:2fa`;

export interface ChallengeClaims {
  userId: string;
  tokenVersion: number;
}

export function issueChallenge(user: { id: string; tokenVersion: number }): string {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion, typ: TYP, nonce: crypto.randomBytes(9).toString("base64url") },
    config.JWT_ACCESS_SECRET,
    { algorithm: ALGORITHM, expiresIn: EXPIRES_IN, issuer: config.JWT_ISSUER, audience: audience() },
  );
}

/** The claims — or null for anything expired, altered or of another kind. */
export function readChallenge(token: string): ChallengeClaims | null {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
      issuer: config.JWT_ISSUER,
      audience: audience(),
    });
    if (typeof decoded === "string") return null;
    const { userId, tokenVersion, typ } = decoded as Record<string, unknown>;
    if (typ !== TYP || typeof userId !== "string" || typeof tokenVersion !== "number") return null;
    return { userId, tokenVersion };
  } catch {
    return null;
  }
}
