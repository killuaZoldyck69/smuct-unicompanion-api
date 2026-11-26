import {
  assertActiveHub,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as contentRepository from "./content.repository";
import {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  CreateDiscussionPayload,
} from "./content.schema";
import {
  MAX_COMMENT_LENGTH,
  MAX_DISCUSSION_CONTENT_LENGTH,
  MAX_DISCUSSION_REPLY_LENGTH,
  MAX_DISCUSSION_TITLE_LENGTH,
  sanitizePlainTextInput,
  validateAndSanitizeAnnouncementContent,
} from "./content.domain";
import { assertNoNewCloudinaryAttachments } from "../hub-attachments";
import { createHubNotifications } from "../../notification/notification.service";

export const createAnnouncement = async (
  userId: string,
  hubId: string,
  data: CreateAnnouncementPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and cannot receive new announcements.",
  );

  const sanitized = validateAndSanitizeAnnouncementContent(data.content);
  if (sanitized.error || !sanitized.cleanHtml || !sanitized.plainText) {
    throw new AppError(
      sanitized.error || "Announcement content cannot be empty.",
      400,
    );
  }

  assertNoNewCloudinaryAttachments(data.attachments);

  const announcement = await contentRepository.createHubAnnouncement(
    userId,
    hubId,
    {
      ...data,
      content: sanitized.cleanHtml,
      attachedLinkUrl: data.attachedLinkUrl?.trim() || null,
      attachedLinkTitle: data.attachedLinkTitle?.trim() || null,
    },
  );

  invalidateHubCaches(hubId);

  await createHubNotifications(hubId, userId, {
    type: "HUB_ANNOUNCEMENT",
    title: "New course hub announcement",
    body: sanitized.plainText.slice(0, 180),
    route: `/hub/${hubId}`,
    dedupeKey: `hub-announcement:${announcement.id}`,
  });

  return announcement;
};

export const updateAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
  data: UpdateAnnouncementPayload,
) => {
  const member = await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and announcements cannot be edited.",
  );

  const announcement =
    await contentRepository.findAnnouncementById(announcementId);
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found", 404);
  }

  const isCreator = announcement.creatorId === userId;
  const isTeacher = member.role === "TEACHER";
  if (!isCreator && !isTeacher) {
    throw new AppError("You can only edit your own announcements", 403);
  }

  let nextContent = data.content;
  if (data.content !== undefined) {
    const sanitized = validateAndSanitizeAnnouncementContent(data.content);
    if (sanitized.error || !sanitized.cleanHtml) {
      throw new AppError(
        sanitized.error || "Announcement content cannot be empty.",
        400,
      );
    }
    nextContent = sanitized.cleanHtml;
  }

  assertNoNewCloudinaryAttachments(
    data.attachments,
    announcement.attachments as { url?: string }[] | null,
  );

  const updated = await contentRepository.updateHubAnnouncement(
    hubId,
    announcementId,
    {
      ...data,
      ...(nextContent !== undefined && { content: nextContent }),
      ...(data.attachedLinkUrl !== undefined && {
        attachedLinkUrl: data.attachedLinkUrl?.trim() || null,
      }),
      ...(data.attachedLinkTitle !== undefined && {
        attachedLinkTitle: data.attachedLinkTitle?.trim() || null,
      }),
    },
  );

  invalidateHubCaches(hubId);
  return updated;
};

export const deleteAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
) => {
  const member = await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and announcements cannot be deleted.",
  );

  const announcement =
    await contentRepository.findAnnouncementById(announcementId);
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

  const deleted =
    await contentRepository.deleteHubAnnouncement(announcementId);
  invalidateHubCaches(hubId);
  return deleted;
};

export const getAnnouncements = async (
  userId: string,
  hubId: string,
  pagination?: { page?: number; limit?: number },
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT", "ADMIN"]);
  return contentRepository.findAnnouncementsByHubId(hubId, pagination);
};

