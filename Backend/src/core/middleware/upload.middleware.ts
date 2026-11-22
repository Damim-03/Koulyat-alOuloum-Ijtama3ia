import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";

import { AppError, BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";

/**
 * ============================================================
 * UPLOAD SECURITY
 * ============================================================
 *
 * The previous filter trusted two client-controlled strings:
 *
 *   - `file.mimetype`, which is simply whatever the browser (or curl) puts
 *     in the multipart part header, and
 *   - `path.extname(file.originalname)`, which was appended to the stored
 *     filename with no allowlist.
 *
 * So `curl -F "file=@shell.html;type=image/png"` passed the MIME check and
 * was written to disk as `<random>.html`, then served from /uploads by
 * express.static as text/html — stored XSS on the API origin.
 *
 * `image/svg+xml` was also allowed. SVG is an XML document that can carry
 * <script>, so serving an uploaded SVG inline is equivalent to hosting
 * attacker JavaScript.
 *
 * Now: the extension is derived from a fixed table (never from the upload),
 * SVG is gone, and the file's actual leading bytes must match the claimed
 * type before it is kept.
 */

const uploadDir = path.join(process.cwd(), "uploads", "cards");
fs.mkdirSync(uploadDir, { recursive: true });

/** The only types accepted, each pinned to the extension it will be stored as. */
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // The stored name contains nothing the client supplied: no original
    // basename, no client extension, so no "..", no null byte, no double
    // extension, and nothing to traverse with.
    // multer يمرّ بـ fileFilter قبل التخزين: لا يبلغ هنا إلا نوعٌ مسموح.
    const ext = ALLOWED_TYPES[file.mimetype]!;
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const cardUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 20,
    parts: 25,
    headerPairs: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    // خطأٌ عاديّ هنا كان يسقط إلى الفرع الأخير في معالج الأخطاء فيصير
    // «خطأ خادم»: الإدارة ترى ٥٠٠ بلا سبب، والسبب الحقيقي في سجلّ لا تراه.
    cb(
      new BadRequestException(
        tr("upload.imageType"),
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  },
});

/**
 * يستقبل صورة البطاقة ويُترجم كل تعثّرٍ في مسار الرفع إلى خطأ عميل.
 *
 * multer يُمرّر إلى `next` ثلاثة أصنافٍ من الأخطاء: أخطاؤه هو (`MulterError`
 * للحجم والعدد والحقل غير المتوقَّع)، وما يرميه المُرشِّح، وما يرميه محلّل
 * `multipart` نفسه — وهذا الأخير خطأٌ عاديّ نصّه مثل «Malformed part header».
 * والثالث كان يصل إلى الفرع الأخير في معالج الأخطاء فيُجاب عنه بـ٥٠٠، مع أن
 * جسم الطلب هو المعطوب لا الخادم.
 */
export const cardImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  cardUpload.single("image")(req, res, (err: unknown) => {
    if (!err) return next();

    // أخطاء multer لها فرعها في معالج الأخطاء، وأخطاؤنا تحمل رسالتها.
    if (err instanceof MulterError || err instanceof AppError) return next(err);

    return next(
      new BadRequestException(
        tr("upload.invalid"),
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  });
};

/**
 * ملفّ Excel للاستيراد: في الذاكرة لا على القرص — يُقرأ ولا يُحفظ.
 *
 * ولا يُصدَّق اسمه ولا نوعه المُعلَن وحدهما: xlsx أرشيفُ ZIP، فبايتاته
 * الأولى «PK\x03\x04» — والمتحكّم يتحقّق منها قبل أن يُعطى للمحلِّل.
 */
const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // بعض المتصفّحات على ويندوز ترسله هكذا حين لا تعرف نوعه
  "application/octet-stream",
]);
export const MAX_XLSX_BYTES = 5 * 1024 * 1024; // 5 MB — ألف طالبٍ بضع مئات الكيلوبايت

const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_XLSX_BYTES, files: 1, fields: 5, parts: 10, headerPairs: 100 },
  fileFilter: (_req, file, cb) => {
    if (XLSX_MIME.has(file.mimetype) && /\.xlsx$/i.test(file.originalname))
      return cb(null, true);
    cb(
      new BadRequestException(
        tr("upload.xlsxType"),
        ErrorCodeEnum.VALIDATION_ERROR,
      ),
    );
  },
});

/** يستقبل ملفّ الاستيراد في الحقل `file`، ويُترجم تعثّر الرفع إلى خطأ عميل. */
export const xlsxFileUpload = (req: Request, res: Response, next: NextFunction) => {
  xlsxUpload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError || err instanceof AppError) return next(err);
    return next(new BadRequestException(tr("upload.invalid"), ErrorCodeEnum.VALIDATION_ERROR));
  });
};

/** أرشيف ZIP — وxlsx منه. */
export const looksLikeXlsx = (b: Buffer) =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/**
 * ما يجوز أن يتمدّد إليه ملفّ الاستيراد كلّه عند فكّه.
 *
 * حدّ الخمسة ميغابايت على الملفّ المضغوط لا على ما فيه: أرشيفٌ من بضعة
 * كيلوبايتات يتمدّد إلى غيغابايتات (zip bomb)، ويفكّه ExcelJS في الذاكرة كلّه
 * قبل أن يُقرأ سطر. وألفُ صفٍّ — حدّ الاستيراد — لا يبلغ بضعة ميغابايتات.
 */
