import bcrypt from "bcryptjs";
import fs from "node:fs";
import { prisma } from "../../core/prisma/client";
import { config } from "../../core/config/app.config";
import { BadRequestException, HttpException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { newSessionId, revokeAllSessions } from "../../core/auth/sessions";
import { signTokenPair } from "../../core/auth/tokens";
import { verifyUploadedImage } from "../../core/middleware/upload.middleware";
import type { RoleType } from "../../core/enums/role.enum";
import {
  adminProfileSchema,
  professorProfileSchema,
  type ChangeEmailDTO,
  type ChangePasswordDTO,
} from "./account.validation";

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
  professor: { edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone"], photo: true, email: false },
  student: { edit: [], photo: false, email: false },
};

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);
const forbidden = (m: string) => new HttpException(m, HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED);

async function load(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...ACCOUNT_SELECT, password: true } });
  if (!user) throw new NotFoundException("Account not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return user;
}

type Loaded = Awaited<ReturnType<typeof load>>;

function present(u: Omit<Loaded, "password">) {
  const role = u.role as RoleType;
  return { ...u, can: CAN[role] ?? CAN.student };
}

async function assertPassword(plain: string, hashed: string) {
  if (!(await bcrypt.compare(plain, hashed))) throw bad("كلمة المرور الحالية غير صحيحة");
}

export const getAccountService = async (userId: string) => {
  const { password, ...account } = await load(userId);
  void password;
  return present(account);
};

export const updateAccountService = async (userId: string, body: unknown) => {
  const user = await load(userId);
  const role = user.role as RoleType;
  if (role === "student") throw forbidden("الطالب لا يعدّل من حسابه إلا كلمة المرور — المعلومات الأخرى تديرها الإدارة.");

  const schema = role === "admin" ? adminProfileSchema : professorProfileSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw bad(`Validation error → ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join(" | ")}`);
  const data = parsed.data as Record<string, unknown>;

  if (typeof data.username === "string" && data.username) {
    const taken = await prisma.user.findFirst({ where: { username: data.username, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw bad(`اسم المستخدم «${data.username}» مستعمل في حساب آخر`);
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
    throw forbidden("لا يمكنك تغيير الصورة من حسابك — تديرها الإدارة.");
  }
  if (!file) throw bad("لم يُرفَع أي ملفّ");
  if (!verifyUploadedImage(file.path)) throw bad("الملفّ ليس صورة صالحة");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: `/uploads/cards/${file.filename}` },
    select: ACCOUNT_SELECT,
  });
  return present(updated);
};

export const changeEmailService = async (userId: string, dto: ChangeEmailDTO) => {
  const user = await load(userId);
  if (!CAN[user.role as RoleType]?.email) throw forbidden("بريدك تديره الإدارة — لا يتغيّر من هنا.");
  await assertPassword(dto.currentPassword, user.password);
  const email = dto.email.trim().toLowerCase();
  if (email === (user.email ?? "").toLowerCase()) throw bad("هذا هو بريدك الحالي");
  const taken = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
  if (taken) throw bad("هذا البريد مستعمل في حساب آخر");
  const updated = await prisma.user.update({ where: { id: userId }, data: { email }, select: ACCOUNT_SELECT });
  return present(updated);
};

export const changePasswordService = async (userId: string, dto: ChangePasswordDTO) => {
  const user = await load(userId);
  await assertPassword(dto.currentPassword, user.password);
  if (await bcrypt.compare(dto.newPassword, user.password)) throw bad("كلمة المرور الجديدة هي نفسها الحالية — اختر غيرها");

  const hashed = await bcrypt.hash(dto.newPassword, config.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  // Every other device signs out; this one carries on with a fresh pair,
  // carrying the same role and profile id a sign-in would give it.
  await revokeAllSessions(userId);
  const { tokenVersion } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
  const role = user.role as RoleType;
  const refId = user.student?.id ?? user.professor?.id ?? userId;
  const tokens = signTokenPair({ userId, role, refId, tokenVersion, sid: newSessionId() });
  return { message: "Password changed", ...tokens };
};
