import bcrypt from "bcryptjs";
import fs from "node:fs";
import { prisma } from "../../core/prisma/client";
import { Prisma } from "../../generated/prisma";
import { config } from "../../core/config/app.config";
import { BadRequestException, HttpException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { newSessionId, revokeAllSessions } from "../../core/auth/sessions";
import {
  closeUserSessions,
  endOtherSessions,
  endUserSession,
  listUserSessions,
  openSession,
} from "../../core/auth/refresh-sessions";
import type { SessionDevice } from "../../core/auth/device";
import { disconnectSessions, liveSessionIds, moveSessionSockets } from "../../core/realtime/realtime";
import { verifyUploadedImage } from "../../core/middleware/upload.middleware";
import type { RoleType } from "../../core/enums/role.enum";
import { passwordIssue } from "../../core/auth/password-policy";
import { seal, unseal } from "../../core/auth/secret-box";
import { hashRecoveryCode, matchTotp, newRecoveryCodes, newTotpSecret, otpauthUrl } from "../../core/auth/totp";
import { recoveryHashes, verifySecondFactor } from "../../core/auth/two-factor";
import { audit } from "../../core/audit/audit";
import { emailProven, passwordChangedMail, requestEmailVerificationService, trustedAddressOf } from "../auth/email-links";
import { mailEnabled } from "../../core/mail/mailer";
import {
  adminProfileSchema,
  professorProfileSchema,
  studentProfileSchema,
  type ChangeEmailDTO,
  type ChangePasswordDTO,
  type TwoFactorDisableDTO,
  type TwoFactorEnableDTO,
  type PasswordOnlyDTO,
} from "./account.validation";
import { issuesMessage, tr } from "../../core/i18n";

/**
 * Anyone's own account — read, and changed by its owner within what their
 * role allows (see `account.validation`).
 *
 * Two changes carry more weight than the rest and ask for the current
 * password first: the email an administrator signs in with, and the password
 * itself. A new password also signs every other device out, and hands this one
 * a fresh pair of tokens so the person making the change stays where they are.
 *
 * A wrong current password answers 400, never 401: the client treats 401 as
 * an expired session and would sign the person out for a typo.
 */

const ACCOUNT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  email: true,
  verifiedEmail: true,
  username: true,
  phone: true,
  avatarUrl: true,
  gender: true,
  role: true,
  status: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  totpRecoveryCodes: true,
  student: {
    select: {
      id: true,
      registrationNumber: true,
      academicYear: { select: { title: true, isActive: true } },
      specialization: {
        select: {
          name: true,
          level: true,
          filiere: { select: { name: true, department: { select: { name: true, faculty: { select: { name: true } } } } } },
        },
      },
    },
  },
  professor: {
    select: {
      id: true,
      employeeNumber: true,
      universityEmail: true,
      grade: true,
      department: { select: { name: true, faculty: { select: { name: true } } } },
    },
  },
} as const;

/** What the page may offer each role — the same rules the routes enforce. */
const CAN: Record<RoleType, { edit: string[]; photo: boolean; email: boolean }> = {
  admin: { edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "username", "phone", "gender"], photo: true, email: true },
  // A professor signs in with the university address; this one, their own, is for links and alerts (2026-11-20).
  professor: { edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone"], photo: true, email: true },
  student: { edit: ["firstName", "lastName"], photo: false, email: true },
};

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);
const forbidden = (m: string) => new HttpException(m, HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED);

