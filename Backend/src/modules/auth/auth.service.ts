import bcrypt from "bcryptjs";

import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  UnauthorizedException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { Roles } from "../../core/enums/role.enum";
import { JwtPayload } from "./auth.types";
import { verifyToken, type AppTokenPayload } from "../../core/auth/tokens";
import {
  isSessionRevoked,
  revokeSession,
  revokeAllSessions,
  pruneExpiredSessions,
} from "../../core/auth/sessions";
import {
  openSession,
  rotateSession,
  closeSessions,
  closeUserSessions,
  pruneAuthSessions,
} from "../../core/auth/refresh-sessions";
import {
  assertNotLocked,
  clearFailures,
  failSignIn,
  throttleKey,
  type ThrottleKind,
} from "../../core/auth/login-throttle";
import { disconnectSessions } from "../../core/realtime/realtime";
import type { SessionDevice } from "../../core/auth/device";
import { newSessionId } from "../../core/auth/sessions";
import { issueChallenge, readChallenge } from "../../core/auth/challenge";
import { verifySecondFactor } from "../../core/auth/two-factor";
import { audit, pruneFailedSignIns, pruneSignIns, type FAILED_SIGN_IN_ACTIONS } from "../../core/audit/audit";
import { config } from "../../core/config/app.config";
import { recordSignInDevice } from "./devices";
import { watchFailureSpike } from "./failure-spike";
import { assertCaptcha } from "./captcha";
import {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
  AdminTwoFactorDTO,
} from "./auth.validation";
import { tr } from "../../core/i18n";

//
// ─── HELPERS ────────────────────────────────────────────────
//

/**
 * A wrong password and an unknown account must cost the same wall-clock time,
 * otherwise response timing reveals which accounts exist.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1Vf3vJ0yXk6z0uS1bJ0aVQqXQe6bJZq";

const burnPasswordTime = async (plain: string) => {
  await bcrypt.compare(plain, DUMMY_HASH);
};

const checkSuspended = (status: string) => {
  if (status === "suspended") {
    throw new UnauthorizedException(
      tr("auth.suspended"),
      ErrorCodeEnum.AUTH_ACCOUNT_SUSPENDED,
    );
  }
};

/**
 * الرسالة الوحيدة لكل صور فشل الدخول.
 *
 * كانت الرسائل مختلفة: «Invalid email or password» حين لا وجود للحساب،
 * و«Invalid credentials» حين تخطئ كلمة السرّ. كلاهما 401، لكن الفرق بينهما
 * يكفي لعدّ الحسابات: يُجرَّب بريد فتُقرأ الرسالة، فيُعرف أمسجَّل هو أم لا.
 *
 * والشيفرة تحرس من هذا في الزمن أصلاً (`burnPasswordTime` تُنفق نفس الوقت على
 * حساب غير موجود) — فكان النصّ يُفشي ما أخفاه الزمن. رسالة واحدة تُغلق البابين.
 */
const invalidCredentials = () =>
  new UnauthorizedException(tr("auth.badCredentials"), ErrorCodeEnum.AUTH_INVALID_CREDENTIALS);

/** A sign-in: the form it came from, what was typed as the account, and from where. */
export interface Attempt {
  kind: ThrottleKind;
  identifier: string;
  device?: SessionDevice;
}

/**
 * Every refused sign-in, on every form:
 *
 * - written in the audit log with what was typed and from where (core/audit —
 *   kept for a while, then deleted);
 * - counted against the identifier typed (core/auth/login-throttle — the
 *   fifth in a row locks it);
 * - and watched across all identifiers (./failure-spike).
 *
 * Only administrators' refusals used to be written down. But a guessing run
 * against students shows itself only in the log — and when the alarm rang,
 * the log had nothing to say about where it came from.
 */
const refuse = async (
  attempt: Attempt,
  error: Error,
  opts: { userId?: string; action?: (typeof FAILED_SIGN_IN_ACTIONS)[number]; reason?: SignInRefusal } = {},
): Promise<never> => {
  audit({
    action: opts.action ?? "auth.loginFailed",
    // The role only when the account exists: a role beside a number nobody
    // holds would read as if it did.
    actor: { id: opts.userId ?? null, role: opts.userId ? attempt.kind : null, label: attempt.identifier.slice(0, 191) },
    // Why, for the log only: the person refused is told the same thing either
    // way, so a guesser learns nothing of which accounts exist.
    details: { as: attempt.kind, ...(opts.reason ? { reason: opts.reason } : {}) },
    success: false,
    device: attempt.device,
  });
  // Old refusals are deleted now and then instead of on a schedule.
  if (Math.random() < 0.02) void pruneFailedSignIns();
  try {
    return await failSignIn(throttleKey(attempt.kind, attempt.identifier), error);
  } finally {
    await watchFailureSpike();
  }
};

