import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../core/prisma/client";
import { config } from "../../core/config/app.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { currentLang, tr } from "../../core/i18n";
import { audit } from "../../core/audit/audit";
import { mailEnabled, queueMail, sendMail } from "../../core/mail/mailer";
import { mailTime } from "../../core/mail/templates";
import { mailFor } from "../../core/mail/mail-templates";
import { passwordIssue } from "../../core/auth/password-policy";
import { revokeAllSessions } from "../../core/auth/sessions";
import { closeUserSessions } from "../../core/auth/refresh-sessions";
import { clearFailures, throttleKey } from "../../core/auth/login-throttle";
import type { SessionDevice } from "../../core/auth/device";
import { describeDevice } from "./devices";
import { disconnectSessions } from "../../core/realtime/realtime";

/**
 * Links sent by email: "forgot my password", and the proof that an address
 * belongs to its account — and the security alerts sent the same way.
 *
 * The rule everything here follows: **mail that can take over an account
 * goes only to an address proven to be its owner's.** An account's own
 * address (`email`) is typed by whoever enters it — a typo would send its
 * reset link to a stranger — so it counts once its owner opened a link sent
 * to it (`verifiedEmail`). A professor may add one too, as a student does
 * (the user's choice, 2026-11-20): proven, it is where their links go;
 * until then, their university address — the one they sign in with, entered
 * by the administration from the university's records.
 *
 * And what an attacker could learn from it, they do not: asking for a reset
 * answers the same sentence whether the account exists, has an address, or
 * neither. A token is 256 random bits, kept only as its SHA-256, good once,
 * for a short while, and only while the account still has that address.
 */

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);

/** Links one account may be sent per hour, of each kind — no mailbox flooded through us. */
const PER_HOUR = 3;

const USER_SELECT = {
  id: true,
  role: true,
  status: true,
  email: true,
  verifiedEmail: true,
  username: true,
  firstName: true,
  lastName: true,
  student: { select: { registrationNumber: true } },
  professor: { select: { universityEmail: true, employeeNumber: true } },
} as const;

type MailUser = {
  role: string;
  email: string | null;
  verifiedEmail: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  student?: { registrationNumber: string } | null;
  professor?: { universityEmail: string; employeeNumber?: string | null } | null;
};

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The account's own address (`email`), proven by a link its owner opened. */
export const emailProven = (u: Pick<MailUser, "email" | "verifiedEmail">) => !!u.email && same(u.email, u.verifiedEmail);

/** Where mail that matters may go for this account — or nowhere. */
export function trustedAddressOf(u: MailUser): string | null {
  // An address its owner proved — a professor's own address too, before their university one.
  if (emailProven(u)) return u.email;
  if (u.role === "professor" && u.professor?.universityEmail) return u.professor.universityEmail;
  return null;
}

/** "Amine Haddad · 202039012345" — how a message names the account it is about. */
const accountLabel = (u: MailUser) =>
  [
    [u.firstName, u.lastName].filter(Boolean).join(" "),
    u.student?.registrationNumber ?? u.professor?.universityEmail ?? u.email ?? u.username,
  ]
    .filter(Boolean)
    .join(" · ");

const newToken = () => {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashOf(raw) };
};
const hashOf = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/** A page of the site, in the reader's language, carrying the token. */
const linkTo = (page: string, raw: string) =>
  `${config.FRONTEND_ORIGIN.replace(/\/+$/, "")}/${currentLang()}/${page}?token=${encodeURIComponent(raw)}`;

