import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import {
  acceptClaimService,
  createClaimService,
  createPostService,
  deletePostService,
  getClaimsForPostService,
  getFeedService,
  getPossibleMatchesService,
  getPostByIdService,
  rejectClaimService,
  updateStatusService,
  withdrawClaimService,
} from "./lost-found.service";
import {
  LostFoundCategory,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await createPostService(userId, req.body);

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const { type, status, category, search, myPosts, page, limit } = req.query;
  const userId = req.user?.id;

  const result = await getFeedService({
    type: type as LostFoundType | undefined,
    status: status as LostFoundStatus | undefined,
    category: category as LostFoundCategory | undefined,
    search: typeof search === "string" ? search : undefined,
    myPosts: myPosts === "true",
    viewerId: userId,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getPossibleMatches = catchAsync(async (req: Request, res: Response) => {
  const result = await getPossibleMatchesService(req.params.id as string);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await getPostByIdService(req.params.id as string, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user?.role;
  const { status } = req.body;

  const result = await updateStatusService(
    req.params.id as string,
    userId,
    userRole,
    status
  );

  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user?.role;

  await deletePostService(req.params.id as string, userId, userRole);

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

// ==============================
// CLAIMS CONTROLLERS
// ==============================

export const submitClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;

  const result = await createClaimService(postId, userId, req.body);

  res.status(201).json({
    success: true,
    message: "Claim submitted successfully",
    data: result,
  });
});

export const getClaims = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;

  const result = await getClaimsForPostService(postId, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const acceptClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;
  const claimId = req.params.claimId as string;

  const result = await acceptClaimService(postId, claimId, userId);

  res.status(200).json({
    success: true,
    message: "Claim accepted and post resolved successfully",
    data: result,
  });
});

export const rejectClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;
  const claimId = req.params.claimId as string;

  const result = await rejectClaimService(postId, claimId, userId);

  res.status(200).json({
    success: true,
    message: "Claim rejected successfully",
    data: result,
  });
});

export const withdrawClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;
  const claimId = req.params.claimId as string;

  const result = await withdrawClaimService(postId, claimId, userId);

  res.status(200).json({
    success: true,
    message: "Claim withdrawn successfully",
    data: result,
  });
});

