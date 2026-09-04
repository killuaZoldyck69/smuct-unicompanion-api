import { AppError } from "../../utils/AppError";
import { LostFoundStatus } from "../../constants/enums";
import {
  CreateLostFoundCommentPayload,
  CreateLostFoundPayload,
} from "./lost-found.schema";
import {
  createLostFoundCommentInDb,
  createLostFoundPostInDb,
  deleteLostFoundCommentFromDb,
  deleteLostFoundPostFromDb,
  findLostFoundCommentByIdInDb,
  findLostFoundFeedInDb,
  findLostFoundPostByIdInDb,
  LostFoundFeedFilters,
  updateLostFoundStatusInDb,
} from "./lost-found.repository";

export const createPostService = async (
  userId: string,
  payload: CreateLostFoundPayload
) => {
  return createLostFoundPostInDb(userId, payload);
};

export const getFeedService = async (filters: LostFoundFeedFilters) => {
  return findLostFoundFeedInDb(filters);
};

export const getPostByIdService = async (id: string) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }
  return post;
};

export const updateStatusService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: LostFoundStatus
) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to modify this post",
      403
    );
  }

  return updateLostFoundStatusInDb(id, status);
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined
) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to delete this post",
      403
    );
  }

  return deleteLostFoundPostFromDb(id);
};

export const createCommentService = async (
  postId: string,
  userId: string,
  payload: CreateLostFoundCommentPayload
) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  if (payload.parentId) {
    const parentComment = await findLostFoundCommentByIdInDb(payload.parentId);
    if (!parentComment || parentComment.postId !== postId) {
      throw new AppError("Parent comment not found on this post", 404);
    }
  }

  return createLostFoundCommentInDb(postId, userId, payload);
};

export const deleteCommentService = async (
  commentId: string,
  userId: string,
  userRole: string | undefined
) => {
  const comment = await findLostFoundCommentByIdInDb(commentId);
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  const isAuthor = comment.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to delete this comment",
      403
    );
  }

  return deleteLostFoundCommentFromDb(commentId);
};
