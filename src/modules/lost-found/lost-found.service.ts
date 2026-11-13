import { AppError } from "../../utils/AppError";
import { sendEmail } from "../../lib/email";
import { LostFoundStatus } from "../../constants/enums";
import { createNotifications } from "../notification/notification.service";
import { findUserUgcTermsStatus } from "../forum/forum.repository";
import {
  isLostFoundPostVisibleToViewer,
  sanitizeLostFoundPostDetail,
} from "./lost-found.domain";
import { deleteUnreferencedLostFoundImages } from "./lost-found.media";
import {
  buildClaimRejectedEmail,
  buildHandoverAuthorEmail,
  buildHandoverClaimantEmail,
  buildNewClaimEmail,
} from "./lost-found.email-templates";
import { createLostFoundReportAndEvaluateAutoHideInDb } from "./lost-found.moderation.repository";
import {
  findClaimByPostAndClaimantInDb,
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
  deleteLostFoundPostAtomicInDb,
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
    void deleteUnreferencedLostFoundImages(removedImages, "removed post images");
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
  const { deleted, imagesToDelete } = await deleteLostFoundPostAtomicInDb(
    id,
    userId,
    userRole,
  );

  if (imagesToDelete.length > 0) {
    void deleteUnreferencedLostFoundImages(
      imagesToDelete,
      "lost-found post images",
    );
  }

  return deleted;
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
    void deleteUnreferencedLostFoundImages(
      [replacedProofImage],
      "replaced claim proof",
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
  const [post, viewer] = await Promise.all([
    findLostFoundPostSummaryInDb(postId),
    getLostFoundViewerContextInDb(userId, userRole),
  ]);
  if (
    !post ||
    !isLostFoundPostVisibleToViewer(post, viewer, { includeOwnHidden: true })
  ) {
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
  const { updatedClaim, claimantEmail, postTitle } = await rejectClaimAtomicInDb(
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

  if (claimantEmail) {
    const email = buildClaimRejectedEmail({
      claimantName: updatedClaim.claimant.name,
      postTitle,
    });
    dispatchEmailSafe(
      { to: claimantEmail, ...email },
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
    void deleteUnreferencedLostFoundImages(
      [proofImage],
      "withdrawn claim proof image",
    );
  }

  return { message: "Claim withdrawn successfully" };
};

export const reportLostFoundPostService = async (
  postId: string,
  reporterId: string,
  data: CreateLostFoundReportPayload,
) => {
  return createLostFoundReportAndEvaluateAutoHideInDb({
    reporterId,
    postId,
    reason: data.reason,
    details: data.details,
  });
};
