import bcrypt from "bcryptjs";

import { prisma } from "../../core/prisma/client";
import { config } from "../../core/config/app.config";
import {
  NotFoundException,
  UnauthorizedException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { Roles } from "../../core/enums/role.enum";
import { JwtPayload } from "./auth.types";
import {
  signTokenPair,
  signAccessToken,
  verifyToken,
} from "../../core/auth/tokens";
import {
  newSessionId,
  isSessionRevoked,
  revokeSession,
  revokeAllSessions,
  pruneExpiredSessions,
} from "../../core/auth/sessions";
import {
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "./auth.validation";

//
// ─── HELPERS ────────────────────────────────────────────────
//

const signTokens = (payload: JwtPayload) => signTokenPair(payload);

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

const checkPassword = async (plain: string, hashed: string) => {
  const isMatch = await bcrypt.compare(plain, hashed);
  if (!isMatch) {
    throw new UnauthorizedException(
      "Invalid credentials",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }
};

const updateLastLogin = (userId: string) =>
  prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

//
// ─── STUDENT LOGIN ───────────────────────────────────────────
//

export const studentLoginService = async (data: StudentLoginDTO) => {
  const student = await prisma.student.findUnique({
    where: { registrationNumber: data.registrationNumber },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });

  if (!student) {
    await burnPasswordTime(data.password);
    throw new UnauthorizedException(
      "Invalid registration number or password",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }

  checkSuspended(student.user.status);
  await checkPassword(data.password, student.user.password);
  await updateLastLogin(student.userId);

  const tokens = signTokens({
    userId: student.userId,
    role: Roles.STUDENT,
    refId: student.id,
    tokenVersion: student.user.tokenVersion,
    sid: newSessionId(),
  });

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
  const professor = await prisma.professor.findUnique({
    where: { universityEmail: data.universityEmail },
    // Internal only: the hash is needed for bcrypt.compare and is never
    // part of the returned object below.
    include: { user: true },
  });

  if (!professor) {
    await burnPasswordTime(data.password);
    throw new UnauthorizedException(
      "Invalid university email or password",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }

  checkSuspended(professor.user.status);
  await checkPassword(data.password, professor.user.password);
  await updateLastLogin(professor.userId);

  const tokens = signTokens({
    userId: professor.userId,
    role: Roles.PROFESSOR,
    refId: professor.id,
    tokenVersion: professor.user.tokenVersion,
    sid: newSessionId(),
  });

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
  const user = await prisma.user.findFirst({
    where: {
      email: data.email,
      role: { in: ["admin", "owner"] },
    },
  });

  if (!user) {
    await burnPasswordTime(data.password);
    throw new UnauthorizedException(
      "Invalid email or password",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }

  checkSuspended(user.status);
  await checkPassword(data.password, user.password);
  await updateLastLogin(user.id);

  const tokens = signTokens({
    userId: user.id,
    role: user.role === "admin" ? Roles.ADMIN : Roles.OWNER,
    refId: user.id,
    tokenVersion: user.tokenVersion,
    sid: newSessionId(),
  });

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

  return {
    accessToken: signAccessToken({
      userId: user.id,
      role: user.role as JwtPayload["role"],
      refId,
      tokenVersion: user.tokenVersion,
      // Same session continues; refreshing does not start a new one.
      sid: decoded.sid,
    }),
  };
};

/**
 * Signs out the session that made the request, and nothing else.
 *
 * The first version of this bumped the account-wide counter, which meant
 * signing out of one browser silently killed every other device on the
 * account. Correct as a panic button, wrong as the everyday behaviour.
 */
export const logoutService = async (accessToken: string | undefined) => {
  if (accessToken) {
    try {
      const payload = verifyToken(accessToken, "access");
      await revokeSession(payload);
      void pruneExpiredSessions();
    } catch {
      // An expired or malformed token has nothing left to revoke; signing out
      // is still a success from the caller's point of view.
    }
  }
  return { message: "Logged out" };
};

/**
 * Signs out every session on the account, including this one. The lever to
 * pull when a device is lost or a token is believed stolen.
 */
export const logoutAllService = async (userId: string) => {
  await revokeAllSessions(userId);
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
      // Both drive the account avatar: the photo when there is one, the
      // gender-specific default when there is not.
      avatarUrl: user.avatarUrl,
      gender: user.gender,
    },
  };
};
