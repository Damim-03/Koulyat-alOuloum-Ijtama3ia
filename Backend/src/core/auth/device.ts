import type { Request } from "express";

/**
 * ============================================================
 * SIGN-IN DEVICE
 * ============================================================
 *
 * What a session remembers about where it was opened, so the account owner
 * can recognise their own phone and laptop in the list of sessions — and
 * spot one that is not theirs.
 *
 * The raw User-Agent is stored and parsed when read, not when written: a
 * better parser then describes old sessions correctly too.
 */

export interface SessionDevice {
  userAgent: string | null;
  ip: string | null;
  /** The browser's own id (core/auth/refresh-cookie) — sign-ins only. */
  deviceId?: string;
}

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export interface DeviceInfo {
  type: DeviceType;
  os: string | null;
  browser: string | null;
}

const UA_MAX = 512;
const IP_MAX = 64;

/** The device behind a request. `req.ip` honours TRUST_PROXY_HOPS. */
export function deviceOf(req: Request): SessionDevice {
  const ua = req.get("user-agent")?.trim();
  const ip = req.ip?.replace(/^::ffff:/, "");
  return {
    userAgent: ua ? ua.slice(0, UA_MAX) : null,
    ip: ip ? ip.slice(0, IP_MAX) : null,
  };
}

const OS: [RegExp, string][] = [
  [/iPad/, "iPadOS"],
  [/iPhone|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows NT|Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

// Order matters: Edge, Opera and Samsung Internet all also say "Chrome", and
// every browser on iOS says "Safari".
const BROWSER: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/YaBrowser\//, "Yandex"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

/** A best-effort reading of a User-Agent — enough to recognise a device. */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { type: "unknown", os: null, browser: null };

  const os = OS.find(([re]) => re.test(ua))?.[1] ?? null;
  const browser = BROWSER.find(([re]) => re.test(ua))?.[1] ?? null;

  let type: DeviceType;
  if (/iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) type = "tablet";
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) type = "mobile";
  else if (os) type = "desktop";
  else type = "unknown";

  return { type, os, browser };
}
