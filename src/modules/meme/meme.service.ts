import { AppError } from "../../utils/AppError";
import { MemeReactionType } from "../../constants/enums";
import { deleteImageFromCloudinary } from "../../lib/cloudinary";
import { CreateMemePayload, QueryMemesQuery } from "./meme.schema";
import {
  createMemeInDb,
  deleteMemeFromDb,
  findMemeByIdInDb,
  findMemesFeedInDb,
  toggleMemeReactionInDb,
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

  return toggleMemeReactionInDb(memeId, userId, type);
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
