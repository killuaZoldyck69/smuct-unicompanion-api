import { prisma } from "../../lib/prisma";
import {
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
} from "./forum.schema";

export const createHelpPost = async (
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

export const findHelpPosts = async (
  where: Record<string, any>,
  skip: number,
  take: number,
) => {
  return await prisma.helpPost.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
      _count: {
        select: { responses: true },
      },
    },
  });
};

export const countHelpPosts = async (where: Record<string, any>) => {
  return await prisma.helpPost.count({ where });
};

export const findHelpPostById = async (id: string) => {
  return await prisma.helpPost.findUnique({
    where: { id },
  });
};

export const findHelpPostWithDetails = async (id: string) => {
  return await prisma.helpPost.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
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
              role: true,
              studentProfile: true,
              teacherProfile: true,
            },
          },
        },
      },
    },
  });
};

export const createHelpResponse = async (
  postId: string,
  responderId: string,
  data: CreateResponsePayload,
) => {
  return await prisma.helpResponse.create({
    data: {
      content: data.content,
      postId,
      responderId,
    },
  });
};

export const updateHelpPost = async (
  id: string,
  data: UpdatePostPayload | { isResolved: boolean },
) => {
  return await prisma.helpPost.update({
    where: { id },
    data,
  });
};

export const deleteHelpPostById = async (id: string) => {
  return await prisma.helpPost.delete({
    where: { id },
  });
};
