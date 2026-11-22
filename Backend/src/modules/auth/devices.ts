import crypto from "node:crypto";

import { prisma } from "../../core/prisma/client";
import { parseUserAgent, type SessionDevice } from "../../core/auth/device";
import { audit } from "../../core/audit/audit";
import { createNotification } from "../notification/notification.service";
import { newDeviceMail } from "./email-links";

/**
 * ============================================================
 * "A SIGN-IN FROM A NEW DEVICE"
 * ============================================================
 *
 * Each browser carries a random id (core/auth/refresh-cookie). A sign-in from
 * an id this account has not used before — when it has used others — tells
 * its owner at once: a notice on every device of the account (and in the
 * administrator's bell), naming the browser, the system and the address, with
 * the way to the devices list to sign that one out. A stolen password used
 * from elsewhere is then seen the same day, not at the end of the year.
 *
 * The very first browser of an account says nothing: there is nothing to
 * compare it with. And none of this may ever fail a sign-in.
 */

/** Browsers remembered per account — enough for anyone's phone, laptop and lab. */
const KEEP = 20;

const keyOf = (deviceId: string) => crypto.createHash("sha256").update(deviceId).digest("hex");

/** "Chrome · Windows" — what the notice calls the device. */
export function describeDevice(userAgent: string | null): string {
  const d = parseUserAgent(userAgent);
  // A script or an app names itself first ("curl/8.4.0", "okhttp/4.12").
  return [d.browser, d.os].filter(Boolean).join(" · ") || userAgent?.split(/\s/)[0]?.slice(0, 40) || "?";
}

export async function recordSignInDevice(userId: string, device: SessionDevice | undefined, sid: string) {
  if (!device?.deviceId) return;
  try {
    const deviceKey = keyOf(device.deviceId);
    const now = new Date();
    const seen = await prisma.userDevice.findUnique({
      where: { userId_deviceKey: { userId, deviceKey } },
      select: { id: true },
    });
    if (seen) {
      await prisma.userDevice.update({
        where: { id: seen.id },
        data: { lastSeenAt: now, userAgent: device.userAgent, ip: device.ip },
      });
      return;
    }

    const before = await prisma.userDevice.count({ where: { userId } });
    await prisma.userDevice.create({
      data: { userId, deviceKey, userAgent: device.userAgent, ip: device.ip },
    });
    if (before >= KEEP) {
      const stale = await prisma.userDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: "desc" },
        skip: KEEP,
        select: { id: true },
      });
      await prisma.userDevice.deleteMany({ where: { id: { in: stale.map((d) => d.id) } } });
    }
    if (before === 0) return;

    await createNotification({
      userId,
      type: "security_alert",
      title: { key: "notif.newDevice.title" },
      message: {
        key: "notif.newDevice.message",
        // Isolated (U+2066…U+2069): "Edge · Windows" and "::1" keep their own
        // direction inside an Arabic sentence.
        params: {
          device: `\u2066${describeDevice(device.userAgent)}\u2069`,
          ip: `\u2066${device.ip ?? "?"}\u2069`,
        },
      },
      // The session it opened: its own page does not warn about itself.
      link: `/account?tab=security&session=${sid}`,
    });
    // And by email, to a proven address — for whoever is not looking at the bell.
    void newDeviceMail(userId, device);
    audit({
      action: "auth.newDevice",
      actor: { id: userId },
      details: { device: parseUserAgent(device.userAgent), session: sid },
      device,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", scope: "recordSignInDevice", message: (error as Error)?.message }),
    );
  }
}
