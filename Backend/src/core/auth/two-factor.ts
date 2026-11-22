import { prisma } from "../prisma/client";
import { unseal } from "./secret-box";
import { hashRecoveryCode, isRecoveryCodeShape, matchTotp } from "./totp";

/**
 * Checks the second factor an administrator typed: the six digits from the
 * authenticator app, or — the phone lost — one of the recovery codes.
 *
 * Each is good once. The app's code: its time step is remembered, so the same
 * code cannot sign in twice. A recovery code: struck off the list.
 */

export interface SecondFactorHolder {
  id: string;
  totpSecret: string | null;
  totpLastStep: number | null;
  totpRecoveryCodes: unknown;
}

export const recoveryHashes = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];

export async function verifySecondFactor(
  user: SecondFactorHolder,
  code: string,
): Promise<"totp" | "recovery" | null> {
  const typed = code.trim();
  if (!typed) return null;

  if (isRecoveryCodeShape(typed)) return spendRecoveryCode(user.id, hashRecoveryCode(typed));

  const secret = unseal(user.totpSecret);
  if (!secret) return null;
  const step = matchTotp(secret, typed, { lastStep: user.totpLastStep });
  if (step === null) return null;
  // Conditional on the step still being new: of two requests racing with the
  // same code, exactly one gets through.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1 ? "totp" : null;
}

/**
 * Strikes a recovery code off the list — once.
 *
 * Read, then written: two requests with the same code, a moment apart, both
 * found it on the list they had read, and both signed in. Now the write is
 * conditional on the row being as it was read (`updatedAt`): of two racing
 * requests exactly one writes, and the other reads again — and no longer finds
 * the code. Two *different* codes racing both succeed, each removing its own
 * from the list as the other left it.
 */
async function spendRecoveryCode(userId: string, hash: string): Promise<"recovery" | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpRecoveryCodes: true, updatedAt: true },
    });
    const hashes = recoveryHashes(row?.totpRecoveryCodes);
    if (!row || !hashes.includes(hash)) return null;
    const { count } = await prisma.user.updateMany({
      where: { id: userId, updatedAt: row.updatedAt },
      data: { totpRecoveryCodes: hashes.filter((h) => h !== hash) },
    });
    if (count === 1) return "recovery";
  }
  return null;
}
