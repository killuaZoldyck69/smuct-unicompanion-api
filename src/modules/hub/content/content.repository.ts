import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  DEFAULT_ANNOUNCEMENTS_LIMIT,
  MAX_ANNOUNCEMENTS_LIMIT,
  MAX_COMMENTS_PER_ANNOUNCEMENT,
  MAX_DISCUSSION_REPLIES,
  MAX_DISCUSSIONS_LIMIT,
} from "./content.domain";
import {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  CreateDiscussionPayload,
} from "./content.schema";

const getAnnouncementCreatorSelect = (hubId: string) => ({
  id: true,
  name: true,
  image: true,
  role: true,
  hubs: {
    where: { hubId, isActive: true },
    select: { role: true },
  },
});

const getCommentsInclude = (hubId: string) => ({
  where: { parentId: null },
  take: MAX_COMMENTS_PER_ANNOUNCEMENT,
  include: {
    author: {
      select: {
        id: true,
        name: true,
        image: true,
        role: true,
        hubs: {
          where: { hubId, isActive: true },
          select: { role: true },
        },
      },
    },
    replies: {
      take: 50,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            hubs: {
              where: { hubId, isActive: true },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
  },
  orderBy: { createdAt: "asc" as const },
});

export const createHubAnnouncement = (
  userId: string,
  hubId: string,
  data: CreateAnnouncementPayload,
) =>
  prisma.hubAnnouncement.create({
    data: {
      hubId,
      creatorId: userId,
      content: data.content,
      attachedLinkUrl: data.attachedLinkUrl || null,
      attachedLinkTitle: data.attachedLinkTitle || null,
      attachments: data.attachments
        ? (data.attachments as Prisma.InputJsonValue)
        : undefined,
      links: data.links ? (data.links as Prisma.InputJsonValue) : undefined,
    },
    include: {
      creator: {
        select: getAnnouncementCreatorSelect(hubId),
      },
      comments: getCommentsInclude(hubId),
    },
  });

export const findAnnouncementById = (announcementId: string) =>
  prisma.hubAnnouncement.findUnique({
    where: { id: announcementId },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });

export const updateHubAnnouncement = (
  hubId: string,
  announcementId: string,
  data: UpdateAnnouncementPayload,
) =>
  prisma.hubAnnouncement.update({
    where: { id: announcementId },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.attachedLinkUrl !== undefined && {
        attachedLinkUrl: data.attachedLinkUrl || null,
      }),
      ...(data.attachedLinkTitle !== undefined && {
        attachedLinkTitle: data.attachedLinkTitle || null,
      }),
      ...(data.attachments !== undefined && {
        attachments:
          data.attachments === null
            ? Prisma.JsonNull
            : (data.attachments as Prisma.InputJsonValue),
      }),
      ...(data.links !== undefined && {
        links:
          data.links === null
            ? Prisma.JsonNull
            : (data.links as Prisma.InputJsonValue),
      }),
    },
    include: {
      creator: {
        select: getAnnouncementCreatorSelect(hubId),
      },
      comments: getCommentsInclude(hubId),
    },
  });

export const deleteHubAnnouncement = (announcementId: string) =>
  prisma.hubAnnouncement.delete({
    where: { id: announcementId },
  });

export const findAnnouncementsByHubId = async (
  hubId: string,
  pagination?: { page?: number; limit?: number },
) => {
  const limit = pagination?.limit
    ? Math.max(1, Math.min(MAX_ANNOUNCEMENTS_LIMIT, pagination.limit))
    : DEFAULT_ANNOUNCEMENTS_LIMIT;
  const page = pagination?.page ? Math.max(1, pagination.page) : 1;
  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    prisma.hubAnnouncement.findMany({
      where: { hubId },
      include: {
        creator: {
          select: getAnnouncementCreatorSelect(hubId),
        },
        comments: getCommentsInclude(hubId),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.hubAnnouncement.count({ where: { hubId } }),
  ]);

  return {
    announcements,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

export const createAnnouncementComment = (
  userId: string,
  hubId: string,
  announcementId: string,
  content: string,
  parentId?: string | null,
) =>
  prisma.announcementComment.create({
    data: {
      announcementId,
      authorId: userId,
      content,
      parentId: parentId || null,
    },
    include: {
      author: {
        select: getAnnouncementCreatorSelect(hubId),
      },
    },
  });

export const findCommentById = (commentId: string) =>
  prisma.announcementComment.findUnique({
    where: { id: commentId },
  });

export const updateAnnouncementComment = (
  hubId: string,
  commentId: string,
  content: string,
) =>
  prisma.announcementComment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: {
        select: getAnnouncementCreatorSelect(hubId),
      },
    },
  });

export const deleteAnnouncementComment = (commentId: string) =>
  prisma.announcementComment.delete({
    where: { id: commentId },
  });

export const createHubDiscussion = (
  userId: string,
  hubId: string,
  data: CreateDiscussionPayload,
) =>
  prisma.hubDiscussion.create({
    data: {
      hubId,
      authorId: userId,
      title: data.title,
      content: data.content,
    },
  });

export const findDiscussionById = (discussionId: string) =>
  prisma.hubDiscussion.findUnique({
    where: { id: discussionId },
    select: { id: true, hubId: true },
  });

export const createDiscussionReply = (
  userId: string,
  discussionId: string,
  content: string,
) =>
  prisma.hubDiscussionReply.create({
    data: { discussionId, authorId: userId, content },
  });

export const findDiscussionsByHubId = (hubId: string) =>
  prisma.hubDiscussion.findMany({
    where: { hubId },
    take: MAX_DISCUSSIONS_LIMIT,
    include: {
      replies: {
        take: MAX_DISCUSSION_REPLIES,
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
