import { prisma } from "../../lib/prisma";
import { CreateNoticePayload, UpdateNoticePayload } from "./notice.schema";

export const createNotice = async (data: CreateNoticePayload) => {
  return await prisma.notice.create({
    data: {
      referenceNo: data.referenceNo,
      title: data.title,
      category: data.category || "GENERAL",
      body: data.body,
      issuerName: data.issuerName,
      issuerDesignation: data.issuerDesignation,
      copyTo: data.copyTo || [],
    },
  });
};

export interface FindPaginatedNoticesParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: "createdAt" | "issueDate" | "title";
  sortOrder?: "asc" | "desc";
}

export const findPaginatedNotices = async (
  params?: FindPaginatedNoticesParams,
) => {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.max(1, Math.min(100, params?.limit || 20));
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();
  const category = params?.category?.trim();
  const sortBy = params?.sortBy || "createdAt";
  const sortOrder = params?.sortOrder || "desc";

  const where: any = {};

  if (category && category.toUpperCase() !== "ALL") {
    where.category = {
      equals: category.toUpperCase(),
      mode: "insensitive",
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
      { issuerName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, totalCount] = await Promise.all([
    prisma.notice.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    }),
    prisma.notice.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
    },
  };
};

export const findAllNotices = async (take = 100) => {
  return await prisma.notice.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take,
  });
};

export const findNoticeById = async (id: string) => {
  return await prisma.notice.findUnique({
    where: { id },
  });
};

export const updateNoticeById = async (
  id: string,
  data: UpdateNoticePayload,
) => {
  return await prisma.notice.update({
    where: { id },
    data: {
      ...(data.referenceNo !== undefined ? { referenceNo: data.referenceNo } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.issuerName !== undefined ? { issuerName: data.issuerName } : {}),
      ...(data.issuerDesignation !== undefined
        ? { issuerDesignation: data.issuerDesignation }
        : {}),
      ...(data.copyTo !== undefined ? { copyTo: data.copyTo } : {}),
    },
  });
};

export const deleteNoticeById = async (id: string) => {
  return await prisma.notice.delete({
    where: { id },
  });
};