async function load(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...ACCOUNT_SELECT, password: true } });
  if (!user) throw new NotFoundException(tr("notFound.account"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return user;
}

type Loaded = Awaited<ReturnType<typeof load>>;

function present(u: Omit<Loaded, "password">) {
  const role = u.role as RoleType;
  const { totpRecoveryCodes, totpEnabledAt, verifiedEmail: _proven, ...rest } = u;
  return {
    ...rest,
    // Whether its own address (`email`) is proven (modules/auth/email-links),
    // where reset links and security alerts go — a professor's university
    // address while their own is not proven — and whether this server can
    // send mail at all. Never the proven value itself.
    emailVerified: emailProven(u),
    recoveryEmail: trustedAddressOf(u),
    mailEnabled: mailEnabled(),
    can: CAN[role], // CAN has every role
    // Whether it is on and since when, and how many recovery codes are left —
    // never the secret, never the codes.
    twoFactor: {
      available: role === "admin",
      required: role === "admin" && config.REQUIRE_ADMIN_2FA,
      enabled: !!totpEnabledAt,
      enabledAt: totpEnabledAt,
      recoveryCodesLeft: totpEnabledAt ? recoveryHashes(totpRecoveryCodes).length : 0,
    },
  };
}

async function assertPassword(plain: string, hashed: string) {
  if (!(await bcrypt.compare(plain, hashed))) throw bad(tr("account.wrongPassword"));
}

export const getAccountService = async (userId: string) => {
  const { password, ...account } = await load(userId);
  void password;
  return present(account);
};

export const updateAccountService = async (userId: string, body: unknown) => {
  const user = await load(userId);
  const role = user.role as RoleType;

  // Each role its own fields: a student, the Arabic name alone.
  const schema = role === "admin" ? adminProfileSchema : role === "professor" ? professorProfileSchema : studentProfileSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw bad(issuesMessage(parsed.error.issues));
  const data = parsed.data as Record<string, unknown>;

  if (typeof data.username === "string" && data.username) {
    const taken = await prisma.user.findFirst({ where: { username: data.username, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw bad(tr("account.usernameTaken", { username: String(data.username) }));
  }
  const updated = await prisma.user.update({ where: { id: userId }, data, select: ACCOUNT_SELECT });
  return present(updated);
};

/** Upload and set in one step — the only way a professor's photo changes. */
export const setAvatarService = async (userId: string, file: Express.Multer.File | undefined) => {
  const user = await load(userId);
  const role = user.role as RoleType;
  const drop = () => file && fs.promises.unlink(file.path).catch(() => undefined);
  if (!CAN[role]?.photo) {
    await drop();
    throw forbidden(tr("account.photoManaged"));
  }
  if (!file) throw bad(tr("upload.none"));
  if (!verifyUploadedImage(file.path)) throw bad(tr("upload.notImage"));
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: `/uploads/cards/${file.filename}` },
    select: ACCOUNT_SELECT,
  });
  return present(updated);
};

export const changeEmailService = async (userId: string, dto: ChangeEmailDTO) => {
  const user = await load(userId);
  if (!CAN[user.role as RoleType]?.email) throw forbidden(tr("account.emailManaged"));
  await assertPassword(dto.currentPassword, user.password);
  const email = dto.email.trim().toLowerCase();
  if (email === (user.email ?? "").toLowerCase()) throw bad(tr("account.sameEmail"));
  const taken = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
  if (taken) throw bad(tr("account.emailTaken"));
  // A university address names a professor's account on «نسيت كلمة المرور»: it cannot be another's own.
  const university = await prisma.professor.findUnique({ where: { universityEmail: email }, select: { userId: true } });
  if (university) throw bad(tr(university.userId === userId ? "account.emailIsUniversity" : "account.emailTaken"));
  const updated = await prisma.user.update({ where: { id: userId }, data: { email }, select: ACCOUNT_SELECT });
  return { account: present(updated), verification: await confirmNewAddress(userId, updated) };
};

/**
 * A new address is not proven: the link that proves it leaves at once, to it
 * (modules/auth/email-links) — the page says whether it did. `verified`: the
 * address was proven before (an old one given back); `off`: this server sends
 * no mail; `failed`: the mail server did not take it — sent again from
 * «الجلسات والأمان» later. The address is saved whatever happens to the link.
 */
async function confirmNewAddress(userId: string, u: Parameters<typeof emailProven>[0]): Promise<"sent" | "verified" | "off" | "failed"> {
  if (emailProven(u)) return "verified";
  if (!mailEnabled()) return "off";
  try {
    await requestEmailVerificationService(userId);
    return "sent";
  } catch {
    return "failed";
  }
}

export const changePasswordService = async (
  userId: string,
  dto: ChangePasswordDTO,
  ctx: { sid?: string; device?: SessionDevice },
) => {
  const user = await load(userId);
  await assertPassword(dto.currentPassword, user.password);
  if (await bcrypt.compare(dto.newPassword, user.password)) throw bad(tr("account.samePassword"));
  // The password an account is handed may be a birth date; the one its owner
  // chooses must pass the policy (core/auth/password-policy): not a date, not
  // a common password, not their own registration or employee number.
  const issue = passwordIssue(dto.newPassword, {
    registrationNumber: user.student?.registrationNumber,
    employeeNumber: user.professor?.employeeNumber,
  });
  if (issue) throw bad(tr(`password.${issue}`));

  const hashed = await bcrypt.hash(dto.newPassword, config.BCRYPT_ROUNDS);
  // Chosen by its owner now: the account is no longer held to change it.
  await prisma.user.update({ where: { id: userId }, data: { password: hashed, mustChangePassword: false } });
  audit({
    action: "password.changed",
    actor: { id: userId, role: user.role },
    details: { wasHandedOut: user.mustChangePassword },
    device: ctx.device,
  });
  void passwordChangedMail(userId);

  // Every other device signs out — sessions, refresh tokens, live sockets; this
  // one carries on with a fresh session, carrying the same role and profile id
  // a sign-in would give it. Its live connection stays up and is moved onto
  // the new session, so signing that session out later still reaches it.
  await revokeAllSessions(userId);
  await closeUserSessions(userId);
  const { tokenVersion } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
  const role = user.role as RoleType;
  const refId = user.student?.id ?? user.professor?.id ?? userId;
  const sid = newSessionId();
  await moveSessionSockets(userId, ctx.sid, sid);
  void disconnectSessions(userId, undefined, sid);
  const tokens = await openSession({ userId, role, refId, tokenVersion }, ctx.device, sid);
  return { message: "Password changed", ...tokens };
};


/**
 * The devices signed in to this account: which one is asking, and which have
 * a live connection right now.
 */
export const listSessionsService = async (userId: string, currentSid?: string) => {
  const [sessions, live] = await Promise.all([listUserSessions(userId), liveSessionIds(userId)]);
  return sessions
    .map((s) => ({ ...s, current: s.id === currentSid, online: live.has(s.id) }))
    // This device first, then the rest by last activity.
    .sort((a, b) => Number(b.current) - Number(a.current));
};

/** Signs one device out — at once: its requests are refused and its page told. */
export const endSessionService = async (userId: string, sid: string, device?: SessionDevice) => {
  if (!(await endUserSession(userId, sid))) {
    throw new NotFoundException(tr("notFound.session"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  }
  void disconnectSessions(userId, [sid]);
  audit({ action: "session.ended", actor: { id: userId }, targetType: "session", targetId: sid, device });
  return { message: "Session ended" };
};

//
// ─── TWO-STEP VERIFICATION ──────────────────────────────────
//
// For administrators: required (REQUIRE_ADMIN_2FA), set up from the account
// page. Three steps — a secret is drawn and shown as a QR code; the app's
// first code proves it was scanned and turns it on; ten recovery codes are
// shown once, for the day the phone is lost.
//

const adminOnly = (role: string) => {
  if (role !== "admin") throw forbidden(tr("twoFactor.adminOnly"));
};

/** A fresh secret, waiting for its first code. Replaces any unfinished one. */
export const startTwoFactorSetupService = async (userId: string) => {
  const user = await load(userId);
  adminOnly(user.role);
  if (user.totpEnabledAt) throw bad(tr("twoFactor.alreadyEnabled"));
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: seal(secret) } });
  const account = user.email ?? user.username ?? userId;
  return { secret, otpauthUrl: otpauthUrl({ secret, account, issuer: config.TOTP_ISSUER }), account };
};

