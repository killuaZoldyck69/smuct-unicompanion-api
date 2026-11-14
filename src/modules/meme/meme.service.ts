import { MemeReactionType } from "../../constants/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { findUserUgcTermsStatus } from "../forum/forum.repository";
import { createNotifications } from "../notification/notification.service";
import {
  MAX_MEME_FEED_LIMIT,
  shouldDispatchMemeMilestoneNotification,
} from "./meme.domain";
import { deleteUnreferencedMemeImages } from "./meme.media";
import {
  createMemeInDb,
  deleteMemeAtomicInDb,
  findMemeByIdInDb,
  findMemesFeedInDb,
  getMemeViewerContextInDb,
  toggleMemeReactionInDb,
  updateMemeInDb,
} from "./meme.repository";
import {
  CreateMemePayload,
  QueryMemesQuery,
  UpdateMemePayload,
} from "./meme.schema";

async function assertUserAcceptedUgcTerms(
  userId: string,
  actionLabel: string,
): Promise<void> {
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

async function dispatchMemeMilestoneNotification(params: {
  authorId: string;
  memeId: string;
  caption: string | null;
  count: number;
  kind: "likes" | "dislikes";
}): Promise<void> {
  const dedupeKey = `meme:${params.memeId}:${params.kind}:${params.count}`;
  try {
    const existing = await prisma.notification.findUnique({
      where: {
        userId_dedupeKey: {
          userId: params.authorId,
          dedupeKey,
        },
      },
      select: { id: true },
    });
    if (existing) return;

    await createNotifications([params.authorId], {
      type: "MEME_REACTION_MILESTONE",
      title: `Your meme reached ${params.count} ${params.kind}`,
      body: `“${params.caption?.trim() || "Your meme"}” reached ${params.count} ${params.kind}.`,
      route: "/(tabs)/forum?section=MEMES",
      dedupeKey,
    });
  } catch (err) {
    console.warn("[Memes] Failed to dispatch reaction milestone notification:", err);
  }
}

export const createMemeService = async (
  userId: string,
  payload: CreateMemePayload,
) => {
  await assertUserAcceptedUgcTerms(userId, "posting a meme");
  return createMemeInDb(userId, payload);
};

export const getMemesFeedService = async (
  currentUserId: string,
  query: QueryMemesQuery,
  viewerRole?: string,
) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(MAX_MEME_FEED_LIMIT, query.limit || 20));
  const skip = (page - 1) * limit;

  const viewer = await getMemeViewerContextInDb(currentUserId, viewerRole, {
    skipReports: query.filter === "mine",
  });
  const result = await findMemesFeedInDb(viewer, query.filter, skip, limit);

  return {
    memes: result.memes,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
      hasMore: skip + result.memes.length < result.total,
    },
  };
};

export const getMemeByIdService = async (
  id: string,
  currentUserId?: string,
  viewerRole?: string,
) => {
  const viewer = await getMemeViewerContextInDb(currentUserId, viewerRole, {
    targetMemeId: id,
  });
  const meme = await findMemeByIdInDb(id, viewer);
  if (!meme) {
    throw new AppError("Meme not found", 404);
  }
  return meme;
};

export const reactMemeService = async (
  memeId: string,
  userId: string,
  type: MemeReactionType,
  viewerRole?: string,
) => {
  const viewer = await getMemeViewerContextInDb(userId, viewerRole, {
    targetMemeId: memeId,
  });
  const result = await toggleMemeReactionInDb(memeId, userId, type, viewer);

  if (result.authorId !== userId) {
    const likesMilestone =
      result.userReaction === "LIKE" &&
      shouldDispatchMemeMilestoneNotification(
        result.previousLikesCount,
        result.likesCount,
      );
    const dislikesMilestone =
      result.userReaction === "DISLIKE" &&
      shouldDispatchMemeMilestoneNotification(
        result.previousDislikesCount,
        result.dislikesCount,
      );

    if (likesMilestone || dislikesMilestone) {
      void dispatchMemeMilestoneNotification({
        authorId: result.authorId,
        memeId,
        caption: result.caption,
        count: likesMilestone ? result.likesCount : result.dislikesCount,
        kind: likesMilestone ? "likes" : "dislikes",
      });
    }
  }

  return {
    memeId: result.memeId,
    action: result.action,
    type: result.type,
    userReaction: result.userReaction,
    likesCount: result.likesCount,
    dislikesCount: result.dislikesCount,
  };
};

export const updateMemeService = async (
  memeId: string,
  userId: string,
  payload: UpdateMemePayload,
) => {
  await assertUserAcceptedUgcTerms(userId, "editing a meme caption");
  return updateMemeInDb(memeId, userId, payload);
};

export const deleteMemeService = async (
  memeId: string,
  userId: string,
  userRole?: string,
) => {
  const deleted = await deleteMemeAtomicInDb(memeId, userId, userRole);

  if (deleted.imageUrl) {
    void deleteUnreferencedMemeImages(
      [deleted.imageUrl],
      "deleted meme image",
    );
  }

  return deleted;
};

export { createMemeReportAndEvaluateAutoHideInDb as reportMemeService } from "./meme.moderation.repository";
