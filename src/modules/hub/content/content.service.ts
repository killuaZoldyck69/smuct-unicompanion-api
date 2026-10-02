import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as contentRepository from "./content.repository";
import {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  CreateDiscussionPayload,
} from "./content.schema";
import { appCache } from "../../../lib/cache";

export const createAnnouncement = async (
  userId: string,
  hubId: string,
  data: CreateAnnouncementPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
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
  const isTeacher = member.role === "TEACHER";
  if (!isCreator && !isTeacher) {
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
  parentId?: string | null,
) => {
  if (parentId) {
    await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

    const parentComment = await contentRepository.findCommentById(parentId);
    if (!parentComment || parentComment.announcementId !== announcementId) {
      throw new AppError("Parent comment not found for this announcement", 404);
    }

    if (parentComment.parentId) {
      throw new AppError("Replies can only be made to top-level comments", 400);
    }
  } else {
    await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  }

  const comment = await contentRepository.createAnnouncementComment(
    userId,
    announcementId,
    content,
    parentId,
  );

  appCache.delPattern(new RegExp(`^hub:${hubId}`));

  return comment;
};

export const editAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  commentId: string,
  content: string,
) => {
  const comment = await contentRepository.findCommentById(commentId);
  if (!comment || comment.announcementId !== announcementId) {
    throw new AppError("Comment not found for this announcement", 404);
  }

  if (comment.authorId !== userId) {
    throw new AppError("You can only edit your own comments", 403);
  }

  const updated = await contentRepository.updateAnnouncementComment(
    commentId,
    content,
  );

  appCache.delPattern(new RegExp(`^hub:${hubId}`));

  return updated;
};

export const removeAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  commentId: string,
) => {
  const comment = await contentRepository.findCommentById(commentId);
  if (!comment || comment.announcementId !== announcementId) {
    throw new AppError("Comment not found for this announcement", 404);
  }

  const isAuthor = comment.authorId === userId;
  if (!isAuthor) {
    // Hub teachers can moderate and delete any comment
    await verifyHubRole(userId, hubId, ["TEACHER"]);
  }

  await contentRepository.deleteAnnouncementComment(commentId);

  appCache.delPattern(new RegExp(`^hub:${hubId}`));

  return { success: true };
};