/**
 * The app's code proves the secret is in it: two-step verification is on.
 * Every other session of the account was opened without it, so they end.
 */
export const enableTwoFactorService = async (
  userId: string,
  dto: TwoFactorEnableDTO,
  ctx: { sid?: string; device?: SessionDevice },
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, totpEnabledAt: true, totpPendingSecret: true },
  });
  if (!user) throw new NotFoundException(tr("notFound.account"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  adminOnly(user.role);
  if (user.totpEnabledAt) throw bad(tr("twoFactor.alreadyEnabled"));
  const secret = unseal(user.totpPendingSecret);
  if (!secret) throw bad(tr("twoFactor.noSetup"));
  const step = matchTotp(secret, dto.code);
  if (step === null) throw bad(tr("twoFactor.badCode"));

  const codes = newRecoveryCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: seal(secret),
      totpPendingSecret: null,
      totpEnabledAt: new Date(),
      totpLastStep: step,
      totpRecoveryCodes: codes.map(hashRecoveryCode),
    },
  });
  const ended = await endOtherSessions(userId, ctx.sid);
  if (ended.length) void disconnectSessions(userId, ended);
  audit({ action: "twoFactor.enabled", actor: { id: userId, role: user.role }, details: { otherSessionsEnded: ended.length }, device: ctx.device });
  return { recoveryCodes: codes };
};

