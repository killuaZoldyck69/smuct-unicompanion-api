import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as forumService from "./forum.service";

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const authorId = req.user.id;
  const newPost = await forumService.createPostService(authorId, req.body);

  res.status(201).json({
    success: true,
    message: "Forum post created successfully.",
    data: newPost,
  });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const posts = await forumService.getAllPostsService();

  res.status(200).json({
    success: true,
    message: "Forum feed retrieved successfully.",
    data: posts,
  });
});

export const getThread = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const post = await forumService.getSinglePostService(id);

  res.status(200).json({
    success: true,
    message: "Forum thread retrieved successfully.",
    data: post,
  });
});

export const replyToPost = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id as string;
  const responderId = req.user.id;

  const response = await forumService.createResponseService(
    postId,
    responderId,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Reply added successfully.",
    data: response,
  });
});

export const markResolved = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id as string;
  const userId = req.user.id;
  const role = req.user.role; // Extract role for Admin check

  const resolvedPost = await forumService.resolvePostService(
    postId,
    userId,
    role,
  );

  res.status(200).json({
    success: true,
    message: "Post marked as resolved successfully.",
    data: resolvedPost,
  });
});

// Update Post Controller
export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id as string;
  const userId = req.user.id;

  const updatedPost = await forumService.updatePostService(
    postId,
    userId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Forum post updated successfully.",
    data: updatedPost,
  });
});

// Delete Post Controller
export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id as string;
  const userId = req.user.id;
  const role = req.user.role; // Extract role for Admin check

  await forumService.deletePostService(postId, userId, role);

  res.status(200).json({
    success: true,
    message: "Forum post deleted successfully.",
  });
});
