import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import type { GetLostFoundFeedQuery } from "./lost-found.schema";
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
  reportLostFoundPostService,
  updatePostService,
  updateStatusService,
  withdrawClaimService,
} from "./lost-found.service";

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const result = await createPostService(req.user!.id, req.body);

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as GetLostFoundFeedQuery;

  const result = await getFeedService({
    type: query.type,
    status: query.status,
    category: query.category,
    search: query.search,
    myPosts: query.myPosts === "true",
    viewerId: req.user!.id,
    viewerRole: req.user!.role,
    page: query.page,
    limit: query.limit,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getPossibleMatches = catchAsync(
  async (req: Request, res: Response) => {
    const result = await getPossibleMatchesService(
      req.params.id as string,
      req.user!.id,
      req.user!.role,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  },
);

export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await getPostByIdService(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const result = await updatePostService(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await updateStatusService(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
    req.body.status,
  );

  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  await deletePostService(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
  );

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

export const submitClaim = catchAsync(async (req: Request, res: Response) => {
  const result = await createClaimService(
    req.params.id as string,
    req.user!.id,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Claim submitted successfully",
    data: result,
  });
});

export const getClaims = catchAsync(async (req: Request, res: Response) => {
  const result = await getClaimsForPostService(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const acceptClaim = catchAsync(async (req: Request, res: Response) => {
  const result = await acceptClaimService(
    req.params.id as string,
    req.params.claimId as string,
    req.user!.id,
  );

  res.status(200).json({
    success: true,
    message: "Claim accepted and post resolved successfully",
    data: result,
  });
});

export const rejectClaim = catchAsync(async (req: Request, res: Response) => {
  const result = await rejectClaimService(
    req.params.id as string,
    req.params.claimId as string,
    req.user!.id,
  );

  res.status(200).json({
    success: true,
    message: "Claim rejected successfully",
    data: result,
  });
});

export const withdrawClaim = catchAsync(
  async (req: Request, res: Response) => {
    const result = await withdrawClaimService(
      req.params.id as string,
      req.params.claimId as string,
      req.user!.id,
      req.user!.role,
    );

    res.status(200).json({
      success: true,
      message: "Claim withdrawn successfully",
      data: result,
    });
  },
);

export const reportPost = catchAsync(async (req: Request, res: Response) => {
  const result = await reportLostFoundPostService(
    req.params.id as string,
    req.user!.id,
    req.body,
  );

  res.status(201).json({
    success: true,
    message:
      "Thank you. Your report has been submitted and this listing is now hidden from your feed.",
    data: result,
  });
});
