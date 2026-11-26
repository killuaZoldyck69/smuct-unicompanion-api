import { AppError } from "../../utils/AppError";

export function isSafeHubHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

type AttachmentReference = {
  url?: string | null;
};

export function isCloudinaryUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "cloudinary.com" || hostname.endsWith(".cloudinary.com");
  } catch {
    return false;
  }
}

export function assertNoNewCloudinaryAttachments(
  attachments: AttachmentReference[] | null | undefined,
  previouslyStored: AttachmentReference[] | null | undefined = [],
): void {
  if (!Array.isArray(attachments)) return;

  const existingUrls = new Set(
    (Array.isArray(previouslyStored) ? previouslyStored : [])
      .map((attachment) => attachment?.url)
      .filter((url): url is string => typeof url === "string"),
  );

  if (
    attachments.some(
      (attachment) =>
        typeof attachment?.url === "string" &&
        isCloudinaryUrl(attachment.url) &&
        !existingUrls.has(attachment.url),
    )
  ) {
    throw new AppError(
      "New Course Hub files must be uploaded to Google Drive. Existing Cloudinary attachments can remain linked.",
      400,
    );
  }
}

export function assertNoNewCloudinaryUrl(
  url: string | null | undefined,
): void {
  if (typeof url === "string" && isCloudinaryUrl(url)) {
    throw new AppError(
      "New Course Hub files must be uploaded to Google Drive.",
      400,
    );
  }
}
