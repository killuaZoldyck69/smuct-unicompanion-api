import { AppError } from "../../utils/AppError";
import { createNotifications } from "../notification/notification.service";
import { MemeReactionType } from "../../constants/enums";
import { deleteImageFromCloudinary } from "../../lib/cloudinary";
import { CreateMemePayload, QueryMemesQuery, UpdateMemePayload } from "./meme.schema";
import {
  createMemeInDb,
  deleteMemeFromDb,
  findMemeByIdInDb,
  findMemesFeedInDb,
  toggleMemeReactionInDb,
  updateMemeInDb,
} from "./meme.repository";

export const createMemeService = async (
  userId: string,
  payload: CreateMemePayload
) => {
  if (!payload.imageUrl) {
    throw new AppError("Meme image is required", 400);
  }

  return createMemeInDb(userId, payload);
};

export const getMemesFeedService = async (
  currentUserId: string,
  query: QueryMemesQuery
) => {
  const { page, limit, filter } = query;
  const skip = (page - 1) * limit;

  const result = await findMemesFeedInDb(currentUserId, filter, skip, limit);

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
  currentUserId?: string
) => {
  const meme = await findMemeByIdInDb(id, currentUserId);
  if (!meme) {
    throw new AppError("Meme not found", 404);
  }
  return meme;
};

export const reactMemeService = async (
  memeId: string,
  userId: string,
  type: MemeReactionType
) => {
  const meme = await findMemeByIdInDb(memeId);
  if (!meme) {
    throw new AppError("Meme not found", 404);
  }

  const result = await toggleMemeReactionInDb(memeId, userId, type);
  const likesMilestone = result.userReaction === "LIKE" && result.likesCount > 0 && result.likesCount % 5 === 0;
  const dislikesMilestone = result.userReaction === "DISLIKE" && result.dislikesCount > 0 && result.dislikesCount % 5 === 0;
  if (meme.authorId !== userId && (likesMilestone || dislikesMilestone)) {
    const count = likesMilestone ? result.likesCount : result.dislikesCount;
    await createNotifications([meme.authorId], {
      type: "MEME_REACTION_MILESTONE",
      title: `Your meme reached ${count} ${likesMilestone ? "likes" : "dislikes"}`,
      body: `“${meme.caption?.trim() || "Your meme"}” reached ${count} ${likesMilestone ? "likes" : "dislikes"}.`,
      route: "/(tabs)/forum?section=MEMES",
      dedupeKey: `meme:${memeId}:${likesMilestone ? "likes" : "dislikes"}:${count}`,
    });
  }
  return result;
};

export const deleteMemeService = async (
  memeId: string,
  userId: string,
  userRole?: string
) => {
  const meme = await findMemeByIdInDb(memeId);
  if (!meme) {
    throw new AppError("Meme not found", 404);
  }

  const isAuthor = meme.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError("You do not have permission to delete this meme", 403);
  }

  const deleted = await deleteMemeFromDb(memeId);

  // Storage cleanup optimization: delete meme image from Cloudinary
  if (meme.imageUrl) {
    deleteImageFromCloudinary(meme.imageUrl).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up meme image:", err)
    );
  }

  return deleted;
};

export const updateMemeService = async (
  memeId: string,
  userId: string,
  payload: UpdateMemePayload
) => {
  const meme = await findMemeByIdInDb(memeId);
  if (!meme) {
    throw new AppError("Meme not found", 404);
  }

  if (meme.authorId !== userId) {
    throw new AppError("You do not have permission to edit this meme", 403);
  }

  return updateMemeInDb(memeId, payload);
};
