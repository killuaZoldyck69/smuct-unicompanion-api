import { prisma } from "../../../lib/prisma";
import { CreateResourcePayload } from "./resources.schema";

export const createResource = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  return await prisma.resource.create({
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
      attachments: data.attachments ? (data.attachments as any) : undefined,
      links: data.links ? (data.links as any) : undefined,
    },
    include: {
      uploader: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          studentProfile: { select: { studentId: true, department: true } },
          teacherProfile: { select: { designation: true, department: true } },
        },
      },
    },
  });
};

export const findResourceById = async (resourceId: string) => {
  return await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      uploader: { select: { id: true, name: true, role: true } },
    },
  });
};

export const deleteResourceById = async (resourceId: string) => {
  return await prisma.resource.delete({
    where: { id: resourceId },
  });
};

export const findResourcesByHubId = async (
  hubId: string,
  filters?: { isStudentNote?: boolean; category?: string },
) => {
  const where: any = { hubId };
  if (filters?.isStudentNote !== undefined) {
    where.isStudentNote = filters.isStudentNote;
  }
  if (filters?.category && filters.category !== "ALL") {
    where.category = filters.category;
  }

  return await prisma.resource.findMany({
    where,
    include: {
      uploader: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          studentProfile: { select: { studentId: true, department: true } },
          teacherProfile: { select: { designation: true, department: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
