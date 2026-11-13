import { AppError } from "../../utils/AppError";
import {
  uploadBufferToCloudinary,
  uploadBase64ToCloudinary,
  UploadResult,
  PROJECT_ROOT_FOLDER,
} from "../../lib/cloudinary";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const ALLOWED_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB standard max image size
export const MAX_PROFILE_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function hasValidImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  // GIF87a / GIF89a: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return true;
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  // HEIC / HEIF / AVIF ISO-BMFF container: ....ftyp
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    return true;
  }

  return false;
}

export function validateImageFile(
  file: MulterFile,
  maxSizeBytes: number = MAX_FILE_SIZE,
): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed types are JPEG, PNG, WEBP, GIF, and HEIC.`,
      400,
    );
  }

  if (file.size > maxSizeBytes) {
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new AppError(
      `File "${file.originalname}" exceeds the ${limitMb}MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose an image under ${limitMb}MB.`,
      400,
    );
  }

  if (!hasValidImageMagicBytes(file.buffer)) {
    throw new AppError(
      `Invalid or corrupted image file "${file.originalname}".`,
      400,
    );
  }
}

export async function uploadSingleImageService(
  file?: MulterFile,
  base64?: string,
  folder: string = PROJECT_ROOT_FOLDER,
  isAdmin: boolean = false,
): Promise<UploadResult> {
  assertUploadFolderIsEnabled(folder, isAdmin);
  const isProfile = folder.toLowerCase().includes("profile");
  const maxLimit = isProfile ? MAX_PROFILE_IMAGE_SIZE : MAX_FILE_SIZE;

  if (file) {
    validateImageFile(file, maxLimit);
    return uploadBufferToCloudinary(file.buffer, folder, file.originalname);
  }

  if (base64) {
    const rawBase64 = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const approxSizeBytes = Math.ceil((rawBase64.length * 3) / 4);
    if (approxSizeBytes > maxLimit) {
      const limitMb = (maxLimit / (1024 * 1024)).toFixed(0);
      throw new AppError(
        `Payload size exceeds limit. Max allowed for this image is ${limitMb}MB.`,
        400,
      );
    }
    const decodedHeader = Buffer.from(rawBase64.slice(0, 32), "base64");
    if (!hasValidImageMagicBytes(decodedHeader)) {
      throw new AppError("Invalid or unsupported base64 image payload.", 400);
    }
    return uploadBase64ToCloudinary(base64, folder);
  }

  throw new AppError("No image file or base64 payload provided", 400);
}

export async function uploadMultipleImagesService(
  files: MulterFile[] = [],
  base64List: string[] = [],
  folder: string = PROJECT_ROOT_FOLDER,
  isAdmin: boolean = false,
): Promise<UploadResult[]> {
  assertUploadFolderIsEnabled(folder, isAdmin);
  const isLostFound = folder.toLowerCase().includes("lost-found");
  const isMarketplace = folder.toLowerCase().includes("marketplace");
  const totalCount = (files?.length || 0) + (base64List?.length || 0);

  if (isLostFound && totalCount > 2) {
    throw new AppError(
      "A maximum of 2 photos can be uploaded for Lost & Found items.",
      400,
    );
  }

  if (isMarketplace && totalCount > 4) {
    throw new AppError(
      "A maximum of 4 photos can be uploaded for marketplace listings.",
      400,
    );
  }

  const uploadPromises: Promise<UploadResult>[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      validateImageFile(file, MAX_FILE_SIZE);
      uploadPromises.push(
        uploadBufferToCloudinary(file.buffer, folder, file.originalname),
      );
    }
  }

  if (base64List && base64List.length > 0) {
    for (const b64 of base64List) {
      const rawBase64 = b64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      const approxSizeBytes = Math.ceil((rawBase64.length * 3) / 4);
      if (approxSizeBytes > MAX_FILE_SIZE) {
        throw new AppError("One or more images exceed the 5MB limit.", 400);
      }
      const decodedHeader = Buffer.from(rawBase64.slice(0, 32), "base64");
      if (!hasValidImageMagicBytes(decodedHeader)) {
        throw new AppError(
          "One or more base64 payloads are not valid images.",
          400,
        );
      }
      uploadPromises.push(uploadBase64ToCloudinary(b64, folder));
    }
  }

  if (uploadPromises.length === 0) {
    throw new AppError("No image files provided for upload", 400);
  }

  return await Promise.all(uploadPromises);
}

const ALLOWED_FILE_MIME_TYPES = new Set([
  ...ALLOWED_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const USER_ALLOWED_UPLOAD_FOLDERS = new Set([
  "lost-found",
  "campus-hub/lost-found",
  "lost-found-proofs",
  "claims",
  "marketplace",
  "campus-hub/marketplace",
  "memes",
  "campus-hub/memes",
  "forum",
  "campus-hub/forum",
  "profiles",
  "smuct-unicompanion/campus-hub/lost-found",
  "smuct-unicompanion/campus-hub/lost-found/claims",
  "smuct-unicompanion/campus-hub/marketplace",
  "smuct-unicompanion/campus-hub/memes",
  "smuct-unicompanion/campus-hub/forum",
  "smuct-unicompanion/profiles",
]);

function assertUploadFolderIsEnabled(
  folder: string,
  isAdmin: boolean = false,
): void {
  const cleaned = (folder || "").trim().replace(/^\/+|\/+$/g, "");
  if (cleaned.includes("..")) {
    throw new AppError("Invalid upload folder path.", 400);
  }
  if (cleaned.split(/[\\/]/).some((part) => part.toLowerCase() === "hubs")) {
    throw new AppError(
      "Course Hub files must be uploaded to Google Drive.",
      403,
    );
  }
  if (!isAdmin) {
    const normalized = cleaned.toLowerCase();
    if (!USER_ALLOWED_UPLOAD_FOLDERS.has(normalized)) {
      throw new AppError(
        "Forbidden: You do not have permission to upload to the specified folder.",
        403,
      );
    }
  }
}

export function validateGenericFile(file: MulterFile): void {
  const mime = file.mimetype.toLowerCase();
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  const allowedExtensions = new Set([
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "txt",
    "zip",
    "rar",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "heic",
  ]);

  if (
    !ALLOWED_FILE_MIME_TYPES.has(mime) &&
    (!ext || !allowedExtensions.has(ext))
  ) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed types include PDF, Word, PowerPoint, Excel, text, zip, and images.`,
      400,
    );
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new AppError(
      `File size exceeds limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed is 25MB.`,
      400,
    );
  }
}

