import { AppError } from "../../../utils/AppError";
import { deleteFileFromCloudinary } from "../../../lib/cloudinary";
import {
  assertActiveHub,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import * as resourcesRepository from "./resources.repository";
import { canRoleDeleteResource } from "./resources.domain";
import { CreateResourcePayload } from "./resources.schema";
import {
  assertNoNewCloudinaryAttachments,
  assertNoNewCloudinaryUrl,
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

  await createHubNotifications(hubId, userId, {
    type: "MATERIAL",
    title: data.isStudentNote
      ? "New student-shared material"
      : "New course material",
    body: resource.title,
    route: `/hub/${hubId}?tab=materials`,
    dedupeKey: `resource:${resource.id}`,
  });

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

  // Best-effort cleanup of any legacy Cloudinary attachments after DB removal
  const legacyUrls: string[] = [];
  if (Array.isArray(resource.attachments)) {
    for (const att of resource.attachments as Array<{ url?: string }>) {
      if (att?.url && att.url.includes("cloudinary.com")) {
        legacyUrls.push(att.url);
      }
    }
  }
  if (resource.driveUrl && resource.driveUrl.includes("cloudinary.com")) {
    legacyUrls.push(resource.driveUrl);
  }

  if (legacyUrls.length > 0) {
    await Promise.allSettled(
      legacyUrls.map((url) => deleteFileFromCloudinary(url)),
    );
  }

  return deleted;
};
