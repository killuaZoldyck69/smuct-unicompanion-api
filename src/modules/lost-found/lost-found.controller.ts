import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import {
  createCommentService,
  createPostService,
  deleteCommentService,
  deletePostService,
  getFeedService,
  getPostByIdService,
  updateStatusService,
} from "./lost-found.service";
import { LostFoundCategory, LostFoundStatus, LostFoundType } from "../../constants/enums";

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
  const { type, status, category, search } = req.query;

  const result = await getFeedService({
    type: type as LostFoundType | undefined,
    status: status as LostFoundStatus | undefined,
    category: category as LostFoundCategory | undefined,
    search: typeof search === "string" ? search : undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await getPostByIdService(req.params.id as string);

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

export const createComment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id as string;

  const result = await createCommentService(postId, userId, req.body);

  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: result,
  });
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user?.role;
  const commentId = req.params.commentId as string;

  await deleteCommentService(commentId, userId, userRole);

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});
