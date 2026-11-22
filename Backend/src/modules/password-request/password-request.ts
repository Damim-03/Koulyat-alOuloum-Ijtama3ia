import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { config } from "../../core/config/app.config";
import { BadRequestException, HttpException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage, tr } from "../../core/i18n";
import { zmsg } from "../../core/i18n/zod";
import { imageKindOf } from "../../core/middleware/upload.middleware";
import { audit } from "../../core/audit/audit";
import { deviceOf, type SessionDevice } from "../../core/auth/device";
import { passwordIssue } from "../../core/auth/password-policy";
import { seal, unseal } from "../../core/auth/secret-box";
import { revokeAllSessions } from "../../core/auth/sessions";
import { closeUserSessions } from "../../core/auth/refresh-sessions";
import { clearFailures, throttleKey } from "../../core/auth/login-throttle";
import { disconnectSessions } from "../../core/realtime/realtime";
import { mailEnabled } from "../../core/mail/mailer";
import { trustedAddressOf } from "../auth/email-links";
import { notifyAdminsQuietly } from "../notification/notification.service";

/**
 * ============================================================
 * FORGOT MY PASSWORD — THROUGH THE ADMINISTRATION
 * ============================================================
 *
 * For a student whose account has no proven address — the link by email
 * (modules/auth/email-links) cannot reach them. On «نسيت كلمة المرور» they
 * type their registration number (the page says at once whether such a
 * student exists: the user's choice, 2026-11-20 — registration numbers are on
 * every class list, so this tells little), photograph their card, and send.
 *
 * The administration is told (the bell), sees the request in «المستخدمون ←
 * طلبات كلمة المرور», checks the card is this student's — the code on it read
 * by the student's browser is a hint beside it — and writes a password
 * (the user's choice: written by the administrator, not generated), or refuses
 * with a reason.
 *
 * Whoever sent the request follows it from that browser alone: it holds a
 * secret (256 random bits) of which only the SHA-256 is kept here. Once a
 * password is written, that browser — and no other — reads it, the student
 * copies it, and the request goes. Until then the password is sealed
 * (core/auth/secret-box, its own key): a copy of the database does not read
 * it. It is temporary all the same: the account must choose its own at the
 * first sign-in (`mustChangePassword`), and every session it had ends.
 *
 * Why the card: a registration number alone is no proof — anyone who knows a
 * classmate's could ask, and be handed their account.
 */

// ─── The photo: a private folder ──────────────────────────────

const DIR = path.resolve(process.env.PASSWORD_REQUEST_PHOTOS_DIR ?? path.join(process.cwd(), "storage", "password-requests"));
fs.mkdirSync(DIR, { recursive: true });

const fileOf = (name: string): string | null => {
  const p = path.resolve(DIR, path.basename(name));
  return p.startsWith(DIR + path.sep) ? p : null;
};

const TYPE: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);

