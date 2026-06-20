import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  CreateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

export const createComplaintService = async (
  userId: string,
  data: CreateComplaintPayload,
) => {
  return await prisma.complaint.create({
    data: { ...data, userId },
  });
};

export const getMyComplaintsService = async (userId: string) => {
  return await prisma.complaint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const getAllComplaintsService = async () => {
  return await prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
};

export const updateComplaintStatusService = async (
  id: string,
  status: UpdateComplaintStatusPayload["status"],
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw new AppError("Complaint not found", 404);

  return await prisma.complaint.update({
    where: { id },
    data: { status },
  });
};

export const deleteComplaintService = async (id: string) => {
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw new AppError("Complaint not found", 404);

  return await prisma.complaint.delete({ where: { id } });
};
