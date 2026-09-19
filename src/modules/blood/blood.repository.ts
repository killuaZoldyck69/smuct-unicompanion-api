import { prisma } from "../../lib/prisma";
import { CreateBloodPostPayload } from "./blood.schema";

export const createBloodPost = async (
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

export const findBloodFeed = async (
  where: Record<string, any> = {},
  skip = 0,
  take = 25,
) => {
  return await prisma.bloodPost.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          studentProfile: {
            select: { department: true },
          },
          teacherProfile: {
            select: { department: true, designation: true },
          },
        },
      },
      _count: {
        select: { responses: true },
      },
    },
  });
};

export const countBloodPosts = async (where: Record<string, any> = {}) => {
  return await prisma.bloodPost.count({ where });
};

export const getBloodCounts = async (userId?: string) => {
  const [total, active, urgent, fulfilled, myPosts] = await Promise.all([
    prisma.bloodPost.count(),
    prisma.bloodPost.count({ where: { isFulfilled: false } }),
    prisma.bloodPost.count({ where: { urgency: "High", isFulfilled: false } }),
    prisma.bloodPost.count({ where: { isFulfilled: true } }),
    userId ? prisma.bloodPost.count({ where: { authorId: userId } }) : 0,
  ]);

  return {
    total,
    active,
    urgent,
    fulfilled,
    myPosts,
  };
};

export const findBloodPostById = async (id: string) => {
  return await prisma.bloodPost.findUnique({
    where: { id },
  });
};

export const findBloodPostWithDetails = async (id: string) => {
  return await prisma.bloodPost.findUnique({
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
};

export const findBloodResponse = async (
  postId: string,
  responderId: string,
) => {
  return await prisma.bloodResponse.findFirst({
    where: { postId, responderId },
  });
};

export const createBloodResponse = async (
  postId: string,
  responderId: string,
  message?: string,
) => {
  return await prisma.bloodResponse.create({
    data: {
      postId,
      responderId,
      message,
    },
  });
};

export const updateBloodPostFulfilled = async (
  id: string,
  isFulfilled: boolean,
) => {
  return await prisma.bloodPost.update({
    where: { id },
    data: { isFulfilled },
  });
};

export const deleteBloodPostById = async (id: string) => {
  return await prisma.bloodPost.delete({
    where: { id },
  });
};
