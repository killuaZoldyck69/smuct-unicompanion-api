import { prisma } from "../../lib/prisma";
import type { ComplaintStatus } from "../../../generated/prisma/enums";
import {
  CreateComplaintPayload,
  UpdateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

export const createComplaint = async (
  userId: string,
  data: CreateComplaintPayload,
) => {
  return await prisma.complaint.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      category: data.category,
      isAnonymous: data.isAnonymous ?? false,
    },
  });
};

export const updateComplaint = async (
  id: string,
  data: UpdateComplaintPayload,
) => {
  return await prisma.complaint.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.isAnonymous !== undefined && { isAnonymous: data.isAnonymous }),
    },
  });
};

export interface FindComplaintsQueryOptions {
  status?: ComplaintStatus;
  page?: number;
  limit?: number;
}

export const findComplaintsByUserId = async (
  userId: string,
  options?: FindComplaintsQueryOptions,
) => {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (options?.status) {
    where.status = options.status;
  }

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    },
  };
};

export const getComplaintStatsByUserId = async (userId: string) => {
  const [all, pending, resolved, rejected] = await Promise.all([
    prisma.complaint.count({ where: { userId } }),
    prisma.complaint.count({ where: { userId, status: "PENDING" } }),
    prisma.complaint.count({ where: { userId, status: "RESOLVED" } }),
    prisma.complaint.count({ where: { userId, status: "REJECTED" } }),
  ]);

  return { all, pending, resolved, rejected };
};

export const findAllComplaints = async (take = 100) => {
  return await prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    take,
  });
};

export const findComplaintById = async (id: string) => {
  return await prisma.complaint.findUnique({
    where: { id },
  });
};

export const updateComplaintStatus = async (
  id: string,
  status: UpdateComplaintStatusPayload["status"],
  adminRemarks?: string | null,
) => {
  return await prisma.complaint.update({
    where: { id },
    data: {
      status,
      ...(adminRemarks !== undefined && { adminRemarks }),
    },
  });
};

export const deleteComplaintById = async (id: string) => {
  return await prisma.complaint.delete({
    where: { id },
  });
};
