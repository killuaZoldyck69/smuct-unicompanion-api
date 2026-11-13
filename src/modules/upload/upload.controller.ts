import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import {
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
  PROJECT_ROOT_FOLDER,
} from "../../lib/cloudinary";
import {
  uploadSingleImageService,
  uploadMultipleImagesService,
  MulterFile,
} from "./upload.service";

export const uploadSingleImage = catchAsync(
  async (req: Request, res: Response) => {
    const file = req.file as unknown as MulterFile | undefined;
    const base64 = req.body?.image as string | undefined;
    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;
    const isAdmin = req.user?.role === "ADMIN";

    const result = await uploadSingleImageService(
      file,
      base64,
      folder,
      isAdmin,
    );

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: result,
    });
  },
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
    const isAdmin = req.user?.role === "ADMIN";

    const results = await uploadMultipleImagesService(
      files,
      base64List,
      folder,
      isAdmin,
    );

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: results,
    });
  },
);

export const uploadSingleFile = catchAsync(
  async (req: Request, res: Response) => {
    const file = req.file as unknown as MulterFile | undefined;
    const folder = (req.body?.folder as string) || PROJECT_ROOT_FOLDER;
    const isAdmin = req.user?.role === "ADMIN";

    const { uploadSingleFileService } = await import("./upload.service");
    const result = await uploadSingleFileService(file, folder, isAdmin);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: result,
    });
  },
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
    const isAdmin = req.user?.role === "ADMIN";

    const { uploadMultipleFilesService } = await import("./upload.service");
    const results = await uploadMultipleFilesService(files, folder, isAdmin);

    res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      data: results,
    });
  },
);

export const deleteUploadedFile = catchAsync(
  async (req: Request, res: Response) => {
    const url = (req.body?.url || req.query?.url) as string | undefined;
    const resourceType =
      (req.body?.resourceType as "image" | "raw" | "video") || "image";

    if (!url) {
      throw new AppError("File URL or public ID is required", 400);
    }

    const publicId = extractPublicIdFromUrl(url);
    if (!publicId || publicId.includes("..")) {
      throw new AppError("Invalid file identifier or URL provided", 400);
    }

    // Security check: Must reside within the smuct-unicompanion project root namespace
    if (!publicId.startsWith(PROJECT_ROOT_FOLDER)) {
      throw new AppError(
        "Forbidden: Cannot delete resources outside of application namespace",
        403,
      );
    }

    // Non-admin authorization & cross-user ownership guard (API-1)
    const user = req.user;
    if (user?.role !== "ADMIN") {
      const protectedAdminFolders = [
        `${PROJECT_ROOT_FOLDER}/notices`,
        `${PROJECT_ROOT_FOLDER}/calendars`,
        `${PROJECT_ROOT_FOLDER}/buses`,
        `${PROJECT_ROOT_FOLDER}/branding`,
        `${PROJECT_ROOT_FOLDER}/hubs`,
      ];
      if (protectedAdminFolders.some((folder) => publicId.startsWith(folder))) {
        throw new AppError(
          "Forbidden: Only administrators can delete institutional assets",
          403,
        );
      }

      const viewerId = user?.id ?? "";
      const isHttpsUrl =
        url.startsWith("https://") || url.startsWith("http://");
      const likePattern = `%${publicId.replace(/[\\%_]/g, "\\$&")}%`;

      const [
        otherLfPost,
        otherLfClaim,
        otherMeme,
        otherUser,
        arrayOwners,
        ownReferenced,
      ] = await Promise.all([
        prisma.lostFoundPost.findFirst({
          where: { authorId: { not: viewerId }, images: { has: url } },
          select: { id: true },
        }),
        prisma.lostFoundClaim.findFirst({
          where: {
            claimantId: { not: viewerId },
            ...(isHttpsUrl
              ? { proofImage: url }
              : { proofImage: { contains: publicId } }),
          },
          select: { id: true },
        }),
        prisma.meme.findFirst({
          where: {
            authorId: { not: viewerId },
            imageUrl: { contains: publicId },
          },
          select: { id: true },
        }),
        prisma.user.findFirst({
          where: {
            id: { not: viewerId },
            image: { contains: publicId },
          },
          select: { id: true },
        }),
        isHttpsUrl
          ? prisma.$queryRaw<Array<{ owned_by_other: boolean }>>`
              SELECT (
                EXISTS (
                  SELECT 1 FROM "lost_found_post"
                  WHERE "authorId" <> ${viewerId}
                    AND "images" @> ARRAY[${url}]::text[]
                )
                OR EXISTS (
                  SELECT 1 FROM "marketplace_post"
                  WHERE "authorId" <> ${viewerId}
                    AND "images" @> ARRAY[${url}]::text[]
                )
              ) AS owned_by_other
            `
          : prisma.$queryRaw<Array<{ owned_by_other: boolean }>>`
              SELECT (
                EXISTS (
                  SELECT 1 FROM "lost_found_post"
                  WHERE "authorId" <> ${viewerId}
                    AND array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
                )
                OR EXISTS (
                  SELECT 1 FROM "marketplace_post"
                  WHERE "authorId" <> ${viewerId}
                    AND array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
                )
              ) AS owned_by_other
            `,
        isHttpsUrl
          ? prisma.$queryRaw<Array<{ actively_referenced: boolean }>>`
              SELECT (
                EXISTS (
                  SELECT 1 FROM "lost_found_post"
                  WHERE "authorId" = ${viewerId}
                    AND "images" @> ARRAY[${url}]::text[]
                )
                OR EXISTS (
                  SELECT 1 FROM "lost_found_claim"
                  WHERE "claimantId" = ${viewerId}
                    AND "proofImage" = ${url}
                )
                OR EXISTS (
                  SELECT 1 FROM "marketplace_post"
                  WHERE "authorId" = ${viewerId}
                    AND "images" @> ARRAY[${url}]::text[]
                )
              ) AS actively_referenced
            `
          : prisma.$queryRaw<Array<{ actively_referenced: boolean }>>`
              SELECT (
                EXISTS (
                  SELECT 1 FROM "lost_found_post"
                  WHERE "authorId" = ${viewerId}
                    AND array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
                )
                OR EXISTS (
                  SELECT 1 FROM "lost_found_claim"
                  WHERE "claimantId" = ${viewerId}
                    AND "proofImage" LIKE ${likePattern} ESCAPE '\\'
                )
                OR EXISTS (
                  SELECT 1 FROM "marketplace_post"
                  WHERE "authorId" = ${viewerId}
                    AND array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
                )
              ) AS actively_referenced
            `,
      ]);

      if (
        otherLfPost ||
        otherLfClaim ||
        otherMeme ||
        otherUser ||
        arrayOwners[0]?.owned_by_other
      ) {
        throw new AppError(
          "Forbidden: You cannot delete media belonging to another user",
          403,
        );
      }

      if (ownReferenced[0]?.actively_referenced) {
        throw new AppError(
          "Conflict: Remove the image from the listing or claim before deleting it.",
          409,
        );
      }
    }

    const success = await deleteFileFromCloudinary(url, resourceType);

    res.status(200).json({
      success: true,
      message: success
        ? "File deleted from Cloudinary successfully"
        : "File not found or already deleted",
      data: { success },
    });
  },
);
