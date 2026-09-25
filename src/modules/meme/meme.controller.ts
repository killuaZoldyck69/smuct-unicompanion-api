import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import {
  createMemeService,
  deleteMemeService,
  getMemeByIdService,
  getMemesFeedService,
  reactMemeService,
  updateMemeService,
} from "./meme.service";
import { MemeReactionType } from "../../constants/enums";

export const createMeme = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await createMemeService(userId, req.body);

  res.status(201).json({
    success: true,
    message: "Meme posted successfully",
    data: result,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user!.id;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const filter = (req.query.filter as "latest" | "popular" | "mine") || "latest";

  const result = await getMemesFeedService(currentUserId, {
    page,
    limit,
    filter,
  });

  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=60");

  res.status(200).json({
    success: true,
    data: result.memes,
    pagination: result.pagination,
  });
});

export const getMemeById = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  const memeId = req.params.id as string;
  const result = await getMemeByIdService(memeId, currentUserId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const reactMeme = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const memeId = req.params.id as string;
  const { type } = req.body as { type: MemeReactionType };

  const result = await reactMemeService(memeId, userId, type);

  res.status(200).json({
    success: true,
    message: "Reaction updated",
    data: result,
  });
});

export const deleteMeme = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user?.role;
  const memeId = req.params.id as string;

  await deleteMemeService(memeId, userId, userRole);

  res.status(200).json({
    success: true,
    message: "Meme deleted successfully",
  });
});

export const updateMeme = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const memeId = req.params.id as string;

  const result = await updateMemeService(memeId, userId, req.body);

  res.status(200).json({
    success: true,
    message: "Meme updated successfully",
    data: result,
  });
});
