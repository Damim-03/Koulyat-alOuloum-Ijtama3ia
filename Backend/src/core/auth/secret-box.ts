import crypto from "node:crypto";

import { config } from "../config/app.config";

/**
 * ============================================================
 * SECRETS AT REST — the two-step verification keys
 * ============================================================
 *
 * A TOTP secret is as good as the code it produces: whoever reads it from the
 * database can sign in as that administrator, password aside. So it is kept
 * encrypted (AES-256-GCM, which also detects tampering), under a key derived
 * from SESSION_SECRET — which lives in the server's environment, never in the
 * database. A copy of the database alone, a backup, a dump, does not open it.
 *
 * Changing SESSION_SECRET makes stored secrets unreadable: each administrator
 * then needs `reset-2fa` (src/cli/reset-2fa.ts) and sets it up again.
 */

const VERSION = "v1";

/**
 * What a sealed text is for: each its own key, so one kind can never be
 * opened as another. The TOTP keys keep the key they were always sealed with;
 * a password an administrator wrote for a student to pick up
 * (modules/password-request) has its own.
 */
export type SealPurpose = "totp-secret/v1" | "password-pickup/v1";

const keys = new Map<SealPurpose, Buffer>();
const keyOf = (purpose: SealPurpose) => {
  let key = keys.get(purpose);
  if (!key) {
    key = Buffer.from(crypto.hkdfSync("sha256", config.SESSION_SECRET, "koulyat-ouloum", purpose, 32));
    keys.set(purpose, key);
  }
  return key;
};

export function seal(plain: string, purpose: SealPurpose = "totp-secret/v1"): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyOf(purpose), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

/** The plain text — or null when it was sealed under another key, or altered. */
export function unseal(sealed: string | null | undefined, purpose: SealPurpose = "totp-secret/v1"): string | null {
  if (!sealed?.startsWith(`${VERSION}.`)) return null;
  try {
    const raw = Buffer.from(sealed.slice(VERSION.length + 1), "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyOf(purpose), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
