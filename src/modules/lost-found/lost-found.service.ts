import { AppError } from "../../utils/AppError";
import { sendEmail } from "../../lib/email";
import { deleteMultipleImagesFromCloudinary } from "../../lib/cloudinary";
import { LostFoundStatus } from "../../constants/enums";
import { createNotifications } from "../notification/notification.service";
import { findUserUgcTermsStatus } from "../forum/forum.repository";
import {
  isLostFoundPostVisibleToViewer,
  sanitizeLostFoundPostDetail,
} from "./lost-found.domain";
import {
  buildClaimRejectedEmail,
  buildHandoverAuthorEmail,
  buildHandoverClaimantEmail,
  buildNewClaimEmail,
} from "./lost-found.email-templates";
import {
  createLostFoundReportAndEvaluateAutoHideInDb,
  findExistingLostFoundReportInDb,
} from "./lost-found.moderation.repository";
import {
  findClaimByPostAndClaimantInDb,
  findClaimProofImagesByPostIdInDb,
  findClaimsByPostIdInDb,
  findLostFoundFeedInDb,
  findLostFoundPostByIdInDb,
  findLostFoundPostSummaryInDb,
  findPossibleMatchesInDb,
  getLostFoundViewerContextInDb,
  LostFoundFeedFilters,
} from "./lost-found.queries";
import {
  acceptClaimAtomicInDb,
  createLostFoundPostInDb,
  createOrResubmitClaimInDb,
  deleteLostFoundPostFromDb,
  rejectClaimAtomicInDb,
  updateLostFoundPostAtomicInDb,
  updateLostFoundStatusAtomicInDb,
  withdrawClaimAtomicInDb,
} from "./lost-found.repository";
import {
  CreateClaimPayload,
  CreateLostFoundPayload,
  CreateLostFoundReportPayload,
  UpdateLostFoundPayload,
} from "./lost-found.schema";

const assertUserAcceptedUgcTerms = async (userId: string) => {
  const user = await findUserUgcTermsStatus(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }
  if (!user.ugcTermsAcceptedAt) {
    throw new AppError(
      "Please accept the Community Guidelines before posting or claiming.",
      403,
      "UGC_TERMS_REQUIRED",
    );
  }
};

function dispatchNotificationSafe(
  recipientIds: string[],
  payload: Parameters<typeof createNotifications>[1],
): void {
  if (recipientIds.length === 0) return;
  void createNotifications(recipientIds, payload).catch((err) => {
    console.warn("[LostFound] Failed to dispatch push notification:", err);
  });
}

function dispatchEmailSafe(
  options: Parameters<typeof sendEmail>[0],
  contextLabel: string,
): void {
  void sendEmail(options)
    .then((sent) => {
      if (!sent) {
        console.warn(
          `[LostFound] Email delivery returned false (${contextLabel})`,
        );
      }
    })
    .catch((err) => {
      console.error(`[LostFound] Email dispatch threw (${contextLabel}):`, err);
    });
}

export const createPostService = async (
  userId: string,
  payload: CreateLostFoundPayload,
) => {
  await assertUserAcceptedUgcTerms(userId);
  return createLostFoundPostInDb(userId, payload);
};

export const updatePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  payload: UpdateLostFoundPayload,
) => {
  const { updated, removedImages } = await updateLostFoundPostAtomicInDb(
    id,
    userId,
    userRole,
    payload,
  );

  if (removedImages.length > 0) {
    deleteMultipleImagesFromCloudinary(removedImages).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up removed post images:", err),
    );
  }

  return updated;
};

export const getFeedService = async (filters: LostFoundFeedFilters) => {
  const viewer = await getLostFoundViewerContextInDb(
    filters.viewerId,
    filters.viewerRole,
  );
  return findLostFoundFeedInDb(filters, viewer);
};

export const getPossibleMatchesService = async (
  postId: string,
  viewerId?: string,
  viewerRole?: string,
) => {
  const [post, viewer] = await Promise.all([
    findLostFoundPostSummaryInDb(postId),
    getLostFoundViewerContextInDb(viewerId, viewerRole),
  ]);
  if (
    !post ||
    !isLostFoundPostVisibleToViewer(post, viewer, { includeOwnHidden: true })
  ) {
    throw new AppError("Lost & Found post not found", 404);
  }
  return findPossibleMatchesInDb(
    post.id,
    post.category,
    post.title,
    post.location,
    post.type,
    viewer,
  );
};

