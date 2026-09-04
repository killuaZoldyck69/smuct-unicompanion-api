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
  folder: string = "unicompanion",
  filename?: string
): Promise<UploadResult> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        public_id: filename ? filename.replace(/\.[^/.]+$/, "") : undefined,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
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
  folder: string = "unicompanion"
): Promise<UploadResult> {
  ensureConfigured();

  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
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

export default cloudinary;
