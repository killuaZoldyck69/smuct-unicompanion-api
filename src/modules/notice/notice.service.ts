import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateNoticePayload } from "./notice.schema";

export const createNoticeService = async (data: CreateNoticePayload) => {
  return await prisma.notice.create({
    data: {
      referenceNo: data.referenceNo,
      title: data.title,
      body: data.body,
      issuerName: data.issuerName,
      issuerDesignation: data.issuerDesignation,
      copyTo: data.copyTo || [],
    },
  });
};

export const getAllNoticesService = async () => {
  return await prisma.notice.findMany({
    orderBy: {
      createdAt: "desc", // Newest notices appear first
    },
  });
};

export const getNoticeByIdService = async (id: string) => {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!notice) {
    throw new AppError("Notice not found.", 404);
  }

  return notice;
};

export const deleteNoticeService = async (id: string) => {
  // Check if the notice exists before attempting to delete
  const existingNotice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }

  return await prisma.notice.delete({
    where: { id },
  });
};
