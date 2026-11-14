export const MEME_CLOUDINARY_PREFIX = "smuct-unicompanion/campus-hub/memes";
export const MAX_MEME_CAPTION_LENGTH = 280;
export const MAX_MEME_FEED_LIMIT = 50;

export type MemeFilter = "latest" | "popular" | "mine";

export interface MemeViewerContext {
  userId: string;
  role?: string;
  reportedMemeIds: ReadonlySet<string>;
}

/**
 * Strips executable blocks and HTML tags from meme captions while preserving
 * single/double line breaks so captions render safely as plain text.
 */
export function sanitizeMemeCaption(caption?: string | null): string | null {
  if (typeof caption !== "string") return null;

  const cleaned = caption
    .replace(/\r\n?/g, "\n")
    .replace(/<(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

export function computeMemePopularityScore(
  likesCount: number,
  dislikesCount: number,
): number {
  return likesCount * 2 - dislikesCount;
}

export function isMemeVisibleToViewer(
  meme: {
    id: string;
    authorId: string;
    isHiddenByModeration?: boolean;
  },
  viewer: MemeViewerContext,
  options?: { includeOwnHidden?: boolean },
): boolean {
  const isAdmin = viewer.role === "ADMIN";
  if (!isAdmin && viewer.reportedMemeIds.has(meme.id)) {
    return false;
  }

  const isOwnMeme = Boolean(viewer.userId) && meme.authorId === viewer.userId;
  if (
    meme.isHiddenByModeration &&
    !isAdmin &&
    !(options?.includeOwnHidden && isOwnMeme)
  ) {
    return false;
  }

  return true;
}

/**
 * Fires only when crossing upward onto a positive multiple of `step` (default 5),
 * avoiding duplicate alerts when toggling reactions back off.
 */
export function shouldDispatchMemeMilestoneNotification(
  previousCount: number,
  nextCount: number,
  step: number = 5,
): boolean {
  return nextCount > previousCount && nextCount > 0 && nextCount % step === 0;
}
