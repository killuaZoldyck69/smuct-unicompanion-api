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
import { assertNoForeignLostFoundMediaReferencesInTx } from "./lost-found.media";
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
  verificationQuestion: string | null;
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
    SELECT id, "authorId", title, type::text, status::text, images, "verificationQuestion", "resolvedClaimId", "isHiddenByModeration"
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

function assertCanManagePost(
  post: LockedPostRow,
  actorId: string,
  actorRole: string | undefined,
  action: "modify" | "delete",
): { isAuthor: boolean; isAdmin: boolean } {
  const isAuthor = post.authorId === actorId;
  const isAdmin = actorRole === "ADMIN";
  if (!isAuthor && !isAdmin) {
    throw new AppError(
      `Unauthorized: You do not have permission to ${action} this post`,
      403,
    );
  }
  return { isAuthor, isAdmin };
}

function assertAuthorCanReviewActivePost(
  post: LockedPostRow,
  actorId: string,
  actionVerb: "accept" | "reject",
  inactiveMessage: string,
): void {
  if (post.isHiddenByModeration) {
    throw new AppError("Lost & Found post not found", 404);
  }
  if (post.authorId !== actorId) {
    throw new AppError(
      `Unauthorized: Only the post author can ${actionVerb} claims`,
      403,
    );
  }
  if (post.status !== LostFoundStatus.ACTIVE) {
    throw new AppError(inactiveMessage, 400);
  }
}

export const createLostFoundPostInDb = async (
  authorId: string,
  payload: CreateLostFoundPayload,
) => {
  const isFound = payload.type === LostFoundType.FOUND;
  const idempotencyKey = payload.idempotencyKey?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.lostFoundPost.findUnique({
          where: {
            authorId_idempotencyKey: { authorId, idempotencyKey },
          },
          select: {
            ...safePostResponseSelect,
            verificationAnswer: true,
          },
        });
        if (existing) {
          return existing;
        }
      }

      const recentPostsCount = await tx.lostFoundPost.count({
        where: {
          authorId,
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      });
      if (recentPostsCount >= 10) {
        throw new AppError(
          "Too many listings created. Please try again in a few minutes.",
          429,
        );
      }

      const images = payload.images || [];
      await assertNoForeignLostFoundMediaReferencesInTx(tx, [authorId], images);

      return tx.lostFoundPost.create({
        data: {
          authorId,
          type: payload.type,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          category: payload.category,
          location: payload.location?.trim() || null,
          images,
          idempotencyKey,
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
    });
  } catch (err) {
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.lostFoundPost.findUnique({
        where: {
          authorId_idempotencyKey: { authorId, idempotencyKey },
        },
        select: {
          ...safePostResponseSelect,
          verificationAnswer: true,
        },
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
};

export const updateLostFoundPostAtomicInDb = async (
  id: string,
  actorId: string,
  actorRole: string | undefined,
  payload: UpdateLostFoundPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const current = await lockLostFoundPostForUpdate(tx, id);
    const { isAuthor, isAdmin } = assertCanManagePost(current, actorId, actorRole, "modify");

    if (current.isHiddenByModeration && !isAdmin) {
      throw new AppError(
        "This listing has been hidden by moderation and cannot be edited",
        403,
      );
    }

    if (
      current.status === LostFoundStatus.RESOLVED ||
      current.status === LostFoundStatus.CLOSED
    ) {
      throw new AppError(
        "Resolved or closed listings cannot be edited",
        400,
      );
    }

    if (payload.images !== undefined) {
      await assertNoForeignLostFoundMediaReferencesInTx(
        tx,
        [actorId, current.authorId],
        payload.images,
      );
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
    const { isAuthor, isAdmin } = assertCanManagePost(previous, actorId, actorRole, "modify");

    if (status === LostFoundStatus.RESOLVED && !isAuthor) {
      throw new AppError(
        "Unauthorized: Only the post author can mark a listing as resolved",
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

export const deleteLostFoundPostAtomicInDb = async (
  id: string,
  userId: string,
  userRole: string | undefined,
) => {
  return prisma.$transaction(async (tx) => {
    const current = await lockLostFoundPostForUpdate(tx, id);
    assertCanManagePost(current, userId, userRole, "delete");

    const claimsWithProof = await tx.lostFoundClaim.findMany({
      where: {
        postId: id,
        proofImage: { not: null },
      },
      select: { proofImage: true },
      take: 500,
    });

    const claimProofImages = claimsWithProof
      .map((claim) => claim.proofImage)
      .filter((image): image is string => Boolean(image));

    await tx.contentReport.deleteMany({
      where: {
        targetType: "LOST_FOUND_POST",
        targetId: id,
      },
    });

    const deleted = await tx.lostFoundPost.delete({
      where: { id },
    });

    return {
      deleted,
      imagesToDelete: [...current.images, ...claimProofImages],
    };
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

    const cleanMessage = payload.message.trim();
    const cleanAnswer = payload.answer?.trim() || null;
    const cleanProof = payload.proofImage?.trim() || null;

    if (postRow.verificationQuestion && !cleanAnswer) {
      throw new AppError("Please answer the finder's verification question.", 400);
    }

    if (cleanProof) {
      await assertNoForeignLostFoundMediaReferencesInTx(
        tx,
        [claimantId],
        [cleanProof],
      );
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
    assertAuthorCanReviewActivePost(
      currentPost,
      actorId,
      "accept",
      "This post has already been resolved or closed",
    );

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
    assertAuthorCanReviewActivePost(
      postRow,
      actorId,
      "reject",
      "Claims can only be rejected while the listing is active",
    );

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

    const { email: claimantEmail, ...safeClaimant } = updatedClaim.claimant;

    return {
      updatedClaim: {
        ...updatedClaim,
        claimant: safeClaimant,
      },
      claimantEmail,
      postTitle: postRow.title,
    };
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
