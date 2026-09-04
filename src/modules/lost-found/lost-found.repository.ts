import { prisma } from "../../lib/prisma";
import {
  LostFoundCategory,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";
import {
  CreateLostFoundCommentPayload,
  CreateLostFoundPayload,
} from "./lost-found.schema";

const authorSelection = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  phoneNumber: true,
  bloodGroup: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      currentSemester: true,
      section: true,
    },
  },
  teacherProfile: {
    select: {
      department: true,
      designation: true,
      officeRoom: true,
      consultationHours: true,
    },
  },
};

export interface LostFoundFeedFilters {
  type?: LostFoundType;
  status?: LostFoundStatus;
  category?: LostFoundCategory;
  search?: string;
}

export const createLostFoundPostInDb = async (
  authorId: string,
  payload: CreateLostFoundPayload
) => {
  return prisma.lostFoundPost.create({
    data: {
      authorId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      location: payload.location,
      images: payload.images,
    },
    include: {
      author: { select: authorSelection },
    },
  });
};

export const findLostFoundFeedInDb = async (filters: LostFoundFeedFilters) => {
  const where: any = {};

  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { location: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.lostFoundPost.findMany({
    where,
    include: {
      author: { select: authorSelection },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findLostFoundPostByIdInDb = async (id: string) => {
  return prisma.lostFoundPost.findUnique({
    where: { id },
    include: {
      author: { select: authorSelection },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: authorSelection },
          replies: {
            include: {
              author: { select: authorSelection },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { comments: true } },
    },
  });
};

export const updateLostFoundStatusInDb = async (
  id: string,
  status: LostFoundStatus
) => {
  return prisma.lostFoundPost.update({
    where: { id },
    data: { status },
    include: {
      author: { select: authorSelection },
    },
  });
};

export const deleteLostFoundPostFromDb = async (id: string) => {
  return prisma.lostFoundPost.delete({
    where: { id },
  });
};

export const createLostFoundCommentInDb = async (
  postId: string,
  authorId: string,
  payload: CreateLostFoundCommentPayload
) => {
  return prisma.lostFoundComment.create({
    data: {
      postId,
      authorId,
      content: payload.content,
      parentId: payload.parentId || null,
    },
    include: {
      author: { select: authorSelection },
    },
  });
};

export const findLostFoundCommentByIdInDb = async (commentId: string) => {
  return prisma.lostFoundComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      postId: true,
    },
  });
};

export const deleteLostFoundCommentFromDb = async (commentId: string) => {
  return prisma.lostFoundComment.delete({
    where: { id: commentId },
  });
};
