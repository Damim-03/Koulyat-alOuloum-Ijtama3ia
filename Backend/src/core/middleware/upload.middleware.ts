import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";

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
    const ext = ALLOWED_TYPES[file.mimetype] ?? ".bin";
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
    cb(new Error("نوع الملفّ غير مدعوم (PNG/JPG/WEBP فقط)"));
  },
});

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
