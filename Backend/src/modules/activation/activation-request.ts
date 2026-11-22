import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
import { deviceOf } from "../../core/auth/device";
import { notifyAdminsQuietly } from "../notification/notification.service";

/**
 * ============================================================
 * VERIFICATION — THE CARD
 * ============================================================
 *
 * A student shows the administration that the account is theirs: a photo of
 * their student card. An administrator checks it — a real card, legible, its
 * name and number the account's (the code on it, read by the student's
 * browser, is a hint beside it) — and accepts (the account is marked
 * verified, `User.isVerified`), or refuses with a reason the student reads to
 * send again.
 *
 * Asked for at the second stage of a student's first sign-in, right after
 * they replace the handed-out password (REQUIRE_STUDENT_ACTIVATION; the
 * student may skip it), and offered any time from «توثيق الحساب» in their
 * account. Skipped, the account works all the same — unverified.
 *
 * The card alone, by the user's choice (2026-11-18) — it was the card and a
 * photo of the student holding it. Simpler to send; weaker, too: whoever has
 * the card in hand, or a good photo of it, can send it. A request from before,
 * with the second photo, is still shown with it until it is decided.
 *
 * The photos are private: kept in a folder that is never served (only an
 * administrator reads them, through this module), and deleted when the
 * request is decided — or after ACTIVATION_REQUEST_DAYS without a decision.
 * The audit log keeps who decided and when, never the photos.
 */

// ─── The photos: a private folder ─────────────────────────────

const DIR = path.resolve(process.env.ACTIVATION_PHOTOS_DIR ?? path.join(process.cwd(), "storage", "activation"));
fs.mkdirSync(DIR, { recursive: true });

/** The file of a stored name — never anything outside the folder. */
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

async function deletePhotos(...names: (string | null | undefined)[]) {
  await Promise.all(
    names.map((n) => {
      const p = n ? fileOf(n) : null;
      return p ? fs.promises.rm(p, { force: true }).catch(() => undefined) : undefined;
    }),
  );
}

/**
 * Requests not decided within ACTIVATION_REQUEST_DAYS go, photos and all; so
 * do photos left behind by an account deleted meanwhile. Run now and then,
 * instead of on a schedule; never throws.
 */
export async function pruneActivationRequests(now = new Date()) {
  try {
    const cutoff = new Date(now.getTime() - config.ACTIVATION_REQUEST_DAYS * 24 * 60 * 60 * 1000);
    const stale = await prisma.activationRequest.findMany({
      where: { sentAt: { lt: cutoff } },
      select: { userId: true, cardFile: true, selfieFile: true },
    });
    if (stale.length) {
      await prisma.activationRequest.deleteMany({ where: { userId: { in: stale.map((s) => s.userId) }, sentAt: { lt: cutoff } } });
      await deletePhotos(...stale.flatMap((s) => [s.cardFile, s.selfieFile]));
    }
    // Files no request names any more (its account deleted, the row gone with it),
    // left a day so a request being written right now is not caught.
    const named = new Set(
      (await prisma.activationRequest.findMany({ select: { cardFile: true, selfieFile: true } })).flatMap((r) => [r.cardFile, r.selfieFile]),
    );
    const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
    for (const name of await fs.promises.readdir(DIR)) {
      if (named.has(name)) continue;
      const p = path.join(DIR, name);
      const stat = await fs.promises.stat(p).catch(() => null);
      if (stat?.isFile() && stat.mtimeMs < dayAgo) await fs.promises.rm(p, { force: true }).catch(() => undefined);
    }
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "activation", action: "prune", message: (error as Error)?.message }));
  }
}

// ─── The student: the photos ──────────────────────────────────

export const submitRequestSchema = z.object({
  /** What the student's browser read from the QR code in the card's photo — it must be the account's number. */
  qrNumber: z.string().trim().max(32).optional(),
});

/** Where the student's request stands: none, waiting, or refused — with why. */
export async function myActivationRequestService(userId: string) {
  const r = await prisma.activationRequest.findUnique({
    where: { userId },
    select: { status: true, sentAt: true, rejectionReason: true, decidedAt: true },
  });
  if (!r) return { status: "none" as const };
  if (r.status === "pending") return { status: "pending" as const, sentAt: r.sentAt };
  return { status: "rejected" as const, reason: r.rejectionReason, decidedAt: r.decidedAt };
}

/**
 * The card's photo. A request already there, waiting or refused, is replaced
 * and its photos deleted. Acceptance marks the account verified and changes
 * nothing else — the password is the student's own business, chosen before.
 */
