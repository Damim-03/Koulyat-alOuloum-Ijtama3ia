import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";

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
  StudentLoginDTO,
  ProfessorLoginDTO,
  AdminLoginDTO,
} from "./auth.validation";

//
// ─── HELPERS ────────────────────────────────────────────────
//

const signTokens = (payload: JwtPayload) => {
  const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);

  return { accessToken, refreshToken };
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
    include: { user: true },
  });

  if (!student) {
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
    include: { user: true },
  });

  if (!professor) {
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

export const refreshTokenService = async (refreshToken: string) => {
  // 1. Verify refresh token
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedException(
      "Invalid or expired refresh token",
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  // 2. Check user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new UnauthorizedException(
      "User no longer exists",
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  checkSuspended(user.status);

  // 3. Sign new access token only
  const accessToken = jwt.sign(
    {
      userId: decoded.userId,
      role: decoded.role,
      refId: decoded.refId,
    } as JwtPayload,
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN } as SignOptions,
  );

  return { accessToken };
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
    },
  };
};
