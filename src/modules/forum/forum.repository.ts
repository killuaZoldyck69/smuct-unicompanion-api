import { prisma } from "../../lib/prisma";
import {
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
  UpdateResponsePayload,
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
          studentProfile: {
            select: {
              department: true,
              currentSemester: true,
              section: true,
            },
          },
          teacherProfile: {
            select: {
              department: true,
              designation: true,
            },
          },
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

export const getForumCounts = async (userId?: string) => {
  const [total, open, resolved, myPosts] = await Promise.all([
    prisma.helpPost.count(),
    prisma.helpPost.count({ where: { isResolved: false } }),
    prisma.helpPost.count({ where: { isResolved: true } }),
    userId ? prisma.helpPost.count({ where: { authorId: userId } }) : 0,
  ]);

  return {
    total,
    open,
    resolved,
    myPosts,
  };
};

export const findHelpPostById = async (id: string) => {
  return await prisma.helpPost.findUnique({
    where: { id },
  });
};

const responderSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  image: true,
  role: true,
  studentProfile: true,
  teacherProfile: true,
};

export const findHelpPostWithDetails = async (id: string) => {
  return await prisma.helpPost.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          image: true,
          role: true,
          studentProfile: true,
          teacherProfile: true,
        },
      },
      responses: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          responder: {
            select: responderSelect,
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              responder: {
                select: responderSelect,
              },
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
      parentId: data.parentId ?? null,
      postId,
      responderId,
    },
    include: {
      responder: {
        select: responderSelect,
      },
    },
  });
};

export const updateHelpPost = async (
  id: string,
  data: UpdatePostPayload | { isResolved: boolean; updatedAt?: Date },
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

export const findHelpResponseById = async (id: string) => {
  return await prisma.helpResponse.findUnique({
    where: { id },
  });
};

export const updateHelpResponse = async (
  id: string,
  data: UpdateResponsePayload,
) => {
  return await prisma.helpResponse.update({
    where: { id },
    data,
  });
};

export const deleteHelpResponseById = async (id: string) => {
  return await prisma.helpResponse.delete({
    where: { id },
  });
};