export async function submitActivationRequestService(
  userId: string,
  files: { card?: Buffer },
  body: unknown,
  device?: ReturnType<typeof deviceOf>,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isVerified: true,
      firstName: true,
      lastName: true,
      firstNameLatin: true,
      lastNameLatin: true,
      student: { select: { registrationNumber: true } },
    },
  });
  if (!user?.student) {
    throw new HttpException(tr("activation.studentsOnly"), HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED);
  }
  if (user.isVerified) throw bad(tr("activation.alreadyVerified"));

  // Without a single field the multipart body is not there at all.
  const parsed = submitRequestSchema.safeParse(body ?? {});
  if (!parsed.success) throw bad(issuesMessage(parsed.error.issues));
  const reg = user.student.registrationNumber;
  // The card is what the administrator checks: without it, nothing to check.
  if (!files.card) throw bad(tr("activation.photosRequired"));
  // And it must be the account's own card: the code on it, read from the photo by the student's
  // browser, carries the account's number — or nothing is sent (the user's decision, 2026-11-18).
  // Read by the browser, not here (the server decodes no images): what stops an honest mistake —
  // another student's card in hand — while the administrator still checks the number on the photo.
  const qrNumber = parsed.data.qrNumber?.trim() ?? "";
  if (!qrNumber) throw bad(tr("activation.qrUnread"));
  if (qrNumber !== reg) throw bad(tr("activation.qrOther"));

  const cardFile = await savePhoto(files.card);

  const previous = await prisma.activationRequest.findUnique({ where: { userId }, select: { cardFile: true, selfieFile: true } });
  // `selfieFile` emptied: a request sent again before the change loses its second photo with the rest.
  const fields = { status: "pending" as const, cardFile, selfieFile: null, qrNumber, rejectionReason: null, decidedAt: null, sentAt: new Date() };
  try {
    await prisma.activationRequest.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  } catch (error) {
    await deletePhotos(cardFile);
    throw error;
  }
  await deletePhotos(previous?.cardFile, previous?.selfieFile);

  audit({
    action: "activation.requested",
    actor: { id: userId, role: "student" },
    details: { qrMatches: qrNumber ? qrNumber === reg : null },
    device,
  });
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || [user.firstNameLatin, user.lastNameLatin].filter(Boolean).join(" ");
  await notifyAdminsQuietly({
    type: "general",
    title: { key: "notif.verificationRequest.title" },
    message: { key: "notif.verificationRequest.message", params: { name: name || reg, reg } },
    // Activation lives in «المستخدمون» (the client's users page), its requests a view of it.
    link: "/admin/users?view=requests",
  });
  if (Math.random() < 0.1) void pruneActivationRequests();
  return myActivationRequestService(userId);
}

// ─── The administration: the requests to review ───────────────

export const decideSchema = z.object({
  /** When the request reviewed was sent: one sent again since is not decided unseen. */
  sentAt: z.coerce.date(),
});

export const rejectRequestSchema = decideSchema.extend({
  reason: z.string().trim().min(1, zmsg("activation.reasonRequired")).max(1000),
});

