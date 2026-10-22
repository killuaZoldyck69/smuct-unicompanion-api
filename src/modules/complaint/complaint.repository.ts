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

  const where: any = { userId, deletedAt: null };
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
  const [all, pending, accepted, resolved, rejected] = await Promise.all([
    prisma.complaint.count({ where: { userId, deletedAt: null } }),
    prisma.complaint.count({ where: { userId, status: "PENDING", deletedAt: null } }),
    prisma.complaint.count({ where: { userId, status: "ACCEPTED", deletedAt: null } }),
    prisma.complaint.count({ where: { userId, status: "RESOLVED", deletedAt: null } }),
    prisma.complaint.count({ where: { userId, status: "REJECTED", deletedAt: null } }),
  ]);

  return { all, pending, accepted, resolved, rejected };
};

export interface FindAllComplaintsOptions {
  status?: ComplaintStatus | "ALL";
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

const userSelectFields = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      program: true,
    },
  },
  teacherProfile: {
    select: {
      teacherId: true,
      department: true,
      designation: true,
    },
  },
};

export const findAllComplaints = async (options?: FindAllComplaintsOptions) => {
  const where: any = { deletedAt: null };

  if (options?.status && options.status !== "ALL") {
    where.status = options.status;
  }

  if (options?.category && options.category !== "ALL") {
    where.category = { equals: options.category, mode: "insensitive" };
  }

  if (options?.search) {
    const q = options.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
  }

  const limit = options?.limit ? Math.min(100, Math.max(1, options.limit)) : undefined;
  const page = options?.page ? Math.max(1, options.page) : 1;
  const skip = limit ? (page - 1) * limit : undefined;

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: userSelectFields },
      },
      ...(limit !== undefined && { take: limit }),
      ...(skip !== undefined && { skip }),
    }),
    prisma.complaint.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit: limit ?? total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      hasMore: limit ? skip! + items.length < total : false,
    },
  };
};

export const getAdminComplaintStats = async () => {
  const [all, pending, accepted, resolved, rejected] = await Promise.all([
    prisma.complaint.count({ where: { deletedAt: null } }),
    prisma.complaint.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.complaint.count({ where: { status: "ACCEPTED", deletedAt: null } }),
    prisma.complaint.count({ where: { status: "RESOLVED", deletedAt: null } }),
    prisma.complaint.count({ where: { status: "REJECTED", deletedAt: null } }),
  ]);

  return { all, pending, accepted, resolved, rejected };
};

export const findComplaintById = async (id: string) => {
  return await prisma.complaint.findUnique({
    where: { id },
    include: {
      user: { select: userSelectFields },
    },
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
    include: {
      user: { select: userSelectFields },
    },
  });
};

export const deleteComplaintById = async (id: string) => {
  return await prisma.complaint.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
};
