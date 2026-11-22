import { prisma } from "../prisma/client";
import { config } from "../config/app.config";

/**
 * The bcrypt hash written in `dev-only/seed-accounts.sql`, whose password is
 * in the repository for anyone to read. An account carrying it on a real
 * server is an open door — said loudly at every start until it is gone.
 */
const DEMO_PASSWORD_HASH = "$2b$10$A3DLuk5aTyMamC7Y85sHfe/rFtoe6FC2IXKFP43hyWUD40iHvZcIq";

export async function warnAboutDemoAccounts() {
  if (!config.IS_PRODUCTION) return;
  try {
    const accounts = await prisma.user.findMany({
      where: { password: DEMO_PASSWORD_HASH },
      select: { email: true, username: true, role: true },
      take: 10,
    });
    if (accounts.length === 0) return;
    console.error(
      `\nSECURITY: ${accounts.length} account(s) still use the demo password from dev-only/seed-accounts.sql, ` +
        "which anyone with the source code knows. Delete them, or reset their passwords, now:",
    );
    for (const a of accounts) console.error(`  - ${a.role}: ${a.email ?? a.username ?? "(no email)"}`);
  } catch {
    // A check that cannot run must not keep the server from starting.
  }
}
