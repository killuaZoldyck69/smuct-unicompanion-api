import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  LostFoundClaimStatus,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";
import {
  buildLostFoundUpdateData,
  MAX_CLAIM_ATTEMPTS_PER_POST,
  MAX_PENDING_CLAIMS_PER_USER,
} from "./lost-found.domain";
import {
  privateContactSelection,
  publicAuthorSelection,
  safePostResponseSelect,
} from "./lost-found.projections";
import {
  CreateClaimPayload,
  CreateLostFoundPayload,
  UpdateLostFoundPayload,
} from "./lost-found.schema";

export { publicAuthorSelection, privateContactSelection };
export type { LostFoundFeedFilters } from "./lost-found.queries";

interface LockedPostRow {
  id: string;
  authorId: string;
  title: string;
  type: LostFoundType;
  status: LostFoundStatus;
  images: string[];
  resolvedClaimId: string | null;
  isHiddenByModeration: boolean;
}

interface LockedClaimRow {
  id: string;
  postId: string;
  claimantId: string;
  status: LostFoundClaimStatus;
  proofImage: string | null;
}

async function lockLostFoundPostForUpdate(
  tx: Prisma.TransactionClient,
  postId: string,
): Promise<LockedPostRow> {
  const rows = await tx.$queryRaw<LockedPostRow[]>`
    SELECT id, "authorId", title, type::text, status::text, images, "resolvedClaimId", "isHiddenByModeration"
    FROM "lost_found_post"
    WHERE id = ${postId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError("Lost & Found post not found", 404);
  }
  return rows[0];
}

async function lockLostFoundClaimForUpdate(
  tx: Prisma.TransactionClient,
  claimId: string,
  postId: string,
): Promise<LockedClaimRow> {
  const rows = await tx.$queryRaw<LockedClaimRow[]>`
    SELECT id, "postId", "claimantId", status::text, "proofImage"
    FROM "lost_found_claim"
    WHERE id = ${claimId}
    FOR UPDATE
  `;

  if (rows.length === 0 || rows[0].postId !== postId) {
    throw new AppError("Claim not found on this post", 404);
  }
  return rows[0];
}

export const createLostFoundPostInDb = async (
  authorId: string,
  payload: CreateLostFoundPayload,
) => {
  const isFound = payload.type === LostFoundType.FOUND;
  return prisma.lostFoundPost.create({
    data: {
      authorId,
      type: payload.type,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      category: payload.category,
      location: payload.location?.trim() || null,
      images: payload.images || [],
      verificationQuestion: isFound
        ? payload.verificationQuestion?.trim() || null
        : null,
      verificationAnswer: isFound
        ? payload.verificationAnswer?.trim() || null
        : null,
    },
    select: {
      ...safePostResponseSelect,
      verificationAnswer: true,
    },
  });
};

export const updateLostFoundPostAtomicInDb = async (
  id: string,
  actorId: string,
  actorRole: string | undefined,
  payload: UpdateLostFoundPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const current = await lockLostFoundPostForUpdate(tx, id);
    const isAuthor = current.authorId === actorId;
    const isAdmin = actorRole === "ADMIN";

    if (!isAuthor && !isAdmin) {
      throw new AppError(
        "Unauthorized: You do not have permission to modify this post",
        403,
      );
    }

    if (current.isHiddenByModeration && !isAdmin) {
      throw new AppError(
        "This listing has been hidden by moderation and cannot be edited",
        403,
      );
    }

    if (
      current.status === LostFoundStatus.RESOLVED &&
      payload.type &&
      payload.type !== current.type
    ) {
      throw new AppError("Cannot change item type on a resolved listing", 400);
    }

    const updateData = buildLostFoundUpdateData(payload, current.type, isAuthor);

    const updated = await tx.lostFoundPost.update({
      where: { id },
      data: updateData,
      select: {
        ...safePostResponseSelect,
        ...(isAuthor ? { verificationAnswer: true } : {}),
      },
    });

    const removedImages = payload.images
      ? current.images.filter((img) => !payload.images!.includes(img))
      : [];

    return { updated, removedImages };
  });
};

export const updateLostFoundStatusAtomicInDb = async (
  id: string,
  actorId: string,
  actorRole: string | undefined,
  status: LostFoundStatus,
) => {
  return prisma.$transaction(async (tx) => {
    const previous = await lockLostFoundPostForUpdate(tx, id);
    const isAuthor = previous.authorId === actorId;
    const isAdmin = actorRole === "ADMIN";

    if (!isAuthor && !isAdmin) {
      throw new AppError(
        "Unauthorized: You do not have permission to modify this post",
        403,
      );
    }

    if (previous.isHiddenByModeration && !isAdmin) {
      throw new AppError(
        "This listing has been hidden by moderation and cannot change status",
        403,
      );
    }

    let revokedClaimantIds: string[] = [];
    let autoRejectedClaimantIds: string[] = [];

    if (
      status === LostFoundStatus.ACTIVE ||
      (status === LostFoundStatus.CLOSED &&
        previous.status === LostFoundStatus.RESOLVED)
    ) {
      const acceptedClaims = await tx.lostFoundClaim.findMany({
        where: {
          postId: id,
          status: LostFoundClaimStatus.ACCEPTED,
        },
        select: { claimantId: true },
      });
      revokedClaimantIds = acceptedClaims.map((c) => c.claimantId);

      // Reopening or closing an already-resolved post revokes previous handover acceptance
      if (revokedClaimantIds.length > 0) {
        await tx.lostFoundClaim.updateMany({
          where: {
            postId: id,
            status: LostFoundClaimStatus.ACCEPTED,
          },
          data: { status: LostFoundClaimStatus.REJECTED },
        });
      }
    } else if (
      status === LostFoundStatus.CLOSED ||
      status === LostFoundStatus.RESOLVED
    ) {
      const pendingClaims = await tx.lostFoundClaim.findMany({
        where: {
          postId: id,
          status: LostFoundClaimStatus.PENDING,
        },
        select: { claimantId: true },
      });
      autoRejectedClaimantIds = pendingClaims.map((c) => c.claimantId);

      if (autoRejectedClaimantIds.length > 0) {
        await tx.lostFoundClaim.updateMany({
          where: {
            postId: id,
            status: LostFoundClaimStatus.PENDING,
          },
          data: { status: LostFoundClaimStatus.REJECTED },
        });
      }
    }

    const data: Prisma.LostFoundPostUpdateInput = {
      status,
      ...(status === LostFoundStatus.ACTIVE || status === LostFoundStatus.CLOSED
        ? { resolvedClaimId: null }
        : {}),
    };

    const post = await tx.lostFoundPost.update({
      where: { id },
      data,
      select: {
        ...safePostResponseSelect,
        ...(isAuthor ? { verificationAnswer: true } : {}),
      },
    });

    return {
      post,
      postTitle: previous.title,
      revokedClaimantIds,
      autoRejectedClaimantIds,
    };
  });
};

export const deleteLostFoundPostFromDb = async (id: string) => {
  return prisma.lostFoundPost.delete({
    where: { id },
  });
};

export const createOrResubmitClaimInDb = async (
  postId: string,
  claimantId: string,
  payload: CreateClaimPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const postRow = await lockLostFoundPostForUpdate(tx, postId);
    if (postRow.isHiddenByModeration) {
      throw new AppError("Lost & Found post not found", 404);
    }

    if (postRow.authorId === claimantId) {
      throw new AppError("You cannot submit a claim on your own post", 400);
    }

    if (postRow.status !== LostFoundStatus.ACTIVE) {
      throw new AppError("This post is no longer accepting claims", 400);
    }

    // Lock claimant row so concurrent cross-post submissions cannot bypass MAX_PENDING_CLAIMS_PER_USER
    await tx.$queryRaw`
      SELECT id FROM "user" WHERE id = ${claimantId} FOR UPDATE
    `;

    const pendingCount = await tx.lostFoundClaim.count({
      where: {
        claimantId,
        status: LostFoundClaimStatus.PENDING,
      },
    });

    if (pendingCount >= MAX_PENDING_CLAIMS_PER_USER) {
      throw new AppError(
        `You have reached the maximum limit of ${MAX_PENDING_CLAIMS_PER_USER} pending claims. Please withdraw an existing claim before submitting a new one.`,
        429,
      );
    }

    const existingClaim = await tx.lostFoundClaim.findUnique({
      where: {
        postId_claimantId: { postId, claimantId },
      },
      select: {
        id: true,
        status: true,
        attemptCount: true,
        proofImage: true,
      },
    });

    const cleanMessage = payload.message.trim();
    const cleanAnswer = payload.answer?.trim() || null;
    const cleanProof = payload.proofImage?.trim() || null;

    let claim;
    let replacedProofImage: string | null = null;

    if (existingClaim) {
      if (existingClaim.status === LostFoundClaimStatus.PENDING) {
        throw new AppError(
          "You have already submitted a pending claim for this item",
          409,
        );
      }
      if (existingClaim.status === LostFoundClaimStatus.ACCEPTED) {
        throw new AppError(
          "Your claim for this item has already been accepted",
          409,
        );
      }
      if (
        (existingClaim.status === LostFoundClaimStatus.REJECTED ||
          existingClaim.status === LostFoundClaimStatus.WITHDRAWN) &&
        existingClaim.attemptCount >= MAX_CLAIM_ATTEMPTS_PER_POST
      ) {
        throw new AppError(
          "You have already used your resubmission attempt for this listing.",
          409,
        );
      }

      if (existingClaim.proofImage && existingClaim.proofImage !== cleanProof) {
        replacedProofImage = existingClaim.proofImage;
      }

      const incrementsAttempt =
        existingClaim.status === LostFoundClaimStatus.REJECTED ||
        existingClaim.status === LostFoundClaimStatus.WITHDRAWN;

      claim = await tx.lostFoundClaim.update({
        where: { id: existingClaim.id },
        data: {
          status: LostFoundClaimStatus.PENDING,
          attemptCount: incrementsAttempt
            ? existingClaim.attemptCount + 1
            : existingClaim.attemptCount,
          message: cleanMessage,
          answer: cleanAnswer,
          proofImage: cleanProof,
        },
        include: {
          claimant: { select: publicAuthorSelection },
        },
      });
    } else {
      claim = await tx.lostFoundClaim.create({
        data: {
          postId,
          claimantId,
          message: cleanMessage,
          answer: cleanAnswer,
          proofImage: cleanProof,
          attemptCount: 1,
        },
        include: {
          claimant: { select: publicAuthorSelection },
        },
      });
    }

    const author = await tx.user.findUnique({
      where: { id: postRow.authorId },
      select: { id: true, name: true, email: true },
    });

    return {
      claim,
      postTitle: postRow.title,
      author,
      replacedProofImage,
    };
  });
};

export const acceptClaimAtomicInDb = async (
  postId: string,
  claimId: string,
  actorId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const currentPost = await lockLostFoundPostForUpdate(tx, postId);
    if (currentPost.isHiddenByModeration) {
      throw new AppError("Lost & Found post not found", 404);
    }

    if (currentPost.authorId !== actorId) {
      throw new AppError(
        "Unauthorized: Only the post author can accept claims",
        403,
      );
    }

    if (currentPost.status !== LostFoundStatus.ACTIVE) {
      throw new AppError("This post has already been resolved or closed", 400);
    }

    const claimRow = await lockLostFoundClaimForUpdate(tx, claimId, postId);
    if (claimRow.status !== LostFoundClaimStatus.PENDING) {
      throw new AppError("Only pending claims can be accepted", 400);
    }

    const acceptedClaim = await tx.lostFoundClaim.update({
      where: { id: claimId },
      data: { status: LostFoundClaimStatus.ACCEPTED },
      include: {
        claimant: { select: privateContactSelection },
      },
    });

    await tx.lostFoundClaim.updateMany({
      where: {
        postId,
        id: { not: claimId },
        status: LostFoundClaimStatus.PENDING,
      },
      data: { status: LostFoundClaimStatus.REJECTED },
    });

    const updatedPost = await tx.lostFoundPost.update({
      where: { id: postId },
      data: {
        status: LostFoundStatus.RESOLVED,
        resolvedClaimId: claimId,
      },
      select: {
        ...safePostResponseSelect,
        author: { select: privateContactSelection },
      },
    });

    return { post: updatedPost, acceptedClaim };
  });
};

export const rejectClaimAtomicInDb = async (
  postId: string,
  claimId: string,
  actorId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const postRow = await lockLostFoundPostForUpdate(tx, postId);
    if (postRow.isHiddenByModeration) {
      throw new AppError("Lost & Found post not found", 404);
    }

    if (postRow.authorId !== actorId) {
      throw new AppError(
        "Unauthorized: Only the post author can reject claims",
        403,
      );
    }

    if (postRow.status !== LostFoundStatus.ACTIVE) {
      throw new AppError(
        "Claims can only be rejected while the listing is active",
        400,
      );
    }

    const claimRow = await lockLostFoundClaimForUpdate(tx, claimId, postId);
    if (claimRow.status !== LostFoundClaimStatus.PENDING) {
      throw new AppError("Only pending claims can be rejected", 400);
    }

    const updatedClaim = await tx.lostFoundClaim.update({
      where: { id: claimId },
      data: { status: LostFoundClaimStatus.REJECTED },
      include: {
        claimant: {
          select: {
            ...publicAuthorSelection,
            email: true,
          },
        },
      },
    });

    return { updatedClaim, postTitle: postRow.title };
  });
};

export const withdrawClaimAtomicInDb = async (
  postId: string,
  claimId: string,
  actorId: string,
  isAdmin: boolean,
) => {
  return prisma.$transaction(async (tx) => {
    const claim = await lockLostFoundClaimForUpdate(tx, claimId, postId);
    const isClaimant = claim.claimantId === actorId;

    if (!isClaimant && !isAdmin) {
      throw new AppError(
        "Unauthorized: You do not have permission to withdraw this claim",
        403,
      );
    }

    if (claim.status === LostFoundClaimStatus.ACCEPTED) {
      throw new AppError("Cannot withdraw or delete an accepted claim", 400);
    }

    if (claim.status !== LostFoundClaimStatus.PENDING && !isAdmin) {
      throw new AppError("Only pending claims can be withdrawn", 400);
    }

    // Soft-withdraw preserves attemptCount so MAX_CLAIM_ATTEMPTS_PER_POST cannot be reset
    await tx.lostFoundClaim.update({
      where: { id: claimId },
      data: {
        status: LostFoundClaimStatus.WITHDRAWN,
        proofImage: null,
      },
    });

    return { proofImage: claim.proofImage };
  });
};
