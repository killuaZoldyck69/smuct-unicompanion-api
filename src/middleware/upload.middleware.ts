import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_PROFILE_IMAGE_SIZE,
} from "../modules/upload/upload.service";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 6,
  },
});

export const singleUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const profileMulter = multer({
  storage,
  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE, // 3MB strict avatar cap
    files: 1,
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

export const profileImageUpload = profileMulter.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

export const normalizeSingleFile = (
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
