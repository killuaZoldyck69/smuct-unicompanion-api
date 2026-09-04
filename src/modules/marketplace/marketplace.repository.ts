import { prisma } from "../../lib/prisma";
import {
  ListingStatus,
  ListingType,
  MarketplaceCategory,
} from "../../constants/enums";
import {
  CreateMarketplaceCommentPayload,
  CreateMarketplacePayload,
} from "./marketplace.schema";

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

export interface MarketplaceFeedFilters {
  type?: ListingType;
  status?: ListingStatus;
  category?: MarketplaceCategory;
  search?: string;
}

export const createMarketplacePostInDb = async (
  authorId: string,
  payload: CreateMarketplacePayload
) => {
  return prisma.marketplacePost.create({
    data: {
      authorId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      price: payload.price ?? null,
      category: payload.category,
      condition: payload.condition ?? null,
      images: payload.images,
      contactPhone: payload.contactPhone ?? null,
    },
    include: {
      author: { select: authorSelection },
    },
  });
};

export const findMarketplaceFeedInDb = async (
  filters: MarketplaceFeedFilters
) => {
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
    ];
  }

  return prisma.marketplacePost.findMany({
    where,
    include: {
      author: { select: authorSelection },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findMarketplacePostByIdInDb = async (id: string) => {
  return prisma.marketplacePost.findUnique({
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

export const updateMarketplaceStatusInDb = async (
  id: string,
  status: ListingStatus
) => {
  return prisma.marketplacePost.update({
    where: { id },
    data: { status },
    include: {
      author: { select: authorSelection },
    },
  });
};

export const deleteMarketplacePostFromDb = async (id: string) => {
  return prisma.marketplacePost.delete({
    where: { id },
  });
};

export const createMarketplaceCommentInDb = async (
  postId: string,
  authorId: string,
  payload: CreateMarketplaceCommentPayload
) => {
  return prisma.marketplaceComment.create({
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

export const findMarketplaceCommentByIdInDb = async (commentId: string) => {
  return prisma.marketplaceComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      postId: true,
    },
  });
};

export const deleteMarketplaceCommentFromDb = async (commentId: string) => {
  return prisma.marketplaceComment.delete({
    where: { id: commentId },
  });
};
