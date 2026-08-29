import { prisma } from "../../lib/prisma";
import {
  CreateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

export const createComplaint = async (
  userId: string,
  data: CreateComplaintPayload,
) => {
  return await prisma.complaint.create({
    data: { ...data, userId },
  });
};

export const findComplaintsByUserId = async (
  userId: string,
  take = 100,
) => {
  return await prisma.complaint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
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
) => {
  return await prisma.complaint.update({
    where: { id },
    data: { status },
  });
};

export const deleteComplaintById = async (id: string) => {
  return await prisma.complaint.delete({
    where: { id },
  });
};