/** Why a sign-in was refused, as the audit log says it. */
type SignInRefusal = "badPassword" | "unknownAccount" | "suspended";

/** A wrong password is refused like any other refusal (see `refuse`). */
const checkPassword = async (attempt: Attempt, plain: string, hashed: string, userId: string) => {
  if (!(await bcrypt.compare(plain, hashed))) await refuse(attempt, invalidCredentials(), { userId, reason: "badPassword" });
};

/** No such account: the same time, the same count and the same answer as a wrong password. */
const unknownAccount = async (attempt: Attempt, plain: string): Promise<never> => {
  await burnPasswordTime(plain);
  return refuse(attempt, invalidCredentials(), { reason: "unknownAccount" });
};

const updateLastLogin = (userId: string) =>
  prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

/**
 * What the account must do before anything else (see auth.middleware): the
 * client reads these to show that screen first.
 */
export const accountFlags = (
  role: string,
  user: { mustChangePassword: boolean; totpEnabledAt: Date | null },
) => ({
  mustChangePassword: user.mustChangePassword,
  twoFactorEnabled: !!user.totpEnabledAt,
  twoFactorSetupRequired: role === Roles.ADMIN && config.REQUIRE_ADMIN_2FA && !user.totpEnabledAt,
  // A student with the handed-out password, while activation is on: the
  // client shows the two stages — a password of their own, then the photos
  // that verify the account (modules/activation/activation-request), which
  // they may skip. The server asks no more of them than of any account with
  // a handed-out password (core/middleware/auth.middleware).
  activationRequired: isActivationPending(role, user),
});

/** A student who has not chosen a password yet, while activation is on. */
export const isActivationPending = (role: string, user: { mustChangePassword: boolean }) =>
  role === Roles.STUDENT && config.REQUIRE_STUDENT_ACTIVATION && user.mustChangePassword;

/**
 * The password (and, for an administrator who has it, the second step) was
 * right. Only now is a suspension mentioned — saying it before the password
 * was checked told anyone typing a registration number that the account
 * existed and was suspended. Then the lock is forgotten, a session opened,
 * and the browser it was opened from noted (a new one is announced to the
 * account's owner — see ./devices).
 */
const completeSignIn = async (
  key: string,
  user: { id: string; status: string; tokenVersion: number },
  role: JwtPayload["role"],
  refId: string,
  device?: SessionDevice,
  how?: { secondFactor?: "totp" | "recovery" },
) => {
  // The right password, on a suspended account: worth knowing who keeps trying.
  if (user.status === "suspended") {
    audit({
      action: "auth.loginFailed",
      actor: { id: user.id, role },
      details: { as: role, reason: "suspended" satisfies SignInRefusal },
      success: false,
      device,
    });
  }
  checkSuspended(user.status);
  await clearFailures(key);
  await updateLastLogin(user.id);
  const sid = newSessionId();
  const tokens = await openSession({ userId: user.id, role, refId, tokenVersion: user.tokenVersion }, device, sid);
  await recordSignInDevice(user.id, device, sid);
  // Every role's: an administrator's kept for good, a student's or a
  // professor's for SIGNIN_RETENTION_DAYS (core/audit).
  audit({
    action: "auth.login",
    actor: { id: user.id, role },
    details: { ...(how?.secondFactor ? { secondFactor: how.secondFactor } : {}), session: sid },
    device,
  });
  if (Math.random() < 0.01) void pruneSignIns();
  return tokens;
};

//
// ─── STUDENT LOGIN ───────────────────────────────────────────
//

export const studentLoginService = async (data: StudentLoginDTO, device?: SessionDevice) => {
  const attempt: Attempt = { kind: "student", identifier: data.registrationNumber, device };
  const key = throttleKey(attempt.kind, attempt.identifier);
  // While locked, the password is not even looked at — nor without the
  // short check, when this identifier has to pass it (./captcha).
  await assertNotLocked(key);
  await assertCaptcha(key, data.altcha);

  const student = await prisma.student.findUnique({
    where: { registrationNumber: data.registrationNumber },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });
  if (!student) return unknownAccount(attempt, data.password);

  await checkPassword(attempt, data.password, student.user.password, student.user.id);
  // A handed-out password (a birth date, printed on the card) signs in, and
  // the session reaches only the screen that replaces it — with activation
  // on, followed by the photos that verify the account (`activationRequired`
  // in accountFlags; core/middleware/auth.middleware).
  const tokens = await completeSignIn(key, student.user, Roles.STUDENT, student.id, device);

  return {
    ...tokens,
    user: {
      id: student.id,
      registrationNumber: student.registrationNumber,
      role: Roles.STUDENT,
      ...accountFlags(Roles.STUDENT, student.user),
    },
  };
};