/**
 * Off — with the password and a current code (or a recovery code). For an
 * administrator it is required, so the next request asks to set it up again:
 * this is also how a new phone replaces the old one.
 */
export const disableTwoFactorService = async (userId: string, dto: TwoFactorDisableDTO, device?: SessionDevice) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException(tr("notFound.account"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  if (!user.totpEnabledAt) throw bad(tr("twoFactor.notEnabled"));
  await assertPassword(dto.currentPassword, user.password);
  if (!(await verifySecondFactor(user, dto.code))) throw bad(tr("twoFactor.badCode"));
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: Prisma.DbNull },
  });
  audit({ action: "twoFactor.disabled", actor: { id: userId, role: user.role }, device });
  return { message: "Two-step verification turned off" };
};

/** Ten new recovery codes; the old ones stop working. */
export const regenerateRecoveryCodesService = async (userId: string, dto: PasswordOnlyDTO, device?: SessionDevice) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, password: true, totpEnabledAt: true } });
  if (!user) throw new NotFoundException(tr("notFound.account"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  if (!user.totpEnabledAt) throw bad(tr("twoFactor.notEnabled"));
  await assertPassword(dto.currentPassword, user.password);
  const codes = newRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { totpRecoveryCodes: codes.map(hashRecoveryCode) } });
  audit({ action: "twoFactor.recoveryCodesRenewed", actor: { id: userId, role: user.role }, device });
  return { recoveryCodes: codes };
};

//
// ─── SECURITY ALERTS ────────────────────────────────────────
//
// "A sign-in from a new device" (modules/auth/devices), until its owner says
// it was them. Not shown on the device it is about: that one knows.
//

export const listSecurityAlertsService = async (userId: string, currentSid?: string) => {
  const rows = await prisma.notification.findMany({
    where: { userId, type: "security_alert", isRead: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, message: true, i18n: true, link: true, createdAt: true },
  });
  return rows.filter((r) => !currentSid || !r.link?.endsWith(`session=${currentSid}`));
};

/** "All of these were me." */
export const ackAllSecurityAlertsService = async (userId: string) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, type: "security_alert", isRead: false },
    data: { isRead: true },
  });
  return { acknowledged: count };
};

export const ackSecurityAlertService = async (userId: string, id: string) => {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId, type: "security_alert" },
    data: { isRead: true },
  });
  if (!count) throw new NotFoundException(tr("notFound.notification"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return { message: "Acknowledged" };
};

/** A link to the account's own address, proving it theirs (modules/auth/email-links). */
export const requestEmailVerification = (userId: string) => requestEmailVerificationService(userId);
