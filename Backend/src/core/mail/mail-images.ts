import fs from "node:fs";
import path from "node:path";
import { MAIL_FACULTY_PNG, MAIL_LOGO_PNG } from "./logo";

/**
 * The two logos a message may carry in its band — the university's and the
 * faculty's — as «واجهة الموقع ← رسائل البريد» chose them:
 *
 * - `null` — none;
 * - `"platform"` — the platform's own (core/mail/logo);
 * - `/uploads/cards/<file>` — a picture the administration uploaded through
 *   the site's own upload (which checks what it stores): read from this
 *   server's disk and attached to the message, never fetched from anywhere.
 *   PNG or JPEG only — what every mail app draws — and small: the editor
 *   shrinks it before uploading, and anything heavier is refused here.
 */

export type LogoChoice = "platform" | string | null;
export type LogoSlot = "university" | "faculty";

export interface MailImage {
  content: Buffer;
  contentType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export const UPLOADED_LOGO = /^\/uploads\/cards\/([A-Za-z0-9._-]+)$/;
/** A logo shown 44 px high needs a few kilobytes; a megabyte would ride on every message. */
export const MAX_LOGO_BYTES = 512 * 1024;

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** A PNG's or a JPEG's size, read from its own bytes — or null for anything else. */
export function imageSize(buf: Buffer): { type: MailImage["contentType"]; width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a)
    return { type: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1]!;
      if (SOF.has(marker)) return { type: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** An uploaded picture fit for a message — or null: not ours, gone, too heavy, or not a PNG or JPEG. */
export function uploadedImage(url: string): MailImage | null {
  const name = UPLOADED_LOGO.exec(url)?.[1];
  if (!name || name.includes("..")) return null;
  try {
    const file = path.join(process.cwd(), "uploads", "cards", name);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_LOGO_BYTES) return null;
    const content = fs.readFileSync(file);
    const size = imageSize(content);
    if (!size || !size.width || !size.height) return null;
    return { content, contentType: size.type, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

const PLATFORM: Record<LogoSlot, MailImage> = {
  university: { content: MAIL_LOGO_PNG, contentType: "image/png", ...imageSize(MAIL_LOGO_PNG)! },
  faculty: { content: MAIL_FACULTY_PNG, contentType: "image/png", ...imageSize(MAIL_FACULTY_PNG)! },
};

/** The picture a choice stands for — or nothing, which leaves the band as it was. */
export function logoImage(slot: LogoSlot, choice: LogoChoice | undefined): MailImage | null {
  if (!choice) return null;
  if (choice === "platform") return PLATFORM[slot];
  return uploadedImage(choice);
}
