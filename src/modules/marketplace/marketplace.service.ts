import { AppError } from "../../utils/AppError";
import { ListingStatus } from "../../constants/enums";
import {
  CreateMarketplaceCommentPayload,
  CreateMarketplacePayload,
} from "./marketplace.schema";
import {
  createMarketplaceCommentInDb,
  createMarketplacePostInDb,
  deleteMarketplaceCommentFromDb,
  deleteMarketplacePostFromDb,
  findMarketplaceCommentByIdInDb,
  findMarketplaceFeedInDb,
  findMarketplacePostByIdInDb,
  MarketplaceFeedFilters,
  updateMarketplaceStatusInDb,
} from "./marketplace.repository";

export const createPostService = async (
  userId: string,
  payload: CreateMarketplacePayload
) => {
  return createMarketplacePostInDb(userId, payload);
};

export const getFeedService = async (filters: MarketplaceFeedFilters) => {
  return findMarketplaceFeedInDb(filters);
};

export const getPostByIdService = async (id: string) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) {
    throw new AppError("Marketplace listing not found", 404);
  }
  return post;
};

export const updateStatusService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: ListingStatus
) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) {
    throw new AppError("Marketplace listing not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to modify this listing",
      403
    );
  }

  return updateMarketplaceStatusInDb(id, status);
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined
) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) {
    throw new AppError("Marketplace listing not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to delete this listing",
      403
    );
  }

  return deleteMarketplacePostFromDb(id);
};

export const createCommentService = async (
  postId: string,
  userId: string,
  payload: CreateMarketplaceCommentPayload
) => {
  const post = await findMarketplacePostByIdInDb(postId);
  if (!post) {
    throw new AppError("Listing not found", 404);
  }

  if (payload.parentId) {
    const parentComment = await findMarketplaceCommentByIdInDb(
      payload.parentId
    );
    if (!parentComment || parentComment.postId !== postId) {
      throw new AppError("Parent comment not found on this listing", 404);
    }
  }

  return createMarketplaceCommentInDb(postId, userId, payload);
};

export const deleteCommentService = async (
  commentId: string,
  userId: string,
  userRole: string | undefined
) => {
  const comment = await findMarketplaceCommentByIdInDb(commentId);
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

  return deleteMarketplaceCommentFromDb(commentId);
};
