import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import { AppError } from "../../utils/AppError";
import { ALLOWED_IMAGE_MIME_TYPES } from "./upload.service";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleFile,
  uploadMultipleFiles,
  deleteUploadedFile,
} from "./upload.controller";

const storage = multer.memoryStorage();

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: createUserKeyGenerator("upload-media"),
  message: {
    success: false,
    message: "Too many file upload requests. Please wait a few minutes.",
  },
});

// Tightly bounded in-memory limits for image endpoints (max 4 x 5MB = 20MB per request)
const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 4,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(
        new AppError(
          `Unsupported file type: ${file.mimetype}. Allowed types are JPEG, PNG, WEBP, GIF, and HEIC.`,
          400,
        ),
      );
      return;
    }
    cb(null, true);
  },
});

// Document/generic file endpoints keep higher cap with tighter file count
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 6,
  },
});

const singleImageUpload = imageUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const multipleImageUpload = imageUpload.fields([
  { name: "images", maxCount: 4 },
]);

const singleUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const normalizeSingleFile = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (files) {
    if (files["image"] && files["image"][0]) {
      req.file = files["image"][0];
    } else if (files["file"] && files["file"][0]) {
      req.file = files["file"][0];
    }
  }
  next();
};

const multipleUpload = upload.fields([
  { name: "images", maxCount: 6 },
  { name: "files", maxCount: 6 },
]);

const normalizeMultipleFiles = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (files) {
    (req as any).files = [
      ...(files["images"] || []),
      ...(files["files"] || []),
    ];
  }
  next();
};

const router = Router();

// POST /api/upload/image - Upload single image
router.post(
  "/image",
  requireAuth,
  uploadRateLimiter,
  singleImageUpload,
  normalizeSingleFile,
  uploadSingleImage,
);

// POST /api/upload/images - Upload up to 4 images
router.post(
  "/images",
  requireAuth,
  uploadRateLimiter,
  multipleImageUpload,
  normalizeMultipleFiles,
  uploadMultipleImages,
);

// POST /api/upload/file - Upload single file/document
router.post(
  "/file",
  requireAuth,
  uploadRateLimiter,
  singleUpload,
  normalizeSingleFile,
  uploadSingleFile,
);

// POST /api/upload/files - Upload up to 6 files/documents
router.post(
  "/files",
  requireAuth,
  uploadRateLimiter,
  multipleUpload,
  normalizeMultipleFiles,
  uploadMultipleFiles,
);

// POST /api/upload/delete - Delete file/document or image from Cloudinary
router.post("/delete", requireAuth, uploadRateLimiter, deleteUploadedFile);

export const uploadRoutes = router;
