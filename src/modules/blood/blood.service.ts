import { AppError } from "../../utils/AppError";
import * as bloodRepository from "./blood.repository";
import {
  CreateBloodPostPayload,
  RespondBloodPostPayload,
} from "./blood.schema";

export const createBloodPostService = async (
  authorId: string,
  data: CreateBloodPostPayload,
) => {
  return await bloodRepository.createBloodPost(authorId, data);
};

export const getBloodFeedService = async (
  query?: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    bloodGroup?: any;
    urgency?: string;
    isFulfilled?: string;
    myPosts?: string;
  },
  userId?: string,
) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query?.bloodGroup) {
    where.bloodGroup = query.bloodGroup;
  }

  if (query?.urgency) {
    where.urgency = query.urgency;
  }

  if (query?.isFulfilled !== undefined) {
    where.isFulfilled = query.isFulfilled === "true";
  }

  if (query?.myPosts === "true" && userId) {
    where.authorId = userId;
  }

  const searchKeyword =
    typeof query?.search === "string" ? query.search.trim() : undefined;
  if (searchKeyword) {
    where.OR = [
      { patientName: { contains: searchKeyword, mode: "insensitive" } },
      { patientCondition: { contains: searchKeyword, mode: "insensitive" } },
      { location: { contains: searchKeyword, mode: "insensitive" } },
    ];
  }

  const [posts, total, counts] = await Promise.all([
    bloodRepository.findBloodFeed(where, skip, limit),
    bloodRepository.countBloodPosts(where),
    bloodRepository.getBloodCounts(userId),
  ]);

  return {
    data: posts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts,
    },
  };
};

export const getBloodPostByIdService = async (id: string) => {
  const post = await bloodRepository.findBloodPostWithDetails(id);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  return post;
};

export const respondToBloodPostService = async (
  postId: string,
  responderId: string,
  data: RespondBloodPostPayload,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  // Prevent users from responding to their own requests
  if (post.authorId === responderId) {
    throw new AppError("You cannot volunteer for your own blood request.", 400);
  }

  // Prevent duplicate responses from the same user on the same post
  const existingResponse = await bloodRepository.findBloodResponse(
    postId,
    responderId,
  );

  if (existingResponse) {
    throw new AppError("You have already responded to this request.", 409);
  }

  return await bloodRepository.createBloodResponse(
    postId,
    responderId,
    data.message,
  );
};

export const resolveBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to mark this request as fulfilled.",
      403,
    );
  }

  return await bloodRepository.updateBloodPostFulfilled(postId, true);
};

export const deleteBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this request.",
      403,
    );
  }

  return await bloodRepository.deleteBloodPostById(postId);
};