/** Writes a photo whose bytes really are an image; its name holds nothing the client sent. */
async function savePhoto(bytes: Buffer): Promise<string> {
  const ext = imageKindOf(bytes);
  if (!ext) throw bad(tr("upload.imageType"));
  const name = `${crypto.randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(DIR, name), bytes, { flag: "wx", mode: 0o600 });
  return name;
}

async function deletePhoto(name: string | null | undefined) {
  const p = name ? fileOf(name) : null;
  if (p) await fs.promises.rm(p, { force: true }).catch(() => undefined);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * What has waited too long goes: a request not decided in PASSWORD_REQUEST_DAYS,
 * a refusal no one came back to read in as long, a password not picked up in
 * PASSWORD_PICKUP_HOURS — and photos no request names any more. Never throws.
 */
export async function prunePasswordRequests(now = new Date()) {
  try {
    const old = new Date(now.getTime() - config.PASSWORD_REQUEST_DAYS * DAY);
    const unpicked = new Date(now.getTime() - config.PASSWORD_PICKUP_HOURS * HOUR);
    const stale = {
      OR: [
        { status: "pending" as const, sentAt: { lt: old } },
        { status: "rejected" as const, decidedAt: { lt: old } },
        { status: "approved" as const, decidedAt: { lt: unpicked } },
      ],
    };
    const rows = await prisma.passwordRequest.findMany({ where: stale, select: { cardFile: true } });
    if (rows.length) {
      await prisma.passwordRequest.deleteMany({ where: stale });
      await Promise.all(rows.map((r) => deletePhoto(r.cardFile)));
    }
    const named = new Set((await prisma.passwordRequest.findMany({ select: { cardFile: true } })).map((r) => r.cardFile));
    for (const name of await fs.promises.readdir(DIR)) {
      if (named.has(name)) continue;
      const p = path.join(DIR, name);
      const stat = await fs.promises.stat(p).catch(() => null);
      if (stat?.isFile() && stat.mtimeMs < now.getTime() - DAY) await fs.promises.rm(p, { force: true }).catch(() => undefined);
    }
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "password-request", action: "prune", message: (error as Error)?.message }));
  }
}

// ─── The secret the requesting browser holds ──────────────────

const hashOf = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
const newToken = () => {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashOf(raw) };
};

const PICKUP = "password-pickup/v1" as const;

// ─── The student (no session: they cannot sign in) ────────────

const regField = z.string().trim().min(1).max(32);
export const lookupSchema = z.object({ registrationNumber: regField });
export const submitSchema = z.object({
  registrationNumber: regField,
  /** What the student's browser read from the QR code in the card's photo — it must be this number. */
  qrNumber: z.string().trim().max(32).optional(),
});
/** 256 random bits in base64url: 43 characters. Anything else is not ours. */
export const tokenSchema = z.object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/) });

const STUDENT_SELECT = {
  id: true,
  role: true,
  status: true,
  email: true,
  verifiedEmail: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  student: { select: { registrationNumber: true } },
} as const;

const studentOf = (registrationNumber: string) =>
  prisma.user.findFirst({ where: { student: { registrationNumber } }, select: STUDENT_SELECT });

/** By email, when the account has a proven address and this server sends mail — else through the administration. */
const routeOf = (u: NonNullable<Awaited<ReturnType<typeof studentOf>>>) =>
  u.status !== "active" ? ("blocked" as const) : mailEnabled() && trustedAddressOf(u) ? ("email" as const) : ("admin" as const);

/**
 * Whether a student has this number — and which way their password comes
 * back: `email` (the link), `admin` (this request), or `blocked` (a suspended
 * account: the administration, in person). Nothing else: no name.
 */
export async function lookupStudentService(registrationNumber: string) {
  const user = await studentOf(registrationNumber);
  if (!user) return { found: false as const };
  return { found: true as const, via: routeOf(user) };
}

/**
 * The card's photo, and the number. A request already there — waiting,
 * refused, or with a password not picked up — is replaced: its photo goes, and
 * the browser that sent it can no longer follow it.
 */
export async function submitPasswordRequestService(files: { card?: Buffer }, body: unknown, device?: SessionDevice) {
  const parsed = submitSchema.safeParse(body ?? {});
  if (!parsed.success) throw bad(issuesMessage(parsed.error.issues));
  const reg = parsed.data.registrationNumber;
  const user = await studentOf(reg);
  if (!user) throw bad(tr("passwordRequest.unknown"));
  const via = routeOf(user);
  if (via === "blocked") throw bad(tr("passwordRequest.suspended"));
  if (via === "email") throw bad(tr("passwordRequest.hasEmail"));

  if (!files.card) throw bad(tr("activation.photosRequired"));
  // The account's own card: the code on it, read by the browser, carries this very number.
  const qrNumber = parsed.data.qrNumber?.trim() ?? "";
  if (!qrNumber) throw bad(tr("activation.qrUnread"));
  if (qrNumber !== reg) throw bad(tr("activation.qrOther"));

  const cardFile = await savePhoto(files.card);
  const { raw, hash } = newToken();
  const previous = await prisma.passwordRequest.findUnique({ where: { userId: user.id }, select: { cardFile: true } });
  const sentAt = new Date();
  const fields = {
    tokenHash: hash,
    status: "pending" as const,
    cardFile,
    qrNumber,
    sealedPassword: null,
    rejectionReason: null,
    decidedAt: null,
    sentAt,
  };
  try {
    await prisma.passwordRequest.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
  } catch (error) {
    await deletePhoto(cardFile);
    throw error;
  }
  await deletePhoto(previous?.cardFile);

  audit({ action: "password.adminRequested", actor: { id: user.id, role: "student" }, device });
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || [user.firstNameLatin, user.lastNameLatin].filter(Boolean).join(" ");
  await notifyAdminsQuietly({
    type: "general",
    title: { key: "notif.passwordRequest.title" },
    message: { key: "notif.passwordRequest.message", params: { name: name || reg, reg } },
    link: "/admin/users?view=passwords",
  });
  if (Math.random() < 0.1) void prunePasswordRequests();
  return { token: raw, status: "pending" as const, sentAt };
}

const byToken = (raw: string) =>
  prisma.passwordRequest.findUnique({
    where: { tokenHash: hashOf(raw) },
    select: {
      userId: true,
      tokenHash: true,
      status: true,
      sentAt: true,
      decidedAt: true,
      rejectionReason: true,
      sealedPassword: true,
      cardFile: true,
      user: { select: { student: { select: { registrationNumber: true } } } },
    },
  });

/**
 * Where the request this browser sent stands: waiting, refused (and why), or
 * answered — with the password, for this browser alone. `none`: no such
 * request (decided long ago, sent again elsewhere, or closed).
 */
export async function passwordRequestStatusService(raw: string) {
  const row = await byToken(raw);
  if (!row) return { status: "none" as const };
  const now = Date.now();
  const expired =
    (row.status === "pending" && row.sentAt.getTime() < now - config.PASSWORD_REQUEST_DAYS * DAY) ||
    (row.status === "rejected" && (row.decidedAt?.getTime() ?? 0) < now - config.PASSWORD_REQUEST_DAYS * DAY) ||
    (row.status === "approved" && (row.decidedAt?.getTime() ?? 0) < now - config.PASSWORD_PICKUP_HOURS * HOUR);
  if (expired) {
    await prisma.passwordRequest.deleteMany({ where: { userId: row.userId, tokenHash: row.tokenHash } });
    await deletePhoto(row.cardFile);
    return { status: "none" as const };
  }
  if (row.status === "pending") return { status: "pending" as const, sentAt: row.sentAt };
  if (row.status === "rejected") return { status: "rejected" as const, reason: row.rejectionReason, decidedAt: row.decidedAt };
  const password = unseal(row.sealedPassword, PICKUP);
  // Sealed under another key (SESSION_SECRET changed): it cannot be read — ask again.
  if (!password) {
    await prisma.passwordRequest.deleteMany({ where: { userId: row.userId, tokenHash: row.tokenHash } });
    return { status: "none" as const };
  }
  return {
    status: "approved" as const,
    password,
    registrationNumber: row.user.student?.registrationNumber ?? null,
    decidedAt: row.decidedAt,
  };
}

/**
 * Done with it: the password copied, a refusal read, or a waiting request
 * withdrawn. The request goes — with its photo, and with the password.
 */
export async function closePasswordRequestService(raw: string, device?: SessionDevice) {
  const row = await byToken(raw);
  if (row) {
    await prisma.passwordRequest.deleteMany({ where: { userId: row.userId, tokenHash: row.tokenHash } });
    await deletePhoto(row.cardFile);
    if (row.status === "approved") audit({ action: "password.pickedUp", actor: { id: row.userId, role: "student" }, device });
  }
  return { status: "none" as const };
}

// ─── The administration ───────────────────────────────────────

export const approveSchema = z.object({
  /** When the request reviewed was sent: one sent again since is not decided unseen. */
  sentAt: z.coerce.date(),
  password: z.string().min(1).max(200),
});

export const rejectSchema = z.object({
  sentAt: z.coerce.date(),
  reason: z.string().trim().min(1, zmsg("activation.reasonRequired")).max(1000),
});

/** The requests waiting, oldest first. */
export async function listPasswordRequestsService() {
  await prunePasswordRequests();
  const rows = await prisma.passwordRequest.findMany({
    where: { status: "pending" },
    orderBy: { sentAt: "asc" },
    take: 200,
    select: {
      sentAt: true,
      qrNumber: true,
      cardFile: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          firstNameLatin: true,
          lastNameLatin: true,
          status: true,
          isVerified: true,
          lastLoginAt: true,
          avatarUrl: true,
          student: {
            select: {
              id: true,
              registrationNumber: true,
              specialization: {
                select: { name: true, level: true, filiere: { select: { name: true, domain: { select: { name: true } } } } },
              },
              academicYear: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  const items = rows.flatMap(({ user: u, sentAt, qrNumber, cardFile }) =>
    u.student
      ? [
          {
            id: u.student.id,
            registrationNumber: u.student.registrationNumber,
            firstName: u.firstName,
            lastName: u.lastName,
            firstNameLatin: u.firstNameLatin,
            lastNameLatin: u.lastNameLatin,
            specialization: { name: u.student.specialization.name, level: u.student.specialization.level },
            /** As the student card prints them: «الميدان» and «الفرع». */
            domain: u.student.specialization.filiere.domain?.name ?? null,
            filiere: u.student.specialization.filiere.name,
            avatarUrl: u.avatarUrl,
            academicYear: u.student.academicYear.title,
            status: u.status,
            verified: u.isVerified,
            lastLoginAt: u.lastLoginAt,
            sentAt,
            qrNumber,
            /** The number read from the card's QR code is this account's — as the student's browser read it. */
            qrMatches: qrNumber ? qrNumber === u.student.registrationNumber : null,
            photo: !!cardFile,
          },
        ]
      : [],
  );
  return { items, total: items.length };
}

/** The waiting request of this student (by Student.id). */
async function pendingOf(studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true, registrationNumber: true, user: { select: { passwordRequest: true } } },
  });
  const r = s?.user.passwordRequest;
  if (!s || !r || r.status !== "pending") {
    throw new NotFoundException(tr("passwordRequest.noRequest"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  }
  return { s, r };
}

const changedSince = () => new HttpException(tr("passwordRequest.changed"), HTTPSTATUS.CONFLICT, ErrorCodeEnum.VALIDATION_ERROR);

/** The card's photo, for the administrator reviewing it. */
export async function passwordRequestPhotoService(studentId: string) {
  const { r } = await pendingOf(studentId);
  const file = r.cardFile ? fileOf(r.cardFile) : null;
  if (!file || !fs.existsSync(file)) throw new NotFoundException(tr("passwordRequest.noRequest"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return { file, type: TYPE[path.extname(file)] ?? "application/octet-stream" };
}

/**
 * The administrator's password, now the account's — under the rules every
 * password passes. Temporary: the student chooses their own at the first
 * sign-in. Every session ends, a lock of wrong guesses lifts; the photo goes,
 * and the password waits, sealed, for the browser that asked.
 */
export async function approvePasswordRequestService(studentId: string, sentAt: Date, password: string) {
  const { s, r } = await pendingOf(studentId);
  if (r.sentAt.getTime() !== sentAt.getTime()) throw changedSince();
  const issue = passwordIssue(password, { registrationNumber: s.registrationNumber });
  if (issue) throw bad(tr(`password.${issue}`));

  const hashed = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
  const done = await prisma.$transaction(async (tx) => {
    // The very request reviewed — not one sent again in between.
    const { count } = await tx.passwordRequest.updateMany({
      where: { userId: s.userId, status: "pending", sentAt: r.sentAt },
      data: {
        status: "approved",
        sealedPassword: seal(password, PICKUP),
        cardFile: null,
        qrNumber: null,
        decidedAt: new Date(),
      },
    });
    if (count !== 1) return false;
    await tx.user.update({ where: { id: s.userId }, data: { password: hashed, mustChangePassword: true } });
    return true;
  });
  if (!done) throw changedSince();

  await deletePhoto(r.cardFile);
  await revokeAllSessions(s.userId);
  await closeUserSessions(s.userId);
  void disconnectSessions(s.userId);
  await clearFailures(throttleKey("student", s.registrationNumber));
  return { message: tr("passwordRequest.approved") };
}

/** Refused, with the reason the student reads on the page that waits. The photo goes now. */
export async function rejectPasswordRequestService(studentId: string, sentAt: Date, reason: string) {
  const { s, r } = await pendingOf(studentId);
  if (r.sentAt.getTime() !== sentAt.getTime()) throw changedSince();
  const { count } = await prisma.passwordRequest.updateMany({
    where: { userId: s.userId, status: "pending", sentAt: r.sentAt },
    data: { status: "rejected", rejectionReason: reason, decidedAt: new Date(), cardFile: null, qrNumber: null },
  });
  if (count !== 1) throw changedSince();
  await deletePhoto(r.cardFile);
  return { message: tr("passwordRequest.rejected") };
}

// ─── Controllers ──────────────────────────────────────────────

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) throw bad(issuesMessage(parsed.error.issues));
  return parsed.data;
};

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const json = (fn: (req: Request) => Promise<unknown>) =>
  wrap(async (req, res) => {
    // What it answers may carry a password: never kept by a cache on the way.
    res.setHeader("Cache-Control", "no-store");
    res.status(HTTPSTATUS.OK).json(await fn(req));
  });

/** `POST /auth/password/student` — `{ registrationNumber }` */
export const lookupStudentController = json((req) => lookupStudentService(parse(lookupSchema, req.body).registrationNumber));

/** `POST /auth/password/request` — multipart: `card`, `registrationNumber`, `qrNumber`. */
export const submitPasswordRequestController = json((req) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return submitPasswordRequestService({ card: files?.card?.[0]?.buffer }, req.body, deviceOf(req));
});

/** `POST /auth/password/request/status` — `{ token }`: in the body, never the address. */
export const passwordRequestStatusController = json((req) => passwordRequestStatusService(parse(tokenSchema, req.body).token));

/** `POST /auth/password/request/close` — `{ token }` */
export const closePasswordRequestController = json((req) =>
  closePasswordRequestService(parse(tokenSchema, req.body).token, deviceOf(req)),
);

/** `GET /admin/password-requests` */
export const listPasswordRequestsController = json(() => listPasswordRequestsService());

/** `GET /admin/password-requests/:id/card` */
export const passwordRequestPhotoController = wrap(async (req, res) => {
  const { file, type } = await passwordRequestPhotoService(String(req.params.id));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", "inline");
  res.status(HTTPSTATUS.OK).send(await fs.promises.readFile(file));
});

/** `POST /admin/password-requests/:id/approve` — `{ sentAt, password }` */
export const approvePasswordRequestController = json((req) => {
  const { sentAt, password } = parse(approveSchema, req.body);
  return approvePasswordRequestService(String(req.params.id), sentAt, password);
});

/** `POST /admin/password-requests/:id/reject` — `{ sentAt, reason }` */
export const rejectPasswordRequestController = json((req) => {
  const { sentAt, reason } = parse(rejectSchema, req.body);
  return rejectPasswordRequestService(String(req.params.id), sentAt, reason);
});