async function recentLinks(userId: string, purpose: "reset" | "verify") {
  return prisma.emailToken.count({
    where: { userId, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
  });
}

/* ════════════════════════════════════════════════════════════
   FORGOT MY PASSWORD
   ════════════════════════════════════════════════════════════ */

/** The account a person names when they cannot sign in: a registration number, or an email. */
async function findByIdentifier(identifier: string) {
  const id = identifier.trim();
  if (!id) return null;
  const lower = id.toLowerCase();
  return (
    (await prisma.user.findFirst({ where: { student: { registrationNumber: id } }, select: USER_SELECT })) ??
    (id.includes("@")
      ? ((await prisma.user.findFirst({ where: { professor: { universityEmail: lower } }, select: USER_SELECT })) ??
        (await prisma.user.findFirst({ where: { email: lower }, select: USER_SELECT })))
      : await prisma.user.findFirst({ where: { username: id }, select: USER_SELECT }))
  );
}

/**
 * Sends a reset link if — and only if — the account exists, is active, has a
 * proven address, and has not asked too often. Says the same thing in every
 * case: who exists, and who has an address, is not for the asker to learn.
 */
export async function requestPasswordResetService(identifier: string, device?: SessionDevice) {
  const answer = { message: tr("auth.resetSent") };
  if (!mailEnabled()) throw bad(tr("auth.mailOff"));

  const user = await findByIdentifier(identifier);
  const to = user && user.status === "active" ? trustedAddressOf(user) : null;
  if (!user || !to) return answer;
  if ((await recentLinks(user.id, "reset")) >= PER_HOUR) return answer;

  const { raw, hash } = newToken();
  // A new link replaces the ones before it: only the latest works. They are
  // closed, not deleted — deleting them would also empty the hourly count
  // above, and let a mailbox be flooded one request at a time.
  await prisma.$transaction([
    prisma.emailToken.updateMany({ where: { userId: user.id, purpose: "reset", usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailToken.create({
      data: {
        userId: user.id,
        purpose: "reset",
        tokenHash: hash,
        email: to,
        expiresAt: new Date(Date.now() + config.RESET_LINK_MINUTES * 60_000),
      },
    }),
  ]);
  const mail = await mailFor("reset", {
    account: accountLabel(user),
    url: linkTo("reset-password", raw),
    minutes: config.RESET_LINK_MINUTES,
  });
  queueMail({ to, ...mail });
  audit({ action: "password.resetRequested", actor: { id: user.id, role: user.role }, device });
  return answer;
}

/** The reset link's token, if it can still set a password — the page asks before showing the form. */
async function usableReset(raw: string) {
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashOf(raw) },
    select: { id: true, purpose: true, email: true, usedAt: true, expiresAt: true, user: { select: USER_SELECT } },
  });
  if (!row || row.purpose !== "reset" || row.usedAt || row.expiresAt < new Date()) return null;
  // The account's proven address is still the one the link went to, and it may sign in.
  if (row.user.status !== "active" || !same(trustedAddressOf(row.user), row.email)) return null;
  return row;
}

export async function checkResetTokenService(raw: string) {
  return { valid: !!(await usableReset(raw)) };
}

/**
 * A new password from the link: the policy every chosen password passes,
 * every device signed out, the lock of too many wrong guesses lifted — and
 * the owner told by email that it happened.
 */
export async function resetPasswordService(raw: string, password: string, device?: SessionDevice) {
  const row = await usableReset(raw);
  if (!row) throw bad(tr("auth.resetInvalid"));
  const user = row.user;
  const issue = passwordIssue(password, {
    registrationNumber: user.student?.registrationNumber,
    employeeNumber: user.professor?.employeeNumber,
  });
  if (issue) throw bad(tr(`password.${issue}`));

  const hashed = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
  const ok = await prisma.$transaction(async (tx) => {
    // Good once: two tabs racing with the same link, one wins.
    const { count } = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (count !== 1) return false;
    await tx.user.update({
      where: { id: user.id },
      // Chosen by its owner, and the link proved the address theirs.
      data: { password: hashed, mustChangePassword: false, verifiedEmail: row.email },
    });
    await tx.emailToken.deleteMany({ where: { userId: user.id, purpose: "reset", usedAt: null } });
    return true;
  });
  if (!ok) throw bad(tr("auth.resetInvalid"));

  await revokeAllSessions(user.id);
  await closeUserSessions(user.id);
  void disconnectSessions(user.id);
  await clearFailures(
    ...[
      user.student && throttleKey("student", user.student.registrationNumber),
      user.professor && throttleKey("professor", user.professor.universityEmail),
      user.role === "admin" && user.email && throttleKey("admin", user.email),
    ].filter((k): k is string => !!k),
  );
  audit({ action: "password.reset", actor: { id: user.id, role: user.role }, device });
  void passwordChangedMail(user.id);
  return { message: tr("auth.resetDone") };
}

/* ════════════════════════════════════════════════════════════
   PROVING AN ADDRESS
   ════════════════════════════════════════════════════════════ */

/** Sends a link to the account's address; opening it proves the address theirs. */
export async function requestEmailVerificationService(userId: string) {
  if (!mailEnabled()) throw bad(tr("auth.mailOff"));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
  // The account's own address — a professor's university one needs no link.
  if (emailProven(user)) throw bad(tr("account.alreadyVerified"));
  if (!user.email) throw bad(tr("account.noEmail"));
  if ((await recentLinks(user.id, "verify")) >= PER_HOUR) throw bad(tr("account.tooManyLinks"));

  const { raw, hash } = newToken();
  const link = await prisma.emailToken.create({
    data: {
      userId: user.id,
      purpose: "verify",
      tokenHash: hash,
      email: user.email,
      expiresAt: new Date(Date.now() + config.VERIFY_LINK_HOURS * 60 * 60_000),
    },
  });
  const mail = await mailFor("verify", {
    account: accountLabel(user),
    url: linkTo("verify-email", raw),
    hours: config.VERIFY_LINK_HOURS,
  });
  // Waited for: the page says "sent" only if the server took it. A link that
  // never left is dropped — it must not count against the hourly cap — and
  // the reason is the mail server, not the settings: the log says which.
  if (!(await sendMail({ to: user.email, ...mail }))) {
    await prisma.emailToken.delete({ where: { id: link.id } });
    throw bad(tr("auth.mailFailed"));
  }
  return { message: tr("account.verifySent", { email: user.email, hours: config.VERIFY_LINK_HOURS }) };
}

/** The link opened — from any device, signed in or not. */
export async function verifyEmailService(raw: string, device?: SessionDevice) {
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashOf(raw) },
    select: { id: true, purpose: true, email: true, usedAt: true, expiresAt: true, user: { select: { id: true, role: true, email: true } } },
  });
  // Only while the account still has the address the link went to.
  if (!row || row.purpose !== "verify" || row.usedAt || row.expiresAt < new Date() || !same(row.user.email, row.email))
    throw bad(tr("auth.verifyInvalid"));
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.user.id }, data: { verifiedEmail: row.email } }),
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.emailToken.deleteMany({ where: { userId: row.user.id, purpose: "verify", usedAt: null } }),
  ]);
  audit({ action: "email.verified", actor: { id: row.user.id, role: row.user.role }, device });
  return { message: tr("auth.verifyDone", { email: row.email }) };
}