export async function uploadSingleFileService(
  file?: MulterFile,
  folder: string = PROJECT_ROOT_FOLDER,
  isAdmin: boolean = false,
): Promise<
  UploadResult & {
    originalName: string;
    size: number;
    mimeType: string;
    format?: string;
  }
> {
  assertUploadFolderIsEnabled(folder, isAdmin);
  if (!file) {
    throw new AppError("No file provided", 400);
  }

  validateGenericFile(file);
  const isImage = ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase());
  const res = await uploadBufferToCloudinary(
    file.buffer,
    folder,
    file.originalname,
    isImage ? "image" : "auto",
  );

  return {
    ...res,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    format: res.format || file.originalname.split(".").pop()?.toLowerCase(),
  };
}

export async function uploadMultipleFilesService(
  files: MulterFile[] = [],
  folder: string = PROJECT_ROOT_FOLDER,
  isAdmin: boolean = false,
): Promise<
  (UploadResult & {
    originalName: string;
    size: number;
    mimeType: string;
    format?: string;
  })[]
> {
  assertUploadFolderIsEnabled(folder, isAdmin);
  if (!files || files.length === 0) {
    throw new AppError("No files provided for upload", 400);
  }

  const uploadPromises = files.map(async (file) => {
    validateGenericFile(file);
    const isImage = ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase());
    const res = await uploadBufferToCloudinary(
      file.buffer,
      folder,
      file.originalname,
      isImage ? "image" : "auto",
    );
    return {
      ...res,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      format: res.format || file.originalname.split(".").pop()?.toLowerCase(),
    };
  });

  return Promise.all(uploadPromises);
}
