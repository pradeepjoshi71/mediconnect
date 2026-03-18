const path = require("path");
const fs = require("fs");
const multer = require("multer");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createUploadMiddleware() {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
  ensureDir(uploadsDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}-${file.originalname}`.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );
      cb(null, safe);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
  });
}

module.exports = { createUploadMiddleware };

