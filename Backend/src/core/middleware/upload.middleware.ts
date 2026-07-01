import multer from "multer";
import path from "path";
import fs from "fs";

// Local-disk storage. To switch to S3/Cloudinary later, replace this storage
// engine only — the controller/routes stay the same.
const uploadDir = path.join(process.cwd(), "uploads", "cards");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export const cardUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملفّ غير مدعوم (PNG/JPG/WEBP/SVG فقط)"));
  },
});