/** The requests waiting, oldest first. */
export async function listActivationRequestsService() {
  await pruneActivationRequests();
  const rows = await prisma.activationRequest.findMany({
    where: { status: "pending" },
    orderBy: { sentAt: "asc" },
    take: 200,
    select: {
      sentAt: true,
      qrNumber: true,
      cardFile: true,
      selfieFile: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          firstNameLatin: true,
          lastNameLatin: true,
          status: true,
          student: {
            select: {
              id: true,
              registrationNumber: true,
              specialization: { select: { name: true, level: true } },
              academicYear: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  const items = rows.flatMap(({ user: u, sentAt, qrNumber, cardFile, selfieFile }) =>
    u.student
      ? [
          {
            id: u.student.id,
            registrationNumber: u.student.registrationNumber,
            firstName: u.firstName,
            lastName: u.lastName,
            firstNameLatin: u.firstNameLatin,
            lastNameLatin: u.lastNameLatin,
            specialization: u.student.specialization,
            academicYear: u.student.academicYear.title,
            status: u.status,
            sentAt,
            qrNumber,
            /** The number read from the card's QR code is this account's — as the student's browser read it. */
            qrMatches: qrNumber ? qrNumber === u.student.registrationNumber : null,
            /** Which photos came with it — both, but for a request sent before they were required. */
            photos: { card: !!cardFile, selfie: !!selfieFile },
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
    select: { userId: true, user: { select: { activationRequest: true } } },
  });
  const r = s?.user.activationRequest;
  if (!s || !r || r.status !== "pending") {
    throw new NotFoundException(tr("activation.noRequest"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  }
  return { s, r };
}

const changedSince = () =>
  new HttpException(tr("activation.changed"), HTTPSTATUS.CONFLICT, ErrorCodeEnum.VALIDATION_ERROR);

/** A request's photo, for the administrator reviewing it — the card; or, on a request from before, the second one. */
export async function activationPhotoService(studentId: string, which: "card" | "selfie") {
  const { r } = await pendingOf(studentId);
  const name = which === "card" ? r.cardFile : r.selfieFile;
  const file = name ? fileOf(name) : null;
  if (!file || !fs.existsSync(file)) throw new NotFoundException(tr("activation.noRequest"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return { file, type: TYPE[path.extname(file)] ?? "application/octet-stream" };
}

/** Accepted: the account is verified, and the photos go. Nothing else changes. */
export async function approveActivationRequestService(studentId: string, sentAt: Date) {
  const { s, r } = await pendingOf(studentId);
  if (r.sentAt.getTime() !== sentAt.getTime()) throw changedSince();
  const done = await prisma.$transaction(async (tx) => {
    // The very request reviewed — not one sent again in between.
    const { count } = await tx.activationRequest.deleteMany({ where: { userId: s.userId, status: "pending", sentAt: r.sentAt } });
    if (count !== 1) return false;
    await tx.user.update({ where: { id: s.userId }, data: { isVerified: true } });
    return true;
  });
  if (!done) throw changedSince();

  await deletePhotos(r.cardFile, r.selfieFile);
  return { message: "Account verified" };
}

/** Refused, with the reason the student reads to send again. The photos go now. */
export async function rejectActivationRequestService(studentId: string, sentAt: Date, reason: string) {
  const { s, r } = await pendingOf(studentId);
  if (r.sentAt.getTime() !== sentAt.getTime()) throw changedSince();
  const { count } = await prisma.activationRequest.updateMany({
    where: { userId: s.userId, status: "pending", sentAt: r.sentAt },
    data: {
      status: "rejected",
      rejectionReason: reason,
      decidedAt: new Date(),
      cardFile: null,
      selfieFile: null,
      qrNumber: null,
    },
  });
  if (count !== 1) throw changedSince();
  await deletePhotos(r.cardFile, r.selfieFile);
  return { message: "Request refused" };
}

// ─── Controllers ──────────────────────────────────────────────

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw bad(issuesMessage(parsed.error.issues));
  return parsed.data;
};

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** `GET /account/activation-request` */
export const myActivationRequestController = wrap(async (req, res) => {
  res.status(HTTPSTATUS.OK).json(await myActivationRequestService(req.user!.userId));
});

/** `POST /account/activation-request` — multipart: `card`, `qrNumber`. */
export const submitActivationRequestController = wrap(async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  res.status(HTTPSTATUS.OK).json(
    await submitActivationRequestService(
      req.user!.userId,
      { card: files?.card?.[0]?.buffer },
      req.body,
      deviceOf(req),
    ),
  );
});

/** `GET /admin/activation/requests` */
export const listActivationRequestsController = wrap(async (_req, res) => {
  res.status(HTTPSTATUS.OK).json(await listActivationRequestsService());
});

/** `GET /admin/activation/requests/:id/card` — and `…/selfie`, on a request sent before the card alone was asked for. */
export const activationPhotoController = (which: "card" | "selfie") =>
  wrap(async (req, res) => {
    const { file, type } = await activationPhotoService(String(req.params.id), which);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Disposition", "inline");
    res.status(HTTPSTATUS.OK).send(await fs.promises.readFile(file));
  });

/** `POST /admin/activation/requests/:id/approve` — `{ sentAt }` */
export const approveActivationRequestController = wrap(async (req, res) => {
  const { sentAt } = parse(decideSchema, req.body);
  res.status(HTTPSTATUS.OK).json(await approveActivationRequestService(String(req.params.id), sentAt));
});

/** `POST /admin/activation/requests/:id/reject` — `{ sentAt, reason }` */
export const rejectActivationRequestController = wrap(async (req, res) => {
  const { sentAt, reason } = parse(rejectRequestSchema, req.body);
  res.status(HTTPSTATUS.OK).json(await rejectActivationRequestService(String(req.params.id), sentAt, reason));
});