export const getPostByIdService = async (
  id: string,
  viewerId: string,
  viewerRole?: string,
) => {
  const [post, viewer] = await Promise.all([
    findLostFoundPostByIdInDb(id),
    getLostFoundViewerContextInDb(viewerId, viewerRole),
  ]);

  if (
    !post ||
    !isLostFoundPostVisibleToViewer(post, viewer, { includeOwnHidden: true })
  ) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === viewerId;
  const myClaim = isAuthor
    ? null
    : await findClaimByPostAndClaimantInDb(id, viewerId);

  return sanitizeLostFoundPostDetail({
    post,
    viewerId,
    viewerRole,
    myClaim,
  });
};

export const updateStatusService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: LostFoundStatus,
) => {
  const { post, postTitle, revokedClaimantIds, autoRejectedClaimantIds } =
    await updateLostFoundStatusAtomicInDb(id, userId, userRole, status);

  if (revokedClaimantIds.length > 0) {
    dispatchNotificationSafe(revokedClaimantIds, {
      type: "LOST_FOUND_CLAIM",
      title: "Listing status updated",
      body: `The listing “${postTitle}” was updated to ${status.toLowerCase()}, and the prior handover was cancelled.`,
      route: `/campus-hub/lost-found/${id}`,
      dedupeKey: `lost-found-reopen:${id}:${post.updatedAt.toISOString()}`,
    });
  }

  if (autoRejectedClaimantIds.length > 0) {
    dispatchNotificationSafe(autoRejectedClaimantIds, {
      type: "LOST_FOUND_CLAIM",
      title: "Listing closed",
      body: `The listing “${postTitle}” was marked ${status.toLowerCase()} by the owner.`,
      route: `/campus-hub/lost-found/${id}`,
      dedupeKey: `lost-found-closed:${id}:${post.updatedAt.toISOString()}`,
    });
  }

  return post;
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
) => {
  const post = await findLostFoundPostSummaryInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to delete this post",
      403,
    );
  }

  const claimProofImages = await findClaimProofImagesByPostIdInDb(id).catch(
    (err) => {
      console.warn(
        "[LostFound] Failed to collect claim proof images prior to delete:",
        err,
      );
      return [] as string[];
    },
  );
  const imagesToDelete = [...post.images, ...claimProofImages];

  const result = await deleteLostFoundPostFromDb(id);

  if (imagesToDelete.length > 0) {
    deleteMultipleImagesFromCloudinary(imagesToDelete).catch((err) =>
      console.warn(
        "[Cloudinary] Failed to clean up lost-found post images:",
        err,
      ),
    );
  }

  return result;
};

export const createClaimService = async (
  postId: string,
  claimantId: string,
  payload: CreateClaimPayload,
) => {
  await assertUserAcceptedUgcTerms(claimantId);

  const { claim, postTitle, author, replacedProofImage } =
    await createOrResubmitClaimInDb(postId, claimantId, payload);

  if (replacedProofImage) {
    deleteMultipleImagesFromCloudinary([replacedProofImage]).catch((err) =>
      console.warn("[Cloudinary] Failed to remove replaced claim proof:", err),
    );
  }

  if (author) {
    dispatchNotificationSafe([author.id], {
      type: "LOST_FOUND_CLAIM",
      title: "New item claim",
      body: `Someone submitted a claim for “${postTitle}”.`,
      route: `/campus-hub/lost-found/${postId}`,
      dedupeKey: `lost-found-claim:${claim.id}:v${claim.attemptCount}`,
    });

    if (author.email) {
      const email = buildNewClaimEmail({
        authorName: author.name,
        postTitle,
        claimantName: claim.claimant.name,
        message: claim.message,
      });
      dispatchEmailSafe(
        { to: author.email, ...email },
        `new-claim:${claim.id}`,
      );
    }
  }

  return claim;
};

export const getClaimsForPostService = async (
  postId: string,
  userId: string,
  userRole?: string,
) => {
  const post = await findLostFoundPostSummaryInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (isAuthor || isAdmin) {
    return findClaimsByPostIdInDb(postId);
  }

  const myClaim = await findClaimByPostAndClaimantInDb(postId, userId);
  return myClaim ? [myClaim] : [];
};

