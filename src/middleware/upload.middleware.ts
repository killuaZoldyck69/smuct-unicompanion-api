import { Request, Response, NextFunction } from "express";
import multer from "multer";

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
