import { AppError } from "../../utils/AppError";
import { createNotifications } from "../notification/notification.service";
import { findUserUgcTermsStatus } from "../forum/forum.repository";
import {
  isMarketplaceItemVisibleToViewer,
  normalizeMarketplaceConditionAndPrice,
  validateAndSanitizeMarketplaceComment,
  validateAndSanitizeMarketplaceInput,
} from "./marketplace.domain";
import { deleteUnreferencedMarketplaceImages } from "./marketplace.media";
import {
  createMarketplaceCommentAtomicInDb,
  createMarketplacePostInDb,
  deleteMarketplacePostAtomicInDb,
  findMarketplaceFeedInDb,
  findMarketplacePostByIdInDb,
  getMarketplaceViewerContextInDb,
  MarketplaceFeedFilters,
  PaginationParams,
  updateMarketplaceCommentAtomicInDb,
  updateMarketplacePostAtomicInDb,
} from "./marketplace.repository";
import {
  CreateMarketplaceCommentPayload,
  CreateMarketplacePayload,
  UpdateMarketplacePayload,
} from "./marketplace.schema";

async function assertUserAcceptedUgcTerms(userId: string, actionLabel: string) {
  const user = await findUserUgcTermsStatus(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }
  if (!user.ugcTermsAcceptedAt) {
    throw new AppError(
      `Please accept the Community Guidelines before ${actionLabel}.`,
      403,
      "UGC_TERMS_REQUIRED",
    );
  }
}

export const getFeedService = async (
  filters: MarketplaceFeedFilters,
  pagination: PaginationParams,
) => {
  const viewer = await getMarketplaceViewerContextInDb(
    filters.viewerId,
    filters.viewerRole,
  );
  return findMarketplaceFeedInDb(filters, pagination, viewer);
};

export const getPostByIdService = async (
  id: string,
  viewerId: string,
  viewerRole?: string,
) => {
  const viewer = await getMarketplaceViewerContextInDb(viewerId, viewerRole);
  const post = await findMarketplacePostByIdInDb(id, viewer);

  if (
    !post ||
    !isMarketplaceItemVisibleToViewer(post, "MARKETPLACE_POST", viewer, {
      includeOwnHidden: true,
    })
  ) {
    throw new AppError("Marketplace listing not found", 404);
  }

  return {
    ...post,
    comments: post.comments
      .filter((comment) =>
        isMarketplaceItemVisibleToViewer(
          comment,
          "MARKETPLACE_COMMENT",
          viewer,
        ),
      )
      .map((comment) => ({
        ...comment,
        replies: (comment.replies ?? []).filter((reply) =>
          isMarketplaceItemVisibleToViewer(
            reply,
            "MARKETPLACE_COMMENT",
            viewer,
          ),
        ),
      })),
  };
};

export const createPostService = async (
  userId: string,
  payload: CreateMarketplacePayload,
) => {
  await assertUserAcceptedUgcTerms(userId, "creating a marketplace listing");

  const sanitized = validateAndSanitizeMarketplaceInput({
    title: payload.title,
    description: payload.description,
  });
  if (sanitized.error) {
    throw new AppError(sanitized.error, 400);
  }

  const normalized = normalizeMarketplaceConditionAndPrice({
    effectiveType: payload.type,
    condition: payload.condition,
    price: payload.price,
  });

  return createMarketplacePostInDb(userId, {
    ...payload,
    title: sanitized.cleanTitle!,
    description: sanitized.cleanDescription!,
    condition: normalized.condition ?? null,
    price: normalized.price ?? 0,
  });
};

export const updatePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  payload: UpdateMarketplacePayload,
) => {
  await assertUserAcceptedUgcTerms(userId, "editing a marketplace listing");

  const sanitized = validateAndSanitizeMarketplaceInput({
    title: payload.title,
    description: payload.description,
  });
  if (sanitized.error) {
    throw new AppError(sanitized.error, 400);
  }

  const nextPayload: UpdateMarketplacePayload = {
    ...payload,
    ...(sanitized.cleanTitle !== undefined && { title: sanitized.cleanTitle }),
    ...(sanitized.cleanDescription !== undefined && {
      description: sanitized.cleanDescription,
    }),
  };

  const { updated, removedImages } = await updateMarketplacePostAtomicInDb(
    id,
    userId,
    userRole,
    nextPayload,
  );

  if (removedImages.length > 0) {
    void deleteUnreferencedMarketplaceImages(
      removedImages,
      "removed marketplace images",
    );
  }

  return updated;
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
) => {
  const { images } = await deleteMarketplacePostAtomicInDb(
    id,
    userId,
    userRole,
  );

  if (images.length > 0) {
    void deleteUnreferencedMarketplaceImages(
      images,
      "deleted marketplace post images",
    );
  }
};

export const createCommentService = async (
  postId: string,
  userId: string,
  userRole: string | undefined,
  payload: CreateMarketplaceCommentPayload,
) => {
  await assertUserAcceptedUgcTerms(userId, "posting a marketplace comment");

  const sanitized = validateAndSanitizeMarketplaceComment(payload.content);
  if (sanitized.error || !sanitized.cleanContent) {
    throw new AppError(
      sanitized.error ?? "Comment content cannot be empty.",
      400,
    );
  }

  const viewer = await getMarketplaceViewerContextInDb(userId, userRole);
  const { comment, postAuthorId, postTitle, parentAuthorId } =
    await createMarketplaceCommentAtomicInDb({
      postId,
      authorId: userId,
      content: sanitized.cleanContent,
      parentId: payload.parentId ?? null,
      viewer,
    });

  const recipients = new Set<string>([postAuthorId]);
  if (parentAuthorId) recipients.add(parentAuthorId);
  recipients.delete(userId);

  if (recipients.size > 0) {
    void createNotifications([...recipients], {
      type: "MARKETPLACE_COMMENT",
      title: "New buy & sell comment",
      body: `Someone commented on “${postTitle}”.`,
      route: `/campus-hub/marketplace/${postId}`,
      dedupeKey: `marketplace-comment:${comment.id}`,
    }).catch((err) => {
      console.warn(
        "[Marketplace] Failed to dispatch comment notification:",
        err,
      );
    });
  }

  return comment;
};

export const updateCommentService = async (
  postId: string,
  commentId: string,
  userId: string,
  content: string,
) => {
  await assertUserAcceptedUgcTerms(userId, "editing a marketplace comment");

  const sanitized = validateAndSanitizeMarketplaceComment(content);
  if (sanitized.error || !sanitized.cleanContent) {
    throw new AppError(
      sanitized.error ?? "Comment content cannot be empty.",
      400,
    );
  }

  return updateMarketplaceCommentAtomicInDb(
    postId,
    commentId,
    userId,
    sanitized.cleanContent,
  );
};