export const MAX_XLSX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 2000;
const inflateRaw = promisify(zlib.inflateRaw);

/**
 * هل يُفكّ هذا الأرشيف في حدود `budget`؟ يمرّ على فهرس الأرشيف (central
 * directory) ويفكّ كلّ ملفٍّ فيه **فعلاً** بسقفٍ على الناتج — لا يكتفي بالحجم
 * المُعلَن، فهو رقمٌ يكتبه صانع الملفّ ويكذب فيه من شاء.
 *
 * وما لا يُفهم يُردّ: ZIP64 (لا يحتاجه ملفٌّ بهذا الحجم)، وطرق ضغطٍ غير
 * الحفظ والـdeflate، وفهرسٌ يشير خارج الملفّ.
 */
export async function xlsxExpandsSafely(
  b: Buffer,
  budget: number = MAX_XLSX_EXPANDED_BYTES,
): Promise<boolean> {
  try {
    // سجلّ نهاية الفهرس: آخر ما في الملفّ، ٢٢ بايتاً وتعليقٌ حتى ٦٤ كيلوبايت.
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
      if (b.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return false;

    const entries = b.readUInt16LE(eocd + 10);
    const dirSize = b.readUInt32LE(eocd + 12);
    const dirOffset = b.readUInt32LE(eocd + 16);
    if (entries === 0xffff || dirOffset === 0xffffffff || entries > MAX_XLSX_ENTRIES) return false;
    if (dirOffset + dirSize > eocd) return false;

    let p = dirOffset;
    let left = budget;
    for (let n = 0; n < entries; n++) {
      if (p + 46 > eocd || b.readUInt32LE(p) !== 0x02014b50) return false;
      const method = b.readUInt16LE(p + 10);
      const compressed = b.readUInt32LE(p + 20);
      const local = b.readUInt32LE(p + 42);
      p += 46 + b.readUInt16LE(p + 28) + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);

      if (local + 30 > b.length || b.readUInt32LE(local) !== 0x04034b50) return false;
      const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const end = start + compressed;
      if (end > b.length) return false;

      let size: number;
      if (method === 0) size = compressed;
      else if (method === 8)
        // يرمي حين يتجاوز الناتج السقف — قبل أن يُكتب ما بعده في الذاكرة.
        size = (await inflateRaw(b.subarray(start, end), { maxOutputLength: Math.max(1, left) })).length;
      else return false;

      left -= size;
      if (left < 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Leading bytes that genuinely identify each accepted format. */
const MAGIC: { ext: string; test: (b: Buffer) => boolean }[] = [
  {
    ext: ".png",
    test: (b) =>
      b.length >= 8 &&
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: ".jpg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: ".webp",
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/**
 * Confirms the bytes on disk really are the image they claimed to be, and
 * deletes the file if not. multer has already written it by this point, so
 * this runs as a route middleware after the upload.
 */
export function verifyUploadedImage(filePath: string): boolean {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    fd = undefined;

    const ext = path.extname(filePath).toLowerCase();
    const rule = MAGIC.find((m) => m.ext === ext);
    if (!rule || !rule.test(head)) {
      fs.unlinkSync(filePath);
      return false;
    }
    return true;
  } catch {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* already closed */
      }
    }
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* nothing to clean up */
    }
    return false;
  }
}

/**
 * Resolves a stored upload path and refuses anything that escapes the upload
 * directory — the guard for any future endpoint that reads a file by name.
 */
export function safeUploadPath(fileName: string): string | null {
  const resolved = path.resolve(uploadDir, path.basename(fileName));
  return resolved.startsWith(path.resolve(uploadDir)) ? resolved : null;
}

/**
 * The image format its bytes really are — ".jpg", ".png" or ".webp" — or null
 * when they are none of them, whatever the upload claimed.
 */
export function imageKindOf(bytes: Buffer): string | null {
  return MAGIC.find((m) => m.test(bytes))?.ext ?? null;
}

/** A phone photo, already scaled down and re-encoded by the browser. */
export const MAX_ACTIVATION_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * The photo of a verification request (modules/activation): the card. In
 * memory, not on disk — it is checked, then written to a private folder that
 * is never served to the public. Any other file is refused.
 */
const activationPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ACTIVATION_PHOTO_BYTES, files: 1, fields: 5, parts: 10, headerPairs: 100 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    cb(new BadRequestException(tr("upload.imageType"), ErrorCodeEnum.VALIDATION_ERROR));
  },
}).fields([{ name: "card", maxCount: 1 }]);

export const activationPhotosUpload = (req: Request, res: Response, next: NextFunction) => {
  activationPhotos(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError || err instanceof AppError) return next(err);
    return next(new BadRequestException(tr("upload.invalid"), ErrorCodeEnum.VALIDATION_ERROR));
  });
};
