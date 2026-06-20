import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  CreateBloodPostPayload,
  RespondBloodPostPayload,
} from "./blood.schema";

export const createBloodPostService = async (
  authorId: string,
  data: CreateBloodPostPayload,
) => {
  return await prisma.bloodPost.create({
    data: {
      ...data,
      authorId,
    },
  });
};

export const getBloodFeedService = async () => {
  return await prisma.bloodPost.findMany({
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

export const getBloodPostByIdService = async (id: string) => {
  const post = await prisma.bloodPost.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          bloodGroup: true,
          phoneNumber: true,
          studentProfile: true,
          teacherProfile: true,
        },
      },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              image: true,
              bloodGroup: true,
              phoneNumber: true,
              studentProfile: true,
              teacherProfile: true,
            },
          },
        },
      },
    },
  });

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  return post;
};

export const respondToBloodPostService = async (
  postId: string,
  responderId: string,
  data: RespondBloodPostPayload,
) => {
  const post = await prisma.bloodPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  // Prevent users from responding to their own requests
  if (post.authorId === responderId) {
    throw new AppError("You cannot volunteer for your own blood request.", 400);
  }

  // Prevent duplicate responses from the same user on the same post
  const existingResponse = await prisma.bloodResponse.findFirst({
    where: { postId, responderId },
  });

  if (existingResponse) {
    throw new AppError("You have already responded to this request.", 409);
  }

  return await prisma.bloodResponse.create({
    data: {
      postId,
      responderId,
      message: data.message,
    },
  });
};

export const resolveBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await prisma.bloodPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to mark this request as fulfilled.",
      403,
    );
  }

  return await prisma.bloodPost.update({
    where: { id: postId },
    data: { isFulfilled: true },
  });
};

export const deleteBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await prisma.bloodPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this request.",
      403,
    );
  }

  return await prisma.bloodPost.delete({
    where: { id: postId },
  });
};
