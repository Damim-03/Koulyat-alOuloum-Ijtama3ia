import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";

import { config } from "../config/app.config";
import { RoleType } from "../enums/role.enum";

/**
 * ============================================================
 * TOKEN ISSUING AND VERIFICATION — single source of truth
 * ============================================================
 *
 * Previously `jwt.sign`/`jwt.verify` were called inline with nothing but a
 * secret and an expiry. Three things were missing:
 *
 *  1. No pinned algorithm. `verify` accepted whatever the token's own header
 *     claimed, which is the classic algorithm-confusion foothold.
 *  2. No `iss`/`aud`. A token minted by any other service sharing the secret
 *     would have been accepted here.
 *  3. No token *type*. Access and refresh tokens carried identical payloads
 *     and were told apart only by which secret signed them, so the split
 *     depended entirely on the two secrets never being equal.
 *
 * Every token now carries `typ`, and verification demands the expected one.
 */

export const ALGORITHM = "HS256" as const;

export type TokenType = "access" | "refresh";

export interface AppTokenPayload {
  userId: string; // always User.id
  role: RoleType;
  refId: string; // studentId | professorId | userId (admin)
  /** User.tokenVersion at issue time; a mismatch revokes the whole account. */
  tokenVersion: number;
  /** One id per sign-in, so a single session can be signed out on its own. */
  sid?: string;
  typ: TokenType;
  /** Standard claim, present on verified tokens. */
  exp?: number;
}

/** Claims that must never be placed in a JWT — it is signed, not encrypted. */
type ClaimsInput = Omit<AppTokenPayload, "typ" | "exp">;

function baseSignOptions(expiresIn: string): SignOptions {
  return {
    algorithm: ALGORITHM,
    expiresIn,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  } as SignOptions;
}

function baseVerifyOptions(): VerifyOptions {
  return {
    algorithms: [ALGORITHM], // never trust the token's own header
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };
}

export function signAccessToken(claims: ClaimsInput): string {
  return jwt.sign(
    { ...claims, typ: "access" satisfies TokenType },
    config.JWT_ACCESS_SECRET,
    baseSignOptions(config.JWT_ACCESS_EXPIRES_IN),
  );
}

export function signRefreshToken(claims: ClaimsInput): string {
  return jwt.sign(
    { ...claims, typ: "refresh" satisfies TokenType },
    config.JWT_REFRESH_SECRET,
    baseSignOptions(config.JWT_REFRESH_EXPIRES_IN),
  );
}

export function signTokenPair(claims: ClaimsInput) {
  return {
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

/**
 * Verifies a token and asserts it is the kind the caller expects.
 * Throws the underlying jsonwebtoken error so callers can distinguish
 * "expired" from "malformed".
 */
export function verifyToken(
  token: string,
  expected: TokenType,
): AppTokenPayload {
  const secret =
    expected === "access" ? config.JWT_ACCESS_SECRET : config.JWT_REFRESH_SECRET;

  const decoded = jwt.verify(token, secret, baseVerifyOptions());

  if (typeof decoded === "string" || decoded === null) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }

  const payload = decoded as unknown as AppTokenPayload;

  // Belt and braces: even with separate secrets, refuse a token presented as
  // the wrong kind.
  if (payload.typ !== expected) {
    throw new jwt.JsonWebTokenError("Unexpected token type");
  }

  if (!payload.userId || !payload.role) {
    throw new jwt.JsonWebTokenError("Incomplete token payload");
  }

  return payload;
}
