import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as bloodService from "./blood.service";

export const createBloodPost = catchAsync(
  async (req: Request, res: Response) => {
    const authorId = req.user.id;
    const newPost = await bloodService.createBloodPostService(
      authorId,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Blood request created successfully.",
      data: newPost,
    });
  },
);

export const getBloodFeed = catchAsync(async (req: Request, res: Response) => {
  const posts = await bloodService.getBloodFeedService();

  res.status(200).json({
    success: true,
    message: "Blood feed retrieved successfully.",
    data: posts,
  });
});

export const getBloodPostById = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const post = await bloodService.getBloodPostByIdService(id);

    res.status(200).json({
      success: true,
      message: "Blood request retrieved successfully.",
      data: post,
    });
  },
);

export const respondToBloodPost = catchAsync(
  async (req: Request, res: Response) => {
    const postId = req.params.id as string;
    const responderId = req.user.id;

    const response = await bloodService.respondToBloodPostService(
      postId,
      responderId,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Successfully volunteered for this request.",
      data: response,
    });
  },
);

export const markBloodPostResolved = catchAsync(
  async (req: Request, res: Response) => {
    const postId = req.params.id as string;
    const userId = req.user.id;
    const role = req.user.role;

    const resolvedPost = await bloodService.resolveBloodPostService(
      postId,
      userId,
      role,
    );

    res.status(200).json({
      success: true,
      message: "Request marked as fulfilled.",
      data: resolvedPost,
    });
  },
);

export const deleteBloodPost = catchAsync(
  async (req: Request, res: Response) => {
    const postId = req.params.id as string;
    const userId = req.user.id;
    const role = req.user.role;

    await bloodService.deleteBloodPostService(postId, userId, role);

    res.status(200).json({
      success: true,
      message: "Blood request deleted successfully.",
    });
  },
);