export const createDiscussion = async (
  userId: string,
  hubId: string,
  data: CreateDiscussionPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and discussions are disabled.",
  );

  const cleanTitle = sanitizePlainTextInput(
    data.title,
    MAX_DISCUSSION_TITLE_LENGTH,
    "Discussion title",
  );
  if (cleanTitle.error || !cleanTitle.cleanText) {
    throw new AppError(cleanTitle.error || "Discussion title is required.", 400);
  }

  const cleanContent = sanitizePlainTextInput(
    data.content,
    MAX_DISCUSSION_CONTENT_LENGTH,
    "Discussion content",
  );
  if (cleanContent.error || !cleanContent.cleanText) {
    throw new AppError(
      cleanContent.error || "Discussion content cannot be empty.",
      400,
    );
  }

  const created = await contentRepository.createHubDiscussion(userId, hubId, {
    title: cleanTitle.cleanText,
    content: cleanContent.cleanText,
  });
  invalidateHubCaches(hubId);
  return created;
};

export const replyToDiscussion = async (
  userId: string,
  hubId: string,
  discussionId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and replies are disabled.",
  );

  const discussion = await contentRepository.findDiscussionById(discussionId);
  if (!discussion || discussion.hubId !== hubId) {
    throw new AppError("Discussion not found in this Course Hub.", 404);
  }

  const cleanReply = sanitizePlainTextInput(
    content,
    MAX_DISCUSSION_REPLY_LENGTH,
    "Reply content",
  );
  if (cleanReply.error || !cleanReply.cleanText) {
    throw new AppError(
      cleanReply.error || "Reply content cannot be empty.",
      400,
    );
  }

  const created = await contentRepository.createDiscussionReply(
    userId,
    discussionId,
    cleanReply.cleanText,
  );
  invalidateHubCaches(hubId);
  return created;
};

export const getDiscussions = async (userId: string, hubId: string) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT", "ADMIN"]);
  return contentRepository.findDiscussionsByHubId(hubId);
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
  } else {
    await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT"]);
  }

  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and comments are disabled.",
  );

  const announcement =
    await contentRepository.findAnnouncementById(announcementId);
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found in this Course Hub.", 404);
  }

  const cleanComment = sanitizePlainTextInput(
    content,
    MAX_COMMENT_LENGTH,
    "Comment",
  );
  if (cleanComment.error || !cleanComment.cleanText) {
    throw new AppError(
      cleanComment.error || "Comment content cannot be empty.",
      400,
    );
  }

  if (parentId) {
    const parentComment = await contentRepository.findCommentById(parentId);
    if (!parentComment || parentComment.announcementId !== announcementId) {
      throw new AppError("Parent comment not found for this announcement", 404);
    }

    if (parentComment.parentId) {
      throw new AppError("Replies can only be made to top-level comments", 400);
    }
  }

  const comment = await contentRepository.createAnnouncementComment(
    userId,
    hubId,
    announcementId,
    cleanComment.cleanText,
    parentId,
  );

  invalidateHubCaches(hubId);
  return comment;
};

export const editAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  commentId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and comments cannot be edited.",
  );

  const announcement =
    await contentRepository.findAnnouncementById(announcementId);
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found in this Course Hub.", 404);
  }

  const comment = await contentRepository.findCommentById(commentId);
  if (!comment || comment.announcementId !== announcementId) {
    throw new AppError("Comment not found for this announcement", 404);
  }

  if (comment.authorId !== userId) {
    throw new AppError("You can only edit your own comments", 403);
  }

  const cleanComment = sanitizePlainTextInput(
    content,
    MAX_COMMENT_LENGTH,
    "Comment",
  );
  if (cleanComment.error || !cleanComment.cleanText) {
    throw new AppError(
      cleanComment.error || "Comment content cannot be empty.",
      400,
    );
  }

  const updated = await contentRepository.updateAnnouncementComment(
    hubId,
    commentId,
    cleanComment.cleanText,
  );

  invalidateHubCaches(hubId);
  return updated;
};

export const removeAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  commentId: string,
) => {
  const member = await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and comments cannot be deleted.",
  );

  const announcement =
    await contentRepository.findAnnouncementById(announcementId);
  if (!announcement || announcement.hubId !== hubId) {
    throw new AppError("Announcement not found in this Course Hub.", 404);
  }

  const comment = await contentRepository.findCommentById(commentId);
  if (!comment || comment.announcementId !== announcementId) {
    throw new AppError("Comment not found for this announcement", 404);
  }

  const isAuthor = comment.authorId === userId;
  const isTeacher = member.role === "TEACHER";
  if (!isAuthor && !isTeacher) {
    throw new AppError("You can only delete your own comments", 403);
  }

  await contentRepository.deleteAnnouncementComment(commentId);

  invalidateHubCaches(hubId);
  return { success: true };
};