//
// ─── PROFESSOR LOGIN ─────────────────────────────────────────
//

export const professorLoginService = async (data: ProfessorLoginDTO, device?: SessionDevice) => {
  const attempt: Attempt = { kind: "professor", identifier: data.universityEmail, device };
  const key = throttleKey(attempt.kind, attempt.identifier);
  await assertNotLocked(key);
  await assertCaptcha(key, data.altcha);

  const professor = await prisma.professor.findUnique({
    where: { universityEmail: data.universityEmail },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });
  if (!professor) return unknownAccount(attempt, data.password);

  await checkPassword(attempt, data.password, professor.user.password, professor.user.id);
  const tokens = await completeSignIn(key, professor.user, Roles.PROFESSOR, professor.id, device);

  return {
    ...tokens,
    user: {
      id: professor.id,
      universityEmail: professor.universityEmail,
      role: Roles.PROFESSOR,
      ...accountFlags(Roles.PROFESSOR, professor.user),
    },
  };
};

// ─── ADMIN LOGIN ─────────────────────────────────────────────

const adminUser = (user: {
  id: string;
  email: string | null;
  role: string;
  mustChangePassword: boolean;
  totpEnabledAt: Date | null;
}) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  ...accountFlags(Roles.ADMIN, user),
});

export const adminLoginService = async (data: AdminLoginDTO, device?: SessionDevice) => {
  const attempt: Attempt = { kind: "admin", identifier: data.email, device };
  const key = throttleKey(attempt.kind, attempt.identifier);
  await assertNotLocked(key);
  await assertCaptcha(key, data.altcha);

  const user = await prisma.user.findFirst({
    where: {
      email: data.email,
      role: "admin",
    },
  });
  if (!user) return unknownAccount(attempt, data.password);

  await checkPassword(attempt, data.password, user.password, user.id);

  // With two-step verification the password alone opens nothing: it earns a
  // five-minute ticket for the code. The failure count is NOT cleared here —
  // the code is guessed under the same count as the password, or a known
  // password would reset the count before every five guesses of the code.
  if (user.totpEnabledAt && user.totpSecret) {
    checkSuspended(user.status);
    return { twoFactorRequired: true as const, challenge: issueChallenge(user) };
  }

  const tokens = await completeSignIn(key, user, Roles.ADMIN, user.id, device);
  return { ...tokens, user: adminUser(user) };
};

/** The second step: the ticket from the password, and the code from the app. */
export const adminTwoFactorLoginService = async (data: AdminTwoFactorDTO, device?: SessionDevice) => {
  const claims = readChallenge(data.challenge);
  if (!claims) {
    throw new UnauthorizedException(tr("auth.challengeExpired"), ErrorCodeEnum.AUTH_INVALID_TOKEN);
  }
  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  // A password changed since (or the account gone, or no longer an
  // administrator with two-step verification): the ticket is void.
  if (
    !user ||
    user.role !== "admin" ||
    !user.email ||
    !user.totpEnabledAt ||
    user.tokenVersion !== claims.tokenVersion
  ) {
    throw new UnauthorizedException(tr("auth.challengeExpired"), ErrorCodeEnum.AUTH_INVALID_TOKEN);
  }

  const key = throttleKey("admin", user.email);
  await assertNotLocked(key);

  const factor = await verifySecondFactor(user, data.code);
  if (!factor) {
    return refuse(
      { kind: "admin", identifier: user.email, device },
      new UnauthorizedException(tr("auth.badCode"), ErrorCodeEnum.AUTH_INVALID_CODE),
      { userId: user.id, action: "auth.twoFactorFailed" },
    );
  }

  const tokens = await completeSignIn(key, user, Roles.ADMIN, user.id, device, { secondFactor: factor });
  return { ...tokens, user: adminUser(user) };
};

/**
 * Exchanges a refresh token for a new pair.
 *
 * Three hardenings over the previous version:
 *  - the token must verify as type "refresh" with the pinned algorithm,
 *    issuer and audience (see core/auth/tokens.ts);
 *  - the token's generation must still match the user's, so logout and
 *    forced sign-out actually invalidate outstanding refresh tokens;
 *  - the role is re-read from the database rather than trusted from the
 *    token, so a demotion takes effect on the next refresh instead of
 *    lingering for the whole refresh lifetime.
 */
