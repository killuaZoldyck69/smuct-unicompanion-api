import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ListingStatus } from "../../constants/enums";
import type { GetMarketplaceFeedQuery } from "./marketplace.schema";
import { createMarketplaceReportAndEvaluateAutoHideInDb } from "./marketplace.moderation.repository";
import {
  deleteMarketplaceCommentAtomicInDb,
  updateMarketplaceStatusAtomicInDb,
} from "./marketplace.repository";
import {
  createCommentService,
  createPostService,
  deletePostService,
  getFeedService,
  getPostByIdService,
  updateCommentService,
  updatePostService,
} from "./marketplace.service";

function requireViewer(req: Request) {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const { limit, cursor, ...filters } =
    req.query as unknown as GetMarketplaceFeedQuery;
  const result = await getFeedService(
    { ...filters, viewerId: viewer.id, viewerRole: viewer.role },
    { limit, cursor },
  );
  res.status(200).json({ success: true, data: result });
});

export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await getPostByIdService(
    String(req.params.id),
    viewer.id,
    viewer.role,
  );
  res.status(200).json({ success: true, data: result });
});

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await createPostService(viewer.id, req.body);
  res.status(201).json({
    success: true,
    message: "Listing created successfully",
    data: result,
  });
});

export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await updatePostService(
    String(req.params.id),
    viewer.id,
    viewer.role,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Listing updated successfully",
    data: result,
  });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await updateMarketplaceStatusAtomicInDb(
    String(req.params.id),
    viewer.id,
    viewer.role,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const markAsSold = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await updateMarketplaceStatusAtomicInDb(
    String(req.params.id),
    viewer.id,
    viewer.role,
    ListingStatus.SOLD,
  );
  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  await deletePostService(String(req.params.id), viewer.id, viewer.role);
  res.status(200).json({
    success: true,
    message: "Listing deleted successfully",
  });
});

export const createComment = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await createCommentService(
    String(req.params.id),
    viewer.id,
    viewer.role,
    req.body,
  );
  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: result,
  });
});

export const updateComment = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await updateCommentService(
    String(req.params.id),
    String(req.params.commentId),
    viewer.id,
    req.body.content,
  );
  res.status(200).json({
    success: true,
    message: "Comment updated successfully",
    data: result,
  });
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  await deleteMarketplaceCommentAtomicInDb(
    String(req.params.id),
    String(req.params.commentId),
    viewer.id,
    viewer.role,
  );
  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});

export const reportMarketplaceContent = catchAsync(
  async (req: Request, res: Response) => {
    const viewer = requireViewer(req);
    const result = await createMarketplaceReportAndEvaluateAutoHideInDb({
      reporterId: viewer.id,
      targetType: req.body.targetType,
      targetId: req.body.targetId,
      reason: req.body.reason,
      details: req.body.details,
    });
    res.status(201).json({
      success: true,
      message: result.autoHidden
        ? "Report submitted. Content has been hidden pending moderator review."
        : "Report submitted. Our moderators will review this content.",
      data: result,
    });
  },
);
