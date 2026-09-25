import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { envConfig } from "../config/env";
import { AppError } from "../utils/AppError";

cloudinary.config({
  cloud_name: envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  secureUrl: string;
  publicId: string;
}

function ensureConfigured(): void {
  const cloudName = envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret = envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      "Cloudinary is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend .env",
      500
    );
  }
}

export const PROJECT_ROOT_FOLDER = "smuct-unicompanion";

/**
 * Normalizes any folder name into the organized smuct-unicompanion feature-based hierarchy.
 * e.g. "memes" -> "smuct-unicompanion/campus-hub/memes"
 *      "lost-found" -> "smuct-unicompanion/campus-hub/lost-found"
 */
export function resolveCloudinaryFolder(folder?: string): string {
  if (!folder || !folder.trim() || folder.trim() === "unicompanion") {
    return PROJECT_ROOT_FOLDER;
  }

  const cleaned = folder.trim().replace(/^\/+|\/+$/g, "");
  if (cleaned.startsWith(PROJECT_ROOT_FOLDER)) {
    return cleaned;
  }

  const FEATURE_MAP: Record<string, string> = {
    memes: `${PROJECT_ROOT_FOLDER}/campus-hub/memes`,
    "campus-hub/memes": `${PROJECT_ROOT_FOLDER}/campus-hub/memes`,
    "lost-found": `${PROJECT_ROOT_FOLDER}/campus-hub/lost-found`,
    "campus-hub/lost-found": `${PROJECT_ROOT_FOLDER}/campus-hub/lost-found`,
    "lost-found-proofs": `${PROJECT_ROOT_FOLDER}/campus-hub/lost-found/claims`,
    claims: `${PROJECT_ROOT_FOLDER}/campus-hub/lost-found/claims`,
    marketplace: `${PROJECT_ROOT_FOLDER}/campus-hub/marketplace`,
    "campus-hub/marketplace": `${PROJECT_ROOT_FOLDER}/campus-hub/marketplace`,
    forum: `${PROJECT_ROOT_FOLDER}/campus-hub/forum`,
    "campus-hub/forum": `${PROJECT_ROOT_FOLDER}/campus-hub/forum`,
    profiles: `${PROJECT_ROOT_FOLDER}/profiles`,
    notices: `${PROJECT_ROOT_FOLDER}/notices`,
    blood: `${PROJECT_ROOT_FOLDER}/blood`,
    hubs: `${PROJECT_ROOT_FOLDER}/hubs`,
  };

  const lookupKey = cleaned.toLowerCase();
  if (FEATURE_MAP[lookupKey]) {
    return FEATURE_MAP[lookupKey];
  }

  if (cleaned.startsWith("campus-hub/")) {
    return `${PROJECT_ROOT_FOLDER}/${cleaned}`;
  }

  return `${PROJECT_ROOT_FOLDER}/${cleaned}`;
}

/**
 * Builds an optimized delivery URL using Cloudinary transformations (q_auto, f_auto, w_1000, c_limit)
 */
export function buildOptimizedUrl(publicId: string, cloudName?: string): string {
  const cName =
    cloudName ||
    envConfig.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    "";
  return `https://res.cloudinary.com/${cName}/image/upload/q_auto,f_auto,w_1000,c_limit/${publicId}`;
}

/**
 * Uploads a file buffer directly to Cloudinary using upload_stream
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = PROJECT_ROOT_FOLDER,
  filename?: string
): Promise<UploadResult> {
  ensureConfigured();

  const targetFolder = resolveCloudinaryFolder(folder);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: "image",
        transformation: [
          { width: 1080, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      },
      (error?: any, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            new AppError(
              `Cloudinary upload error: ${error?.message || "Unknown error"}`,
              502
            )
          );
        }

        resolve({
          secureUrl: buildOptimizedUrl(result.public_id),
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Uploads a Base64 or DataURI string to Cloudinary
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string = PROJECT_ROOT_FOLDER
): Promise<UploadResult> {
  ensureConfigured();

  const targetFolder = resolveCloudinaryFolder(folder);

  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: targetFolder,
      resource_type: "image",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    return {
      secureUrl: buildOptimizedUrl(result.public_id),
      publicId: result.public_id,
    };
  } catch (error: any) {
    throw new AppError(
      `Cloudinary upload error: ${error?.message || "Upload failed"}`,
      502
    );
  }
}

/**
 * Extracts publicId from a Cloudinary URL or direct publicId string
 */
export function extractPublicIdFromUrl(urlOrPublicId: string): string | null {
  if (!urlOrPublicId || typeof urlOrPublicId !== "string") {
    return null;
  }

  const trimmed = urlOrPublicId.trim();
  if (!trimmed) return null;

  // If not a URL, treat directly as public_id (strip extension if present)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.replace(/\.[a-zA-Z0-9]+$/, "");
  }

  // If external URL (e.g. Google auth avatar, external link), ignore
  if (!trimmed.includes("cloudinary.com") && !trimmed.includes("/image/upload/")) {
    return null;
  }

  try {
    const uploadIndex = trimmed.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    // Substring after "/upload/"
    const pathAfterUpload = trimmed.substring(uploadIndex + "/upload/".length);
    const parts = pathAfterUpload.split("/");

    const isVersion = (part: string) => /^v\d+$/.test(part);
    const isTransformation = (part: string) => {
      if (part.includes(",")) return true;
      return /^[a-z]{1,4}_[a-zA-Z0-9_]+$/.test(part);
    };

    let startIndex = 0;
    while (startIndex < parts.length) {
      const part = parts[startIndex];
      if (isVersion(part) || isTransformation(part)) {
        startIndex++;
      } else {
        break;
      }
    }

    if (startIndex >= parts.length) {
      return null;
    }

    let publicIdWithExt = parts.slice(startIndex).join("/");
    publicIdWithExt = publicIdWithExt.split("?")[0].split("#")[0];
    const publicId = publicIdWithExt.replace(/\.[a-zA-Z0-9]+$/, "");

    return publicId || null;
  } catch {
    return null;
  }
}

/**
 * Deletes a single image from Cloudinary storage by URL or publicId.
 * Safe & non-blocking: returns true/false without throwing errors.
 */
export async function deleteImageFromCloudinary(
  urlOrPublicId: string
): Promise<boolean> {
  const publicId = extractPublicIdFromUrl(urlOrPublicId);
  if (!publicId) return false;

  const cloudName = envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret = envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn("[Cloudinary] Missing credentials. Skipping image deletion for:", publicId);
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });
    return result.result === "ok" || result.result === "not found";
  } catch (error) {
    console.warn(`[Cloudinary] Failed to delete image (${publicId}):`, error);
    return false;
  }
}

/**
 * Deletes multiple images from Cloudinary storage in parallel.
 */
export async function deleteMultipleImagesFromCloudinary(
  urlsOrPublicIds: (string | null | undefined)[]
): Promise<void> {
  if (!Array.isArray(urlsOrPublicIds) || urlsOrPublicIds.length === 0) return;

  const valid = urlsOrPublicIds.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  if (valid.length === 0) return;

  await Promise.allSettled(valid.map((item) => deleteImageFromCloudinary(item)));
}

export default cloudinary;
