import { AppError } from "../../utils/AppError";
import { ListingStatus } from "../../constants/enums";
import { deleteMultipleImagesFromCloudinary } from "../../lib/cloudinary";
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
  PaginationParams,
  updateMarketplaceCommentInDb,
  updateMarketplacePostInDb,
  updateMarketplaceStatusInDb,
} from "./marketplace.repository";

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
export const getFeedService = async (
  filters: MarketplaceFeedFilters,
  pagination: PaginationParams
) => findMarketplaceFeedInDb(filters, pagination);

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------
export const getPostByIdService = async (id: string) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) throw new AppError("Marketplace listing not found", 404);
  return post;
};

// ---------------------------------------------------------------------------
// Helpers — shared ownership guard
// ---------------------------------------------------------------------------
const assertOwnership = (
  isAuthor: boolean,
  isAdmin: boolean,
  action: string
) => {
  if (!isAuthor && !isAdmin) {
    throw new AppError(
      `Unauthorized: You do not have permission to ${action}`,
      403
    );
  }
};

// ---------------------------------------------------------------------------
// Create / Update / Delete posts
// ---------------------------------------------------------------------------
export const createPostService = async (
  userId: string,
  payload: CreateMarketplacePayload
) => createMarketplacePostInDb(userId, payload);

export const updatePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  payload: Partial<CreateMarketplacePayload>
) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) throw new AppError("Marketplace listing not found", 404);

  assertOwnership(post.authorId === userId, userRole === "ADMIN", "modify this listing");

  // Storage cleanup optimization: detect any removed images from Cloudinary
  if (Array.isArray(payload.images) && Array.isArray(post.images)) {
    const newImageSet = new Set(payload.images);
    const removedImages = post.images.filter((img) => !newImageSet.has(img));
    if (removedImages.length > 0) {
      deleteMultipleImagesFromCloudinary(removedImages).catch((err) =>
        console.warn("[Cloudinary] Failed to clean up removed marketplace images:", err)
      );
    }
  }

  return updateMarketplacePostInDb(id, payload);
};

export const updateStatusService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: ListingStatus
) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) throw new AppError("Marketplace listing not found", 404);

  assertOwnership(post.authorId === userId, userRole === "ADMIN", "modify this listing");

  return updateMarketplaceStatusInDb(id, status);
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined
) => {
  const post = await findMarketplacePostByIdInDb(id);
  if (!post) throw new AppError("Marketplace listing not found", 404);

  assertOwnership(post.authorId === userId, userRole === "ADMIN", "delete this listing");

  // Collect post images before deleting from DB
  const imagesToDelete: string[] = Array.isArray(post.images)
    ? [...post.images]
    : [];

  const result = await deleteMarketplacePostFromDb(id);

  // Storage cleanup optimization: delete associated images from Cloudinary
  if (imagesToDelete.length > 0) {
    deleteMultipleImagesFromCloudinary(imagesToDelete).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up marketplace post images on deletion:", err)
    );
  }

  return result;
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const createCommentService = async (
  postId: string,
  userId: string,
  payload: CreateMarketplaceCommentPayload
) => {
  const post = await findMarketplacePostByIdInDb(postId);
  if (!post) throw new AppError("Listing not found", 404);

  if (payload.parentId) {
    const parent = await findMarketplaceCommentByIdInDb(payload.parentId);
    if (!parent || parent.postId !== postId) {
      throw new AppError("Parent comment not found on this listing", 404);
    }
  }

  return createMarketplaceCommentInDb(postId, userId, payload);
};

export const updateCommentService = async (
  commentId: string,
  userId: string,
  userRole: string | undefined,
  content: string
) => {
  const comment = await findMarketplaceCommentByIdInDb(commentId);
  if (!comment) throw new AppError("Comment not found", 404);

  // Only the original author can edit their own comment text
  assertOwnership(comment.authorId === userId, false, "edit this comment");

  return updateMarketplaceCommentInDb(commentId, content);
};

export const deleteCommentService = async (
  commentId: string,
  userId: string,
  userRole: string | undefined
) => {
  const comment = await findMarketplaceCommentByIdInDb(commentId);
  if (!comment) throw new AppError("Comment not found", 404);

  assertOwnership(comment.authorId === userId, userRole === "ADMIN", "delete this comment");

  return deleteMarketplaceCommentFromDb(commentId);
};
