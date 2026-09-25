import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import {
  createCommentService,
  updateCommentService,
  createPostService,
  deleteCommentService,
  deletePostService,
  getFeedService,
  getPostByIdService,
  updatePostService,
  updateStatusService,
} from "./marketplace.service";
import {
  ListingStatus,
  ListingType,
  MarketplaceCategory,
} from "../../constants/enums";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const parseLimit = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(n, MAX_PAGE_LIMIT);
};

const parseCursor = (raw: unknown): string | undefined =>
  typeof raw === "string" && raw.length > 0 ? raw : undefined;

// ---------------------------------------------------------------------------
// Feed — GET /marketplace?type=&status=&category=&search=&limit=&cursor=
// ---------------------------------------------------------------------------
export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const { type, status, category, search, limit, cursor } = req.query;

  const result = await getFeedService(
    {
      type: type as ListingType | undefined,
      status: status as ListingStatus | undefined,
      category: category as MarketplaceCategory | undefined,
      search: typeof search === "string" ? search.trim() : undefined,
    },
    {
      limit: parseLimit(limit),
      cursor: parseCursor(cursor),
    }
  );

  res.status(200).json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------
export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await getPostByIdService(req.params.id as string);
  res.status(200).json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export const createPost = catchAsync(async (req: Request, res: Response) => {
  const result = await createPostService(req.user!.id, req.body);
  res.status(201).json({
    success: true,
    message: "Listing created successfully",
    data: result,
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const result = await updatePostService(
    req.params.id as string,
    req.user!.id,
    req.user?.role,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Listing updated successfully",
    data: result,
  });
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await updateStatusService(
    req.params.id as string,
    req.user!.id,
    req.user?.role,
    req.body.status
  );
  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export const deletePost = catchAsync(async (req: Request, res: Response) => {
  await deletePostService(req.params.id as string, req.user!.id, req.user?.role);
  res.status(200).json({ success: true, message: "Listing deleted successfully" });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const createComment = catchAsync(async (req: Request, res: Response) => {
  const result = await createCommentService(
    req.params.id as string,
    req.user!.id,
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: result,
  });
});

export const updateComment = catchAsync(async (req: Request, res: Response) => {
  const result = await updateCommentService(
    req.params.commentId as string,
    req.user!.id,
    req.user?.role,
    req.body.content
  );
  res.status(200).json({
    success: true,
    message: "Comment updated successfully",
    data: result,
  });
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  await deleteCommentService(
    req.params.commentId as string,
    req.user!.id,
    req.user?.role
  );
  res.status(200).json({ success: true, message: "Comment deleted successfully" });
});
