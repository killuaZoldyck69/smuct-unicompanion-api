import { Request, Response } from "express";
import { MemeReactionType } from "../../constants/enums";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { MAX_MEME_FEED_LIMIT } from "./meme.domain";
import {
  CreateMemeReportBodyPayload,
  CreateMemeReportByIdPayload,
  QueryMemesQuery,
  UpdateMemePayload,
} from "./meme.schema";
import {
  createMemeService,
  deleteMemeService,
  getMemeByIdService,
  getMemesFeedService,
  reactMemeService,
  reportMemeService,
  updateMemeService,
} from "./meme.service";

function requireViewer(req: Request) {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export const createMeme = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const result = await createMemeService(viewer.id, req.body);

  res.status(201).json({
    success: true,
    message: "Meme posted successfully",
    data: result,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const rawQuery = req.query as unknown as Partial<QueryMemesQuery>;
  const page = Math.max(1, Number(rawQuery.page) || 1);
  const limit = Math.max(
    1,
    Math.min(MAX_MEME_FEED_LIMIT, Number(rawQuery.limit) || 20),
  );
  const filter =
    rawQuery.filter === "popular" || rawQuery.filter === "mine"
      ? rawQuery.filter
      : "latest";

  const result = await getMemesFeedService(
    viewer.id,
    { page, limit, filter },
    viewer.role,
  );

  res.setHeader(
    "Cache-Control",
    "private, max-age=15, stale-while-revalidate=60",
  );

  res.status(200).json({
    success: true,
    data: result.memes,
    pagination: result.pagination,
  });
});

export const getMemeById = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const memeId = String(req.params.id);
  const result = await getMemeByIdService(memeId, viewer.id, viewer.role);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const reactMeme = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const memeId = String(req.params.id);
  const { type } = req.body as { type: MemeReactionType };

  const result = await reactMemeService(memeId, viewer.id, type, viewer.role);

  res.status(200).json({
    success: true,
    message: "Reaction updated",
    data: result,
  });
});

export const deleteMeme = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const memeId = String(req.params.id);

  await deleteMemeService(memeId, viewer.id, viewer.role);

  res.status(200).json({
    success: true,
    message: "Meme deleted successfully",
  });
});

export const updateMeme = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const memeId = String(req.params.id);

  const result = await updateMemeService(
    memeId,
    viewer.id,
    req.body as UpdateMemePayload,
  );

  res.status(200).json({
    success: true,
    message: "Meme updated successfully",
    data: result,
  });
});

export const reportMeme = catchAsync(async (req: Request, res: Response) => {
  const viewer = requireViewer(req);
  const paramId = req.params.id ? String(req.params.id) : undefined;
  const body = req.body as Partial<CreateMemeReportBodyPayload> &
    CreateMemeReportByIdPayload;
  const memeId = paramId ?? body.targetId ?? body.memeId;

  if (!memeId) {
    throw new AppError("Meme ID is required", 400);
  }

  const result = await reportMemeService({
    reporterId: viewer.id,
    memeId,
    reason: body.reason,
    details: body.details,
  });

  res.status(201).json({
    success: true,
    message: result.autoHidden
      ? "Report submitted. This meme has been hidden pending moderator review."
      : "Report submitted. Our moderators will review this meme.",
    data: result,
  });
});
