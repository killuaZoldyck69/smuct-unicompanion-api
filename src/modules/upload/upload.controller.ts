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

export const uploadSingleFile = catchAsync(
  async (req: Request, res: Response) => {
    const file = req.file as unknown as MulterFile | undefined;
    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;

    const { uploadSingleFileService } = await import("./upload.service");
    const result = await uploadSingleFileService(file, folder);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: result,
    });
  }
);

export const uploadMultipleFiles = catchAsync(
  async (req: Request, res: Response) => {
    let files: MulterFile[] = [];

    if (Array.isArray(req.files)) {
      files = req.files as unknown as MulterFile[];
    } else if (req.files && typeof req.files === "object") {
      files = Object.values(req.files).flat() as unknown as MulterFile[];
    }

    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;

    const { uploadMultipleFilesService } = await import("./upload.service");
    const results = await uploadMultipleFilesService(files, folder);

    res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      data: results,
    });
  }
);

export const deleteUploadedFile = catchAsync(
  async (req: Request, res: Response) => {
    const url = (req.body?.url || req.query?.url) as string | undefined;
    const resourceType = (req.body?.resourceType as "image" | "raw" | "video") || "image";

    if (!url) {
      const { AppError } = await import("../../utils/AppError");
      throw new AppError("File URL or public ID is required", 400);
    }

    const { extractPublicIdFromUrl, PROJECT_ROOT_FOLDER, deleteFileFromCloudinary } = await import("../../lib/cloudinary");
    const { AppError } = await import("../../utils/AppError");

    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      throw new AppError("Invalid file identifier or URL provided", 400);
    }

    // Security check: Must reside within the smuct-unicompanion project root namespace
    if (!publicId.startsWith(PROJECT_ROOT_FOLDER)) {
      throw new AppError("Forbidden: Cannot delete resources outside of application namespace", 403);
    }

    // Non-admin authorization restrictions
    const user = (req as any).user;
    if (user?.role !== "ADMIN") {
      const protectedAdminFolders = [
        `${PROJECT_ROOT_FOLDER}/notices`,
        `${PROJECT_ROOT_FOLDER}/calendars`,
        `${PROJECT_ROOT_FOLDER}/buses`,
      ];
      const isProtected = protectedAdminFolders.some((f) => publicId.startsWith(f));
      if (isProtected) {
        throw new AppError("Forbidden: Only administrators can delete institutional assets", 403);
      }
    }

    const success = await deleteFileFromCloudinary(url, resourceType);

    res.status(200).json({
      success: true,
      message: success ? "File deleted from Cloudinary successfully" : "File not found or already deleted",
      data: { success },
    });
  }
);
