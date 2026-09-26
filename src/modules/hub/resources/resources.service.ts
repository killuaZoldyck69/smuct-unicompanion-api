import { AppError } from "../../../utils/AppError";
import { deleteFileFromCloudinary } from "../../../lib/cloudinary";
import { verifyHubRole, getUserHubRole } from "../hub.service";
import * as resourcesRepository from "./resources.repository";
import { CreateResourcePayload } from "./resources.schema";

export const createResourceService = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  const role = await getUserHubRole(userId, hubId);
  if (!role) {
    throw new AppError("You are not a member of this hub", 403);
  }

  // Official materials can only be uploaded by Teacher, CR, or TA
  if (!data.isStudentNote && !["TEACHER", "CR", "TA"].includes(role)) {
    throw new AppError(
      "Only Teachers and CRs can upload official course materials. As a student, please post under Student Shared Resources.",
      403,
    );
  }

  return await resourcesRepository.createResource(userId, hubId, data);
};

export const getResourcesService = async (
  hubId: string,
  filters?: { isStudentNote?: boolean; category?: string },
) => {
  return await resourcesRepository.findResourcesByHubId(hubId, filters);
};

export const deleteResourceService = async (
  userId: string,
  hubId: string,
  resourceId: string,
) => {
  const resource = await resourcesRepository.findResourceById(resourceId);
  if (!resource || resource.hubId !== hubId) {
    throw new AppError("Resource not found", 404);
  }

  const role = await getUserHubRole(userId, hubId);
  const isUploader = resource.uploaderId === userId;
  const isPrivileged = role && ["TEACHER", "CR", "TA"].includes(role);

  if (!isUploader && !isPrivileged) {
    throw new AppError("You do not have permission to delete this resource", 403);
  }

  // Cleanup Cloudinary attachments if any
  if (Array.isArray(resource.attachments)) {
    for (const att of resource.attachments as any[]) {
      if (att.url) {
        await deleteFileFromCloudinary(att.url);
      }
    }
  }
  if (resource.driveUrl && resource.driveUrl.includes("cloudinary.com")) {
    await deleteFileFromCloudinary(resource.driveUrl);
  }

  return await resourcesRepository.deleteResourceById(resourceId);
};
