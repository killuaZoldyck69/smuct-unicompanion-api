import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
} from "./forum.schema";

export const createPostService = async (
  authorId: string,
  data: CreatePostPayload,
) => {
  return await prisma.helpPost.create({
    data: {
      title: data.title,
      description: data.description,
      authorId,
    },
  });
};

export const getAllPostsService = async () => {
  return await prisma.helpPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
      _count: {
        select: { responses: true },
      },
    },
  });
};

export const getSinglePostService = async (id: string) => {
  const post = await prisma.helpPost.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          responder: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
  });

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  return post;
};

export const createResponseService = async (
  postId: string,
  responderId: string,
  data: CreateResponsePayload,
) => {
  const post = await prisma.helpPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  return await prisma.helpResponse.create({
    data: {
      content: data.content,
      postId,
      responderId,
    },
  });
};

export const resolvePostService = async (postId: string, userId: string) => {
  const post = await prisma.helpPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.authorId !== userId) {
    throw new AppError("You do not have permission to resolve this post.", 403);
  }

  return await prisma.helpPost.update({
    where: { id: postId },
    data: { isResolved: true },
  });
};

// NEW: Update Post Service
export const updatePostService = async (
  postId: string,
  userId: string,
  data: UpdatePostPayload,
) => {
  const post = await prisma.helpPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.authorId !== userId) {
    throw new AppError("You do not have permission to edit this post.", 403);
  }

  return await prisma.helpPost.update({
    where: { id: postId },
    data, // Prisma natively ignores undefined values
  });
};

// NEW: Delete Post Service
export const deletePostService = async (postId: string, userId: string) => {
  const post = await prisma.helpPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }

  if (post.authorId !== userId) {
    throw new AppError("You do not have permission to delete this post.", 403);
  }

  return await prisma.helpPost.delete({
    where: { id: postId },
  });
};
