import crypto from "node:crypto";
import path from "node:path";
import { getEnv } from "../utils/get-env";
import { isOriginAllowed, isSecureContextOrigin, normalizeOrigin } from "./origins";

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

/**
 * The origins allowed by both the HTTP API and Socket.IO.
 *
 * Production allows exactly what the environment names, so a missing or
 * malformed value used to surface only as a browser that could not sign in
 * ("CORS not allowed") — with nothing in the server log to say why. Now the
 * process refuses to start instead, naming the variable. A trailing slash or
 * a path, the commonest slip, is simply dropped.
 */
function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
    ? process.env.CORS_ORIGINS
    : process.env.FRONTEND_ORIGIN?.trim()
      ? process.env.FRONTEND_ORIGIN
      : undefined;

  if (raw === undefined && IS_PRODUCTION) {
    problems.push(
      "FRONTEND_ORIGIN (or CORS_ORIGINS) is not set — e.g. https://memoires.univ-eloued.dz",
    );
    return [];
  }

  const listed = (raw ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origins: string[] = [];
  for (const o of listed) {
    const origin = normalizeOrigin(o);
    if (origin) origins.push(origin);
    else problems.push(`"${o}" in FRONTEND_ORIGIN/CORS_ORIGINS is not an http(s) address`);
  }
  if (IS_PRODUCTION) return origins;

  // Development conveniences only — never merged into the production list.
  return [
    ...origins,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
  ];
}

const CORS_ORIGINS = parseOrigins();

/**
 * Whether the refresh cookie is marked `Secure` (sent over HTTPS only).
 *
 * `auto`, the default, decides per request: HTTPS gets a Secure cookie, plain
 * HTTP (an intranet without TLS) a cookie it can actually keep. A fixed
 * `true` on plain HTTP made browsers drop the cookie, and every session ended
 * with its first access token, fifteen minutes in. `true`/`false` still pin it.
 */
const AUTH_COOKIE_SECURE = ((): boolean | "auto" => {
  const v = (process.env.AUTH_COOKIE_SECURE ?? "auto").trim().toLowerCase();
  return v === "true" ? true : v === "false" ? false : "auto";
})();

/** A positive number from the environment, or the default. */
const positive = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  problems.push(`${key} must be a positive number (got "${raw}")`);
  return fallback;
};

/**
 * Two-step verification is required of every administrator unless this says
 * otherwise. The integration tests sign administrators in by password alone,
 * so `.env.test` turns it off; production should never need to.
 */
const REQUIRE_ADMIN_2FA = (process.env.REQUIRE_ADMIN_2FA ?? "true").trim().toLowerCase() !== "false";

// Read here, before the checks below: a bad value is a problem like any other —
// read inside appConfig() it was recorded only after the checks had run.
const ADMIN_SESSION_HOURS = positive("ADMIN_SESSION_HOURS", 8);
const ADMIN_IDLE_MINUTES = positive("ADMIN_IDLE_MINUTES", 30);
const LOGIN_SPIKE_ACCOUNTS = positive("LOGIN_SPIKE_ACCOUNTS", 50);
const LOGIN_SPIKE_WINDOW_MINUTES = positive("LOGIN_SPIKE_WINDOW_MINUTES", 10);
const LOGIN_SPIKE_COOLDOWN_MINUTES = positive("LOGIN_SPIKE_COOLDOWN_MINUTES", 60);
const FAILED_SIGNIN_RETENTION_DAYS = positive("FAILED_SIGNIN_RETENTION_DAYS", 90);
const SIGNIN_RETENTION_DAYS = positive("SIGNIN_RETENTION_DAYS", 90);
// Backend/geo, from src/core/config and from dist/core/config alike. Empty: off.
const GEOIP_DIR = process.env.GEOIP_DIR?.trim() ?? path.resolve(__dirname, "../../../geo");

/**
 * The short check a browser solves before signing in, once an account has
 * failed a few times or while the alarm is up (modules/auth/captcha).
 *
 * Browsers run it only on a secure page — HTTPS or the machine itself — since
 * it needs `crypto.subtle`. On a plain-HTTP intranet it cannot run, and asking
 * for it there would leave a student who mistyped twice unable to sign in. So
 * `auto` (the default) turns it on only when every address the web client is
 * served from is secure; `on`/`off` pin it. It is decided here, from the
 * configuration, and never from the request: a header saying "this page is
 * plain HTTP" is as easy to forge as any other.
 *
 * Under test, `auto` means off: the integration tests fail sign-ins on purpose
 * and expect the lock; the check is tested in its own file, switched on there.
 */
