import { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
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

function getAuthActor(req: Request): { id: string; role?: string } {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

function getParamId(req: Request, key: "id" | "claimId"): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await createPostService(actor.id, req.body);

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const query = req.query as GetLostFoundFeedQuery;

  const result = await getFeedService({
    type: query.type,
    status: query.status,
    category: query.category,
    search: query.search,
    myPosts: query.myPosts === "true",
    viewerId: actor.id,
    viewerRole: actor.role,
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
    const actor = getAuthActor(req);
    const result = await getPossibleMatchesService(
      getParamId(req, "id"),
      actor.id,
      actor.role,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  },
);

export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await getPostByIdService(
    getParamId(req, "id"),
    actor.id,
    actor.role,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await updatePostService(
    getParamId(req, "id"),
    actor.id,
    actor.role,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await updateStatusService(
    getParamId(req, "id"),
    actor.id,
    actor.role,
    req.body.status,
  );

  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  await deletePostService(getParamId(req, "id"), actor.id, actor.role);

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

export const submitClaim = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await createClaimService(
    getParamId(req, "id"),
    actor.id,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Claim submitted successfully",
    data: result,
  });
});

export const getClaims = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await getClaimsForPostService(
    getParamId(req, "id"),
    actor.id,
    actor.role,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const acceptClaim = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await acceptClaimService(
    getParamId(req, "id"),
    getParamId(req, "claimId"),
    actor.id,
  );

  res.status(200).json({
    success: true,
    message: "Claim accepted and post resolved successfully",
    data: result,
  });
});

export const rejectClaim = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await rejectClaimService(
    getParamId(req, "id"),
    getParamId(req, "claimId"),
    actor.id,
  );

  res.status(200).json({
    success: true,
    message: "Claim rejected successfully",
    data: result,
  });
});

export const withdrawClaim = catchAsync(
  async (req: Request, res: Response) => {
    const actor = getAuthActor(req);
    const result = await withdrawClaimService(
      getParamId(req, "id"),
      getParamId(req, "claimId"),
      actor.id,
      actor.role,
    );

    res.status(200).json({
      success: true,
      message: "Claim withdrawn successfully",
      data: result,
    });
  },
);

export const reportPost = catchAsync(async (req: Request, res: Response) => {
  const actor = getAuthActor(req);
  const result = await reportLostFoundPostService(
    getParamId(req, "id"),
    actor.id,
    req.body,
  );

  res.status(201).json({
    success: true,
    message:
      "Thank you. Your report has been submitted and this listing is now hidden from your feed.",
    data: result,
  });
});
