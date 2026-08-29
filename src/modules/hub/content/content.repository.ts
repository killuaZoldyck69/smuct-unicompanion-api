import { prisma } from "../../../lib/prisma";
import {
  CreateAnnouncementPayload,
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
    },
  });
};

export const findAnnouncementsByHubId = async (hubId: string) => {
  return await prisma.hubAnnouncement.findMany({
    where: { hubId },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      comments: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
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
