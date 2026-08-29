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

export const findBloodFeed = async (take = 100) => {
  return await prisma.bloodPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take,
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