const LOGIN_CAPTCHA = ((): boolean => {
  const v = (process.env.LOGIN_CAPTCHA ?? "auto").trim().toLowerCase();
  if (v === "on" || v === "true") return true;
  if (v === "off" || v === "false") return false;
  if (NODE_ENV === "test") return false;
  return CORS_ORIGINS.length > 0 && CORS_ORIGINS.every(isSecureContextOrigin);
})();
const LOGIN_CAPTCHA_AFTER_FAILURES = positive("LOGIN_CAPTCHA_AFTER_FAILURES", 2);

/**
 * Activation of student accounts, in two stages.
 *
 * A student's first password is handed out by the administration — a birth
 * date, printed on the student's own card. Any account with a handed-out
 * password must replace it before anything else (core/middleware/auth.middleware).
 * On, a student's first sign-in goes on from there: right after the new
 * password, the photos that verify the account — the card, and their face —
 * for an administrator to review (modules/activation/activation-request).
 * The student may skip them: the account works all the same, unverified, and
 * «توثيق الحساب» in their account offers it again.
 *
 * Not a lock: whoever knows the birth date can still choose the password
 * first. What it gives is accounts the administration has seen are their
 * holders'. Off by default: switched on the day the administration is ready
 * to review the photos.
 */
const REQUIRE_STUDENT_ACTIVATION = (process.env.REQUIRE_STUDENT_ACTIVATION ?? "false").trim().toLowerCase() === "true";
/**
 * An activation request (photos of the card and of the student holding it —
 * modules/activation) not reviewed in this many days is deleted, photos and
 * all: they are not kept waiting for ever.
 */
const ACTIVATION_REQUEST_DAYS = positive("ACTIVATION_REQUEST_DAYS", 30);
/**
 * «نسيت كلمة المرور» through the administration (modules/password-request):
 * a request not decided in this many days goes, card photo and all; and the
 * password an administrator wrote waits this many hours for the student to
 * copy it — then it goes too, and they ask again.
 */
const PASSWORD_REQUEST_DAYS = positive("PASSWORD_REQUEST_DAYS", 14);
const PASSWORD_PICKUP_HOURS = positive("PASSWORD_PICKUP_HOURS", 72);

if (IS_PRODUCTION && problems.length > 0) {
  // Fail fast and loudly: a misconfigured production process must not serve
  // traffic with forgeable tokens.
  console.error(
    "\nFATAL: refusing to start in production with an unsafe configuration:",
  );
  for (const p of problems) console.error(`  - ${p}`);
  if (problems.some((p) => p.includes("SECRET"))) {
    console.error(
      "\nGenerate a strong secret with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n',
    );
  }
  process.exit(1);
}

if (!IS_PRODUCTION && problems.length > 0) {
  console.warn("Configuration warnings (fatal in production):");
  for (const p of problems) console.warn(`  - ${p}`);
}

/**
 * `PORT=0` تعني «أعطني أي منفذٍ حرّ» — وهي قيمة صالحة يستعملها الخادم في
 * الاختبار كي لا ينازع خادم التطوير على منفذه. والصيغة السابقة
 * `Number(process.env.PORT) || 3000` كانت تُسقطها بصمت لأن الصفر كاذبٌ في
 * جافاسكربت، فتعود إلى ٣٠٠٠ وكأن شيئاً لم يُطلب.
 *
 * وما هو خارج المدى أو ليس عدداً يعود إلى ٣٠٠٠ كما كان: الخطأ في متغيّر بيئة
 * لا ينبغي أن يمنع الخادم من العمل.
 */
const readPort = (): number => {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3000;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 3000;
};

