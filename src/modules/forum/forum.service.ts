import { AppError } from "../../utils/AppError";
import * as forumRepository from "./forum.repository";
import {
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
  UpdateResponsePayload,
} from "./forum.schema";

export const createPostService = async (
  authorId: string,
  data: CreatePostPayload,
) => {
  return await forumRepository.createHelpPost(authorId, data);
};

export const getAllPostsService = async (
  query?: {
    page?: number | string;
    limit?: number | string;
    filter?: string;
    search?: string;
  },
  userId?: string,
) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 25));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query?.filter === "UNRESOLVED") {
    where.isResolved = false;
  } else if (query?.filter === "RESOLVED") {
    where.isResolved = true;
  } else if (query?.filter === "MY_POSTS" && userId) {
    where.authorId = userId;
  }

  const searchKeyword = typeof query?.search === "string" ? query.search.trim() : undefined;
  if (searchKeyword) {
    where.OR = [
      { title: { contains: searchKeyword, mode: "insensitive" } },
      { description: { contains: searchKeyword, mode: "insensitive" } },
    ];
  }

  const [posts, total, counts] = await Promise.all([
    forumRepository.findHelpPosts(where, skip, limit),
    forumRepository.countHelpPosts(where),
    forumRepository.getForumCounts(userId),
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

export const getSinglePostService = async (id: string) => {
  const post = await forumRepository.findHelpPostWithDetails(id);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  return post;
};

export const createResponseService = async (
  postId: string,
  responderId: string,
  data: CreateResponsePayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  return await forumRepository.createHelpResponse(postId, responderId, data);
};

export const resolvePostService = async (
  postId: string,
  userId: string,
  role: string,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Admin Override applied here
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return await forumRepository.updateHelpPost(postId, { isResolved: true });
};

// Update Post Service
export const updatePostService = async (
  postId: string,
  userId: string,
  data: UpdatePostPayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Edit action is strictly for the original author (No Admin override requested here)
  if (post.authorId !== userId) {
    throw new AppError("You do not have permission to edit this post.", 403);
  }

  return await forumRepository.updateHelpPost(postId, data);
};

// Delete Post Service
export const deletePostService = async (
  postId: string,
  userId: string,
  role: string,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Admin Override applied here
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return await forumRepository.deleteHelpPostById(postId);
};

export const updateResponseService = async (
  postId: string,
  responseId: string,
  userId: string,
  role: string,
  data: UpdateResponsePayload,
) => {
  const response = await forumRepository.findHelpResponseById(responseId);

  if (!response || response.postId !== postId) {
    throw new AppError("Response not found.", 404);
  }

  if (response.responderId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to edit this response.",
      403,
    );
  }

  return await forumRepository.updateHelpResponse(responseId, data);
};

export const deleteResponseService = async (
  postId: string,
  responseId: string,
  userId: string,
  role: string,
) => {
  const response = await forumRepository.findHelpResponseById(responseId);

  if (!response || response.postId !== postId) {
    throw new AppError("Response not found.", 404);
  }

  if (response.responderId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this response.",
      403,
    );
  }

  return await forumRepository.deleteHelpResponseById(responseId);
};
