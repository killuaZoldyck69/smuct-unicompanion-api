import { prisma } from "../../lib/prisma";
import { CreateNoticePayload } from "./notice.schema";

export const createNotice = async (data: CreateNoticePayload) => {
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

export const deleteNoticeById = async (id: string) => {
  return await prisma.notice.delete({
    where: { id },
  });
};