const appConfig = () => ({
  NODE_ENV,
  IS_PRODUCTION,
  PORT: readPort(),
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

  /**
   * The web client's refresh token lives in an httpOnly cookie, out of reach
   * of page scripts. `lax` suits a frontend and API on the same site
   * (app.example.dz + api.example.dz, or localhost on two ports); a frontend
   * on an unrelated domain needs `none`, which also forces `Secure`.
   */
  AUTH_COOKIE_SAMESITE: ((): "lax" | "strict" | "none" => {
    const v = getEnv("AUTH_COOKIE_SAMESITE", "lax").toLowerCase();
    return v === "strict" || v === "none" ? v : "lax";
  })(),
  /** Only the auth routes ever receive the cookie. Prefix it if a proxy does. */
  AUTH_COOKIE_PATH: getEnv("AUTH_COOKIE_PATH", "/api/auth"),
  /** `auto` follows each request's scheme (see above); `true`/`false` pin it. */
  AUTH_COOKIE_SECURE,

  // أقصى عدد محاولات دخول فاشلة لكل عنوان في نافذة الحدّ. قابل للضبط
  // لأن الاختبارات تُفشل الدخول عمداً مراراً، فتُشعل الحدّ وتفشل لسببٍ
  // لا علاقة له بما تختبره. تُختبَر آليّة الحدّ نفسها على حدة.
  AUTH_RATE_LIMIT_MAX: Number(getEnv("AUTH_RATE_LIMIT_MAX", "10")),

  /**
   * The alarm for a guessing run spread over many accounts (modules/auth/
   * failure-spike): this many different identifiers failing within the
   * window tells every administrator — at most once per cooldown.
   */
  LOGIN_SPIKE_ACCOUNTS,
  LOGIN_SPIKE_WINDOW_MINUTES,
  LOGIN_SPIKE_COOLDOWN_MINUTES,
  /** Refused sign-ins name a registration number or email and an address: kept this long, then deleted. */
  FAILED_SIGNIN_RETENTION_DAYS,
  /**
   * Students and professors signing in and out: many rows a day, kept this
   * long, then deleted. An administrator's are kept for good.
   */
  SIGNIN_RETENTION_DAYS,
  /**
   * Where the address databases are (core/geo): the country, region and city
   * of an address, and its network operator — read on this server, never
   * asked of anyone else. Empty turns it off; a folder without them, too.
   */
  GEOIP_DIR,
  /** Whether sign-in can ask for the browser check at all (see above), and after how many failures. */
  LOGIN_CAPTCHA,
  LOGIN_CAPTCHA_AFTER_FAILURES,
  /** Whether a student's first sign-in goes on to the photos (see above), and how long a request waits. */
  REQUIRE_STUDENT_ACTIVATION,
  ACTIVATION_REQUEST_DAYS,
  /** How long a forgotten-password request waits for a decision, and its password for the student. */
  PASSWORD_REQUEST_DAYS,
  PASSWORD_PICKUP_HOURS,

  FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),

  CORS_ORIGINS,

  /** Hops between the internet and this process (0 = directly exposed). */
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS ?? 0),

  /** Request body ceilings. Uploads go through multer, not these. */
  JSON_BODY_LIMIT: getEnv("JSON_BODY_LIMIT", "256kb"),
  URLENCODED_BODY_LIMIT: getEnv("URLENCODED_BODY_LIMIT", "256kb"),

  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 12),

  /**
   * An administrator's session is shorter than everyone else's: it ends this
   * many hours after sign-in, whatever happens in between…
   */
  ADMIN_SESSION_HOURS,
  /**
   * …and after this many minutes without a request — decided by the server,
   * so a browser closed without signing out (a shared office computer) does
   * not reopen into the administration the next morning.
   */
  ADMIN_IDLE_MINUTES,

  REQUIRE_ADMIN_2FA,
  /** The name authenticator apps show above the code. */
  TOTP_ISSUER: getEnv("TOTP_ISSUER", "Mudhakkirati"),

  /**
   * Outgoing mail (core/mail) — any SMTP server: the university's, or a Gmail
   * account with an app password while testing. Without SMTP_HOST mail is
   * off: nothing is sent, and the pages that need it (forgot password) say so
   * instead of promising a message that will never come.
   */
  MAIL: {
    host: process.env.SMTP_HOST?.trim() || null,
    port: Number(process.env.SMTP_PORT ?? 587),
    /** `true` for port 465 (TLS from the start); 587 upgrades with STARTTLS. */
    secure: (process.env.SMTP_SECURE ?? "").trim().toLowerCase() === "true",
    user: process.env.SMTP_USER?.trim() || null,
    pass: process.env.SMTP_PASS || null,
    /** "Mudhakkirati <noreply@univ-eloued.dz>" — the account's own address when unset. */
    from: process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || null,
  },
  /** How long a "forgot my password" link works. */
  RESET_LINK_MINUTES: Number(getEnv("RESET_LINK_MINUTES", "30")),
  /** How long a link that proves an email address works. */
  VERIFY_LINK_HOURS: Number(getEnv("VERIFY_LINK_HOURS", "24")),
});

export const config = appConfig();

/**
 * هل يُقبل هذا الأصل؟
 *
 * الحدّ الوحيد للسماح في الـHTTP وفي السوكيت معاً — فلا يفترقان. وقاعدته
 * في `origins.ts`، دالّةً صرفةً مُختبَرة: القائمة الصريحة في كل بيئة،
 * وأنفاق التطوير في التطوير وحده.
 */
export const isAllowedOrigin = (origin: string): boolean =>
  isOriginAllowed(origin, {
    allowList: config.CORS_ORIGINS,
    isProduction: IS_PRODUCTION,
  });
