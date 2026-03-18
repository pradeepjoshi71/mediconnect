const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { AppError } = require("./http");

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createUploadMiddleware() {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
  ensureDir(uploadsDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 12);
      const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      cb(null, `${base}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "_"));
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024),
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
        cb(new AppError(400, "Unsupported file type"));
        return;
      }
      cb(null, true);
    },
  });
}

module.exports = { createUploadMiddleware };
