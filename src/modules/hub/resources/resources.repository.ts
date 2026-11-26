import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { MAX_HUB_RESOURCES_LIST } from "./resources.domain";
import { CreateResourcePayload } from "./resources.schema";

const resourceUploaderSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
  studentProfile: { select: { studentId: true, department: true } },
  teacherProfile: { select: { designation: true, department: true } },
} satisfies Prisma.UserSelect;

export const createResource = (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) =>
  prisma.resource.create({
    data: {
      hubId,
      uploaderId: userId,
      title: data.title,
      driveUrl: data.driveUrl || "https://drive.google.com",
      description: data.description,
      category: data.category,
      fileType: data.fileType,
      fileSize: data.fileSize,
      isStudentNote: data.isStudentNote || false,
      attachments: data.attachments
        ? (data.attachments as Prisma.InputJsonValue)
        : undefined,
      links: data.links ? (data.links as Prisma.InputJsonValue) : undefined,
    },
    include: {
      uploader: {
        select: resourceUploaderSelect,
      },
    },
  });

export const findResourceById = (resourceId: string) =>
  prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      uploader: { select: { id: true, name: true, role: true } },
    },
  });

export const deleteResourceById = (resourceId: string) =>
  prisma.resource.delete({
    where: { id: resourceId },
  });

export const findResourcesByHubId = (
  hubId: string,
  filters?: { isStudentNote?: boolean; category?: string },
) => {
  const where: Prisma.ResourceWhereInput = { hubId };
  if (filters?.isStudentNote !== undefined) {
    where.isStudentNote = filters.isStudentNote;
  }
  if (filters?.category && filters.category !== "ALL") {
    where.category = filters.category;
  }

  return prisma.resource.findMany({
    where,
    take: MAX_HUB_RESOURCES_LIST,
    include: {
      uploader: {
        select: resourceUploaderSelect,
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