export const acceptClaimService = async (
  postId: string,
  claimId: string,
  userId: string,
) => {
  const result = await acceptClaimAtomicInDb(postId, claimId, userId);

  dispatchNotificationSafe(
    [result.acceptedClaim.claimantId, result.post.authorId],
    {
      type: "LOST_FOUND_HANDOVER",
      title: "Claim accepted",
      body: `The claim for “${result.post.title}” was accepted. Arrange the handover in the app.`,
      route: `/campus-hub/lost-found/${postId}`,
      dedupeKey: `lost-found-handover:${claimId}`,
    },
  );

  if (result.acceptedClaim.claimant.email) {
    const email = buildHandoverClaimantEmail({
      postTitle: result.post.title,
      authorName: result.post.author.name,
      authorEmail: result.post.author.email,
      authorPhone: result.post.author.phoneNumber,
    });
    dispatchEmailSafe(
      { to: result.acceptedClaim.claimant.email, ...email },
      `handover-claimant:${claimId}`,
    );
  }

  if (result.post.author.email) {
    const email = buildHandoverAuthorEmail({
      postTitle: result.post.title,
      claimantName: result.acceptedClaim.claimant.name,
      claimantEmail: result.acceptedClaim.claimant.email,
      claimantPhone: result.acceptedClaim.claimant.phoneNumber,
    });
    dispatchEmailSafe(
      { to: result.post.author.email, ...email },
      `handover-author:${claimId}`,
    );
  }

  return result;
};

export const rejectClaimService = async (
  postId: string,
  claimId: string,
  userId: string,
) => {
  const { updatedClaim, postTitle } = await rejectClaimAtomicInDb(
    postId,
    claimId,
    userId,
  );

  dispatchNotificationSafe([updatedClaim.claimantId], {
    type: "LOST_FOUND_CLAIM",
    title: "Claim update",
    body: `Your claim for “${postTitle}” was not accepted.`,
    route: `/campus-hub/lost-found/${postId}`,
    dedupeKey: `lost-found-rejection:${claimId}:v${updatedClaim.attemptCount}`,
  });

  if (updatedClaim.claimant.email) {
    const email = buildClaimRejectedEmail({
      claimantName: updatedClaim.claimant.name,
      postTitle,
    });
    dispatchEmailSafe(
      { to: updatedClaim.claimant.email, ...email },
      `reject-claim:${claimId}`,
    );
  }

  return updatedClaim;
};

export const withdrawClaimService = async (
  postId: string,
  claimId: string,
  userId: string,
  userRole?: string,
) => {
  const isAdmin = userRole === "ADMIN";
  const { proofImage } = await withdrawClaimAtomicInDb(
    postId,
    claimId,
    userId,
    isAdmin,
  );

  if (proofImage) {
    deleteMultipleImagesFromCloudinary([proofImage]).catch((err) =>
      console.warn(
        "[Cloudinary] Failed to clean up withdrawn claim proof image:",
        err,
      ),
    );
  }

  return { message: "Claim withdrawn successfully" };
};

export const reportLostFoundPostService = async (
  postId: string,
  reporterId: string,
  data: CreateLostFoundReportPayload,
) => {
  const post = await findLostFoundPostSummaryInDb(postId);
  if (!post || post.isHiddenByModeration) {
    throw new AppError("Lost & Found post not found", 404);
  }
  if (post.authorId === reporterId) {
    throw new AppError("You cannot report your own listing.", 400);
  }

  const existing = await findExistingLostFoundReportInDb(reporterId, postId);
  let reopenReportId: string | undefined;

  if (existing) {
    if (existing.status !== "DISMISSED") {
      throw new AppError("You have already reported this listing.", 409);
    }
    const reviewedBoundary = existing.reviewedAt ?? existing.createdAt;
    if (post.updatedAt <= reviewedBoundary) {
      throw new AppError("A moderator has already reviewed this listing.", 409);
    }
    reopenReportId = existing.id;
  }

  return createLostFoundReportAndEvaluateAutoHideInDb({
    reporterId,
    postId,
    targetAuthorId: post.authorId,
    reason: data.reason,
    details: data.details,
    targetSnapshot: {
      postId: post.id,
      type: post.type,
      category: post.category,
      title: post.title,
      contentPreview: (post.description || post.location || "").slice(0, 400),
    },
    reopenReportId,
  });
};
