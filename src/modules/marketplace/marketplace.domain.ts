import { ListingStatus, ListingType } from "../../constants/enums";
import { AppError } from "../../utils/AppError";
import { extractPlainText, sanitizeForumHtml } from "../forum/forum.sanitizer";

export function assertOwnership(
  isOwner: boolean,
  isAdmin: boolean,
  action: string,
): void {
  if (!isOwner && !isAdmin) {
    throw new AppError(
      `Forbidden: You do not have permission to ${action}.`,
      403,
    );
  }
}

export const MIN_MARKETPLACE_TITLE_LENGTH = 2;
export const MAX_MARKETPLACE_TITLE_LENGTH = 150;
export const MIN_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH = 5;
export const MAX_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH = 3000;
export const MAX_MARKETPLACE_DESCRIPTION_HTML_LENGTH = 12000;
export const MIN_MARKETPLACE_COMMENT_LENGTH = 1;
export const MAX_MARKETPLACE_COMMENT_LENGTH = 1000;
export const MAX_MARKETPLACE_IMAGES = 4;
export const MARKETPLACE_CLOUDINARY_PREFIX =
  "smuct-unicompanion/campus-hub/marketplace";

export interface MarketplaceViewerContext {
  userId: string;
  role?: string;
  reportedPostIds: ReadonlySet<string>;
  reportedCommentIds: ReadonlySet<string>;
}

export function validateAndSanitizeMarketplaceInput(input: {
  title?: string;
  description?: string;
}): {
  cleanTitle?: string;
  cleanDescription?: string;
  plainText?: string;
  error?: string;
} {
  let cleanTitle: string | undefined;
  if (input.title !== undefined) {
    cleanTitle = extractPlainText(input.title).replace(/\s+/g, " ").trim();
    if (cleanTitle.length < MIN_MARKETPLACE_TITLE_LENGTH) {
      return {
        error: `Title must be at least ${MIN_MARKETPLACE_TITLE_LENGTH} characters.`,
      };
    }
    if (cleanTitle.length > MAX_MARKETPLACE_TITLE_LENGTH) {
      return {
        error: `Title cannot exceed ${MAX_MARKETPLACE_TITLE_LENGTH} characters.`,
      };
    }
  }

  let cleanDescription: string | undefined;
  let plainText: string | undefined;
  if (input.description !== undefined) {
    cleanDescription = sanitizeForumHtml(input.description);
    plainText = extractPlainText(cleanDescription);

    if (plainText.length < MIN_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH) {
      return {
        error: `Description must contain at least ${MIN_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH} characters of readable text.`,
      };
    }
    if (plainText.length > MAX_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH) {
      return {
        error: `Description cannot exceed ${MAX_MARKETPLACE_DESCRIPTION_PLAIN_LENGTH.toLocaleString()} characters.`,
      };
    }
    if (cleanDescription.length > MAX_MARKETPLACE_DESCRIPTION_HTML_LENGTH) {
      return {
        error: "Description formatting markup exceeds maximum allowed payload size.",
      };
    }
  }

  return { cleanTitle, cleanDescription, plainText };
}

export function validateAndSanitizeMarketplaceComment(content?: string): {
  cleanContent?: string;
  error?: string;
} {
  if (!content) {
    return { error: "Comment content cannot be empty." };
  }

  const sanitized = sanitizeForumHtml(content);
  const cleanContent = extractPlainText(sanitized);

  if (cleanContent.length < MIN_MARKETPLACE_COMMENT_LENGTH) {
    return { error: "Comment content cannot be empty." };
  }
  if (cleanContent.length > MAX_MARKETPLACE_COMMENT_LENGTH) {
    return {
      error: `Comment cannot exceed ${MAX_MARKETPLACE_COMMENT_LENGTH} characters.`,
    };
  }

  return { cleanContent };
}

export function normalizeMarketplaceConditionAndPrice(params: {
  effectiveType: ListingType;
  condition?: string | null;
  price?: number | null;
}) {
  const normalizedCondition =
    params.effectiveType === ListingType.BUYING
      ? null
      : params.condition !== undefined
        ? params.condition
        : undefined;

  const normalizedPrice =
    params.price === null ? 0 : params.price !== undefined ? params.price : undefined;

  return {
    condition: normalizedCondition,
    price: normalizedPrice,
  };
}

export function resolveTopLevelParentCommentId(parent: {
  id: string;
  parentId: string | null;
}): string {
  return parent.parentId ?? parent.id;
}

export function canCommentOnMarketplacePost(status: ListingStatus): boolean {
  return status === ListingStatus.ACTIVE;
}

export function isMarketplaceItemVisibleToViewer(
  item: {
    id: string;
    authorId?: string;
    isHiddenByModeration: boolean;
  },
  targetType: "MARKETPLACE_POST" | "MARKETPLACE_COMMENT",
  viewer: MarketplaceViewerContext,
  options?: { includeOwnHidden?: boolean },
): boolean {
  const isAdmin = viewer.role === "ADMIN";
  const reportedSet =
    targetType === "MARKETPLACE_POST"
      ? viewer.reportedPostIds
      : viewer.reportedCommentIds;

  if (!isAdmin && reportedSet.has(item.id)) {
    return false;
  }

  const isOwnModeratedPost =
    targetType === "MARKETPLACE_POST" &&
    Boolean(options?.includeOwnHidden) &&
    Boolean(viewer.userId) &&
    item.authorId === viewer.userId;

  if (item.isHiddenByModeration && !isAdmin && !isOwnModeratedPost) {
    return false;
  }

  return true;
}
