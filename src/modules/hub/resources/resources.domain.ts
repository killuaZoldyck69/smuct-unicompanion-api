/**
 * Course Hub Resources Domain Helpers & Bounds
 *
 * Enforces HTTP(S)-only resource URL validation, payload limits,
 * bounded list sizing, and the approved Resource Deletion Matrix.
 */

export const MAX_RESOURCE_TITLE_LENGTH = 200;
export const MAX_RESOURCE_DESCRIPTION_LENGTH = 2000;
export const MAX_RESOURCE_CATEGORY_LENGTH = 60;
export const MAX_RESOURCE_FILE_TYPE_LENGTH = 60;
export const MAX_RESOURCE_LINK_TITLE_LENGTH = 200;
export const MAX_RESOURCE_ATTACHMENTS = 10;
export const MAX_RESOURCE_LINKS = 10;
export const MAX_HUB_RESOURCES_LIST = 200;

/**
 * Validates that a resource URL uses strictly http: or https: and parses cleanly.
 */
export function isSafeResourceHttpUrl(raw?: string | null): boolean {
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

/**
 * Resource Deletion Matrix (Option A):
 * - TEACHER: can delete any resource (official or student-shared)
 * - CR: can delete their own official materials AND any student-shared resource,
 *       but cannot delete official materials uploaded by teachers or other CRs
 * - STUDENT: can delete only their own student-shared resources
 * - ADMIN / other roles: strictly read-only (false)
 */
export function canRoleDeleteResource(params: {
  role: string;
  userId: string;
  uploaderId: string;
  isStudentNote: boolean;
}): boolean {
  const { role, userId, uploaderId, isStudentNote } = params;
  const isUploader = Boolean(userId && uploaderId && userId === uploaderId);

  if (role === "TEACHER") {
    return true;
  }
  if (role === "CR") {
    return isStudentNote || isUploader;
  }
  if (role === "STUDENT") {
    return isStudentNote && isUploader;
  }
  return false;
}
