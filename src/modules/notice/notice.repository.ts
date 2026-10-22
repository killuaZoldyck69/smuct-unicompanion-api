import { prisma } from "../../lib/prisma";
import { CreateNoticePayload, UpdateNoticePayload } from "./notice.schema";

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

export const updateNoticeById = async (
  id: string,
  data: UpdateNoticePayload,
) => {
  return await prisma.notice.update({
    where: { id },
    data: {
      ...(data.referenceNo !== undefined ? { referenceNo: data.referenceNo } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
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
