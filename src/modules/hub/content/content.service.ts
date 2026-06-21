import { prisma } from "../../../lib/prisma";
import { verifyHubRole } from "../hub.service";

// 1. Update createAnnouncement to accept link fields
export const createAnnouncement = async (
  userId: string,
  hubId: string,
  data: any,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await prisma.hubAnnouncement.create({
    data: { hubId, creatorId: userId, ...data }, // Spread includes the links
  });
};

export const getAnnouncements = async (hubId: string) => {
  return await prisma.hubAnnouncement.findMany({
    where: { hubId },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      comments: {
        // 👈 Added this to fetch comments!
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

// 3. Add the comment creation service
export const createAnnouncementComment = async (
  userId: string,
  hubId: string,
  announcementId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await prisma.announcementComment.create({
    data: { announcementId, authorId: userId, content },
  });
};

export const createDiscussion = async (
  userId: string,
  hubId: string,
  data: any,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await prisma.hubDiscussion.create({
    data: { hubId, authorId: userId, ...data },
  });
};

export const replyToDiscussion = async (
  userId: string,
  hubId: string,
  discussionId: string,
  content: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await prisma.hubDiscussionReply.create({
    data: { discussionId, authorId: userId, content },
  });
};

export const getDiscussions = async (hubId: string) => {
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

export const commentOnAnnouncement = async (
  userId: string,
  hubId: string,
  announcementId: string,
  content: string,
) => {
  // All hub members can comment on announcements
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);

  return await prisma.announcementComment.create({
    data: { announcementId, authorId: userId, content },
  });
};
