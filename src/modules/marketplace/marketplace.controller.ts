import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ListingStatus } from "../../constants/enums";
import {
  createCommentService,
  createMarketplaceReportService,
  createPostService,
  deleteCommentService,
  deletePostService,
  getFeedService,
  getPostByIdService,
  updateCommentService,
  updatePostService,
  updateStatusService,
} from "./marketplace.service";
import type { GetMarketplaceFeedQuery } from "./marketplace.schema";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Feed — GET /marketplace?type=&status=&category=&search=&myPosts=&limit=&cursor=
// ---------------------------------------------------------------------------
export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const q = req.query as unknown as GetMarketplaceFeedQuery;
  const parsedLimit =
    typeof q.limit === "number" && Number.isFinite(q.limit) && q.limit >= 1
      ? Math.min(q.limit, MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT;

  const result = await getFeedService(
    {
      type: q.type,
      status: q.status,
      category: q.category,
      search: q.search,
      myPosts: q.myPosts === "true",
      viewerId: req.user!.id,
      viewerRole: req.user?.role,
    },
    {
      limit: parsedLimit,
      cursor: q.cursor,
    },
  );

  res.status(200).json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------
export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await getPostByIdService(
    req.params.id as string,
    req.user!.id,
    req.user?.role,
  );
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
    req.body,
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
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const markAsSold = catchAsync(async (req: Request, res: Response) => {
  const result = await updateStatusService(
    req.params.id as string,
    req.user!.id,
    req.user?.role,
    ListingStatus.SOLD,
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
  res.status(200).json({
    success: true,
    message: "Listing deleted successfully",
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const createComment = catchAsync(async (req: Request, res: Response) => {
  const result = await createCommentService(
    req.params.id as string,
    req.user!.id,
    req.user?.role,
    req.body,
  );
  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: result,
  });
});

export const updateComment = catchAsync(async (req: Request, res: Response) => {
  const result = await updateCommentService(
    req.params.id as string,
    req.params.commentId as string,
    req.user!.id,
    req.body.content,
  );
  res.status(200).json({
    success: true,
    message: "Comment updated successfully",
    data: result,
  });
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  await deleteCommentService(
    req.params.id as string,
    req.params.commentId as string,
    req.user!.id,
    req.user?.role,
  );
  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});

// ---------------------------------------------------------------------------
// UGC Moderation Reports
// ---------------------------------------------------------------------------
export const reportMarketplaceContent = catchAsync(
  async (req: Request, res: Response) => {
    const result = await createMarketplaceReportService(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      message: result.autoHidden
        ? "Report submitted. Content has been hidden pending moderator review."
        : "Report submitted. Our moderators will review this content.",
      data: result,
    });
  },
);
