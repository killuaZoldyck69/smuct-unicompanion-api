/**
 * Course Hub Assessments, Submissions & Grading Domain Helpers
 *
 * Pure domain validation, Option A ownership authorization, submission state
 * transitions, and aligned bounds shared across schemas, services, and tests.
 */

export const MAX_ASSESSMENT_TITLE_LENGTH = 200;
export const MAX_ASSESSMENT_DESCRIPTION_LENGTH = 5000;
export const MAX_ASSESSMENT_TOTAL_MARKS = 10000;
export const MAX_ASSESSMENT_ATTACHMENTS = 10;
export const MAX_ASSESSMENT_LINKS = 10;
export const MAX_SUBMISSION_ATTACHMENTS = 10;
export const MAX_SUBMISSION_LINKS = 10;
export const MAX_SUBMISSION_CONTENT_LENGTH = 5000;
export const MAX_GRADE_FEEDBACK_LENGTH = 2000;
export const MAX_LINK_TITLE_LENGTH = 200;
export const MAX_ATTACHMENT_NAME_LENGTH = 255;
export const MAX_ATTACHMENT_TYPE_LENGTH = 100;
export const MAX_BULK_GRADE_ENTRIES = 300;
export const MAX_HUB_ASSESSMENTS_LIST = 200;
export const MAX_ASSESSMENT_SUBMISSIONS_LIST = 500;

export const ASSESSMENT_STATUS_VALUES = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "CLOSED",
  "ARCHIVED",
] as const;

export const SUBMISSION_REQUEST_STATUS_VALUES = [
  "SUBMITTED",
  "HAND_SUBMISSION",
] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUS_VALUES)[number];
export type SubmissionRequestStatus =
  (typeof SUBMISSION_REQUEST_STATUS_VALUES)[number];

/**
 * Validates that a URL uses strictly http: or https:, has a hostname, and has no whitespace.
 */
export function isSafeAssessmentHttpUrl(raw?: string | null): boolean {
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
 * Option A Assessment Ownership Authorization:
 * - TEACHER: can edit or delete any assessment in the hub
 * - CR: can edit or delete only assessments they created (creatorId === userId)
 * - STUDENT / ADMIN / others: false
 */
export function canRoleManageAssessment(params: {
  role: string;
  userId: string;
  creatorId?: string | null;
}): boolean {
  const { role, userId, creatorId } = params;
  if (role === "TEACHER") {
    return true;
  }
  if (role === "CR") {
    return Boolean(userId && creatorId && userId === creatorId);
  }
  return false;
}

/**
 * Determines whether a submission has already been graded.
 */
export function isSubmissionGraded(
  sub?: { marks?: number | null; status?: string | null } | null,
): boolean {
  if (!sub) return false;
  return (
    (sub.marks !== null && sub.marks !== undefined) || sub.status === "GRADED"
  );
}

/**
 * Ensures startDate (when provided) is on or before deadline.
 */
export function validateAssessmentDateWindow(
  startDate?: Date | null,
  deadline?: Date | null,
): boolean {
  if (!startDate || !deadline) return true;
  return startDate.getTime() <= deadline.getTime();
}

export type SubmissionOutcome =
  | {
      ok: true;
      status: "SUBMITTED" | "LATE" | "HAND_SUBMISSION";
      isLate: boolean;
    }
  | {
      ok: false;
      message: string;
    };

/**
 * Resolves and enforces student submission state transitions server-side:
 * - Only PUBLISHED assessments accept submissions
 * - Graded submissions are immutable
 * - Deadline + allowLateSubmission policy enforced from server clock
 * - submissionType (ONLINE vs HAND) must match the requested submission mode
 */
export function resolveStudentSubmissionOutcome(params: {
  assessmentStatus: string;
  submissionType?: string | null;
  deadline: Date;
  allowLateSubmission: boolean;
  previousSubmission?: { marks?: number | null; status?: string | null } | null;
  requestedStatus?: string | null;
  now?: Date;
}): SubmissionOutcome {
  const {
    assessmentStatus,
    submissionType,
    deadline,
    allowLateSubmission,
    previousSubmission,
    requestedStatus,
    now = new Date(),
  } = params;

  if (assessmentStatus !== "PUBLISHED") {
    return {
      ok: false,
      message: "Submissions are only accepted for published assessments.",
    };
  }

  if (isSubmissionGraded(previousSubmission)) {
    return {
      ok: false,
      message:
        "This submission has already been graded and can no longer be modified.",
    };
  }

  const isPastDeadline = now.getTime() > deadline.getTime();
  if (isPastDeadline && !allowLateSubmission) {
    return {
      ok: false,
      message:
        "Deadline has passed and late submissions are not allowed for this assessment.",
    };
  }

  if (submissionType === "HAND") {
    if (requestedStatus && requestedStatus !== "HAND_SUBMISSION") {
      return {
        ok: false,
        message: "This assessment only accepts in-person (hand) submissions.",
      };
    }
    return {
      ok: true,
      status: "HAND_SUBMISSION",
      isLate: isPastDeadline,
    };
  }

  if (requestedStatus === "HAND_SUBMISSION") {
    return {
      ok: false,
      message: "Hand submission is not enabled for this online assessment.",
    };
  }

  return {
    ok: true,
    status: isPastDeadline ? "LATE" : "SUBMITTED",
    isLate: isPastDeadline,
  };
}
