import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import {
  uploadSingleImageService,
  uploadMultipleImagesService,
  MulterFile,
} from "./upload.service";
import { PROJECT_ROOT_FOLDER } from "../../lib/cloudinary";

export const uploadSingleImage = catchAsync(
  async (req: Request, res: Response) => {
    const file = req.file as unknown as MulterFile | undefined;
    const base64 = req.body?.image as string | undefined;
    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;

    const result = await uploadSingleImageService(file, base64, folder);

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: result,
    });
  }
);

export const uploadMultipleImages = catchAsync(
  async (req: Request, res: Response) => {
    let files: MulterFile[] = [];

    if (Array.isArray(req.files)) {
      files = req.files as unknown as MulterFile[];
    } else if (req.files && typeof req.files === "object") {
      files = Object.values(req.files).flat() as unknown as MulterFile[];
    }

    const base64List = Array.isArray(req.body?.images)
      ? (req.body.images as string[])
      : [];

    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;

    const results = await uploadMultipleImagesService(files, base64List, folder);

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: results,
    });
  }
);
