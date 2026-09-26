import { AppError } from "../../utils/AppError";
import {
  uploadBufferToCloudinary,
  uploadBase64ToCloudinary,
  UploadResult,
  PROJECT_ROOT_FOLDER,
} from "../../lib/cloudinary";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function validateImageFile(file: MulterFile): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed types are JPEG, PNG, WEBP, GIF, and HEIC.`,
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(
      `File size exceeds limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed is 10MB.`,
      400
    );
  }
}

export async function uploadSingleImageService(
  file?: MulterFile,
  base64?: string,
  folder: string = PROJECT_ROOT_FOLDER
): Promise<UploadResult> {
  if (file) {
    validateImageFile(file);
    return uploadBufferToCloudinary(file.buffer, folder, file.originalname);
  }

  if (base64) {
    return uploadBase64ToCloudinary(base64, folder);
  }

  throw new AppError("No image file or base64 payload provided", 400);
}

export async function uploadMultipleImagesService(
  files: MulterFile[] = [],
  base64List: string[] = [],
  folder: string = PROJECT_ROOT_FOLDER
): Promise<UploadResult[]> {
  const uploadPromises: Promise<UploadResult>[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      validateImageFile(file);
      uploadPromises.push(
        uploadBufferToCloudinary(file.buffer, folder, file.originalname)
      );
    }
  }

  if (base64List && base64List.length > 0) {
    for (const b64 of base64List) {
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

export function validateGenericFile(file: MulterFile): void {
  const mime = file.mimetype.toLowerCase();
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  const allowedExtensions = new Set([
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "zip", "rar",
    "jpg", "jpeg", "png", "webp", "gif", "heic"
  ]);

  if (!ALLOWED_FILE_MIME_TYPES.has(mime) && (!ext || !allowedExtensions.has(ext))) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed types include PDF, Word, PowerPoint, Excel, text, zip, and images.`,
      400
    );
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new AppError(
      `File size exceeds limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed is 25MB.`,
      400
    );
  }
}

export async function uploadSingleFileService(
  file?: MulterFile,
  folder: string = PROJECT_ROOT_FOLDER
): Promise<UploadResult & { originalName: string; size: number; mimeType: string }> {
  if (!file) {
    throw new AppError("No file provided", 400);
  }

  validateGenericFile(file);
  const isImage = ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase());
  const res = await uploadBufferToCloudinary(
    file.buffer,
    folder,
    file.originalname,
    isImage ? "image" : "auto"
  );

  return {
    ...res,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
}

export async function uploadMultipleFilesService(
  files: MulterFile[] = [],
  folder: string = PROJECT_ROOT_FOLDER
): Promise<(UploadResult & { originalName: string; size: number; mimeType: string })[]> {
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
      isImage ? "image" : "auto"
    );
    return {
      ...res,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  });

  return Promise.all(uploadPromises);
}
