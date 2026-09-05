import crypto from "node:crypto";
import { getEnv } from "../utils/get-env";

/**
 * ============================================================
 * APPLICATION CONFIGURATION
 * ============================================================
 *
 * Secrets used to fall back to predictable literals ("super_access_secret",
 * "secret", "refresh_secret"). Those values are in this repository's history
 * and in every copy of it, so a production process that booted without the
 * environment set would have signed tokens anyone could forge.
 *
 * The rule now: development may fall back to a per-boot random value (tokens
 * simply do not survive a restart, which is harmless locally). Production
 * refuses to start unless every secret is present, long enough, and not one
 * of the known placeholders.
 */

const NODE_ENV = getEnv("NODE_ENV", "development");
const IS_PRODUCTION = NODE_ENV === "production";

/** Placeholders that must never reach production, whatever their length. */
const FORBIDDEN_SECRETS = new Set([
  "super_access_secret",
  "super_refresh_secret",
  "secret",
  "refresh_secret",
  "changeme",
  "change_me",
  "password",
  "development",
  "test",
]);

/** 32 bytes of entropy — the minimum defensible key length for HS256. */
const MIN_SECRET_LENGTH = 32;

const problems: string[] = [];

/**
 * Reads a secret. Never logs or returns the value anywhere but the caller.
 * Error messages name the variable only — never its content.
 */
function requireSecret(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    if (IS_PRODUCTION) {
      problems.push(`${key} is not set`);
      return "";
    }
    // Development: a random per-boot secret keeps the app usable without
    // shipping a guessable default.
    return crypto.randomBytes(48).toString("base64url");
  }

  if (FORBIDDEN_SECRETS.has(value.toLowerCase())) {
    problems.push(`${key} is set to a known placeholder value`);
  } else if (value.length < MIN_SECRET_LENGTH) {
    problems.push(
      `${key} is shorter than ${MIN_SECRET_LENGTH} characters (${value.length})`,
    );
  }

  return value;
}

const JWT_ACCESS_SECRET = requireSecret("JWT_ACCESS_SECRET");
const JWT_REFRESH_SECRET = requireSecret("JWT_REFRESH_SECRET");
const SESSION_SECRET = requireSecret("SESSION_SECRET");

// Signing both token kinds with the same key would make a refresh token a
// valid access token, defeating the short access-token lifetime.
if (
  JWT_ACCESS_SECRET &&
  JWT_REFRESH_SECRET &&
  JWT_ACCESS_SECRET === JWT_REFRESH_SECRET
) {
  problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
}

if (IS_PRODUCTION && !process.env.DATABASE_URL) {
  problems.push("DATABASE_URL is not set");
}

if (IS_PRODUCTION && problems.length > 0) {
  // Fail fast and loudly: a misconfigured production process must not serve
  // traffic with forgeable tokens.
  console.error(
    "\nFATAL: refusing to start in production with an unsafe configuration:",
  );
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nGenerate a strong secret with:\n" +
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n',
  );
  process.exit(1);
}

if (!IS_PRODUCTION && problems.length > 0) {
  console.warn("Configuration warnings (fatal in production):");
  for (const p of problems) console.warn(`  - ${p}`);
}

/** Origins allowed by both the HTTP API and Socket.IO. */
function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw && raw.trim() !== "") {
    return raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  const frontend = getEnv("FRONTEND_ORIGIN", "http://localhost:5173");
  if (IS_PRODUCTION) return [frontend];

  // Development conveniences only — never merged into the production list.
  return [
    frontend,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
  ];
}

const appConfig = () => ({
  NODE_ENV,
  IS_PRODUCTION,
  PORT: Number(process.env.PORT) || 3000,
  BASE_PATH: getEnv("BASE_PATH", "/"),

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: getEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "7d"),

  /** Claims pinned on every token so a token from elsewhere cannot be replayed. */
  JWT_ISSUER: getEnv("JWT_ISSUER", "koulyat-ouloum-api"),
  JWT_AUDIENCE: getEnv("JWT_AUDIENCE", "koulyat-ouloum-client"),

  SESSION_SECRET,
  SESSION_EXPIRES_IN: getEnv("SESSION_EXPIRES_IN", "1d"),

  FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),

  /** This API's own public base URL. Used to mint upload URLs without
      trusting the request's Host header. */
  PUBLIC_API_URL: (
    process.env.PUBLIC_API_URL ?? `http://localhost:${Number(process.env.PORT) || 3000}`
  ).replace(/\/+$/, ""),
  CORS_ORIGINS: parseOrigins(),

  /** Hops between the internet and this process (0 = directly exposed). */
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS ?? 0),

  /** Request body ceilings. Uploads go through multer, not these. */
  JSON_BODY_LIMIT: getEnv("JSON_BODY_LIMIT", "256kb"),
  URLENCODED_BODY_LIMIT: getEnv("URLENCODED_BODY_LIMIT", "256kb"),

  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 12),
});

export const config = appConfig();
