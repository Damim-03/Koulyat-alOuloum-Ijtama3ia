/**
 * يُطفئ التحقّق بخطوتين لمسؤولٍ فقد هاتفه ولم يبقَ له رمز استرداد — أو بعد
 * تغيير SESSION_SECRET (الذي يشفّر أسرار التطبيقات، فتصير غير مقروءة).
 *
 * الإنتاج (داخل الحاوية):   ADMIN_EMAIL=… node dist/cli/reset-2fa.js
 * التطوير:                   ADMIN_EMAIL=… npm run reset-2fa:dev
 *
 * يُخرج الحساب من كلّ أجهزته، ويُكتب في سجلّ العمليات. وعند دخوله التالي
 * يُطلب منه إعداد التحقّق من جديد بهاتفه الجديد.
 *
 * Runs only from the server's own console: whoever can run it already holds
 * the database and the secrets, so it opens nothing they could not.
 *
 * `resetTwoFactor` and `run` are exported for `reset-2fa.test.ts`; the command
 * itself runs only when started, never on import.
 */
import "dotenv/config";

import { prisma } from "../core/prisma/client";
import { Prisma } from "../generated/prisma";
import { auditNow } from "../core/audit/audit";

/** A message printed as it is, ending the command. */
export class CliError extends Error {}

/** Turns it off for one administrator, signs every device out, and writes it down. */
export async function resetTwoFactor(rawEmail: string | undefined) {
  const email = rawEmail?.trim().toLowerCase();
  if (!email) throw new CliError("Set ADMIN_EMAIL to the administrator's sign-in email.");

  const user = await prisma.user.findFirst({
    where: { email, role: "admin" },
    select: { id: true, totpEnabledAt: true },
  });
  if (!user) throw new CliError(`No administrator signs in with ${email}.`);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpPendingSecret: null,
      totpEnabledAt: null,
      totpLastStep: null,
      totpRecoveryCodes: Prisma.DbNull,
      // Every device signs out: whoever holds the lost phone holds no session.
      tokenVersion: { increment: 1 },
    },
  });
  await prisma.authSession.deleteMany({ where: { userId: user.id } });
  await auditNow({
    action: "cli.twoFactorReset",
    actor: { label: "server console" },
    targetType: "users",
    targetId: user.id,
    details: { email, wasEnabled: !!user.totpEnabledAt },
  });
  return { email, wasEnabled: !!user.totpEnabledAt };
}

/** The command: reads ADMIN_EMAIL, resets, says what happened. Returns the exit code. */
export async function run(
  env: NodeJS.ProcessEnv,
  out: { log: (...a: unknown[]) => void; error: (...a: unknown[]) => void } = console,
): Promise<number> {
  try {
    const { email } = await resetTwoFactor(env.ADMIN_EMAIL);
    out.log(`✔ Two-step verification reset for ${email}; every session signed out.`);
    out.log("  At the next sign-in they will be asked to set it up again.");
    return 0;
  } catch (err) {
    if (err instanceof CliError) out.error(`✖ ${err.message}`);
    else out.error("✖ Could not reset:", err instanceof Error ? err.message : err);
    return 1;
  }
}

/** The command's entry: its exit code, then the database let go. */
export async function main(env: NodeJS.ProcessEnv = process.env) {
  try {
    process.exitCode = await run(env);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when started as a command (node dist/cli/reset-2fa.js), never on import.
// Jest never runs a file as the main module, so this one line is checked by
// running the command itself (as src/server.ts is left to its own run).
/* istanbul ignore next */
if (require.main === module) void main();