export const refreshTokenService = async (refreshToken: string, device?: SessionDevice) => {
  let decoded;
  try {
    decoded = verifyToken(refreshToken, "refresh");
  } catch {
    throw new UnauthorizedException(
      tr("auth.invalidRefresh"),
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      role: true,
      status: true,
      tokenVersion: true,
      student: { select: { id: true } },
      professor: { select: { id: true } },
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      tr("auth.userNotFound"),
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  checkSuspended(user.status);

  if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
    throw new UnauthorizedException(
      tr("auth.sessionRevoked"),
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  if (await isSessionRevoked(decoded.sid)) {
    throw new UnauthorizedException(
      tr("auth.sessionRevoked"),
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  const refId = user.student?.id ?? user.professor?.id ?? user.id;

  // Same session continues, with a new refresh token (see
  // core/auth/refresh-sessions). A replaced token coming back means a copy is
  // loose: the session ends for both holders.
  const rotation = await rotateSession(decoded, {
    userId: user.id,
    role: user.role as JwtPayload["role"],
    refId,
    tokenVersion: user.tokenVersion,
  }, device);
  if (rotation.kind === "refused") {
    // A refusal always names a session: a token without `sid` is never
    // refused — rotateSession opens a session for it instead.
    await revokeSession(decoded);
    await closeSessions([decoded.sid!]);
    void disconnectSessions(user.id, [decoded.sid]);
    throw new UnauthorizedException(
      tr(rotation.reason === "idle" ? "auth.idleTimeout" : "auth.sessionRevoked"),
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  return rotation.tokens as { accessToken: string; refreshToken?: string };
};

/**
 * Signs out the session that made the request, and nothing else.
 *
 * The first version of this bumped the account-wide counter, which meant
 * signing out of one browser silently killed every other device on the
 * account. Correct as a panic button, wrong as the everyday behaviour.
 */
export const logoutService = async (
  accessToken: string | undefined,
  refreshToken?: string,
  device?: SessionDevice,
) => {
  // Either token names the session: the access token from the header, the
  // refresh token from the cookie — which still works after the access token
  // has expired.
  const sessions: AppTokenPayload[] = [];
  for (const [token, kind] of [
    [accessToken, "access"],
    [refreshToken, "refresh"],
  ] as const) {
    if (!token) continue;
    try {
      sessions.push(verifyToken(token, kind));
    } catch {
      // An expired or malformed token has nothing left to revoke; signing out
      // is still a success from the caller's point of view.
    }
  }

  for (const payload of sessions) await revokeSession(payload);
  const sids = sessions.map((p) => p.sid).filter((x): x is string => !!x);
  // When the session began, read before it is closed: the log says how long it lasted.
  const opened = sids[0]
    ? await prisma.authSession.findUnique({ where: { id: sids[0] }, select: { createdAt: true } }).catch(() => null)
    : null;
  await closeSessions(sids);
  if (sessions[0]) {
    void disconnectSessions(sessions[0].userId, sids);
    audit({
      action: "auth.logout",
      actor: { id: sessions[0].userId, role: sessions[0].role },
      details: sids[0] ? { session: sids[0], ...(opened ? { startedAt: opened.createdAt } : {}) } : undefined,
      device,
    });
  }
  void pruneExpiredSessions();
  void pruneAuthSessions();

  return { message: "Logged out" };
};

/**
 * Signs out every session on the account, including this one. The lever to
 * pull when a device is lost or a token is believed stolen.
 */
export const logoutAllService = async (userId: string, device?: SessionDevice) => {
  await revokeAllSessions(userId);
  await closeUserSessions(userId);
  void disconnectSessions(userId);
  audit({ action: "auth.logoutAll", actor: { id: userId }, device });
  return { message: "Signed out of all devices" };
};

// داخل auth.service (نفس النمط الموجود)
//
// ─── GET ME ──────────────────────────────────────────────────
//

export const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      firstNameLatin: true,
      lastNameLatin: true,
      avatarUrl: true,
      gender: true,
      mustChangePassword: true,
      totpEnabledAt: true,
      student: {
        select: {
          id: true,
          registrationNumber: true,
        },
      },
      professor: {
        select: {
          id: true,
          universityEmail: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundException(tr("notFound.user"));
  }

  const profile = user.student ?? user.professor ?? null;

  return {
    user: {
      id: profile?.id ?? user.id,
      role: user.role,
      email: user.email,
      registrationNumber: user.student?.registrationNumber,
      universityEmail: user.professor?.universityEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      firstNameLatin: user.firstNameLatin,
      lastNameLatin: user.lastNameLatin,
      // Both drive the account avatar: the photo when there is one, the
      // gender-specific default when there is not.
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      ...accountFlags(user.role, user),
    },
  };
};
