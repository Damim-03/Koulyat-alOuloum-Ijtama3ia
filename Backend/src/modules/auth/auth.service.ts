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
} from "../../core/auth/login-throttle";
import { disconnectSessions } from "../../core/realtime/realtime";
import {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "./auth.validation";

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
      "Your account has been suspended",
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
const INVALID_CREDENTIALS = "Invalid credentials";

const invalidCredentials = () =>
  new UnauthorizedException(INVALID_CREDENTIALS, ErrorCodeEnum.AUTH_INVALID_CREDENTIALS);

/**
 * A wrong password counts against the identifier typed (see
 * core/auth/login-throttle) — the fifth in a row locks it.
 */
const checkPassword = async (key: string, plain: string, hashed: string) => {
  if (!(await bcrypt.compare(plain, hashed))) await failSignIn(key, invalidCredentials());
};

/** No such account: the same time, the same count and the same answer as a wrong password. */
const unknownAccount = async (key: string, plain: string): Promise<never> => {
  await burnPasswordTime(plain);
  return failSignIn(key, invalidCredentials());
};

const updateLastLogin = (userId: string) =>
  prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

/**
 * The password was right. Only now is a suspension mentioned — saying it
 * before the password was checked told anyone typing a registration number
 * that the account existed and was suspended. Then the lock is forgotten and
 * a session opened.
 */
const completeSignIn = async (
  key: string,
  user: { id: string; status: string; tokenVersion: number },
  role: JwtPayload["role"],
  refId: string,
) => {
  checkSuspended(user.status);
  await clearFailures(key);
  await updateLastLogin(user.id);
  return openSession({ userId: user.id, role, refId, tokenVersion: user.tokenVersion });
};

//
// ─── STUDENT LOGIN ───────────────────────────────────────────
//

export const studentLoginService = async (data: StudentLoginDTO) => {
  const key = throttleKey("student", data.registrationNumber);
  // While locked, the password is not even looked at.
  await assertNotLocked(key);

  const student = await prisma.student.findUnique({
    where: { registrationNumber: data.registrationNumber },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });
  if (!student) return unknownAccount(key, data.password);

  await checkPassword(key, data.password, student.user.password);
  const tokens = await completeSignIn(key, student.user, Roles.STUDENT, student.id);

  return {
    ...tokens,
    user: {
      id: student.id,
      registrationNumber: student.registrationNumber,
      role: Roles.STUDENT,
    },
  };
};

//
// ─── PROFESSOR LOGIN ─────────────────────────────────────────
//

export const professorLoginService = async (data: ProfessorLoginDTO) => {
  const key = throttleKey("professor", data.universityEmail);
  await assertNotLocked(key);

  const professor = await prisma.professor.findUnique({
    where: { universityEmail: data.universityEmail },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });
  if (!professor) return unknownAccount(key, data.password);

  await checkPassword(key, data.password, professor.user.password);
  const tokens = await completeSignIn(key, professor.user, Roles.PROFESSOR, professor.id);

  return {
    ...tokens,
    user: {
      id: professor.id,
      universityEmail: professor.universityEmail,
      role: Roles.PROFESSOR,
    },
  };
};

// ─── ADMIN LOGIN ─────────────────────────────────────────────

export const adminLoginService = async (data: AdminLoginDTO) => {
  const key = throttleKey("admin", data.email);
  await assertNotLocked(key);

  const user = await prisma.user.findFirst({
    where: {
      email: data.email,
      role: "admin",
    },
  });
  if (!user) return unknownAccount(key, data.password);

  await checkPassword(key, data.password, user.password);
  const tokens = await completeSignIn(key, user, Roles.ADMIN, user.id);

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
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
export const refreshTokenService = async (refreshToken: string) => {
  let decoded;
  try {
    decoded = verifyToken(refreshToken, "refresh");
  } catch {
    throw new UnauthorizedException(
      "Invalid or expired refresh token",
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
      "User no longer exists",
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  checkSuspended(user.status);

  if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
    throw new UnauthorizedException(
      "Session has been revoked",
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  if (await isSessionRevoked(decoded.sid)) {
    throw new UnauthorizedException(
      "Session has been revoked",
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
  });
  if (rotation.kind === "refused") {
    await revokeSession(decoded);
    if (decoded.sid) await closeSessions([decoded.sid]);
    void disconnectSessions(user.id, [decoded.sid]);
    throw new UnauthorizedException(
      "Session has been revoked",
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
  await closeSessions(sids);
  if (sessions[0]) void disconnectSessions(sessions[0].userId, sids);
  void pruneExpiredSessions();
  void pruneAuthSessions();

  return { message: "Logged out" };
};

/**
 * Signs out every session on the account, including this one. The lever to
 * pull when a device is lost or a token is believed stolen.
 */
export const logoutAllService = async (userId: string) => {
  await revokeAllSessions(userId);
  await closeUserSessions(userId);
  void disconnectSessions(userId);
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
    throw new NotFoundException("User not found");
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
    },
  };
};
