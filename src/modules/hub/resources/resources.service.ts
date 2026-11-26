import { AppError } from "../../../utils/AppError";
import {
  PROJECT_ROOT_FOLDER,
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
} from "../../../lib/cloudinary";
import {
  assertActiveHub,
  dispatchHubNotification,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import * as resourcesRepository from "./resources.repository";
import { canRoleDeleteResource } from "./resources.domain";
import { CreateResourcePayload } from "./resources.schema";
import {
  assertNoNewCloudinaryAttachments,
  assertNoNewCloudinaryUrl,
  isCloudinaryUrl,
} from "../hub-attachments";
import { createHubNotifications } from "../../notification/notification.service";

export const createResourceService = async (
  userId: string,
  hubId: string,
  data: CreateResourcePayload,
) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
  ]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and cannot receive new materials.",
  );

  // Official materials can only be uploaded by active Teacher or CR
  if (!data.isStudentNote && !["TEACHER", "CR"].includes(member.role)) {
    throw new AppError(
      "Only Teachers and CRs can upload official course materials. As a student, please post under Student Shared Resources.",
      403,
    );
  }

  assertNoNewCloudinaryUrl(data.driveUrl);
  assertNoNewCloudinaryAttachments(data.attachments);

  const resource = await resourcesRepository.createResource(
    userId,
    hubId,
    data,
  );
  invalidateHubCaches(hubId);

  dispatchHubNotification(
    createHubNotifications(hubId, userId, {
      type: "MATERIAL",
      title: data.isStudentNote
        ? "New student-shared material"
        : "New course material",
      body: resource.title,
      route: `/hub/${hubId}?tab=materials`,
      dedupeKey: `resource:${resource.id}`,
    }),
    "hub.resource_notification_failed",
    hubId,
  );

  return resource;
};

export const getResourcesService = async (
  userId: string,
  hubId: string,
  filters?: { isStudentNote?: boolean; category?: string },
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT", "ADMIN"]);
  return resourcesRepository.findResourcesByHubId(hubId, filters);
};

export const deleteResourceService = async (
  userId: string,
  hubId: string,
  resourceId: string,
) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
  ]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and materials cannot be deleted.",
  );

  const resource = await resourcesRepository.findResourceById(resourceId);
  if (!resource || resource.hubId !== hubId) {
    throw new AppError("Resource not found", 404);
  }

  if (
    !canRoleDeleteResource({
      role: member.role,
      userId,
      uploaderId: resource.uploaderId,
      isStudentNote: resource.isStudentNote,
    })
  ) {
    throw new AppError("You do not have permission to delete this resource", 403);
  }

  const deleted = await resourcesRepository.deleteResourceById(resourceId);
  invalidateHubCaches(hubId);

  // Best-effort cleanup of any legacy Course Hub Cloudinary attachments after DB removal
  const hubsPrefix = `${PROJECT_ROOT_FOLDER}/hubs/`;
  const extractScopedHubPublicId = (url?: string | null): string | null => {
    if (!url || !isCloudinaryUrl(url)) return null;
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId || publicId.includes("..") || !publicId.startsWith(hubsPrefix)) {
      return null;
    }
    return publicId;
  };

  const legacyPublicIds = new Set<string>();
  if (Array.isArray(resource.attachments)) {
    for (const att of resource.attachments as Array<{ url?: string }>) {
      const publicId = extractScopedHubPublicId(att?.url);
      if (publicId) {
        legacyPublicIds.add(publicId);
      }
    }
  }
  const drivePublicId = extractScopedHubPublicId(resource.driveUrl);
  if (drivePublicId) {
    legacyPublicIds.add(drivePublicId);
  }

  if (legacyPublicIds.size > 0) {
    await Promise.allSettled(
      Array.from(legacyPublicIds).map((publicId) =>
        deleteFileFromCloudinary(publicId),
      ),
    );
  }

  return deleted;
};
