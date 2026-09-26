import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as contentRepository from "./content.repository";
import {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  CreateDiscussionPayload,
} from "./content.schema";

export const createAnnouncement = async (
  userId: string,
  hubId: string,
  data: CreateAnnouncementPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await contentRepository.createHubAnnouncement(userId, hubId, data);
};

export const updateAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
  data: UpdateAnnouncementPayload,
) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA",
    "STUDENT",
  ]);
  const announcement = await contentRepository.findAnnouncementById(
    announcementId,
  );
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found", 404);
  }

  const isCreator = announcement.creatorId === userId;
  const isTeacher = member.role === "TEACHER";
  if (!isCreator && !isTeacher) {
    throw new AppError("You can only edit your own announcements", 403);
  }

  return await contentRepository.updateHubAnnouncement(announcementId, data);
};

export const deleteAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA",
    "STUDENT",
  ]);
  const announcement = await contentRepository.findAnnouncementById(
    announcementId,
  );
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found", 404);
  }

  const isCreator = announcement.creatorId === userId;
  const canModerate = ["TEACHER", "CR"].includes(member.role);
  if (!isCreator && !canModerate) {
    throw new AppError(
      "You do not have permission to delete this announcement",
      403,
    );
  }

  return await contentRepository.deleteHubAnnouncement(announcementId);
};

export const getAnnouncements = async (
  hubId: string,
  pagination?: { page?: number; limit?: number },
) => {
  return await contentRepository.findAnnouncementsByHubId(hubId, pagination);
};

export const createAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await contentRepository.createAnnouncementComment(
    userId,
    announcementId,
    content,
  );
};

export const createDiscussion = async (
  userId: string,
  hubId: string,
  data: CreateDiscussionPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await contentRepository.createHubDiscussion(userId, hubId, data);
};

export const replyToDiscussion = async (
  userId: string,
  hubId: string,
  discussionId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await contentRepository.createDiscussionReply(
    userId,
    discussionId,
    content,
  );
};

export const getDiscussions = async (hubId: string) => {
  return await contentRepository.findDiscussionsByHubId(hubId);
};

export const commentOnAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
  content: string,
) => {
  // All hub members can comment on announcements
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await contentRepository.createAnnouncementComment(
    userId,
    announcementId,
    content,
  );
};
