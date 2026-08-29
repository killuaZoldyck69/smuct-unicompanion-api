import { prisma } from "../../../lib/prisma";
import { CreateResourcePayload } from "./resources.schema";

export const createResource = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  return await prisma.resource.create({
    data: {
      ...data,
      hubId,
      uploaderId: userId,
    },
  });
};

export const findResourcesByHubId = async (hubId: string) => {
  return await prisma.resource.findMany({
    where: { hubId },
    include: {
      uploader: { select: { id: true, name: true, image: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};
