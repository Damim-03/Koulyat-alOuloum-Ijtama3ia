import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { prisma } from "../../core/prisma/client";
import type { Prisma } from "../../generated/prisma";
import { AppError, BadRequestException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { imageKindOf } from "../../core/middleware/upload.middleware";
import { tr } from "../../core/i18n";

/**
 * Files sent with messages.
 *
 * A file is uploaded on its own first — so the screen can show each one's
 * progress — and is a *draft* of its uploader until a message carries it.
 * Sending names the drafts; they are claimed by the message inside the same
 * transaction that stores it, so a message never exists without its files,
 * nor a file with someone else's message.
 *
 * Three guarantees:
 *
 *   • **Private.** The files live in a folder that is never served as static
 *     files. Only the sender and the recipients of the message open one —
 *     the same people who may read the message — and a draft only its
 *     uploader. Anyone else is told it does not exist.
 *   • **What it says it is.** The type comes from a fixed table, chosen by
 *     the extension and confirmed by the file's own first bytes; nothing the
 *     client claims (its MIME type, its name) is used on disk or trusted.
 *   • **Nothing left behind.** A draft never sent, or a file whose message is
 *     gone, is swept after a day — row and file.
 */

export const MAX_FILE_MB = 25;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
/** Files one message may carry. */
export const MAX_FILES = 5;
/** Drafts one account may hold at once: a few messages' worth. */
const MAX_DRAFTS = 20;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const DIR = path.resolve(process.env.MESSAGE_FILES_DIR ?? path.join(process.cwd(), "storage", "messages"));
fs.mkdirSync(DIR, { recursive: true });

/** The file of a stored name — never anything outside the folder. */
const fileOf = (name: string): string | null => {
  const p = path.resolve(DIR, path.basename(name));
  return p.startsWith(DIR + path.sep) ? p : null;
};

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);
const notFound = () => new NotFoundException(tr("messages.fileNotFound"), ErrorCodeEnum.RESOURCE_NOT_FOUND);

/* ── what is accepted ─────────────────────────────────────── */

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** The container of the older Office formats (.doc, .xls, .ppt). */
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const startsWith = (sig: Buffer) => (head: Buffer) =>
  head.length >= sig.length && head.subarray(0, sig.length).equals(sig);
const image = (ext: string) => (head: Buffer) => imageKindOf(head) === ext;

/** Text is UTF-8 with no NUL byte: a binary renamed .txt is neither. */
function isText(head: Buffer) {
  if (head.includes(0)) return false;
  try {
    // `stream` lets a character cut at the end of the sample through.
    new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

const TYPES: Record<string, { mime: string; sniff: (head: Buffer) => boolean }> = {
  ".pdf": { mime: "application/pdf", sniff: startsWith(Buffer.from("%PDF-")) },
  ".png": { mime: "image/png", sniff: image(".png") },
  ".jpg": { mime: "image/jpeg", sniff: image(".jpg") },
  ".jpeg": { mime: "image/jpeg", sniff: image(".jpg") },
  ".webp": { mime: "image/webp", sniff: image(".webp") },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sniff: startsWith(ZIP) },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sniff: startsWith(ZIP) },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sniff: startsWith(ZIP) },
  ".doc": { mime: "application/msword", sniff: startsWith(OLE) },
  ".xls": { mime: "application/vnd.ms-excel", sniff: startsWith(OLE) },
  ".ppt": { mime: "application/vnd.ms-powerpoint", sniff: startsWith(OLE) },
  ".txt": { mime: "text/plain; charset=utf-8", sniff: isText },
};

/** The extensions accepted, for the client's file picker and for tests. */
export const ACCEPTED_EXTENSIONS = Object.keys(TYPES);

const extOf = (name: string) => path.extname(name).toLowerCase();

/**
 * The name shown and offered on download. Its folders are dropped, and so are
 * control characters and the bidirectional overrides — the ones that make
 * "invoice‮fdp.exe" read as "invoiceexe.pdf".
 */
function cleanName(raw: string, ext: string) {
  let name = path
    .basename(raw.replace(/\\/g, "/"))
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .trim();
  if (!name || name === "." || name === "..") name = `file${ext}`;
  if (name.length > 200) name = name.slice(0, 200 - ext.length) + ext;
  return name;
}

