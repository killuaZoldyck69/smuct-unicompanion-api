import { prisma } from "../../../lib/prisma";
import { verifyHubRole } from "../hub.service";
import { CreateResourcePayload } from "./resources.schema";

export const createResourceService = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  // All members can upload resources (Teachers upload lectures, Students upload notes)
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await prisma.resource.create({
    data: {
      ...data,
      hubId,
      uploaderId: userId,
    },
  });
};

export const getResourcesService = async (hubId: string) => {
  return await prisma.resource.findMany({
    where: { hubId },
    include: {
      uploader: { select: { id: true, name: true, image: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};
