import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "..", "uploads");
const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_FILE_SIZE_MB || 15);
const maxUploadBytes = Number.isFinite(maxUploadSizeMb) && maxUploadSizeMb > 0
  ? Math.round(maxUploadSizeMb * 1024 * 1024)
  : 15 * 1024 * 1024;

const ensureDir = (folderPath) => {
  fs.mkdirSync(folderPath, { recursive: true });
};

const buildStorage = (subFolder) => {
  const targetDir = path.join(uploadsRoot, subFolder);
  ensureDir(targetDir);

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  });
};

const imageFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error("invalid image type. allowed: jpg, jpeg, png, webp"));
    return;
  }
  cb(null, true);
};

const createUploader = (subFolder) =>
  multer({
    storage: buildStorage(subFolder),
    fileFilter: imageFilter,
    limits: {
      fileSize: maxUploadBytes,
    },
  });

const withUploadError = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: `image is too large. max allowed size is ${maxUploadSizeMb}MB`,
      });
    }
    return res.status(400).json({ message: error.message || "file upload failed" });
  });
};

export const uploadCompetitorImage = withUploadError(createUploader("competitors").single("image"));
export const uploadPollImage = withUploadError(createUploader("polls").single("image"));
