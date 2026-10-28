import { AppError } from "../../utils/AppError";
import * as forumRepository from "./forum.repository";
import {
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
  UpdateResponsePayload,
  ResolvePostPayload,
} from "./forum.schema";
import {
  validateAndSanitizePost,
  validateAndSanitizeResponse,
} from "./forum.sanitizer";

export const createPostService = async (
  authorId: string,
  data: CreatePostPayload,
) => {
  const validation = validateAndSanitizePost(data);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  return await forumRepository.createHelpPost(authorId, {
    title: validation.cleanTitle!,
    description: validation.cleanDescription!,
  });
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
  role: string,
  data: CreateResponsePayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Prevent posting replies to resolved threads unless Admin
  if (post.isResolved && role !== "ADMIN") {
    throw new AppError(
      "Cannot reply to a resolved discussion. Please reopen the discussion or start a new topic.",
      403,
    );
  }

  const validation = validateAndSanitizeResponse(data.content);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  let finalParentId = data.parentId ?? null;
  if (finalParentId) {
    const parentResponse = await forumRepository.findHelpResponseById(finalParentId);
    if (!parentResponse || parentResponse.postId !== postId) {
      throw new AppError("Parent response not found.", 404);
    }
    // Flatten if replying to an existing reply (maintains strict 2-tier discussion hierarchy)
    if (parentResponse.parentId) {
      finalParentId = parentResponse.parentId;
    }
  }

  return await forumRepository.createHelpResponse(postId, responderId, {
    content: validation.cleanContent!,
    parentId: finalParentId,
  });
};

export const resolvePostService = async (
  postId: string,
  userId: string,
  role: string,
  data?: ResolvePostPayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Post author or Admin can toggle/set resolution state
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  // If specific isResolved provided, use it; otherwise toggle current state
  const targetResolved =
    typeof data?.isResolved === "boolean" ? data.isResolved : !post.isResolved;

  return await forumRepository.updateHelpPost(postId, {
    isResolved: targetResolved,
    updatedAt: post.updatedAt,
  });
};

export const updatePostService = async (
  postId: string,
  userId: string,
  role: string,
  data: UpdatePostPayload,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Original author or Admin can edit/moderate post
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError("You do not have permission to edit this post.", 403);
  }

  // Prevent modifying post content once resolved, unless Admin
  if (post.isResolved && role !== "ADMIN") {
    throw new AppError(
      "Cannot edit a resolved discussion. Please reopen the discussion first.",
      403,
    );
  }

  const validation = validateAndSanitizePost(data);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  const updateData: UpdatePostPayload = {};
  if (validation.cleanTitle !== undefined) {
    updateData.title = validation.cleanTitle;
  }
  if (validation.cleanDescription !== undefined) {
    updateData.description = validation.cleanDescription;
  }

  return await forumRepository.updateHelpPost(postId, updateData);
};

export const deletePostService = async (
  postId: string,
  userId: string,
  role: string,
) => {
  const post = await forumRepository.findHelpPostById(postId);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  // Author or Admin can delete
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
  const [post, response] = await Promise.all([
    forumRepository.findHelpPostById(postId),
    forumRepository.findHelpResponseById(responseId),
  ]);

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.isResolved && role !== "ADMIN") {
    throw new AppError("Cannot edit responses on a resolved discussion.", 403);
  }

  if (!response || response.postId !== postId) {
    throw new AppError("Response not found.", 404);
  }

  if (response.responderId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to edit this response.",
      403,
    );
  }

  const validation = validateAndSanitizeResponse(data.content);
  if (validation.error) {
    throw new AppError(validation.error, 400);
  }

  return await forumRepository.updateHelpResponse(responseId, {
    content: validation.cleanContent!,
  });
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
