/**
 * Forum Pure Domain Helpers, Canonical Non-PII Author Projections,
 * Reaction State Helpers, and UGC Visibility/Moderation Rules
 */

export const UGC_AUTO_HIDE_REPORT_THRESHOLD = 3;

export type ReactionType = "LIKE" | "DISLIKE";

export interface ReactionSummary {
  likesCount: number;
  dislikesCount: number;
  userReaction: ReactionType | null;
}

export const safeStudentProfileSelect = {
  select: {
    department: true,
    program: true,
    batch: true,
    currentSemester: true,
    section: true,
    isCR: true,
    skills: true,
    linkedInUrl: true,
    personalWebsiteUrl: true,
  },
} as const;

export const safeTeacherProfileSelect = {
  select: {
    designation: true,
    department: true,
    faculty: true,
    administrativeRole: true,
    officeRoom: true,
    advisoryBatch: true,
    dayOff: true,
    consultationSlots: true,
    expertiseFields: true,
    academicQualifications: true,
    linkedInUrl: true,
    personalWebsiteUrl: true,
  },
} as const;

/**
 * Canonical non-PII author projection reusable across Campus Hub features
 * (Forum, Lost & Found, Marketplace, Memes). Deliberately omits email,
 * studentId, teacherId, phoneNumber, and bloodGroup.
 */
export const publicUserSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
  studentProfile: safeStudentProfileSelect,
  teacherProfile: safeTeacherProfileSelect,
} as const;

/**
 * Minimal feed author projection to keep list payloads small on free-tier Postgres/Render.
 */
export const feedAuthorSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
  studentProfile: {
    select: {
      department: true,
      currentSemester: true,
      section: true,
    },
  },
  teacherProfile: {
    select: {
      department: true,
      designation: true,
    },
  },
} as const;

/**
 * Compute resulting reaction state & updated counts for optimistic/deterministic transitions.
 */
export function resolveNextReactionState(
  current: ReactionType | null,
  incoming: ReactionType,
  counts: { likesCount: number; dislikesCount: number },
): ReactionSummary {
  let likesCount = Math.max(0, counts.likesCount);
  let dislikesCount = Math.max(0, counts.dislikesCount);
  let userReaction: ReactionType | null;

  if (current === incoming) {
    if (incoming === "LIKE") likesCount = Math.max(0, likesCount - 1);
    else dislikesCount = Math.max(0, dislikesCount - 1);
    userReaction = null;
  } else {
    if (current === "LIKE") likesCount = Math.max(0, likesCount - 1);
    if (current === "DISLIKE") dislikesCount = Math.max(0, dislikesCount - 1);
    if (incoming === "LIKE") likesCount += 1;
    else dislikesCount += 1;
    userReaction = incoming;
  }

  return { likesCount, dislikesCount, userReaction };
}

/**
 * Determine whether a reported post or response has met the auto-hide threshold.
 */
export function shouldAutoHideByReportCount(
  uniquePendingCount: number,
  threshold: number = UGC_AUTO_HIDE_REPORT_THRESHOLD,
): boolean {
  return uniquePendingCount >= threshold;
}

/**
 * Filter reply notification recipients to exclude the replier themselves and deduplicate IDs.
 */
export function filterForumNotificationRecipients(
  candidateIds: Iterable<string>,
  responderId: string,
): string[] {
  const unique = new Set<string>();
  for (const id of candidateIds) {
    if (!id || id === responderId) continue;
    unique.add(id);
  }
  return [...unique];
}

export interface ViewerModerationContext {
  userId: string;
  role?: string;
  reportedPostIds: ReadonlySet<string>;
  reportedResponseIds: ReadonlySet<string>;
}

/**
 * Evaluate whether a forum post or response should be visible to the current viewer.
 */
export function isForumItemVisibleToViewer(
  item: {
    id: string;
    authorId?: string;
    isHiddenByModeration: boolean;
  },
  targetType: "FORUM_POST" | "FORUM_RESPONSE",
  viewer: ViewerModerationContext,
): boolean {
  const reportedSet =
    targetType === "FORUM_POST"
      ? viewer.reportedPostIds
      : viewer.reportedResponseIds;
  if (reportedSet.has(item.id)) {
    return false;
  }

  const isOwnModeratedPost =
    targetType === "FORUM_POST" &&
    Boolean(viewer.userId) &&
    item.authorId === viewer.userId;

  if (item.isHiddenByModeration && viewer.role !== "ADMIN" && !isOwnModeratedPost) {
    return false;
  }

  return true;
}

/**
 * Attach aggregated reaction counts & current user's active reaction onto
 * top-level responses and nested replies in O(N) without extra DB queries.
 */
export function attachReactionSummariesToResponses<
  T extends {
    id: string;
    replies?: Array<{ id: string } & Record<string, any>>;
  } & Record<string, any>,
>(
  responses: T[],
  countsByResponseId: ReadonlyMap<
    string,
    { likesCount: number; dislikesCount: number }
  >,
  userReactionByResponseId: ReadonlyMap<string, ReactionType>,
) {
  const decorate = <R extends { id: string }>(item: R) => {
    const counts = countsByResponseId.get(item.id) ?? {
      likesCount: 0,
      dislikesCount: 0,
    };
    return {
      ...item,
      likesCount: counts.likesCount,
      dislikesCount: counts.dislikesCount,
      userReaction: userReactionByResponseId.get(item.id) ?? null,
    };
  };

  return responses.map((response) => ({
    ...decorate(response),
    ...(Array.isArray(response.replies)
      ? { replies: response.replies.map(decorate) }
      : {}),
  }));
}
