import { verifyHubRole } from "../hub.service";
import * as contentRepository from "./content.repository";
import {
  CreateAnnouncementPayload,
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

export const getAnnouncements = async (hubId: string) => {
  return await contentRepository.findAnnouncementsByHubId(hubId);
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