/* ── the upload ───────────────────────────────────────────── */

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DIR),
    // A temporary name: the file is renamed once its bytes are checked.
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.part`),
  }),
  // Without it, an Arabic file name arrives as Latin-1 mojibake.
  defParamCharset: "utf8",
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, parts: 4, headerPairs: 100 },
  fileFilter: (_req, file, cb) => {
    if (TYPES[extOf(file.originalname)]) return cb(null, true);
    cb(bad(tr("messages.fileType")));
  },
}).single("file");

/** `POST /messages/attachments` — one file, in the field `file`. */
export const messageFileUpload = (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE")
      return next(bad(tr("messages.fileTooLarge", { max: MAX_FILE_MB })));
    if (err instanceof MulterError || err instanceof AppError) return next(err);
    return next(bad(tr("upload.invalid")));
  });
};

async function readHead(file: string, bytes: number) {
  const fd = await fs.promises.open(file, "r");
  try {
    const head = Buffer.alloc(bytes);
    const { bytesRead } = await fd.read(head, 0, bytes, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

const removeFile = (storedName: string) => {
  const p = fileOf(storedName);
  return p ? fs.promises.rm(p, { force: true }).catch(() => undefined) : undefined;
};

/** Drafts older than a day, and files whose message is gone: row and file. */
async function sweep() {
  const stale = await prisma.messageAttachment.findMany({
    where: { messageId: null, createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
    select: { id: true, storedName: true },
    take: 200,
  });
  if (stale.length === 0) return;
  await prisma.messageAttachment.deleteMany({
    where: { id: { in: stale.map((s) => s.id) }, messageId: null },
  });
  await Promise.all(stale.map((s) => removeFile(s.storedName)));
}

export const ATTACHMENT_SELECT = { id: true, fileName: true, mimeType: true, size: true } as const;
export type AttachmentInfo = { id: string; fileName: string; mimeType: string; size: number };

/** Keeps an uploaded file as a draft of `userId` — once its bytes say what its name does. */
export async function saveUploadService(userId: string, file?: Express.Multer.File): Promise<AttachmentInfo> {
  if (!file) throw bad(tr("upload.none"));
  const tmp = file.path;
  try {
    const ext = extOf(file.originalname);
    const kind = TYPES[ext];
    if (!kind) throw bad(tr("messages.fileType"));
    if (file.size === 0) throw bad(tr("upload.none"));
    if (!kind.sniff(await readHead(tmp, 64 * 1024))) throw bad(tr("messages.fileMismatch"));

    await sweep();
    const drafts = await prisma.messageAttachment.count({ where: { uploaderId: userId, messageId: null } });
    if (drafts >= MAX_DRAFTS) throw bad(tr("messages.tooManyDrafts"));

    const storedName = `${crypto.randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
    const dest = path.join(DIR, storedName);
    await fs.promises.rename(tmp, dest);
    await fs.promises.chmod(dest, 0o600).catch(() => undefined);
    try {
      return await prisma.messageAttachment.create({
        data: {
          uploaderId: userId,
          fileName: cleanName(file.originalname, ext),
          storedName,
          mimeType: kind.mime,
          size: file.size,
        },
        select: ATTACHMENT_SELECT,
      });
    } catch (e) {
      await removeFile(storedName);
      throw e;
    }
  } finally {
    // Gone already when it was kept (renamed); otherwise this is the cleanup.
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
  }
}

/** A draft its uploader changed their mind about. A sent file stays with its message. */
export async function deleteDraftService(userId: string, id: string) {
  const row = await prisma.messageAttachment.findFirst({
    where: { id, uploaderId: userId, messageId: null },
    select: { storedName: true },
  });
  if (!row) throw notFound();
  const { count } = await prisma.messageAttachment.deleteMany({ where: { id, uploaderId: userId, messageId: null } });
  if (count === 0) throw notFound(); // sent in between
  await removeFile(row.storedName);
  return { ok: true };
}

/**
 * Gives the message `messageId` the drafts `ids` of `uploaderId` — inside the
 * transaction that stores the message, which a refusal here rolls back.
 */
export async function claimAttachments(
  tx: Prisma.TransactionClient,
  uploaderId: string,
  ids: string[] | undefined,
  messageId: string,
) {
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) return;
  if (unique.length > MAX_FILES) throw bad(tr("messages.tooManyFiles", { max: MAX_FILES }));
  const { count } = await tx.messageAttachment.updateMany({
    where: { id: { in: unique }, uploaderId, messageId: null },
    data: { messageId },
  });
  if (count !== unique.length) throw bad(tr("messages.filesGone"));
}

/** The files of each message, in the order they were attached. */
export async function attachmentsOf(messageIds: string[]): Promise<Map<string, AttachmentInfo[]>> {
  const map = new Map<string, AttachmentInfo[]>();
  if (messageIds.length === 0) return map;
  const rows = await prisma.messageAttachment.findMany({
    where: { messageId: { in: messageIds } },
    select: { ...ATTACHMENT_SELECT, messageId: true },
    orderBy: { createdAt: "asc" },
  });
  for (const { messageId, ...a } of rows) {
    const list = map.get(messageId!) ?? [];
    list.push(a);
    map.set(messageId!, list);
  }
  return map;
}

/**
 * The file, if `userId` may open it: the sender of its message, or a
 * recipient who has not deleted it — the people who may read the message.
 * A draft, only its uploader. Anyone else: it does not exist.
 */
export async function openAttachmentService(userId: string, id: string) {
  const a = await prisma.messageAttachment.findUnique({
    where: { id },
    select: {
      storedName: true,
      fileName: true,
      mimeType: true,
      size: true,
      uploaderId: true,
      message: { select: { senderId: true, recipients: { where: { userId }, select: { deletedAt: true } } } },
    },
  });
  if (!a) throw notFound();
  const row = a.message?.recipients[0];
  const allowed = a.message
    ? a.message.senderId === userId || (!!row && !row.deletedAt)
    : a.uploaderId === userId;
  if (!allowed) throw notFound();
  const file = fileOf(a.storedName);
  if (!file || !fs.existsSync(file)) throw notFound();
  return { file, fileName: a.fileName, mimeType: a.mimeType, size: a.size };
}

/**
 * The files of a message withdrawn for everyone: rows and files, now — not
 * left for the sweep, since nobody may open them any more.
 */
export async function deleteFilesOf(messageId: string) {
  const rows = await prisma.messageAttachment.findMany({ where: { messageId }, select: { id: true, storedName: true } });
  if (rows.length === 0) return 0;
  await prisma.messageAttachment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await Promise.all(rows.map((r) => removeFile(r.storedName)));
  return rows.length;
}