/* ════════════════════════════════════════════════════════════
   SECURITY ALERTS — to a proven address, never waited for
   ════════════════════════════════════════════════════════════ */

/** "Your password was changed" — by its owner, through a reset link, or by the administration. */
export async function passwordChangedMail(userId: string, opts: { byAdmin?: boolean } = {}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    const to = user && trustedAddressOf(user);
    if (!user || !to) return;
    const mail = await mailFor("passwordChanged", { account: accountLabel(user), when: mailTime(), byAdmin: !!opts.byAdmin });
    queueMail({ to, ...mail });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "passwordChangedMail", message: (error as Error)?.message }));
  }
}

/** "A new sign-in to your account" — the same alert the bell shows, for whoever is not looking at it. */
export async function newDeviceMail(userId: string, device: SessionDevice) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    const to = user && trustedAddressOf(user);
    if (!user || !to) return;
    const mail = await mailFor("newDevice", {
      account: accountLabel(user),
      device: describeDevice(device.userAgent),
      ip: device.ip ?? "?",
      when: mailTime(),
      url: `${config.FRONTEND_ORIGIN.replace(/\/+$/, "")}/${currentLang()}/account?tab=security`,
    });
    queueMail({ to, ...mail });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "newDeviceMail", message: (error as Error)?.message }));
  }
}
