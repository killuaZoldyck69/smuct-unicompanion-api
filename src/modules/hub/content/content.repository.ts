import { prisma } from "../../../lib/prisma";
import {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  CreateDiscussionPayload,
} from "./content.schema";

export const createHubAnnouncement = async (
  userId: string,
  hubId: string,
  data: CreateAnnouncementPayload,
) => {
  return await prisma.hubAnnouncement.create({
    data: {
      hubId,
      creatorId: userId,
      content: data.content,
      attachedLinkUrl: data.attachedLinkUrl,
      attachedLinkTitle: data.attachedLinkTitle,
      attachments: data.attachments ? (data.attachments as any) : undefined,
      links: data.links ? (data.links as any) : undefined,
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          hubs: {
            where: { hubId },
            select: { role: true },
          },
        },
      },
      comments: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

export const findAnnouncementById = async (announcementId: string) => {
  return await prisma.hubAnnouncement.findUnique({
    where: { id: announcementId },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });
};

export const updateHubAnnouncement = async (
  announcementId: string,
  data: UpdateAnnouncementPayload,
) => {
  return await prisma.hubAnnouncement.update({
    where: { id: announcementId },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.attachedLinkUrl !== undefined && {
        attachedLinkUrl: data.attachedLinkUrl,
      }),
      ...(data.attachedLinkTitle !== undefined && {
        attachedLinkTitle: data.attachedLinkTitle,
      }),
      ...(data.attachments !== undefined && {
        attachments: data.attachments as any,
      }),
      ...(data.links !== undefined && { links: data.links as any }),
    },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      comments: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

export const deleteHubAnnouncement = async (announcementId: string) => {
  return await prisma.hubAnnouncement.delete({
    where: { id: announcementId },
  });
};

export const findAnnouncementsByHubId = async (
  hubId: string,
  pagination?: { page?: number; limit?: number },
) => {
  const page = pagination?.page ? Math.max(1, pagination.page) : undefined;
  const limit = pagination?.limit
    ? Math.max(1, Math.min(100, pagination.limit))
    : undefined;
  const skip = page && limit ? (page - 1) * limit : undefined;

  const [announcements, total] = await Promise.all([
    prisma.hubAnnouncement.findMany({
      where: { hubId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            hubs: {
              where: { hubId },
              select: { role: true },
            },
          },
        },
        comments: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(skip !== undefined && { skip }),
      ...(limit !== undefined && { take: limit }),
    }),
    prisma.hubAnnouncement.count({ where: { hubId } }),
  ]);

  return {
    announcements,
    total,
    page: page || 1,
    limit: limit || announcements.length,
    totalPages: limit ? Math.ceil(total / limit) : 1,
  };
};

export const createAnnouncementComment = async (
  userId: string,
  announcementId: string,
  content: string,
) => {
  return await prisma.announcementComment.create({
    data: { announcementId, authorId: userId, content },
  });
};

export const createHubDiscussion = async (
  userId: string,
  hubId: string,
  data: CreateDiscussionPayload,
) => {
  return await prisma.hubDiscussion.create({
    data: {
      hubId,
      authorId: userId,
      title: data.title,
      content: data.content,
    },
  });
};

export const createDiscussionReply = async (
  userId: string,
  discussionId: string,
  content: string,
) => {
  return await prisma.hubDiscussionReply.create({
    data: { discussionId, authorId: userId, content },
  });
};

export const findDiscussionsByHubId = async (hubId: string) => {
  return await prisma.hubDiscussion.findMany({
    where: { hubId },
    include: {
      replies: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};
