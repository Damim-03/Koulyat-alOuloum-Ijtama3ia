import { prisma } from "../../core/prisma/client";
import { auditNow } from "../../core/audit/audit";
import { config } from "../../core/config/app.config";
import { notifyAdminsQuietly } from "../notification/notification.service";

/**
 * ============================================================
 * THE ALARM FOR A GUESSING RUN ACROSS MANY ACCOUNTS
 * ============================================================
 *
 * Each account is locked after five wrong passwords (core/auth/login-throttle),
 * and each address after a few failures (`authLimiter`). Neither sees one
 * shape of attack: a list of registration numbers, each tried once or twice
 * with a likely birth date, from many machines. Every account stays under its
 * lock and every address under its limit.
 *
 * What that run cannot hide is its breadth. The throttle already keeps one
 * row per identifier that failed, with the time of its last failure, and a
 * successful sign-in deletes its row. So the number of rows that failed in
 * the last few minutes is the number of different accounts being refused right
 * now: a handful of typos on an ordinary day, hundreds during such a run.
 *
 * Past the threshold, every administrator is told and the event is written in
 * the audit log — once per cooldown, read from that log, so a restart does not
 * repeat it. Nothing is blocked: an alarm that locked sign-in for everyone
 * would hand the attacker a switch that shuts the platform for every student.
 */

export const FAILURE_SPIKE_ACTION = "auth.failureSpike";

const MINUTE = 60 * 1000;

let running: Promise<void> | null = null;
let queued: Promise<void> | null = null;

function start(): Promise<void> {
  const p: Promise<void> = check()
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({ level: "error", scope: "failure-spike", message: (error as Error)?.message }),
      );
    })
    .finally(() => {
      if (running === p) running = null;
    });
  running = p;
  return p;
}

/**
 * Looks after one refused sign-in, once its failure is recorded. Never throws.
 *
 * Checks run one at a time: two passing together would both find no alert
 * yet, and send two. A failure that arrives while a check runs may not have
 * been counted by it, so one more check is queued after it — shared by every
 * failure that arrives meanwhile. The last failure of a run is always counted,
 * and no sign-in waits for more than two checks.
 */
export function watchFailureSpike(): Promise<void> {
  if (!running) return start();
  queued ??= running.then(() => {
    queued = null;
    return running ?? start();
  });
  return queued;
}

/** Whether an alert went out within the cooldown: the alarm is still up. */
export async function spikeActive(now = Date.now()): Promise<boolean> {
  const told = await prisma.auditLog.findFirst({
    where: {
      action: FAILURE_SPIKE_ACTION,
      createdAt: { gte: new Date(now - config.LOGIN_SPIKE_COOLDOWN_MINUTES * MINUTE) },
    },
    select: { id: true },
  });
  return !!told;
}

async function check() {
  const now = Date.now();
  const minutes = config.LOGIN_SPIKE_WINDOW_MINUTES;
  const accounts = await prisma.loginThrottle.count({
    where: { lastFailureAt: { gte: new Date(now - minutes * MINUTE) } },
  });
  if (accounts < config.LOGIN_SPIKE_ACCOUNTS) return;

  if (await spikeActive(now)) return;

  // The log first: it is what the cooldown reads.
  await auditNow({
    action: FAILURE_SPIKE_ACTION,
    success: false,
    details: { accounts, minutes, threshold: config.LOGIN_SPIKE_ACCOUNTS },
  });
  await notifyAdminsQuietly({
    type: "security_alert",
    title: { key: "notif.loginSpike.title" },
    message: { key: "notif.loginSpike.message", params: { count: accounts, minutes } },
    // The audit log is a part of «المستخدمون» (the client's users page) now.
    link: "/admin/users?view=audit&kind=failed",
  });
}
