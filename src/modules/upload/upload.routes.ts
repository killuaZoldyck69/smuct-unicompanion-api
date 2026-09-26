import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleFile,
  uploadMultipleFiles,
} from "./upload.controller";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 6,
  },
});

const singleUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const normalizeSingleFile = (
  req: Request,
  _res: Response,
  next: NextFunction
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
  next: NextFunction
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
  singleUpload,
  normalizeSingleFile,
  uploadSingleImage
);

// POST /api/upload/images - Upload up to 6 images
router.post(
  "/images",
  requireAuth,
  multipleUpload,
  normalizeMultipleFiles,
  uploadMultipleImages
);

// POST /api/upload/file - Upload single file/document
router.post(
  "/file",
  requireAuth,
  singleUpload,
  normalizeSingleFile,
  uploadSingleFile
);

// POST /api/upload/files - Upload up to 6 files/documents
router.post(
  "/files",
  requireAuth,
  multipleUpload,
  normalizeMultipleFiles,
  uploadMultipleFiles
);

export const uploadRoutes = router;
