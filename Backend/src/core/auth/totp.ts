import crypto from "node:crypto";

/**
 * ============================================================
 * TWO-STEP VERIFICATION — TOTP (RFC 6238 over RFC 4226)
 * ============================================================
 *
 * The six-digit codes every authenticator app shows (Google Authenticator,
 * Microsoft Authenticator, Aegis, 2FAS…): HMAC-SHA1 of the 30-second step
 * since 1970, under a secret shared once through a QR code.
 *
 * Written here rather than pulled from a package: it is forty lines, the RFC
 * gives test vectors (totp.test.ts), and one fewer dependency is one fewer
 * thing in `npm audit`.
 */

export const STEP_SECONDS = 30;
export const DIGITS = 6;
/** Codes from one step either side are accepted — a phone's clock drifts. */
export const WINDOW = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160 random bits — the size RFC 4226 recommends — as base32. */
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

/** HOTP (RFC 4226 §5.3): the code for one counter value. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin =
    ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** The 30-second step a moment falls in. */
export const stepAt = (ms: number = Date.now()) => Math.floor(ms / 1000 / STEP_SECONDS);

export const totpAt = (secretB32: string, ms: number = Date.now(), digits = DIGITS) =>
  hotp(base32Decode(secretB32), stepAt(ms), digits);

const sameCode = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The step this code belongs to, or null.
 *
 * A step at or before `lastStep` was already used to sign in: the same code
 * seen twice is someone replaying it (over a shoulder, from a proxy log), so
 * it is refused even inside its 30 seconds.
 */
export function matchTotp(
  secretB32: string,
  code: string,
  opts: { now?: number; lastStep?: number | null; window?: number } = {},
): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretB32);
  const current = stepAt(opts.now ?? Date.now());
  const window = opts.window ?? WINDOW;
  for (let step = current - window; step <= current + window; step++) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    if (sameCode(hotp(secret, step), digits)) return step;
  }
  return null;
}

/** What an authenticator app reads from the QR code. */
export function otpauthUrl(opts: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

//
// ─── RECOVERY CODES ─────────────────────────────────────────
//
// For the day the phone is lost: ten single-use codes, shown once. Stored as
// SHA-256 — they are random and long, so a plain hash is enough (nobody can
// try 2^40 of them against a login form that locks after five).
//

/** No 0/O, 1/I/L: a code copied from paper is read right. */
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const chars = [...crypto.randomBytes(10)].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
    return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
  });
}

export const normalizeRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");

export const hashRecoveryCode = (code: string) =>
  crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");

/** Looks like a recovery code rather than a six-digit one. */
export const isRecoveryCodeShape = (code: string) => normalizeRecoveryCode(code).length === 10;
